const fs = require('fs');
const lines = fs.readFileSync('api-error-log.txt', 'utf8').split('\n');
console.log(lines.slice(-50).join('\n'));
