import net from 'net';
import fs from 'fs';
import Server from '../core/Server.js';
import Session from '../core/Session.js';
import { parseMessages, parseCommand } from '../../common/protocol.js';
import { parseFileHeader, formatBitrate, formatFileSize } from '../../common/fileTransfer.js';

export default class TcpServer extends Server {
  constructor(fileManager) {
    super();
    this.server = null;
    this.sessions = new Map();
    this.fileManager = fileManager;
  }

  async start(port) {
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      const session = new Session(socket, clientId);
      this.sessions.set(clientId, session);

      socket.setKeepAlive(true, 30000);

      socket.on('data', (data) => {
        this.handleData(session, data);
      });

      socket.on('close', () => {
        this.handleTransferInterrupted(session);
        this.sessions.delete(clientId);
      });

      socket.on('error', (err) => {
        console.error(`Client ${clientId} error:`, err.message);
        this.handleTransferInterrupted(session);
        this.sessions.delete(clientId);
      });
    });

    this.server.listen(port, () => {
      console.log(`TCP Server listening on port ${port}`);
    });
  }

  async handleData(session, data) {
    const transferState = session.getTransferState();

    if (transferState?.type === 'upload') {
      await this.handleFileUpload(session, data);
      return;
    }

    if (transferState?.type === 'download') {
      return;
    }

    let remainingBinaryData = null;

    try {
      const dataStr = data.toString('latin1');
      const { buffer, commands } = parseMessages(session.buffer, dataStr);
      session.buffer = buffer;

      for (const cmd of commands) {
        const { name, args } = parseCommand(cmd);
        await this.handleCommand(session, name, args);

        if (session.shouldClose) {
          session.close();
          break;
        }

        const newState = session.getTransferState();

        if (newState?.type === 'download') {
          await this.startFileDownload(session);
          return;
        }

        if (newState?.type === 'upload') {
          const totalProcessed = dataStr.length - buffer.length;
          remainingBinaryData = data.slice(totalProcessed);
          session.buffer = '';
          break;
        }
      }
    } catch (err) {
      session.send('Error: ' + err.message + '\r\n');
      return;
    }

    if (remainingBinaryData) {
      await this.handleFileUpload(session, remainingBinaryData);
    }
  }

  async handleFileUpload(session, data) {
    const state = session.getTransferState();

    if (!state.fileHandle) {
      const headerResult = parseFileHeader(Buffer.concat([state.headerBuffer || Buffer.alloc(0), data]));

      if (!headerResult) {
        state.headerBuffer = Buffer.concat([state.headerBuffer || Buffer.alloc(0), data]);
        return;
      }

      const { header, remaining } = headerResult;
      state.headerBuffer = null;
      state.fileSize = header.size;

      const clientOffset = header.resumeOffset || 0;

      if (clientOffset !== state.offset) {
        session.send(`Error: Offset mismatch. Server expects ${state.offset}, client sent ${clientOffset}\r\n`);
        this.fileManager.clearTransferState(session.clientId);
        session.clearTransferState();
        return;
      }

      state.resumeOffset = state.offset;

      const flags = state.resumeOffset > 0 ? 'r+' : 'w';
      state.fileHandle = fs.createWriteStream(state.filePath, { flags, start: state.resumeOffset });
      state.startTime = Date.now();

      if (remaining.length > 0) {
        state.fileHandle.write(remaining);
        state.bytesReceived = state.resumeOffset + remaining.length;
      }

      return;
    }

    state.fileHandle.write(data);
    state.bytesReceived += data.length;

    if (state.bytesReceived >= state.fileSize) {
      state.fileHandle.end();

      const endTime = Date.now();
      const bitrate = calcBitrate(state.startTime, endTime, state.bytesReceived);
      const message = `File uploaded: ${state.filename} (${formatFileSize(state.bytesReceived)}) - Speed: ${formatBitrate(bitrate)}`;

      session.send(message + '\r\n');
      this.fileManager.clearTransferState(session.clientId);
      session.clearTransferState();
    }
  }

  async startFileDownload(session) {
    const state = session.getTransferState();

    const readStream = fs.createReadStream(state.filePath, { start: state.offset });

    readStream.on('data', (chunk) => {
      session.sendRaw(chunk);
      state.bytesSent += chunk.length;

      this.fileManager.saveDownloadState(session.clientId, state.filename, state.bytesSent);
    });

    readStream.on('end', () => {
      if (session.getTransferState()) {
        // Перед завершением очищаем состояние
        this.fileManager.clearTransferState(session.clientId, state.filename);
        session.clearTransferState();
      }
    });

    readStream.on('error', (err) => {
      session.send('Error reading file: ' + err.message + '\r\n');
      this.fileManager.clearTransferState(session.clientId);
      session.clearTransferState();
    });
  }

  handleTransferInterrupted(session) {
    const state = session.getTransferState();

    if (!state) {
      return;
    }

    if (state.type === 'upload' && state.fileHandle) {
      state.fileHandle.end();

      if (state.bytesReceived > 0) {
        this.fileManager.saveUploadState(session.clientId, state.filename, state.filePath, state.bytesReceived);
      }
    }

    if (state.type === 'download') {
      const actualBytesSent = state.bytesSent > 0 ? state.bytesSent : state.offset;
      if (actualBytesSent > 0 && actualBytesSent < state.fileSize) {
        this.fileManager.saveDownloadState(session.clientId, state.filename, actualBytesSent);
      }
    }
  }
}

function calcBitrate(startTime, endTime, bytes) {
  const durationSeconds = (endTime - startTime) / 1000;

  if (durationSeconds <= 0) {
    return { bitrate: 0, unit: 'Mbps' };
  }

  const bitsPerSecond = (bytes * 8) / durationSeconds;

  if (bitsPerSecond >= 1_000_000) {
    return { bitrate: bitsPerSecond / 1_000_000, unit: 'Mbps' };
  } else if (bitsPerSecond >= 1000) {
    return { bitrate: bitsPerSecond / 1000, unit: 'Kbps' };
  } else {
    return { bitrate: bitsPerSecond, unit: 'bps' };
  }
}
