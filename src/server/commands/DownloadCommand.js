import BaseCommand from './BaseCommand.js';
import TcpDownloadHandler from '../transfers/TcpDownloadHandler.js';
import { buildFileHeader } from '../../common/fileTransfer.js';

export default class DownloadCommand extends BaseCommand {
  constructor(fileManager) {
    super('DOWNLOAD');
    this.fileManager = fileManager;
  }

  async execute(session, args) {
    const filename = args[0];

    if (!filename) {
      return 'Usage: DOWNLOAD <filename>';
    }

    if (!this.fileManager.fileExists(filename)) {
      return `Error: File '${filename}' not found`;
    }

    const filePath = this.fileManager.getFilePath(filename);
    const fileSize = this.fileManager.getFileSize(filename);

    const clientOffset = parseInt(args[1], 10) || 0;
    const resumeState = this.fileManager.getDownloadState(session.clientId, filename);

    let offset;
    if (clientOffset > 0) {
      offset = clientOffset;
    } else if (resumeState) {
      offset = resumeState.offset;
    } else {
      offset = 0;
    }

    const transferState = {
      type: 'download',
      filename,
      filePath,
      offset,
      fileSize,
      startTime: Date.now(),
      bytesSent: offset
    };

    const header = buildFileHeader(filename, fileSize, offset);
    session.sendRaw(header);

    const handler = new TcpDownloadHandler(session, this.fileManager, transferState);
    session.setTransferHandler(handler);
    session.setTransferState(transferState);

    await handler.start();

    return null;
  }
}
