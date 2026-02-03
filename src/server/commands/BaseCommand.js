export default class BaseCommand {
  constructor(name) {
    this.name = name;
  }

  async execute(session, args) {
    throw new Error(`Command ${this.name} must implement execute()`);
  }
}
