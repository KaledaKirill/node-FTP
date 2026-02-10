export default class Session {
  constructor(socket, clientId) {
    this.socket = socket;
    this.clientId = clientId;
    this.buffer = '';
    this.shouldClose = false;
    this.transferState = null;
    this.transferHandler = null;
  }

  send(data) {
    console.log(`[Session] Sending to ${this.clientId}:`, data.trim());
    this.socket.write(data);
  }

  sendRaw(buffer) {
    console.log(`[Session] Sending raw data to ${this.clientId}: ${buffer.length} bytes`);
    this.socket.write(buffer);
  }

  close() {
    console.log(`[Session] Closing connection for client ${this.clientId}`);
    this.socket.end();
  }

  setTransferState(state) {
    this.transferState = state;
  }

  getTransferState() {
    return this.transferState;
  }

  clearTransferState() {
    console.log(`[Session] Clearing transfer state for ${this.clientId}`);
    this.transferState = null;
  }

  setTransferHandler(handler) {
    console.log(`[Session] Setting transfer handler for ${this.clientId}: ${handler?.constructor?.name}`);
    this.transferHandler = handler;
  }

  getTransferHandler() {
    return this.transferHandler;
  }

  clearTransferHandler() {
    if (this.transferHandler) {
      console.log(`[Session] Clearing transfer handler for ${this.clientId}`);
      this.transferHandler.cleanup();
      this.transferHandler = null;
    }
  }
}
