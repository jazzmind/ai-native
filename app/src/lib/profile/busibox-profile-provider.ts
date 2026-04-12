import type { ProfileProvider, ProfileEntry } from "./profile-provider";

export class BusiboxProfileProvider implements ProfileProvider {
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

  async upsert(userId: string, category: string, key: string, value: string, sourceConversation?: string): Promise<void> {
    await this.fetch("/api/user-profile", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, category, key, value, source_conversation: sourceConversation }),
    });
  }

  async list(userId: string, category?: string): Promise<ProfileEntry[]> {
    let endpoint = `/api/user-profile?user_id=${userId}`;
    if (category) endpoint += `&category=${category}`;
    try {
      const data = await this.fetch(endpoint);
      const entries = Array.isArray(data) ? data : data.entries || [];
      return entries.map((e: any) => ({
        id: String(e.id || ""),
        category: e.category || "",
        key: e.key || "",
        value: e.value || "",
        source_conversation: e.source_conversation || null,
        created_at: e.created_at || "",
        updated_at: e.updated_at || "",
      }));
    } catch {
      return [];
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.fetch(`/api/user-profile/${id}?user_id=${userId}`, { method: "DELETE" });
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
