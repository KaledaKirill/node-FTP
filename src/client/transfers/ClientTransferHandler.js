export default class ClientTransferHandler {
  constructor(socket, filename, config) {
    this.socket = socket;
    this.filename = filename;
    this.config = config;
    this.isActive = false;
  }

  start() {
    throw new Error('ClientTransferHandler.start() must be implemented by subclass');
  }

  handleData(data) {
    throw new Error('ClientTransferHandler.handleData() must be implemented by subclass');
  }

  complete() {
    this.isActive = false;
  }

  abort() {
    this.isActive = false;
  }
}
