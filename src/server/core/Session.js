export default class Session {
  constructor(socket, clientId) {
    this.socket = socket;
    this.clientId = clientId;
    this.buffer = '';
    this.shouldClose = false;
    this.transferState = null;
  }

  send(data) {
    this.socket.write(data);
  }

  sendRaw(buffer) {
    this.socket.write(buffer);
  }

  close() {
    this.socket.end();
  }

  setTransferState(state) {
    this.transferState = state;
  }

  getTransferState() {
    return this.transferState;
  }

  clearTransferState() {
    this.transferState = null;
  }
}
