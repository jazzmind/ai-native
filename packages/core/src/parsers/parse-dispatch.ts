import type { EaMemoryType } from '../types/ea-memory';
import { EA_MEMORY_TYPES } from '../types/ea-memory';

export interface ParsedDispatch {
  advisors: string[];
  question: string;
}

export interface ParsedMemoryBlock {
  type: EaMemoryType;
  key: string;
  title: string;
  content: string;
}

export interface ParsedExpertRequest {
  domain: string;
  title: string;
  question: string;
  budgetHint: 'low' | 'medium' | 'high';
}

export interface ParsedSkillInvocation {
  skillName: string;
  context: string;
}

const BLOCK_REGEX = /:::(dispatch|memory|expert_request)\n([\s\S]*?):::/g;
const SKILL_BLOCK_REGEX = /:::skill ([^\n]+)\n([\s\S]*?):::/g;

function parseKeyValueBlock(raw: string): Record<string, string> {
  const lines = raw.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const result: Record<string, string> = {};
  let lastKey: string | null = null;

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !line.startsWith(' ')) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      result[key] = value;
      lastKey = key;
    } else if (lastKey) {
      result[lastKey] = (result[lastKey] ?? '') + '\n' + line;
    }
  }
  return result;
}

export function parseDispatchBlocks(content: string): ParsedDispatch[] {
  const results: ParsedDispatch[] = [];
  BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(content)) !== null) {
    if (match[1] !== 'dispatch') continue;
    const fields = parseKeyValueBlock(match[2]!);
    const advisors = (fields['advisors'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const question = fields['question']?.trim() ?? '';
    if (advisors.length > 0 && question) {
      results.push({ advisors, question });
    }
  }
  return results;
}

export function parseMemoryBlocks(content: string): ParsedMemoryBlock[] {
  const results: ParsedMemoryBlock[] = [];
  BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(content)) !== null) {
    if (match[1] !== 'memory') continue;
    const raw = match[2]!;

    const lines = raw.trim().split('\n');
    const fields: Record<string, string> = {};
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && ['type', 'key', 'title'].includes(line.slice(0, colonIdx).trim())) {
        fields[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
        bodyStart = i + 1;
      } else {
        break;
      }
    }

    const bodyContent = lines.slice(bodyStart).join('\n').trim();
    const type = fields['type'] as EaMemoryType;
    if (!EA_MEMORY_TYPES.includes(type)) continue;
    if (!fields['key'] || !fields['title']) continue;

    results.push({
      type,
      key: fields['key'],
      title: fields['title'],
      content: bodyContent || fields['content'] || '',
    });
  }
  return results;
}

export function parseExpertRequests(content: string): ParsedExpertRequest[] {
  const results: ParsedExpertRequest[] = [];
  BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK_REGEX.exec(content)) !== null) {
    if (match[1] !== 'expert_request') continue;
    const fields = parseKeyValueBlock(match[2]!);
    if (!fields['domain'] || !fields['title'] || !fields['question']) continue;
    const budgetHint = (['low', 'medium', 'high'].includes(fields['budget_hint'] ?? '')
      ? fields['budget_hint']
      : 'medium') as 'low' | 'medium' | 'high';
    results.push({
      domain: fields['domain'],
      title: fields['title'],
      question: fields['question'],
      budgetHint,
    });
  }
  return results;
}

export function parseSkillBlocks(content: string): ParsedSkillInvocation[] {
  const results: ParsedSkillInvocation[] = [];
  SKILL_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SKILL_BLOCK_REGEX.exec(content)) !== null) {
    const skillName = match[1]!.trim();
    const fields = parseKeyValueBlock(match[2]!);
    const context = fields['context']?.trim() ?? '';
    if (skillName && context) {
      results.push({ skillName, context });
    }
  }
  return results;
}

export function stripEaBlocks(content: string): string {
  return content
    .replace(/:::(dispatch|memory|expert_request)\n[\s\S]*?:::/g, '')
    .replace(/:::skill [^\n]+\n[\s\S]*?:::/g, '')
    .trim();
}
