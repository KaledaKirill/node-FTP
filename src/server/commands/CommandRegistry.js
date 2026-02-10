export default class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  register(command, ...aliases) {
    this.commands.set(command.name, command);

    for (const alias of aliases) {
      this.commands.set(alias.toUpperCase(), command);
    }
  }

  get(commandName) {
    return this.commands.get(commandName.toUpperCase());
  }

  has(commandName) {
    return this.commands.has(commandName.toUpperCase());
  }

  async execute(commandName, session, args) {
    const command = this.get(commandName);

    if (!command) {
      console.warn(`[CommandRegistry] Unknown command '${commandName}' from client ${session.clientId}`);
      return `Error: Unknown command '${commandName}'`;
    }

    try {
      const result = await command.execute(session, args);
      console.log(`[CommandRegistry] Command '${commandName}' executed successfully for client ${session.clientId}`);
      return result;
    } catch (error) {
      console.error(`[CommandRegistry] Error executing command '${commandName}' for client ${session.clientId}:`, error.message);
      return `Error: ${error.message}`;
    }
  }
}
