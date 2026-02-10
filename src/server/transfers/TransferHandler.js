export default class TransferHandler {
  constructor(session, fileManager, transferState) {
    this.session = session;
    this.fileManager = fileManager;
    this.state = transferState;
    this.isActive = false;
  }

  async start() {
    throw new Error('TransferHandler.start() must be implemented by subclass');
  }

  async handleData(data) {
    throw new Error('TransferHandler.handleData() must be implemented by subclass');
  }

  async interrupt() {
    throw new Error('TransferHandler.interrupt() must be implemented by subclass');
  }

  complete() {
    console.log(`[TransferHandler] ${this.session.clientId}: Transfer completed - ${this.state.type} '${this.state.filename}'`);
    this.isActive = false;
    this.session.clearTransferState();
    this.fileManager.clearTransferState(this.session.clientId, this.state.filename);
  }

  cleanup() {
    console.log(`[TransferHandler] ${this.session.clientId}: Transfer cleanup - ${this.state?.type || 'unknown'}`);
    this.isActive = false;
  }
}
