import BaseCommand from './BaseCommand.js';
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

    // Приоритет: клиентский offset > сохраненное состояние сервера > 0
    const clientOffset = parseInt(args[1], 10) || 0;
    const resumeState = this.fileManager.getDownloadState(session.clientId, filename);

    let offset;
    if (clientOffset > 0) {
      // Клиент сообщает о размере локального файла
      offset = clientOffset;
    } else if (resumeState) {
      // Используем сохраненное состояние с сервера
      offset = resumeState.offset;
    } else {
      offset = 0;
    }

    session.setTransferState({
      type: 'download',
      filename,
      filePath,
      offset,
      fileSize,
      startTime: Date.now(),
      bytesSent: offset
    });

    const header = buildFileHeader(filename, fileSize, offset);

    // Отправляем заголовок файла БЕЗ текстового сообщения, чтобы не смешивать с данными
    session.sendRaw(header);

    // Не отправляем сообщение здесь, так как оно будет смешано с файловыми данными
    return null;
  }
}
