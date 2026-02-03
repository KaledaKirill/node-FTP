export default class Session {
  constructor(socket, clientId) {
    this.socket = socket;
    this.clientId = clientId;
    this.buffer = '';
    this.shouldClose = false;
  }

  send(data) {
    this.socket.write(data);
  }

  close() {
    this.socket.end();
  }
}
