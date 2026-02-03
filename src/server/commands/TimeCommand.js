import BaseCommand from './BaseCommand.js';

export default class TimeCommand extends BaseCommand {
  constructor() {
    super('TIME');
  }

  async execute(session, args) {
    return new Date().toISOString();
  }
}
