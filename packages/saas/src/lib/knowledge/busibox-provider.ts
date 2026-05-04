import type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "./knowledge-provider";

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

  async search(_ctx: ProviderContext, query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]> {
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

  async ingest(_ctx: ProviderContext, doc: DocumentInput, collection?: string): Promise<{ id: string }> {
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

  async listCollections(_ctx: ProviderContext): Promise<Collection[]> {
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

  async listDocuments(_ctx: ProviderContext, collection?: string): Promise<KnowledgeDocument[]> {
    const endpoint = collection ? `/api/data?collection_id=${collection}` : "/api/data";
    try {
      const data = await this.fetch(endpoint);
      const docs = Array.isArray(data) ? data : data.documents || [];
      return docs.map((d: any) => ({
        id: d.id || d.document_id || "",
        collection_id: d.collection_id || "",
        title: d.title || d.name || "",
        content: d.content || d.text || "",
        source: d.source || "",
        metadata: d.metadata || {},
      }));
    } catch {
      return [];
    }
  }

  async getDocument(_ctx: ProviderContext, id: string): Promise<KnowledgeDocument | null> {
    try {
      const data = await this.fetch(`/api/data/${id}`);
      return {
        id: data.id || id,
        collection_id: data.collection_id || "",
        title: data.title || "",
        content: data.content || "",
        source: data.source || "",
        metadata: data.metadata || {},
      };
    } catch {
      return null;
    }
  }

  async updateDocument(_ctx: ProviderContext, id: string, doc: Partial<DocumentInput>): Promise<void> {
    await this.fetch(`/api/data/${id}`, {
      method: "PUT",
      body: JSON.stringify(doc),
    });
  }

  async deleteDocument(_ctx: ProviderContext, id: string): Promise<void> {
    await this.fetch(`/api/data/${id}`, { method: "DELETE" });
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
