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
    this.isPaused = false;
    this.pauseCount = 0; // Track number of pauses for logging

    try {
      this.readStream = fs.createReadStream(this.state.filePath, {
        start: this.state.offset,
        highWaterMark: 256 * 1024 // 256KB chunks - better balance for network transfers
      });

      // Set up drain handler before starting to read
      this.session.socket.on('drain', () => {
        if (this.isPaused && this.isActive) {
          this.readStream.resume();
          this.isPaused = false;
        }
      });

      this.readStream.on('data', (chunk) => {
        // Check if socket is ready to accept more data
        const canWrite = this.session.socket.write(chunk);

        this.state.bytesSent += chunk.length;

        // Save progress state less frequently to reduce I/O
        if (this.state.bytesSent % (1024 * 1024) === 0 || this.state.bytesSent === this.state.fileSize) {
          this.fileManager.saveDownloadState(
            this.session.clientId,
            this.state.filename,
            this.state.bytesSent
          );
        }

        // If socket buffer is full, pause reading until drain event
        if (!canWrite) {
          this.readStream.pause();
          this.isPaused = true;
          this.pauseCount++;

          // Only log every 100 pauses to reduce log spam
          if (this.pauseCount % 100 === 0) {
            const progress = ((this.state.bytesSent / this.state.fileSize) * 100).toFixed(1);
            console.log(`[TcpDownloadHandler] ${this.session.clientId}: Flow control active - ${progress}% complete (${this.state.bytesSent}/${this.state.fileSize} bytes)`);
          }
        }
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

  async handleData(_data) {
    // Download doesn't handle incoming data from client
    // This is a no-op for downloads
  }

  complete() {
    // Remove drain event listener
    this.session.socket.removeAllListeners('drain');
    // Call parent complete
    super.complete();
  }

  async interrupt() {
    console.log(`[TcpDownloadHandler] ${this.session.clientId}: Download interrupted - ${this.state.filename}`);
    if (this.readStream) {
      this.readStream.destroy();
    }

    // Remove drain event listener
    this.session.socket.removeAllListeners('drain');

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
