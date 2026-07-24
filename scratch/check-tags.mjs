import fs from 'fs';

const content = fs.readFileSync('features/purchases/components/local-purchase-journal-report-view.tsx', 'utf8');

// Find all tags: <Tag ...> or </Tag>
// We need to ignore comments, strings, and expressions, but let's do a simple regex first.
// Regex to match tags
const tagRegex = /<\/?[A-Za-z0-9_.:-]+(?:\s+[A-Za-z0-9_.:-]+(?:\s*=\s*(?:{[^}]*}|"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g;

let match;
const stack = [];
let lineNum = 1;
let index = 0;

// Helper to count lines
function getLineNumber(pos) {
    const sub = content.substring(0, pos);
    return sub.split('\n').length;
}

// Let's filter out self-closing tags, script contents, comments, etc.
// A simpler way: just tokenize the file and find tags.
// Let's print tags as we find them.
console.log("Analyzing tags...");

const rawTags = [];
while ((match = tagRegex.exec(content)) !== null) {
    const tagText = match[0];
    const line = getLineNumber(match.index);
    
    // Ignore self-closing tags
    if (tagText.endsWith('/>')) continue;
    
    // Ignore comments
    if (tagText.startsWith('<!--')) continue;
    
    const isClosing = tagText.startsWith('</');
    const tagNameMatch = tagText.match(/<\/?([A-Za-z0-9_.:-]+)/);
    if (!tagNameMatch) continue;
    const tagName = tagNameMatch[1];
    
    // Ignore common non-JSX or typescript cast things
    if (tagName === 'Fragment' || tagName === 'Fragment') continue;
    
    rawTags.push({ text: tagText, name: tagName, isClosing, line });
}

// Let's match them
for (const tag of rawTags) {
    if (!tag.isClosing) {
        stack.push(tag);
    } else {
        if (stack.length === 0) {
            console.log(`Error: Extra closing tag </${tag.name}> at line ${tag.line}`);
        } else {
            const last = stack.pop();
            if (last.name !== tag.name) {
                console.log(`Mismatch: Opened <${last.name}> at line ${last.line}, but closed </${tag.name}> at line ${tag.line}`);
                // Push last back to try to recover
                stack.push(last);
            }
        }
    }
}

if (stack.length > 0) {
    console.log("Unclosed tags remaining on stack:");
    for (const tag of stack) {
        console.log(`  <${tag.name}> opened at line ${tag.line}`);
    }
} else {
    console.log("No tag mismatches found by simple parser.");
}
