export const EA_MEMORY_TYPES = ['template', 'recurring_task', 'contact', 'preference', 'context'] as const;
export type EaMemoryType = (typeof EA_MEMORY_TYPES)[number];

export function isValidEaMemoryType(value: string): value is EaMemoryType {
  return EA_MEMORY_TYPES.includes(value as EaMemoryType);
}

export function formatEaMemoryForPrompt(
  entries: Array<{
    memoryType: EaMemoryType;
    title: string;
    key: string;
    content: string;
  }>,
): string {
  if (entries.length === 0) return '';

  const grouped: Record<string, typeof entries> = {};
  for (const e of entries) {
    (grouped[e.memoryType] ??= []).push(e);
  }

  const typeLabels: Record<string, string> = {
    template: 'Saved Templates',
    recurring_task: 'Recurring Workflows',
    contact: 'Known Contacts',
    preference: 'User Preferences',
    context: 'Standing Context',
  };

  const sections: string[] = [];
  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] ?? type;
    sections.push(
      `### ${label}\n` +
        items.map((e) => `**${e.title}** (key: ${e.key})\n${e.content}`).join('\n\n'),
    );
  }
  return sections.join('\n\n');
}
