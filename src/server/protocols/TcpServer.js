import net from 'net';
import Server from '../core/Server.js';
import Session from '../core/Session.js';
import { parseMessages, parseCommand } from '../../common/protocol.js';

export default class TcpServer extends Server {
  constructor(fileManager) {
    super();
    this.server = null;
    this.sessions = new Map();
    this.fileManager = fileManager;
  }

  async start(port) {
    console.log(`[TcpServer] Starting TCP server on port ${port}`);
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`[TcpServer] New client connected: ${clientId}`);
      const session = new Session(socket, clientId);
      this.sessions.set(clientId, session);

      socket.setKeepAlive(true, 30000);

      socket.on('data', (data) => {
        this.handleData(session, data);
      });

      socket.on('close', async () => {
        console.log(`[TcpServer] Client disconnected: ${clientId}`);
        await this.handleTransferInterrupted(session);
        this.sessions.delete(clientId);
      });

      socket.on('error', async (err) => {
        console.error(`[TcpServer] Client ${clientId} error:`, err.message);
        await this.handleTransferInterrupted(session);
        this.sessions.delete(clientId);
      });
    });

    this.server.listen(port, () => {
      console.log(`[TcpServer] TCP Server listening on port ${port}`);
    });

    this.server.on('error', (err) => {
      console.error('[TcpServer] Server error:', err.message);
    });
  }

  async handleData(session, data) {
    if (this._hasActiveTransfer(session)) {
      await session.getTransferHandler().handleData(data);
      return;
    }

    await this._processCommands(session, data);
  }

  _hasActiveTransfer(session) {
    const handler = session.getTransferHandler();
    return handler && handler.isActive;
  }

  async _processCommands(session, data) {
    let remainingBinaryData = null;

    try {
      const dataStr = data.toString('latin1');
      const { buffer, commands } = parseMessages(session.buffer, dataStr);
      session.buffer = buffer;

      console.log(`[TcpServer] ${session.clientId}: Parsed ${commands.length} command(s) from data`);
      for (const cmd of commands) {
        const { name, args } = parseCommand(cmd);
        await this.handleCommand(session, name, args);

        if (session.shouldClose) {
          session.close();
          break;
        }

        if (this._hasActiveTransfer(session)) {
          console.log(`[TcpServer] ${session.clientId}: Transfer started, extracting binary data`);
          remainingBinaryData = this._extractBinaryData(data, dataStr, buffer);
          session.buffer = '';
          break;
        }
      }
    } catch (err) {
      console.error(`[TcpServer] ${session.clientId}: Error processing commands:`, err.message);
      session.send('Error: ' + err.message + '\r\n');
      return;
    }

    if (remainingBinaryData && this._hasActiveTransfer(session)) {
      console.log(`[TcpServer] ${session.clientId}: Sending remaining binary data to transfer handler (${remainingBinaryData.length} bytes)`);
      await session.getTransferHandler().handleData(remainingBinaryData);
    }
  }

  _extractBinaryData(rawData, dataStr, buffer) {
    const totalProcessed = dataStr.length - buffer.length;
    return rawData.slice(totalProcessed);
  }

  async handleTransferInterrupted(session) {
    console.log(`[TcpServer] ${session.clientId}: Handling interrupted transfer`);
    const transferHandler = session.getTransferHandler();

    if (transferHandler && transferHandler.isActive) {
      await transferHandler.interrupt();
    }

    session.clearTransferHandler();
    session.clearTransferState();
  }
}
