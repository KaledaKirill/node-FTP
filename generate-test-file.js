import fs from 'fs';
import path from 'path';

const FILE_SIZE = 64 * 1024 * 1024; // 2 GB in bytes
const CHUNK_SIZE = 1024 * 1024; // 1 MB chunks
const OUTPUT_FILE = './server-storage/test-file-2gb.txt';
const PROGRESS_INTERVAL = 100 * 1024 * 1024; // Report progress every 100 MB

async function generateTestFile() {
  console.log('='.repeat(60));
  console.log('Test File Generator');
  console.log('='.repeat(60));
  console.log(`Target file size: ${(FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`Chunk size: ${(CHUNK_SIZE / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let bytesWritten = 0;
  let chunksWritten = 0;
  let lastProgressTime = startTime;

  try {
    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create write stream
    const writeStream = fs.createWriteStream(OUTPUT_FILE);

    // Generate a pattern to repeat (more efficient than random data)
    // This creates a readable text pattern with line numbers
    const patternLines = [];
    for (let i = 0; i < 1000; i++) {
      patternLines.push(`Line ${i.toString().padStart(6, '0')}: This is test data for FTP transfer testing. `.repeat(10));
    }
    const patternString = patternLines.join('\n') + '\n';
    const patternBuffer = Buffer.from(patternString, 'utf8');

    console.log('Generating file...\n');

    const writeChunk = () => {
      return new Promise((resolve, reject) => {
        if (bytesWritten >= FILE_SIZE) {
          writeStream.end();
          resolve();
          return;
        }

        // Calculate remaining bytes to write
        const remainingBytes = FILE_SIZE - bytesWritten;
        const bytesToWrite = Math.min(CHUNK_SIZE, remainingBytes);

        // Build chunk by repeating the pattern
        const chunks = [];
        let chunkSize = 0;

        while (chunkSize < bytesToWrite) {
          const remaining = bytesToWrite - chunkSize;
          const toCopy = Math.min(patternBuffer.length, remaining);

          if (toCopy === patternBuffer.length) {
            chunks.push(patternBuffer);
          } else {
            chunks.push(patternBuffer.subarray(0, toCopy));
          }
          chunkSize += toCopy;
        }

        const chunkBuffer = Buffer.concat(chunks);

        // Write the chunk as text
        const canWrite = writeStream.write(chunkBuffer, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        bytesWritten += chunkBuffer.length;
        chunksWritten++;

        // Report progress
        if (chunksWritten % 100 === 0 || bytesWritten >= FILE_SIZE) {
          const elapsed = Date.now() - startTime;
          const speed = bytesWritten / (elapsed / 1000); // bytes per second
          const progress = (bytesWritten / FILE_SIZE * 100).toFixed(1);
          const eta = ((FILE_SIZE - bytesWritten) / speed).toFixed(0);

          process.stdout.write(
            `\rProgress: ${progress}% | ` +
            `${(bytesWritten / 1024 / 1024 / 1024).toFixed(2)} GB / ${(FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)} GB | ` +
            `Speed: ${(speed / 1024 / 1024).toFixed(2)} MB/s | ` +
            `ETA: ${eta}s`
          );
        }

        // Handle backpressure
        if (!canWrite) {
          writeStream.once('drain', () => {
            setImmediate(writeChunk);
            resolve();
          });
        } else {
          setImmediate(writeChunk);
          resolve();
        }
      });
    };

    // Start writing
    await writeChunk();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const avgSpeed = FILE_SIZE / duration / 1024 / 1024;

    console.log('\n' + '='.repeat(60));
    console.log('File generation completed!');
    console.log('='.repeat(60));
    console.log(`File: ${OUTPUT_FILE}`);
    console.log(`Size: ${(FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Average speed: ${avgSpeed.toFixed(2)} MB/s`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\nError generating file:', err.message);
    process.exit(1);
  }
}

// Run the generator
generateTestFile();
