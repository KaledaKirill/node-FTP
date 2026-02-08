import fs from 'fs';
import ClientTransferHandler from './ClientTransferHandler.js';
import { buildFileHeader, calcBitrate, formatBitrate, formatFileSize } from '../../common/fileTransfer.js';

export default class UploadHandler extends ClientTransferHandler {
  constructor(socket, filename, config) {
    super(socket, filename, config);
  }

  start() {
    this.isActive = true;

    const stats = fs.statSync(this.filename);
    this.fileSize = stats.size;
    const offset = this.config.offset || 0;

    const header = buildFileHeader(this.filename, this.fileSize, offset);
    this.socket.write(header);

    this.readStream = fs.createReadStream(this.filename, { start: offset });
    this.startTime = Date.now();
    this.bytesSent = 0;

    this.readStream.on('data', (chunk) => {
      this.socket.write(chunk);
      this.bytesSent += chunk.length;
    });

    this.readStream.on('end', () => {
      const endTime = Date.now();
      const bitrate = calcBitrate(this.startTime, endTime, this.bytesSent);
      console.log(`Upload complete: ${this.filename} (${formatFileSize(this.bytesSent)}) - Speed: ${formatBitrate(bitrate)}`);
      this.complete();
    });

    this.readStream.on('error', (err) => {
      console.error('Upload error:', err.message);
      this.abort();
    });
  }

  handleData(data) {
    // Upload doesn't receive data from server (except READY response handled separately)
    // This is a no-op for uploads
  }
}
