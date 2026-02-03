import BaseCommand from './BaseCommand.js';

export default class CloseCommand extends BaseCommand {
  constructor() {
    super('CLOSE');
  }

  async execute(session, args) {
    session.shouldClose = true;
    return 'Goodbye';
  }
}
