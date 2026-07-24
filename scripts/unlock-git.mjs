import fs from 'fs';

const lockFile = '.git/index.lock';
if (fs.existsSync(lockFile)) {
  try {
    fs.unlinkSync(lockFile);
    console.log('[✓] Successfully removed .git/index.lock file!');
  } catch (err) {
    console.error('Failed to remove lock file:', err.message);
  }
} else {
  console.log('[i] No .git/index.lock file found.');
}
