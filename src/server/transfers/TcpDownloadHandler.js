import fs from 'fs';
import TransferHandler from './TransferHandler.js';

export default class TcpDownloadHandler extends TransferHandler {
  constructor(session, fileManager, transferState) {
    super(session, fileManager, transferState);
    this.readStream = null;
  }

  async start() {
    this.isActive = true;
    this.state.startTime = Date.now();
    this.state.bytesSent = this.state.offset || 0;

    this.readStream = fs.createReadStream(this.state.filePath, {
      start: this.state.offset
    });

    this.readStream.on('data', (chunk) => {
      this.session.sendRaw(chunk);
      this.state.bytesSent += chunk.length;
      this.fileManager.saveDownloadState(
        this.session.clientId,
        this.state.filename,
        this.state.bytesSent
      );
    });

    this.readStream.on('end', () => {
      if (this.isActive) {
        this.complete();
      }
    });

    this.readStream.on('error', (err) => {
      this.session.send('Error reading file: ' + err.message + '\r\n');
      this.fileManager.clearTransferState(this.session.clientId);
      this.cleanup();
    });
  }

  async handleData(data) {
    // Download doesn't handle incoming data from client
    // This is a no-op for downloads
  }

  async interrupt() {
    if (this.readStream) {
      this.readStream.destroy();
    }

    const actualBytesSent = this.state.bytesSent > 0 ? this.state.bytesSent : this.state.offset;
    if (actualBytesSent > 0 && actualBytesSent < this.state.fileSize) {
      this.fileManager.saveDownloadState(
        this.session.clientId,
        this.state.filename,
        actualBytesSent
      );
    }
    this.cleanup();
  }
}
