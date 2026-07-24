import fs from 'fs';

const filesToDelete = [
  'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/app/api/temp-sql-query/route.ts',
  'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/scratch/run_query.mjs'
];

filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Deleted: ${file}`);
  }
});

const dir = 'c:/Users/dgtll/OneDrive/Documents/ACCOUNTS.DGT.LLC/app/api/temp-sql-query';
if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
  fs.rmdirSync(dir);
  console.log(`Deleted empty dir: ${dir}`);
}
