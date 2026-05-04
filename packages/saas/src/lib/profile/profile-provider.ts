export interface ProfileEntry {
  id: string;
  category: string;
  key: string;
  value: string;
  source_conversation: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileProvider {
  readonly type: string;

  upsert(userId: string, category: string, key: string, value: string, sourceConversation?: string, orgId?: string): Promise<void>;

  list(userId: string, category?: string): Promise<ProfileEntry[]>;

  delete(userId: string, id: string): Promise<void>;

  isAvailable(): Promise<boolean>;
}

export function formatProfileForPrompt(entries: ProfileEntry[]): string {
  if (entries.length === 0) return "";

  const grouped: Record<string, { key: string; value: string }[]> = {};
  for (const e of entries) {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push({ key: e.key, value: e.value });
  }

  let prompt = "\n\n## User Profile Context\n\n";
  for (const [category, items] of Object.entries(grouped)) {
    prompt += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
    for (const item of items) {
      prompt += `- **${item.key}**: ${item.value}\n`;
    }
    prompt += "\n";
  }
  return prompt;
}
