import BaseCommand from './BaseCommand.js';
import TcpUploadHandler from '../transfers/TcpUploadHandler.js';

export default class UploadCommand extends BaseCommand {
  constructor(fileManager, storageDir) {
    super('UPLOAD');
    this.fileManager = fileManager;
    this.storageDir = storageDir;
  }

  async execute(session, args) {
    const filename = args[0];

    if (!filename) {
      console.warn(`[UploadCommand] Missing filename argument from ${session.clientId}`);
      return 'Usage: UPLOAD <filename>';
    }

    console.log(`[UploadCommand] ${session.clientId}: Requested upload of '${filename}'`);

    const filePath = this.fileManager.getFilePath(filename);
    const existingSize = this.fileManager.getFileSize(filename) || 0;
    const resumeState = this.fileManager.getUploadState(session.clientId, filename);
    const offset = resumeState ? resumeState.offset : existingSize;

    if (resumeState) {
      console.log(`[UploadCommand] ${session.clientId}: Resuming upload from saved state: offset=${offset}`);
    } else if (existingSize > 0) {
      console.log(`[UploadCommand] ${session.clientId}: Appending to existing file: size=${existingSize}, offset=${offset}`);
    } else {
      console.log(`[UploadCommand] ${session.clientId}: Starting new file upload`);
    }

    const transferState = {
      type: 'upload',
      filename,
      filePath,
      offset,
      startTime: null,
      bytesReceived: offset
    };

    console.log(`[UploadCommand] ${session.clientId}: Initiating upload transfer - file: ${filename}, offset: ${offset}`);

    const handler = new TcpUploadHandler(session, this.fileManager, transferState);
    session.setTransferHandler(handler);
    session.setTransferState(transferState);

    await handler.start();

    return `READY ${offset}`;
  }
}
