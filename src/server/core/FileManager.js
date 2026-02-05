import fs from 'fs';
import path from 'path';

export default class FileManager {
  constructor(storageDir) {
    this.storageDir = path.resolve(storageDir);
    this.pendingUploads = new Map();
    this.pendingDownloads = new Map();
    this.ensureStorageDir();
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getFilePath(filename) {
    const sanitized = path.basename(filename);
    return path.join(this.storageDir, sanitized);
  }

  fileExists(filename) {
    const filePath = this.getFilePath(filename);
    return fs.existsSync(filePath);
  }

  getFileSize(filename) {
    const filePath = this.getFilePath(filename);

    if (!this.fileExists(filename)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    return stats.size;
  }

  saveUploadState(clientId, filename, tempPath, offset) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    this.pendingUploads.set(key, {
      filename,
      tempPath,
      offset,
      timestamp: Date.now()
    });
  }

  getUploadState(clientId, filename) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    return this.pendingUploads.get(key) || null;
  }

  saveDownloadState(clientId, filename, offset) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    this.pendingDownloads.set(key, {
      offset,
      timestamp: Date.now()
    });
  }

  getDownloadState(clientId, filename) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    return this.pendingDownloads.get(key) || null;
  }

  clearTransferState(clientId, filename = null) {
    const ip = clientId.split(':')[0];

    if (filename) {
      this.pendingUploads.delete(`${ip}:${filename}`);
      this.pendingDownloads.delete(`${ip}:${filename}`);
    } else {
      for (const [key] of this.pendingUploads) {
        if (key.startsWith(ip + ':')) {
          this.pendingUploads.delete(key);
        }
      }
      for (const [key] of this.pendingDownloads) {
        if (key.startsWith(ip + ':')) {
          this.pendingDownloads.delete(key);
        }
      }
    }
  }

  cleanupOldTempFiles(maxAge = 3600000) {
    const now = Date.now();

    for (const [key, state] of this.pendingUploads) {
      if (now - state.timestamp > maxAge) {
        try {
          if (fs.existsSync(state.tempPath)) {
            fs.unlinkSync(state.tempPath);
          }
        } catch (err) {
          console.error(`Failed to cleanup temp file: ${err.message}`);
        }

        this.pendingUploads.delete(key);
      }
    }
  }
}
