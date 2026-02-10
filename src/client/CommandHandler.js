import fs from 'fs';
import path from 'path';
import { parseCommand } from '../common/protocol.js';
import { formatFileSize } from '../common/fileTransfer.js';
import readline from 'readline';

const CLIENT_STORAGE_DIR = './client-storage';

export default class CommandHandler {
  constructor(client) {
    this.client = client;
    this.storageDir = path.resolve(CLIENT_STORAGE_DIR);
    this._ensureStorageDir();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this._setupCommandHandlers();
  }

  _ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log(`Created client storage directory: ${this.storageDir}`);
    }
  }

  _setupCommandHandlers() {
    this.rl.on('line', (input) => {
      const { name, args } = parseCommand(input);
      this._handleCommand(name, args, input);
    });
  }

  async _handleCommand(name, args, input) {
    switch (name) {
      case 'UPLOAD':
        await this._handleUpload(args);
        break;
      case 'DOWNLOAD':
        await this._handleDownload(args);
        break;
      case 'EXIT':
      case 'QUIT':
        this.client.disconnect();
        break;
      case 'CLOSE':
        this.client.disconnect();
        break;
      default:
        this.client.sendCommand(input);
    }
  }

  async _handleUpload(args) {
    const filename = args.join(' ');

    if (!filename) {
      console.log('Usage: UPLOAD <filename>');
      return;
    }

    const filePath = path.join(this.storageDir, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      console.log(`Error: File '${filename}' not found in client storage (${this.storageDir})`);
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.log(`Error: '${filename}' is a directory, not a file`);
      return;
    }

    const basename = path.basename(filename);
    this.client.sendCommand(`UPLOAD ${basename}`);
    this.client.setUpload({ filename: filePath, basename });
  }

  async _handleDownload(args) {
    const filename = args.join(' ');

    if (!filename) {
      console.log('Usage: DOWNLOAD <filename>');
      return;
    }

    const filePath = path.join(this.storageDir, path.basename(filename));

    // Check for resume
    let localSize = 0;
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (!stats.isDirectory()) {
        localSize = stats.size;
      }
    }

    if (localSize > 0) {
      this.client.sendCommand(`DOWNLOAD ${filename} ${localSize}`);
      console.log(`Requesting resume from ${formatFileSize(localSize)} (${localSize} bytes)`);
    } else {
      this.client.sendCommand(`DOWNLOAD ${filename}`);
    }

    this.client.setDownload({ filename: filePath });
  }

  close() {
    this.rl.close();
  }
}
