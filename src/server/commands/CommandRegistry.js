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
      return `Error: Unknown command '${commandName}'`;
    }

    return await command.execute(session, args);
  }
}
