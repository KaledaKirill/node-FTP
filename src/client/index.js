import FtpClient from './FtpClient.js';
import CommandHandler from './CommandHandler.js';

const HOST = process.argv[2] || 'localhost';
const PORT = parseInt(process.argv[3]) || 3000;

async function main() {
  const client = new FtpClient(HOST, PORT);
  await client.connect();

  console.log('Available commands: ECHO, TIME, UPLOAD <file>, DOWNLOAD <file>, EXIT\n');

  const cmdHandler = new CommandHandler(client);

  // Set up cleanup on exit
  client.onClose = () => {
    cmdHandler.close();
    process.exit(0);
  };
}

main().catch(err => {
  console.error('Failed to start client:', err);
  process.exit(1);
});
