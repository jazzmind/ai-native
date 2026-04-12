import type { ActivityProvider, ActivityEntry } from "./activity-provider";

export class BusiboxActivityProvider implements ActivityProvider {
  readonly type = "busibox";
  private hostUrl: string;
  private apiKey: string;

  constructor(hostUrl: string, apiKey: string) {
    this.hostUrl = hostUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async fetch(endpoint: string, options?: RequestInit) {
    const url = `${this.hostUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Busibox API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async add(userId: string, conversationId: string, coachKey: string, eventType: string, eventData: Record<string, unknown> = {}): Promise<void> {
    await this.fetch("/api/agent-activity", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
        coach_key: coachKey,
        event_type: eventType,
        event_data: eventData,
      }),
    });
  }

  async listByConversation(userId: string, conversationId: string): Promise<ActivityEntry[]> {
    try {
      const data = await this.fetch(`/api/agent-activity?user_id=${userId}&conversation_id=${conversationId}`);
      const entries = Array.isArray(data) ? data : data.entries || [];
      return entries.map((e: any) => ({
        id: String(e.id || ""),
        conversation_id: e.conversation_id || conversationId,
        coach_key: e.coach_key || "",
        event_type: e.event_type || "",
        event_data: typeof e.event_data === "string" ? e.event_data : JSON.stringify(e.event_data || {}),
        created_at: e.created_at || "",
      }));
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.fetch("/api/health");
      return true;
    } catch {
      return false;
    }
  }
}
