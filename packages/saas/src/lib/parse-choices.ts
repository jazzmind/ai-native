export interface ParsedChoices {
  title: string;
  options: string[];
  hasWriteIn: boolean;
  originalBlock: string;
}

const CHOICES_REGEX = /:::choices\n([\s\S]*?):::/g;
const WRITE_IN_PATTERNS = /^other\b|please specify|write.?in|custom|something else/i;

export function parseChoicesBlocks(content: string): ParsedChoices[] {
  const results: ParsedChoices[] = [];
  let match;

  while ((match = CHOICES_REGEX.exec(content)) !== null) {
    const block = match[1].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let title = '';
    const options: string[] = [];

    for (const line of lines) {
      if (line.startsWith('title:')) {
        title = line.slice(6).trim();
      } else if (line.startsWith('- ')) {
        options.push(line.slice(2).trim());
      }
    }

    if (options.length > 0) {
      const hasWriteIn = options.some(o => WRITE_IN_PATTERNS.test(o));
      results.push({
        title: title || 'Choose an option:',
        options,
        hasWriteIn,
        originalBlock: match[0],
      });
    }
  }

  return results;
}

export function stripChoicesBlocks(content: string): string {
  return content.replace(CHOICES_REGEX, '').trim();
}

export function splitContentAndChoices(content: string): {
  textParts: string[];
  choiceBlocks: ParsedChoices[];
} {
  const choiceBlocks = parseChoicesBlocks(content);
  if (choiceBlocks.length === 0) {
    return { textParts: [content], choiceBlocks: [] };
  }

  const textParts: string[] = [];
  let remaining = content;

  for (const block of choiceBlocks) {
    const idx = remaining.indexOf(block.originalBlock);
    if (idx !== -1) {
      const before = remaining.slice(0, idx).trim();
      if (before) textParts.push(before);
      remaining = remaining.slice(idx + block.originalBlock.length);
    }
  }

  const after = remaining.trim();
  if (after) textParts.push(after);

  return { textParts, choiceBlocks };
}
