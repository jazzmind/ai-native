/**
 * Knowledge Provider — Busibox implementation
 *
 * Routes knowledge operations through busibox search-api with Zero Trust
 * token exchange. The advisor's system context is enriched with search
 * results before each conversation turn.
 */

import type {
  KnowledgeProvider,
  ProviderContext,
  SearchResult,
  Collection,
  DocumentInput,
  KnowledgeDocument,
} from "@ai-native/core";

const SEARCH_API_URL = process.env.SEARCH_API_URL || "http://localhost:8003";

export class BusiboxKnowledgeProvider implements KnowledgeProvider {
  readonly type = "busibox-search-api";

  constructor(private readonly getToken: () => Promise<string>) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async search(
    ctx: ProviderContext,
    query: string,
    options?: { limit?: number; collection?: string },
  ): Promise<SearchResult[]> {
    const headers = await this.headers();
    const body: Record<string, unknown> = {
      query,
      user_id: ctx.userId,
      project_id: ctx.projectId,
      limit: options?.limit ?? 5,
    };
    if (options?.collection) body["collection"] = options.collection;

    const res = await fetch(`${SEARCH_API_URL}/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results?: SearchResult[] };
    return data.results ?? [];
  }

  async ingest(ctx: ProviderContext, doc: DocumentInput, collection?: string): Promise<{ id: string }> {
    const headers = await this.headers();
    const res = await fetch(`${SEARCH_API_URL}/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content: doc.content,
        title: doc.title,
        source: doc.source,
        metadata: doc.metadata,
        user_id: ctx.userId,
        project_id: ctx.projectId,
        collection,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ingest failed: ${res.status}`);
    }

    const data = (await res.json()) as { id: string };
    return { id: data.id };
  }

  async listCollections(ctx: ProviderContext): Promise<Collection[]> {
    const headers = await this.headers();
    const res = await fetch(
      `${SEARCH_API_URL}/collections?user_id=${encodeURIComponent(ctx.userId)}${ctx.projectId ? `&project_id=${encodeURIComponent(ctx.projectId)}` : ""}`,
      { headers },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { collections?: Collection[] };
    return data.collections ?? [];
  }

  async listDocuments(ctx: ProviderContext, collection?: string): Promise<KnowledgeDocument[]> {
    const headers = await this.headers();
    const params = new URLSearchParams({ user_id: ctx.userId });
    if (ctx.projectId) params.set("project_id", ctx.projectId);
    if (collection) params.set("collection", collection);

    const res = await fetch(`${SEARCH_API_URL}/documents?${params}`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { documents?: KnowledgeDocument[] };
    return data.documents ?? [];
  }

  async getDocument(ctx: ProviderContext, id: string): Promise<KnowledgeDocument | null> {
    const headers = await this.headers();
    const res = await fetch(`${SEARCH_API_URL}/documents/${encodeURIComponent(id)}`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<KnowledgeDocument>;
  }

  async updateDocument(ctx: ProviderContext, id: string, doc: Partial<DocumentInput>): Promise<void> {
    const headers = await this.headers();
    await fetch(`${SEARCH_API_URL}/documents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(doc),
    });
  }

  async deleteDocument(ctx: ProviderContext, id: string): Promise<void> {
    const headers = await this.headers();
    await fetch(`${SEARCH_API_URL}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${SEARCH_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Search knowledge and return a context string to inject into advisor prompts.
 * Returns empty string if no results or search is unavailable.
 */
export async function searchKnowledgeForContext(
  provider: BusiboxKnowledgeProvider,
  ctx: ProviderContext,
  query: string,
): Promise<string> {
  try {
    const results = await provider.search(ctx, query, { limit: 3 });
    if (results.length === 0) return "";

    const docs = results
      .map((r, i) => `**[${i + 1}] ${r.title ?? "Document"}** (score: ${r.score.toFixed(2)})\n${r.content.slice(0, 400)}`)
      .join("\n\n");

    return `\n\n## Relevant Knowledge\n${docs}\n`;
  } catch {
    return "";
  }
}
