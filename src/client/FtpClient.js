import net from 'net';
import { parseMessages, parseCommand } from '../common/protocol.js';
import UploadHandler from './transfers/UploadHandler.js';
import DownloadHandler from './transfers/DownloadHandler.js';
import { formatFileSize } from '../common/fileTransfer.js';

export default class FtpClient {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.buffer = '';
    this.transferHandler = null;
    this.pendingUpload = null;
    this.onClose = null;
  }

  async connect() {
    return new Promise((resolve) => {
      this.socket = net.createConnection(this.port, this.host, () => {
        console.log(`Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('data', (data) => this._handleData(data));
      this.socket.on('close', () => this._handleClose());
      this.socket.on('error', (err) => this._handleError(err));
    });
  }

  sendCommand(cmd) {
    this.socket.write(cmd + '\r\n');
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }

  _handleData(data) {
    // If active transfer handler, delegate to it
    if (this.transferHandler && this.transferHandler.isActive) {
      this.transferHandler.handleData(data);
      return;
    }

    // Check if we have a pending download handler that's not yet active
    if (this.transferHandler && !this.transferHandler.isActive) {
      // Check if this is an error response from server
      const dataStr = data.toString('utf8');
      if (dataStr.trim().startsWith('Error:')) {
        // This is an error - parse and display it
        this._parseServerResponses(data);
        this.transferHandler = null;
        return;
      }
      // Otherwise treat as binary data (file download)
      this.transferHandler.isActive = true;
      this.transferHandler.handleData(data);
      return;
    }

    // Otherwise parse server responses
    this._parseServerResponses(data);
  }

  _parseServerResponses(data) {
    const { buffer, commands } = parseMessages(this.buffer, data.toString());
    this.buffer = buffer;

    for (const cmd of commands) {
      this._handleServerResponse(cmd);
    }
  }

  _handleServerResponse(cmd) {
    const { name, args } = parseCommand(cmd);

    if (name === 'READY') {
      this._handleReady(args);
    } else {
      console.log(`Server: ${cmd}`);
    }
  }

  _handleReady(args) {
    const offset = parseInt(args[0], 10) || 0;

    if (offset > 0) {
      console.log(`Server: READY to resume from offset ${formatFileSize(offset)} (${offset} bytes)`);
    } else {
      console.log(`Server: READY`);
    }

    if (this.pendingUpload) {
      this.transferHandler = new UploadHandler(
        this.socket,
        this.pendingUpload.filename,
        { offset }
      );
      this.transferHandler.onComplete = () => {
        this.transferHandler = null;
      };
      this.transferHandler.start();
      this.pendingUpload = null;
    }
  }

  setUpload(uploadInfo) {
    this.pendingUpload = uploadInfo;
  }

  setDownload(downloadInfo) {
    this.transferHandler = new DownloadHandler(
      this.socket,
      downloadInfo.filename,
      downloadInfo
    );
    this.transferHandler.onComplete = () => {
      this.transferHandler = null;
    };
    this.transferHandler.start();
  }

  _handleClose() {
    console.log('\nDisconnected from server');
    if (this.onClose) {
      this.onClose();
    }
  }

  _handleError(err) {
    console.error('Connection error:', err.message);
    if (this.onClose) {
      this.onClose();
    }
  }
}
