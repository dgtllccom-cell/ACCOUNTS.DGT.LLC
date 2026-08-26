import fs from 'fs';

const src = fs.readFileSync('features/purchases/components/purchase-order-wizard.jsx', 'utf8');
const stack = [];
let i = 0;

function skipQuoted(q) {
  i++;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === q) {
      i++;
      return;
    }
    i++;
  }
}

while (i < src.length) {
  const ch = src[i];
  if (ch === '"' || ch === "'" || ch === '`') {
    skipQuoted(ch);
    continue;
  }
  if (ch === '/' && src[i + 1] === '/') {
    while (i < src.length && src[i] !== '\n') i++;
    continue;
  }
  if (ch === '/' && src[i + 1] === '*') {
    i += 2;
    while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
    i += 2;
    continue;
  }
  if (ch === '(' || ch === '{' || ch === '[') stack.push({ ch, i });
  if (ch === ')' || ch === '}' || ch === ']') {
    const last = stack.pop();
    if (!last) {
      console.log('extra close', ch, 'at', i);
      process.exit(0);
    }
    const pairs = { '(': ')', '{': '}', '[': ']' };
    if (pairs[last.ch] !== ch) {
      console.log('mismatch', { expected: pairs[last.ch], got: ch, last });
      process.exit(0);
    }
  }
  i++;
}

console.log('remaining', stack.slice(-20).map((x) => ({ ch: x.ch, line: src.slice(0, x.i).split(/\r?\n/).length })));
