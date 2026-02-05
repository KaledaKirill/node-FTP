import BaseCommand from './BaseCommand.js';

export default class UploadCommand extends BaseCommand {
  constructor(fileManager, storageDir) {
    super('UPLOAD');
    this.fileManager = fileManager;
    this.storageDir = storageDir;
  }

  async execute(session, args) {
    const filename = args[0];

    if (!filename) {
      return 'Usage: UPLOAD <filename>';
    }

    const filePath = this.fileManager.getFilePath(filename);
    const existingSize = this.fileManager.getFileSize(filename) || 0;
    const resumeState = this.fileManager.getUploadState(session.clientId, filename);
    const offset = resumeState ? resumeState.offset : existingSize;

    session.setTransferState({
      type: 'upload',
      filename,
      filePath,
      offset,
      startTime: null,
      bytesReceived: offset
    });

    return `READY ${offset}`;
  }
}
