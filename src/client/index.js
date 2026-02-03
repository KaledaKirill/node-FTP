import net from 'net';
import { parseMessages } from '../common/protocol.js';
import readline from 'readline';

const HOST = process.argv[2] || 'localhost';
const PORT = parseInt(process.argv[3]) || 3000;

const socket = net.createConnection(PORT, HOST, () => {
  console.log(`Connected to ${HOST}:${PORT}`);
  console.log('Type commands (ECHO, TIME, EXIT) and press Enter\n');
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let buffer = '';

socket.on('data', (data) => {
  const { buffer: newBuffer, commands } = parseMessages(buffer, data.toString());
  buffer = newBuffer;

  for (const cmd of commands) {
    console.log(`Server: ${cmd}`);
  }
});

socket.on('close', () => {
  console.log('\nDisconnected from server');
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

rl.on('line', (input) => {
  socket.write(input + '\r\n');
});
