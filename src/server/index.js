import TcpServer from './protocols/TcpServer.js';
import FileManager from './core/FileManager.js';
import EchoCommand from './commands/EchoCommand.js';
import TimeCommand from './commands/TimeCommand.js';
import CloseCommand from './commands/CloseCommand.js';
import UploadCommand from './commands/UploadCommand.js';
import DownloadCommand from './commands/DownloadCommand.js';

const PORT = process.env.PORT || 3000;
const STORAGE_DIR = process.env.STORAGE_DIR || './server-storage';

console.log('='.repeat(50));
console.log('[Server] Initializing FTP Server');
console.log(`[Server] Port: ${PORT}`);
console.log(`[Server] Storage directory: ${STORAGE_DIR}`);
console.log('='.repeat(50));

const fileManager = new FileManager(STORAGE_DIR);
const server = new TcpServer(fileManager);

console.log('[Server] Registering commands...');
server.registerCommand(new EchoCommand());
server.registerCommand(new TimeCommand());
server.registerCommand(new CloseCommand(), 'EXIT', 'QUIT');
server.registerCommand(new UploadCommand(fileManager, STORAGE_DIR));
server.registerCommand(new DownloadCommand(fileManager));

server.start(PORT);

process.on('SIGINT', () => {
  console.log('\n[Server] Received shutdown signal (SIGINT)');
  console.log('[Server] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received termination signal (SIGTERM)');
  console.log('[Server] Shutting down gracefully...');
  process.exit(0);
});

console.log('[Server] Server initialization complete');
console.log('='.repeat(50));
