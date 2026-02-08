import CommandRegistry from '../commands/CommandRegistry.js';

export default class Server {
  constructor() {
    this.commandRegistry = new CommandRegistry();
  }

  registerCommand(command, ...aliases) {
    this.commandRegistry.register(command, ...aliases);
  }

  async handleCommand(session, commandName, args) {
    const response = await this.commandRegistry.execute(commandName, session, args);
    if (response !== null && response !== undefined) {
      session.send(response + '\r\n');
    }
  }

  async start(port) {
    throw new Error('Server.start() must be implemented by subclass');
  }
}
