import fs from 'fs';
import path from 'path';

try {
  const files = fs.readdirSync('C:/tmp');
  console.log('Files in C:/tmp:', files);
} catch (e) {
  console.error('Error reading C:/tmp:', e.message);
}
