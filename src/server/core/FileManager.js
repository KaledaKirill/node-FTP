import fs from 'fs';
import path from 'path';

export default class FileManager {
  constructor(storageDir) {
    this.storageDir = path.resolve(storageDir);
    this.pendingUploads = new Map();
    this.pendingDownloads = new Map();
    this.ensureStorageDir();
    console.log(`[FileManager] Initialized with storage directory: ${this.storageDir}`);
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      console.log(`[FileManager] Creating storage directory: ${this.storageDir}`);
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getFilePath(filename) {
    const sanitized = path.basename(filename);
    return path.join(this.storageDir, sanitized);
  }

  fileExists(filename) {
    const filePath = this.getFilePath(filename);
    const exists = fs.existsSync(filePath);
    console.log(`[FileManager] Checking file '${filename}': ${exists ? 'exists' : 'not found'}`);
    return exists;
  }

  getFileSize(filename) {
    const filePath = this.getFilePath(filename);

    if (!this.fileExists(filename)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    console.log(`[FileManager] File '${filename}' size: ${stats.size} bytes`);
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
    console.log(`[FileManager] Saved upload state for '${filename}' from ${clientId}: offset=${offset}`);
  }

  getUploadState(clientId, filename) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    const state = this.pendingUploads.get(key) || null;
    if (state) {
      console.log(`[FileManager] Found upload state for '${filename}' from ${clientId}: offset=${state.offset}`);
    }
    return state;
  }

  saveDownloadState(clientId, filename, offset) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    this.pendingDownloads.set(key, {
      offset,
      timestamp: Date.now()
    });
    console.log(`[FileManager] Saved download state for '${filename}' from ${clientId}: offset=${offset}`);
  }

  getDownloadState(clientId, filename) {
    const ip = clientId.split(':')[0];
    const key = `${ip}:${filename}`;
    const state = this.pendingDownloads.get(key) || null;
    if (state) {
      console.log(`[FileManager] Found download state for '${filename}' from ${clientId}: offset=${state.offset}`);
    }
    return state;
  }

  clearTransferState(clientId, filename = null) {
    const ip = clientId.split(':')[0];

    if (filename) {
      this.pendingUploads.delete(`${ip}:${filename}`);
      this.pendingDownloads.delete(`${ip}:${filename}`);
      console.log(`[FileManager] Cleared transfer state for '${filename}' from ${clientId}`);
    } else {
      let count = 0;
      for (const [key] of this.pendingUploads) {
        if (key.startsWith(ip + ':')) {
          this.pendingUploads.delete(key);
          count++;
        }
      }
      for (const [key] of this.pendingDownloads) {
        if (key.startsWith(ip + ':')) {
          this.pendingDownloads.delete(key);
          count++;
        }
      }
      console.log(`[FileManager] Cleared ${count} transfer state(s) for ${clientId}`);
    }
  }

  cleanupOldTempFiles(maxAge = 3600000) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, state] of this.pendingUploads) {
      if (now - state.timestamp > maxAge) {
        try {
          if (fs.existsSync(state.tempPath)) {
            fs.unlinkSync(state.tempPath);
            console.log(`[FileManager] Cleaned up old temp file: ${state.tempPath}`);
          }
        } catch (err) {
          console.error(`[FileManager] Failed to cleanup temp file: ${err.message}`);
        }

        this.pendingUploads.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[FileManager] Cleanup completed: ${cleanedCount} old temp file(s) removed`);
    }
  }
}
