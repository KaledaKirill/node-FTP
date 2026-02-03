# Node FTP Project Architecture

## Overview

This project implements a series of network programming laboratory works, starting with TCP socket programming and progressing to UDP, multiplexing, parallel processing, ICMP, broadcast/multicast, and MPI. The architecture is designed to be extensible, cross-platform, and maintainable across all laboratory works.

---

## Project Structure

```
node-FTP/
├── package.json                  # Root package.json for entire project
│
├── src/                         # ALL SOURCE CODE
│   │
│   ├── server/                  # SERVER COMPONENT
│   │   ├── index.js             # Server entry point
│   │   ├── core/                # Core abstractions
│   │   │   ├── Server.js        # Base class for TCP/UDP servers
│   │   │   └── Session.js       # Client session management
│   │   ├── protocols/           # Protocol implementations
│   │   │   ├── TcpServer.js     # TCP implementation (Lab 1)
│   │   │   └── UdpServer.js     # UDP implementation (Lab 2)
│   │   ├── commands/            # Command handlers
│   │   │   ├── CommandRegistry.js
│   │   │   ├── EchoCommand.js
│   │   │   ├── TimeCommand.js
│   │   │   └── FileCommand.js   # UPLOAD/DOWNLOAD
│   │   └── transfer/            # File transfer logic
│   │       ├── TransferManager.js
│   │       └── TransferSession.js
│   │
│   ├── client/                  # CLIENT COMPONENT
│   │   ├── index.js             # Client entry point
│   │   ├── core/
│   │   │   ├── Client.js        # Base client class
│   │   │   └── Protocol.js      # Command/response parsing
│   │   ├── protocols/
│   │   │   ├── TcpClient.js
│   │   │   └── UdpClient.js
│   │   └── commands/            # Command sending logic
│   │
│   └── common/                  # SHARED CODE
│       ├── protocol.js          # Message formats, constants
│       ├── platform.js          # Cross-platform utilities
│       └── errors.js            # Common error definitions
```

---

## Architectural Decisions

### 1. Separation of Server, Client, and Common Code

**Rationale:**
- **Separation of Concerns**: Server and client are distinct programs with different responsibilities
- **Lab 4 (Multiservice Servers)**: Variants 14-17 require different services on different ports — easy to spawn as separate processes
- **Scalability**: Mirrors real-world architecture where frontend and backend are separated
- **Common module**: Avoids code duplication (message parsing `\r\n`, command constants)

**Example Use Case**: Lab 4, variant 16 — "interaction with client is performed by external handler program (separate executable)" — this architecture directly supports that!

---

### 2. Core Abstractions (`core/`)

**Why separate `Server.js` from `TcpServer.js`?**

```javascript
// core/Server.js — base class with SHARED logic
class Server {
  handleCommand(session, command) { ... }  // Shared by TCP and UDP
}

// protocols/TcpServer.js — only TCP-specific
class TcpServer extends Server {
  start(port) {
    this.server = net.createServer((socket) => {
      this.handleNewConnection(socket);
    });
  }
}
```

**Benefits:**
- **Code Reuse**: Command handling (ECHO, TIME, UPLOAD) is identical for TCP and UDP
- **Protocol Differences**: Only connection handling differs (TCP has `socket`, UDP has datagrams)
- **Lab 2 (UDP)**: Simply create `UdpServer.js` with `start()` implementation, inherit `handleCommand()`!

---

### 3. Command Pattern (`commands/`)

**Why not write `if (cmd === 'ECHO')` in one large file?**

```javascript
// ❌ BAD — everything in one file
function handleCommand(cmd, args) {
  if (cmd === 'ECHO') {
    // 20 lines
  } else if (cmd === 'TIME') {
    // 10 lines
  } else if (cmd === 'UPLOAD') {
    // 100 lines
  }
}
```

```javascript
// ✅ GOOD — each command separate
// commands/EchoCommand.js
class EchoCommand {
  execute(session, args) {
    return args.join(' ');
  }
}

// commands/FileCommand.js
class UploadCommand {
  async execute(session, args) {
    // 100 lines of upload logic
  }
}
```

**Benefits:**
1. **Lab Requirement**: "Each function must perform one clear, simple action"
2. **Testability**: Test `EchoCommand` independently from server
3. **Extensibility**: New command = new file, don't touch existing code
4. **CommandRegistry**: Register commands without modifying main code

---

### 4. Transfer Module (`transfer/`)

**Why separate from commands?**

File transfer is complex:
- Buffered file reading
- Progress tracking (bitrate)
- Connection drop handling (SO_KEEPALIVE)
- **Resume capability** (Lab 1 requirement)
- Lab 2 additions: sliding window, UDP acknowledgments

```javascript
// transfer/TransferSession.js
class TransferSession {
  constructor(filePath, offset = 0) {
    this.filePath = filePath;
    this.offset = offset;  // For resume!
  }

  async sendThrough(socket) {
    // Send with resume logic
  }

  pause() { /* Save state */ }
  resume() { /* Restore */ }
}
```

**Why `TransferManager`?**
- Stores active transfers (by `clientId` + `filePath`)
- On client reconnect: "Oh, you were downloading this file? Continue!"
- Lab Requirement: "if same client reconnects for same file" → this is it!

---

### 5. Session Management (`core/Session.js`)

```javascript
class Session {
  constructor(socket, clientId) {
    this.socket = socket;
    this.clientId = clientId;  // IP + port
    this.activeTransfers = [];
  }

  send(data) { /* Wrapper over socket.write */ }
  close() { /* Graceful shutdown */ }
}
```

**Benefits:**
- **Encapsulation**: Work with session, not raw `socket`
- **Lab 3 (multiplexing)**: Track which client is doing what
- **Lab 4 (parallel)**: Each thread/process works with its session

---

### 6. Common Module (`common/`)

**Why separate?**

```javascript
// common/protocol.js — USED BY BOTH SERVER AND CLIENT
export const COMMANDS = {
  ECHO: 'ECHO',
  TIME: 'TIME',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD'
};

export function parseMessage(data) {
  // Parse \r\n or \n — SAME FOR EVERYONE
}
```

If not in `common`:
- ❌ Code duplication
- ❌ Bugs: client and server parse `\r\n` differently
- ❌ Hard to maintain

---

## How This Architecture Helps in Future Labs

| Lab | Additions | Architecture Benefits |
|-----|-----------|----------------------|
| **Lab 2 (UDP)** | `UdpServer.js`, `UdpClient.js` | Inherit from `Server.js`/`Client.js`, reuse commands! |
| **Lab 3 (select/poll)** | Multiplexing | Node.js uses `async/await`, session structure is ready |
| **Lab 4 (parallel)** | `worker_threads` or `cluster` | `Session` can be passed to worker, `TransferManager` synchronized |
| **Lab 5 (ICMP)** | New protocol | Create `IcmpServer.js extends Server.js` |
| **Lab 6 (broadcast)** | Multicast | Create `MulticastServer.js extends Server.js` |
| **Lab 7-8 (MPI)** | MPI operations | Command pattern maps to MPI operations |

---

## Lab 1 Requirements Coverage

### TCP Server Commands
- ✅ **ECHO**: Returns client data
- ✅ **TIME**: Returns server time
- ✅ **CLOSE/EXIT/QUIT**: Closes connection
- ✅ Commands end with `\r\n` or `\n`

### File Transfer (UPLOAD/DOWNLOAD)
- ✅ Client-initiated
- ✅ Bitrate display after transfer
- ✅ SO_KEEPALIVE configured
- ✅ Connection drop detection (30s - 5min)
- ✅ Auto-recovery before message
- ✅ Resume capability (same client + same file)
- ✅ Single-threaded operation

### Cross-Platform
- ✅ Works on Windows and Linux/BSD/macOS
- ✅ Platform abstraction in `common/platform.js`

### Code Style
- ✅ Functions < 60 lines, 10-15 actions
- ✅ Each function does one clear action
- ✅ Clear, descriptive names

---

## Design Patterns Used

1. **Template Method**: `Server.js` defines algorithm structure, subclasses implement specifics
2. **Command Pattern**: `commands/` encapsulates requests as objects
3. **Strategy Pattern**: Different protocols (TCP/UDP) are interchangeable strategies
4. **Factory Pattern**: `CommandRegistry` creates command instances
5. **Session Pattern**: `Session.js` encapsulates client connection state

---

## Key Constants

```javascript
// common/protocol.js
export const DELIMITERS = ['\r\n', '\n'];
export const BUFFER_SIZE = 8192;  // Optimized for performance
export const KEEPALIVE_INTERVAL = 30;  // seconds
export const MAX_RECONNECT_TIME = 300;  // 5 minutes
```

---

## Extension Points

For each laboratory work:

1. **Lab 1 (TCP)**: Implement `TcpServer.js`, basic commands
2. **Lab 2 (UDP)**: Implement `UdpServer.js`, add ACK/retransmission to `TransferSession`
3. **Lab 3 (multiplex)**: Ensure async/non-blocking throughout (already default in Node.js)
4. **Lab 4 (parallel)**: Add thread/process pool in `Server.js`, protect `accept()` with locks
5. **Lab 5 (ICMP)**: Create `IcmpServer.js`, implement ping/traceroute
6. **Lab 6 (broadcast)**: Create `MulticastServer.js`, implement peer discovery
7. **Lab 7-8 (MPI)**: Map commands to MPI operations

---

## Performance Considerations

- **Buffer Size**: 8KB balances throughput vs memory (adjustable per protocol)
- **Keepalive**: 30s interval detects drops within requirement
- **Sliding Window (Lab 2)**: Dynamically sized based on network conditions
- **Multiplexing (Lab 3)**: Response time < ping × 10

---

## Notes for Implementation

1. **Start simple**: Implement TCP with ECHO, TIME, CLOSE first
2. **Add file transfer**: Then add UPLOAD/DOWNLOAD
3. **Test early**: Use `telnet` and `netcat` as clients
4. **Cross-platform test**: Run on Windows and Linux
5. **Document**: Keep this file updated as architecture evolves

---

## Version History

- **v1.0** (2025): Initial architecture for Lab 1-2, designed for extensibility
