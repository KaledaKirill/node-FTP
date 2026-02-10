import fs from 'fs';
import TransferHandler from './TransferHandler.js';

export default class TcpDownloadHandler extends TransferHandler {
  constructor(session, fileManager, transferState) {
    super(session, fileManager, transferState);
    this.readStream = null;
  }

  async start() {
    console.log(`[TcpDownloadHandler] ${this.session.clientId}: Starting download - file: ${this.state.filename}, size: ${this.state.fileSize} bytes, offset: ${this.state.offset}`);
    this.isActive = true;
    this.state.startTime = Date.now();
    this.state.bytesSent = this.state.offset || 0;

    try {
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
          const duration = (Date.now() - this.state.startTime) / 1000;
          const speed = this.state.bytesSent / (duration || 1);
          console.log(`[TcpDownloadHandler] ${this.session.clientId}: Download completed - ${this.state.filename}, ${this.state.bytesSent} bytes sent in ${duration.toFixed(2)}s (${(speed / 1024).toFixed(2)} KB/s)`);
          this.complete();
        }
      });

      this.readStream.on('error', (err) => {
        console.error(`[TcpDownloadHandler] ${this.session.clientId}: Read stream error for ${this.state.filename}:`, err.message);
        this.session.send('Error reading file: ' + err.message + '\r\n');
        this.fileManager.clearTransferState(this.session.clientId);
        this.cleanup();
      });
    } catch (err) {
      console.error(`[TcpDownloadHandler] ${this.session.clientId}: Failed to start download:`, err.message);
      throw err;
    }
  }

  async handleData(data) {
    // Download doesn't handle incoming data from client
    // This is a no-op for downloads
  }

  async interrupt() {
    console.log(`[TcpDownloadHandler] ${this.session.clientId}: Download interrupted - ${this.state.filename}`);
    if (this.readStream) {
      this.readStream.destroy();
    }

    const actualBytesSent = this.state.bytesSent > 0 ? this.state.bytesSent : this.state.offset;
    if (actualBytesSent > 0 && actualBytesSent < this.state.fileSize) {
      console.log(`[TcpDownloadHandler] ${this.session.clientId}: Saving download state - offset: ${actualBytesSent}/${this.state.fileSize}`);
      this.fileManager.saveDownloadState(
        this.session.clientId,
        this.state.filename,
        actualBytesSent
      );
    }
    this.cleanup();
  }
}
