import type { KnowledgeProvider, SearchResult, Collection, DocumentInput } from "./knowledge-provider";

export class BusiboxKnowledgeProvider implements KnowledgeProvider {
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

  async search(query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]> {
    const body: Record<string, any> = {
      query,
      limit: options?.limit || 10,
    };
    if (options?.collection) body.collection_id = options.collection;

    const data = await this.fetch("/api/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const results = Array.isArray(data) ? data : data.results || [];
    return results.map((r: any) => ({
      id: r.id || r.document_id || "",
      content: r.content || r.text || r.chunk || "",
      title: r.title || r.name || r.metadata?.title || "",
      source: r.source || r.metadata?.source || "",
      score: r.score || r.similarity || 0,
      metadata: r.metadata || {},
    }));
  }

  async ingest(doc: DocumentInput, collection?: string): Promise<{ id: string }> {
    const body: Record<string, any> = {
      content: doc.content,
      title: doc.title,
      source: doc.source,
      metadata: doc.metadata,
    };
    if (collection) body.collection_id = collection;

    const data = await this.fetch("/api/data", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { id: data.id || data.document_id || "" };
  }

  async listCollections(): Promise<Collection[]> {
    try {
      const data = await this.fetch("/api/data/collections");
      const collections = Array.isArray(data) ? data : data.collections || [];
      return collections.map((c: any) => ({
        id: c.id || c.collection_id || "",
        name: c.name || c.title || "",
        documentCount: c.document_count || c.count || 0,
        description: c.description || "",
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
