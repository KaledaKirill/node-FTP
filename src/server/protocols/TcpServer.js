import net from 'net';
import Server from '../core/Server.js';
import Session from '../core/Session.js';
import { parseMessages, parseCommand } from '../../common/protocol.js';

export default class TcpServer extends Server {
  constructor() {
    super();
    this.server = null;
    this.sessions = new Map();
  }

  async start(port) {
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      const session = new Session(socket, clientId);
      this.sessions.set(clientId, session);

      socket.on('data', (data) => {
        this.handleData(session, data.toString());
      });

      socket.on('close', () => {
        this.sessions.delete(clientId);
      });

      socket.on('error', (err) => {
        console.error(`Client ${clientId} error:`, err.message);
        this.sessions.delete(clientId);
      });
    });

    this.server.listen(port, () => {
      console.log(`TCP Server listening on port ${port}`);
    });
  }

  async handleData(session, data) {
    try {
      const { buffer, commands } = parseMessages(session.buffer, data);
      session.buffer = buffer;

      for (const cmd of commands) {
        const { name, args } = parseCommand(cmd);
        await this.handleCommand(session, name, args);

        if (session.shouldClose) {
          session.close();
          break;
        }
      }
    } catch (err) {
      session.send('Error: ' + err.message + '\r\n');
    }
  }
}
