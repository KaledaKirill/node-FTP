import BaseCommand from './BaseCommand.js';

export default class EchoCommand extends BaseCommand {
  constructor() {
    super('ECHO');
  }

  async execute(session, args) {
    return args.join(' ');
  }
}
