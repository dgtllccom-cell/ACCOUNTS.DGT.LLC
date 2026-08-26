import fs from 'fs';

const src = fs.readFileSync('features/purchases/components/purchase-order-wizard.jsx', 'utf8');
const stack = [];
let i = 0;

const lineOf = (p) => src.slice(0, p).split(/\r?\n/).length;

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

function readTag() {
  const start = i;
  i++;
  let closing = false;
  if (src[i] === '/') {
    closing = true;
    i++;
  }

  let name = '';
  while (i < src.length && /[A-Za-z0-9_.:-]/.test(src[i])) {
    name += src[i++];
  }

  let quote = null;
  let self = false;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '>') {
      i++;
      break;
    }
    if (ch === '/' && src[i + 1] === '>') {
      self = true;
      i += 2;
      break;
    }
    i++;
  }

  return { closing, name, self, start };
}

while (i < src.length) {
  const ch = src[i];
  if (ch === '"' || ch === "'" || ch === '`') {
    skipQuoted(ch);
    continue;
  }
  if (ch === '<') {
    const next = src[i + 1];
    if (next === '!' || next === '?') {
      i += 2;
      continue;
    }
    const tag = readTag();
    if (!tag.name) continue;
    const line = lineOf(tag.start);
    if (tag.closing) {
      const last = stack.pop();
      if (last !== tag.name) {
        console.log('mismatch', JSON.stringify({ expected: last?.name, got: tag.name, pos: tag.start, line, expectedLine: last?.line }));
        break;
      }
    } else if (!tag.self) {
      stack.push({ name: tag.name, line });
    }
    continue;
  }
  i++;
}

console.log('stack length', stack.length);
console.log('top', JSON.stringify(stack.slice(-30)));
