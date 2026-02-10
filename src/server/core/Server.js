import CommandRegistry from '../commands/CommandRegistry.js';

export default class Server {
  constructor() {
    this.commandRegistry = new CommandRegistry();
  }

  registerCommand(command, ...aliases) {
    this.commandRegistry.register(command, ...aliases);
    const aliasList = aliases.length > 0 ? ` (aliases: ${aliases.join(', ')})` : '';
    console.log(`[Server] Command registered: ${command.name}${aliasList}`);
  }

  async handleCommand(session, commandName, args) {
    console.log(`[Server] Executing command '${commandName}' for client ${session.clientId} with args:`, args);
    const response = await this.commandRegistry.execute(commandName, session, args);
    if (response !== null && response !== undefined) {
      session.send(response + '\r\n');
    }
  }

  async start(port) {
    throw new Error('Server.start() must be implemented by subclass');
  }
}
