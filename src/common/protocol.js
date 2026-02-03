export const DELIMITERS = ['\r\n', '\n'];
export const MAX_BUFFER_SIZE = 64 * 1024;

export function parseMessages(buffer, newData) {
  buffer += newData;
  const commands = [];

  while (buffer.length > 0) {
    if (buffer.length > MAX_BUFFER_SIZE) {
      throw new Error('Buffer overflow: message too large without delimiter');
    }

    let delimiterIndex = -1;
    let usedDelimiter = null;

    for (const delimiter of DELIMITERS) {
      const index = buffer.indexOf(delimiter);
      if (index !== -1 && (delimiterIndex === -1 || index < delimiterIndex)) {
        delimiterIndex = index;
        usedDelimiter = delimiter;
      }
    }

    if (delimiterIndex === -1) {
      break;
    }

    const command = buffer.slice(0, delimiterIndex);
    buffer = buffer.slice(delimiterIndex + usedDelimiter.length);

    if (command.length > 0) {
      commands.push(command);
    }
  }

  return { buffer, commands };
}

export function parseCommand(command) {
  const parts = command.trim().split(/\s+/);
  const name = parts[0].toUpperCase();
  const args = parts.slice(1);
  return { name, args };
}

export function formatMessage(message, useCRLF = true) {
  return message + (useCRLF ? '\r\n' : '\n');
}
