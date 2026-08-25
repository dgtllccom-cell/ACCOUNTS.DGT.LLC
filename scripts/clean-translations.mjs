import fs from 'fs';

const filePath = 'features/accounts/components/translations.ts';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'export const accountTranslations: Record<string, Record<SupportedLanguage, string>> = {';
const endMarker = 'export function getLabel(';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const innerWithBrace = content.slice(startIndex + startMarker.length, endIndex);
  const closingBraceIdx = innerWithBrace.lastIndexOf('};');
  const inner = innerWithBrace.slice(0, closingBraceIdx);

  const blockRegex = /([a-zA-Z0-9_]+)\s*:\s*\{([^}]*)\}/g;
  let m;
  const seenKeys = new Set();
  const uniqueBlocks = [];

  while ((m = blockRegex.exec(inner)) !== null) {
    const keyName = m[1];
    if (!seenKeys.has(keyName)) {
      seenKeys.add(keyName);
      uniqueBlocks.push(`  ${keyName}: {${m[2]}}`);
    }
  }

  const newBlock = '\n' + uniqueBlocks.join(',\n') + '\n};\n\n';
  const newContent = content.slice(0, startIndex + startMarker.length) + newBlock + content.slice(endIndex);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Cleaned translations! Total unique keys: ${seenKeys.size}`);
} else {
  console.error('Markers not found');
}
