import fs from 'fs';

const content = fs.readFileSync('features/purchases/components/local-purchase-journal-report-view.tsx', 'utf8');

const tagRegex = /(<\/?[A-Za-z0-9_.-]+(?:\s+[^>]*?)?>)/gs;

let match;
const tags = [];

function getLineNumber(pos) {
    const sub = content.substring(0, pos);
    return sub.split('\n').length;
}

const matches = content.matchAll(tagRegex);
for (const m of matches) {
    const tagText = m[1];
    const index = m.index;
    const line = getLineNumber(index);
    
    if (tagText.endsWith('/>')) continue;
    if (tagText.startsWith('<!--')) continue;
    
    const isClosing = tagText.startsWith('</');
    const nameMatch = tagText.match(/<\/?([A-Za-z0-9_.-]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    
    if (name === '') continue;
    
    tags.push({ name, isClosing, line, text: tagText });
}

const htmlAndComponents = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 
    'button', 'svg', 'line', 'span', 'Fragment', 'Card', 'CardHeader', 'CardTitle', 'CardContent', 'Button',
    'Loader2', 'Coins', 'Globe', 'FileText', 'Printer', 'Send', 'Package', 'RefreshCw', 'Search', 'SimpleModal'
]);

const filteredTags = tags.filter(tag => htmlAndComponents.has(tag.name));

const stack = [];
console.log("Analyzing JSX tags...");
for (const tag of filteredTags) {
    const safeText = tag.text.replace(/</g, '[').replace(/>/g, ']');
    if (!tag.isClosing) {
        stack.push(tag);
    } else {
        if (stack.length === 0) {
            console.log(`Error: Extra closing tag [/${tag.name}] at line ${tag.line}`);
        } else {
            const last = stack.pop();
            if (last.name !== tag.name) {
                console.log(`Mismatch: Opened [${last.name}] at line ${last.line}, but closed [/${tag.name}] at line ${tag.line}`);
                stack.push(last);
            }
        }
    }
}

console.log("\nUnclosed tags remaining on stack:");
for (const tag of stack) {
    console.log(`  [${tag.name}] opened at line ${tag.line}`);
}
