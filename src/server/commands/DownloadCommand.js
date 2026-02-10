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
      console.warn(`[DownloadCommand] Missing filename argument from ${session.clientId}`);
      return 'Usage: DOWNLOAD <filename>';
    }

    console.log(`[DownloadCommand] ${session.clientId}: Requested download of '${filename}'`);

    const filePath = this.fileManager.getFilePath(filename);
    const fileSize = this.fileManager.getFileSize(filename);

    if (!fileSize) {
      console.warn(`[DownloadCommand] ${session.clientId}: File '${filename}' not found`);
      return `Error: File '${filename}' not found`;
    }

    const clientOffset = parseInt(args[1], 10) || 0;
    const resumeState = this.fileManager.getDownloadState(session.clientId, filename);

    let offset;
    if (clientOffset > 0) {
      offset = clientOffset;
      console.log(`[DownloadCommand] ${session.clientId}: Using client offset: ${offset}`);
    } else if (resumeState) {
      offset = resumeState.offset;
      console.log(`[DownloadCommand] ${session.clientId}: Resuming from saved state: offset=${offset}`);
    } else {
      offset = 0;
      console.log(`[DownloadCommand] ${session.clientId}: Starting fresh download from beginning`);
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

    console.log(`[DownloadCommand] ${session.clientId}: Initiating download transfer - file: ${filename}, size: ${fileSize} bytes, offset: ${offset}`);

    const header = buildFileHeader(filename, fileSize, offset);
    session.sendRaw(header);

    const handler = new TcpDownloadHandler(session, this.fileManager, transferState);
    session.setTransferHandler(handler);
    session.setTransferState(transferState);

    await handler.start();

    return null;
  }
}
