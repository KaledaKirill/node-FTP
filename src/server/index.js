import TcpServer from './protocols/TcpServer.js';
import EchoCommand from './commands/EchoCommand.js';
import TimeCommand from './commands/TimeCommand.js';
import CloseCommand from './commands/CloseCommand.js';

const PORT = process.env.PORT || 3000;

const server = new TcpServer();

server.registerCommand(new EchoCommand());
server.registerCommand(new TimeCommand());
server.registerCommand(new CloseCommand(), 'EXIT', 'QUIT');

server.start(PORT);

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});
