export interface ParsedTask {
  type: 'coaching_followup' | 'reminder' | 'deadline' | 'check_in' | 'status_report_collection' | 'ea_briefing';
  title: string;
  triggerAt: Date;
  triggerDescription: string;
  repeatInterval: string | null;
  contextKey: string | null;
}

const TASK_REGEX = /:::task\n([\s\S]*?):::/g;

const DURATION_MAP: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

function parseTrigger(trigger: string): { triggerAt: Date; description: string } {
  const match = trigger.match(/^(\d+)([mhdw])$/);
  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2];
    const ms = amount * (DURATION_MAP[unit] || DURATION_MAP.d);
    const triggerAt = new Date(Date.now() + ms);

    const unitLabels: Record<string, string> = {
      m: 'minute', h: 'hour', d: 'day', w: 'week',
    };
    const label = unitLabels[unit] || unit;
    return {
      triggerAt,
      description: `in ${amount} ${label}${amount > 1 ? 's' : ''}`,
    };
  }

  // Default: 1 day from now
  return {
    triggerAt: new Date(Date.now() + DURATION_MAP.d),
    description: 'in 1 day',
  };
}

const VALID_TYPES = ['coaching_followup', 'reminder', 'deadline', 'check_in', 'status_report_collection', 'ea_briefing'] as const;

export function parseTaskBlocks(content: string): ParsedTask[] {
  const results: ParsedTask[] = [];
  let match;

  while ((match = TASK_REGEX.exec(content)) !== null) {
    const block = match[1].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    let type: ParsedTask['type'] = 'reminder';
    let title = '';
    let trigger = '1d';
    let repeat: string | null = null;
    let contextKey: string | null = null;

    for (const line of lines) {
      if (line.startsWith('type:')) {
        const val = line.slice(5).trim() as any;
        if (VALID_TYPES.includes(val)) type = val;
      } else if (line.startsWith('title:')) {
        title = line.slice(6).trim();
      } else if (line.startsWith('trigger:')) {
        trigger = line.slice(8).trim();
      } else if (line.startsWith('repeat:')) {
        repeat = line.slice(7).trim();
      } else if (line.startsWith('context_key:')) {
        contextKey = line.slice(12).trim();
      }
    }

    if (title) {
      const { triggerAt, description } = parseTrigger(trigger);
      results.push({
        type,
        title,
        triggerAt,
        triggerDescription: description,
        repeatInterval: repeat,
        contextKey,
      });
    }
  }

  return results;
}
