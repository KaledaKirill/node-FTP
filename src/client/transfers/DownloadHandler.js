import fs from 'fs';
import ClientTransferHandler from './ClientTransferHandler.js';
import { parseFileHeader, calcBitrate, formatBitrate, formatFileSize } from '../../common/fileTransfer.js';

export default class DownloadHandler extends ClientTransferHandler {
  constructor(socket, filename, config) {
    super(socket, filename, config);
    this.savePath = filename; // Store the full path where file should be saved
    this.headerBuffer = null;
    this.fileHandle = null;
  }

  start() {
    // Don't set isActive yet - wait for binary data to confirm successful download
    // Download doesn't need explicit start - waits for data from server
    this.headerBuffer = Buffer.alloc(0);
  }

  handleData(data) {
    // Mark handler as active once we receive binary data
    if (!this.isActive) {
      this.isActive = true;
    }

    if (!this.fileHandle) {
      // First phase: parse header
      if (!this.headerBuffer) {
        this.headerBuffer = data;
      } else {
        this.headerBuffer = Buffer.concat([this.headerBuffer, data]);
      }

      const result = parseFileHeader(this.headerBuffer);

      if (!result) {
        return; // Header not complete yet
      }

      const { header, remaining } = result;
      this.headerBuffer = null;
      this.filename = header.filename;
      this.fileSize = header.size;
      this.resumeOffset = header.resumeOffset || 0;
      this.bytesReceived = this.resumeOffset + remaining.length;
      this.startTime = Date.now();

      const flags = this.resumeOffset > 0 ? 'r+' : 'w';
      // Use savePath for the actual file location
      this.fileHandle = fs.createWriteStream(this.savePath, { flags, start: this.resumeOffset });

      if (remaining.length > 0) {
        this.fileHandle.write(remaining);
      }

      if (this.resumeOffset > 0) {
        console.log(`Resuming download from ${formatFileSize(this.resumeOffset)}`);
      }

      if (this.bytesReceived >= this.fileSize) {
        this._finalizeDownload();
      }

      return;
    }

    // Second phase: write data
    this.bytesReceived += data.length;
    this.fileHandle.write(data);

    if (this.bytesReceived >= this.fileSize) {
      this._finalizeDownload();
    }
  }

  _finalizeDownload() {
    this.fileHandle.end();

    const endTime = Date.now();
    const bytesDownloaded = this.bytesReceived - this.resumeOffset;
    const bitrate = calcBitrate(this.startTime, endTime, bytesDownloaded);
    console.log(`Download complete: ${this.savePath} (${formatFileSize(this.bytesReceived)}) - Speed: ${formatBitrate(bitrate)}`);

    this.complete();
  }
}
