import net from 'net';
import fs from 'fs';
import path from 'path';
import { parseMessages, parseCommand } from '../common/protocol.js';
import { buildFileHeader, parseFileHeader, formatBitrate, formatFileSize } from '../common/fileTransfer.js';
import readline from 'readline';

const HOST = process.argv[2] || 'localhost';
const PORT = parseInt(process.argv[3]) || 3000;

const socket = net.createConnection(PORT, HOST, () => {
  console.log(`Connected to ${HOST}:${PORT}`);
  console.log('Available commands: ECHO, TIME, UPLOAD <file>, DOWNLOAD <file>, EXIT\n');
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let buffer = '';
let downloadState = null;

socket.on('data', (data) => {
  if (downloadState) {
    const completed = handleFileData(data);
    if (completed) {
      downloadState = null;
    }
    return;
  }

  const { buffer: newBuffer, commands } = parseMessages(buffer, data.toString());
  buffer = newBuffer;

  for (const cmd of commands) {
    const { name, args } = parseCommand(cmd);

    if (name === 'READY') {
      const offset = parseInt(args[0], 10) || 0;

      if (offset > 0) {
        console.log(`Server: READY to resume from offset ${formatFileSize(offset)} (${offset} bytes)`);
      } else {
        console.log(`Server: ${cmd}`);
      }

      if (pendingUpload) {
        startFileUpload(pendingUpload, offset);
      }
    } else {
      console.log(`Server: ${cmd}`);
    }
  }
});

socket.on('close', () => {
  console.log('\nDisconnected from server');
  rl.close();
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('Connection error:', err.message);
  rl.close();
  process.exit(1);
});

let pendingUpload = null;

rl.on('line', (input) => {
  const { name, args } = parseCommand(input);

  if (name === 'UPLOAD') {
    const filename = args.join(' ');
    if (!filename) {
      console.log('Usage: UPLOAD <filename>');
      return;
    }

    if (!fs.existsSync(filename)) {
      console.log(`Error: File '${filename}' not found`);
      return;
    }

    const stats = fs.statSync(filename);
    if (stats.isDirectory()) {
      console.log(`Error: '${filename}' is a directory, not a file`);
      return;
    }

    const basename = path.basename(filename);
    pendingUpload = { filename, basename };
    socket.write(`UPLOAD ${basename}\r\n`);
    return;
  }

  if (name === 'DOWNLOAD') {
    const filename = args.join(' ');
    if (!filename) {
      console.log('Usage: DOWNLOAD <filename>');
      return;
    }

    // Проверяем существует ли файл локально для возобновления
    let localSize = 0;
    if (fs.existsSync(filename)) {
      const stats = fs.statSync(filename);
      if (!stats.isDirectory()) {
        localSize = stats.size;
      }
    }

    if (localSize > 0) {
      socket.write(`DOWNLOAD ${filename} ${localSize}\r\n`);
      console.log(`Requesting resume from ${formatFileSize(localSize)} (${localSize} bytes)`);
    } else {
      socket.write(`DOWNLOAD ${filename}\r\n`);
    }

    downloadState = { filename, buffer: null };
    return;
  }

  socket.write(input + '\r\n');
});

function startFileUpload(pending, offset = 0) {
  const { filename, basename } = pending;
  const stats = fs.statSync(filename);
  const fileSize = stats.size;

  const header = buildFileHeader(basename, fileSize, offset);
  socket.write(header);

  const readStream = fs.createReadStream(filename, { start: offset });
  const startTime = Date.now();
  let bytesSent = 0;

  readStream.on('data', (chunk) => {
    socket.write(chunk);
    bytesSent += chunk.length;
  });

  readStream.on('end', () => {
    const endTime = Date.now();
    const bitrate = calcBitrate(startTime, endTime, bytesSent);
    console.log(`Upload complete: ${basename} (${formatFileSize(bytesSent)}) - Speed: ${formatBitrate(bitrate)}`);
    pendingUpload = null;
  });

  readStream.on('error', (err) => {
    console.error('Upload error:', err.message);
    pendingUpload = null;
  });
}

function handleFileData(data) {
  if (!downloadState.fileHandle) {
    if (!downloadState.buffer) {
      downloadState.buffer = data;
    } else {
      downloadState.buffer = Buffer.concat([downloadState.buffer, data]);
    }

    const result = parseFileHeader(downloadState.buffer);

    if (!result) {
      return false;
    }

    const { header, remaining } = result;
    downloadState.buffer = null;
    downloadState.filename = header.filename;
    downloadState.fileSize = header.size;
    downloadState.resumeOffset = header.resumeOffset || 0;
    downloadState.bytesReceived = downloadState.resumeOffset + remaining.length;
    downloadState.startTime = Date.now();

    const flags = downloadState.resumeOffset > 0 ? 'r+' : 'w';
    downloadState.fileHandle = fs.createWriteStream(downloadState.filename, { flags, start: downloadState.resumeOffset });

    if (remaining.length > 0) {
      downloadState.fileHandle.write(remaining);
    }

    if (downloadState.resumeOffset > 0) {
      console.log(`Resuming download from ${formatFileSize(downloadState.resumeOffset)}`);
    }

    if (downloadState.bytesReceived >= downloadState.fileSize) {
      downloadState.fileHandle.end();

      const endTime = Date.now();
      const bytesDownloaded = downloadState.bytesReceived - downloadState.resumeOffset;
      const bitrate = calcBitrate(downloadState.startTime, endTime, bytesDownloaded);
      console.log(`Download complete: ${downloadState.filename} (${formatFileSize(downloadState.bytesReceived)}) - Speed: ${formatBitrate(bitrate)}`);

      return true;
    }

    return false;
  }

  downloadState.bytesReceived += data.length;
  downloadState.fileHandle.write(data);

  if (downloadState.bytesReceived >= downloadState.fileSize) {
    downloadState.fileHandle.end();

    const endTime = Date.now();
    const bytesDownloaded = downloadState.bytesReceived - downloadState.resumeOffset;
    const bitrate = calcBitrate(downloadState.startTime, endTime, bytesDownloaded);
    console.log(`Download complete: ${downloadState.filename} (${formatFileSize(downloadState.bytesReceived)}) - Speed: ${formatBitrate(bitrate)}`);

    return true;
  }

  return false;
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
