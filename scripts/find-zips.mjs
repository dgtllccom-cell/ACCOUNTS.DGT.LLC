import fs from 'fs';
import path from 'path';

const targets = ['ACCOUNTS.DGT.LLC-main(2).zip', 'dht-nextjs-main(2).zip', 'vigilant-adventure-main(2).zip'];
const searchDirs = [
  'C:\\Users\\dgtll\\Downloads',
  'C:\\Users\\dgtll\\OneDrive\\Documents',
  'C:\\Users\\dgtll\\OneDrive\\Desktop',
  'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC',
  'C:\\Users\\dgtll\\OneDrive\\Documents\\Daman ERP Backups',
  'C:\\Users\\dgtll'
];

searchDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        if (f.endsWith('.zip') || f.includes('main')) {
          console.log('FOUND MATCH:', path.join(dir, f));
        }
      });
    } catch(e) {
      console.error('Error reading dir:', dir, e.message);
    }
  }
});
