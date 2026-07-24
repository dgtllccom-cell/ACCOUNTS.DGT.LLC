const fs = require('fs');
const path = require('path');

const logPath = path.join(process.cwd(), 'api-error-log.txt');
if (!fs.existsSync(logPath)) {
  console.log("Log file does not exist");
  process.exit(0);
}

const stats = fs.statSync(logPath);
const size = stats.size;
const bufferSize = Math.min(size, 20000); // last 20KB
const fd = fs.openSync(logPath, 'r');
const buffer = Buffer.alloc(bufferSize);

fs.readSync(fd, buffer, 0, bufferSize, size - bufferSize);
fs.closeSync(fd);

console.log(buffer.toString('utf8'));
