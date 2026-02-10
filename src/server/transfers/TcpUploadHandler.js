import fs from 'fs';
import TransferHandler from './TransferHandler.js';
import { parseFileHeader, calcBitrate, formatFileSize, formatBitrate } from '../../common/fileTransfer.js';

export default class TcpUploadHandler extends TransferHandler {
  constructor(session, fileManager, transferState) {
    super(session, fileManager, transferState);
    this.headerBuffer = Buffer.alloc(0);
  }

  async start() {
    console.log(`[TcpUploadHandler] ${this.session.clientId}: Starting upload handler for ${this.state.filename}, offset: ${this.state.offset}`);
    this.isActive = true;
    this.state.startTime = this.state.startTime || Date.now();
    this.state.bytesReceived = this.state.offset || 0;
  }

  async handleData(data) {
    if (!this.state.fileHandle) {
      await this._initializeFileStream(data);
    } else {
      await this._writeDataChunk(data);
    }
  }

  async _initializeFileStream(data) {
    const headerResult = parseFileHeader(
      Buffer.concat([this.headerBuffer, data])
    );

    if (!headerResult) {
      console.log(`[TcpUploadHandler] ${this.session.clientId}: Waiting for complete header (${this.headerBuffer.length + data.length} bytes buffered)`);
      this.headerBuffer = Buffer.concat([this.headerBuffer, data]);
      return;
    }

    const { header, remaining } = headerResult;
    this.headerBuffer = Buffer.alloc(0);
    this.state.fileSize = header.size;

    console.log(`[TcpUploadHandler] ${this.session.clientId}: Received file header - name: ${header.filename}, size: ${header.size}, resumeOffset: ${header.resumeOffset || 0}`);

    const clientOffset = header.resumeOffset || 0;

    if (clientOffset !== this.state.offset) {
      const errorMsg = `Offset mismatch. Server expects ${this.state.offset}, client sent ${clientOffset}`;
      console.error(`[TcpUploadHandler] ${this.session.clientId}: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    this.state.resumeOffset = this.state.offset;
    const flags = this.state.resumeOffset > 0 ? 'r+' : 'w';
    this.state.fileHandle = fs.createWriteStream(this.state.filePath, {
      flags,
      start: this.state.resumeOffset
    });

    console.log(`[TcpUploadHandler] ${this.session.clientId}: File stream opened - flags: ${flags}, start: ${this.state.resumeOffset}`);

    if (remaining.length > 0) {
      await this._writeDataChunk(remaining);
    }
  }

  async _writeDataChunk(data) {
    this.state.fileHandle.write(data);
    this.state.bytesReceived += data.length;
    const progress = ((this.state.bytesReceived / this.state.fileSize) * 100).toFixed(1);
    console.log(`[TcpUploadHandler] ${this.session.clientId}: Received chunk - ${this.state.bytesReceived}/${this.state.fileSize} bytes (${progress}%)`);

    if (this.state.bytesReceived >= this.state.fileSize) {
      await this._finalizeUpload();
    }
  }

  async _finalizeUpload() {
    console.log(`[TcpUploadHandler] ${this.session.clientId}: Finalizing upload - ${this.state.filename}, ${this.state.bytesReceived} bytes`);
    this.state.fileHandle.end();

    const endTime = Date.now();
    const bitrate = calcBitrate(
      this.state.startTime,
      endTime,
      this.state.bytesReceived
    );

    const message = `File uploaded: ${this.state.filename} (${formatFileSize(this.state.bytesReceived)}) - Speed: ${formatBitrate(bitrate)}`;
    console.log(`[TcpUploadHandler] ${this.session.clientId}: ${message}`);
    this.session.send(message + '\r\n');
    this.complete();
  }

  async interrupt() {
    console.log(`[TcpUploadHandler] ${this.session.clientId}: Upload interrupted - ${this.state.filename}, received: ${this.state.bytesReceived} bytes`);
    if (this.state.fileHandle) {
      this.state.fileHandle.end();

      if (this.state.bytesReceived > 0) {
        console.log(`[TcpUploadHandler] ${this.session.clientId}: Saving upload state - offset: ${this.state.bytesReceived}`);
        this.fileManager.saveUploadState(
          this.session.clientId,
          this.state.filename,
          this.state.filePath,
          this.state.bytesReceived
        );
      }
    }
    this.cleanup();
  }
}
