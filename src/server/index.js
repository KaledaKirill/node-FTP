import TcpServer from './protocols/TcpServer.js';
import FileManager from './core/FileManager.js';
import EchoCommand from './commands/EchoCommand.js';
import TimeCommand from './commands/TimeCommand.js';
import CloseCommand from './commands/CloseCommand.js';
import UploadCommand from './commands/UploadCommand.js';
import DownloadCommand from './commands/DownloadCommand.js';

const PORT = process.env.PORT || 3000;
const STORAGE_DIR = process.env.STORAGE_DIR || './storage';

const fileManager = new FileManager(STORAGE_DIR);
const server = new TcpServer(fileManager);

server.registerCommand(new EchoCommand());
server.registerCommand(new TimeCommand());
server.registerCommand(new CloseCommand(), 'EXIT', 'QUIT');
server.registerCommand(new UploadCommand(fileManager, STORAGE_DIR));
server.registerCommand(new DownloadCommand(fileManager));

server.start(PORT);

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});
