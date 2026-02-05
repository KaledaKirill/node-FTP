const HEADER_DELIMITER = '\r\n\r\n';
const MAX_FILENAME_LENGTH = 255;

export function buildFileHeader(filename, size, resumeOffset = 0) {
  if (!filename || filename.length > MAX_FILENAME_LENGTH) {
    throw new Error(`Invalid filename: max ${MAX_FILENAME_LENGTH} chars`);
  }

  if (size < 0) {
    throw new Error('Invalid file size');
  }

  if (resumeOffset < 0) {
    throw new Error('Invalid resume offset');
  }

  let header = `SIZE:${size}\r\n`;
  header += `NAME:${filename}\r\n`;

  if (resumeOffset > 0) {
    header += `RESUME:${resumeOffset}\r\n`;
  }

  header += '\r\n';

  return header;
}

export function parseFileHeader(buffer) {
  const headerEndIndex = buffer.indexOf(HEADER_DELIMITER);

  if (headerEndIndex === -1) {
    return null;
  }

  const headerText = buffer.slice(0, headerEndIndex).toString();
  const remaining = buffer.slice(headerEndIndex + HEADER_DELIMITER.length);

  const lines = headerText.split('\r\n');
  const header = {};

  for (const line of lines) {
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid header line: ${line}`);
    }

    const key = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    if (key === 'SIZE') {
      header.size = parseInt(value, 10);
    } else if (key === 'NAME') {
      header.filename = value;
    } else if (key === 'RESUME') {
      header.resumeOffset = parseInt(value, 10);
    }
  }

  if (header.size === undefined || !header.filename) {
    throw new Error('Invalid file header: missing SIZE or NAME');
  }

  return { header, remaining: remaining };
}

export function calcBitrate(startTime, endTime, bytes) {
  const durationSeconds = (endTime - startTime) / 1000;

  if (durationSeconds <= 0) {
    return { bitrate: 0, unit: 'MB/s' };
  }

  const bitsPerSecond = (bytes * 8) / durationSeconds;

  if (bitsPerSecond >= 1_000_000) {
    return { bitrate: bitsPerSecond / 1_000_000, unit: 'Mbps' };
  } else if (bitsPerSecond >= 1000) {
    return { bitrate: bitsPerSecond / 1000, unit: 'Kbps' };
  } else {
    return { bitrate: bitsPerSecond, unit: 'bps' };
  }
}

export function formatBitrate(bitrateObj) {
  return `${bitrateObj.bitrate.toFixed(2)} ${bitrateObj.unit}`;
}

export function formatFileSize(bytes) {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  } else if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}
