import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { KnowledgeProvider, ProviderContext, SearchResult, Collection, DocumentInput, KnowledgeDocument } from "./knowledge-provider";

const DB_PATH = path.join(process.cwd(), "coach-router.db");

export class StandaloneKnowledgeProvider implements KnowledgeProvider {
  readonly type = "standalone";
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        id UNINDEXED,
        collection_id UNINDEXED,
        title,
        content,
        source UNINDEXED,
        metadata UNINDEXED
      );

      CREATE TABLE IF NOT EXISTS knowledge_collections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'legacy-user',
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS knowledge_doc_meta (
        doc_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT
      );
    `);
    this.migrate();
  }

  private migrate() {
    const cols = (this.db.prepare("PRAGMA table_info(knowledge_collections)").all() as any[]).map(r => r.name);
    if (!cols.includes("user_id")) {
      this.db.exec("ALTER TABLE knowledge_collections ADD COLUMN user_id TEXT NOT NULL DEFAULT 'legacy-user'");
    }
    if (!cols.includes("project_id")) {
      this.db.exec("ALTER TABLE knowledge_collections ADD COLUMN project_id TEXT");
    }
  }

  private getDocIds(ctx: ProviderContext): string[] {
    // All docs owned by user: project-specific + common (project_id IS NULL)
    const rows = this.db.prepare(
      "SELECT doc_id FROM knowledge_doc_meta WHERE user_id = ? AND (project_id = ? OR project_id IS NULL)"
    ).all(ctx.userId, ctx.projectId || null) as { doc_id: string }[];

    // Also include docs from shared projects
    if (ctx.projectId) {
      const shared = this.db.prepare(
        "SELECT doc_id FROM knowledge_doc_meta dm JOIN knowledge_shares ks ON dm.project_id = ks.source_project_id WHERE ks.target_project_id = ?"
      ).all(ctx.projectId) as { doc_id: string }[];
      const ids = new Set(rows.map(r => r.doc_id));
      for (const s of shared) ids.add(s.doc_id);
      return Array.from(ids);
    }

    return rows.map(r => r.doc_id);
  }

  async search(ctx: ProviderContext, query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const accessibleIds = this.getDocIds(ctx);
    if (accessibleIds.length === 0) return [];

    const placeholders = accessibleIds.map(() => "?").join(",");
    let sql = `SELECT id, title, content, source, metadata, rank FROM knowledge_fts WHERE knowledge_fts MATCH ? AND id IN (${placeholders})`;
    const params: any[] = [query, ...accessibleIds];

    if (options?.collection) {
      sql += " AND collection_id = ?";
      params.push(options.collection);
    }

    sql += " ORDER BY rank LIMIT ?";
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(r => ({
        id: r.id,
        content: r.content,
        title: r.title || "",
        source: r.source || "",
        score: -r.rank,
        metadata: r.metadata ? JSON.parse(r.metadata) : {},
      }));
    } catch {
      return [];
    }
  }

  async ingest(ctx: ProviderContext, doc: DocumentInput, collection?: string): Promise<{ id: string }> {
    const id = uuidv4();
    const collectionId = collection || "default";

    const existingCollection = this.db.prepare("SELECT id FROM knowledge_collections WHERE id = ?").get(collectionId);
    if (!existingCollection) {
      this.db.prepare("INSERT INTO knowledge_collections (id, user_id, project_id, name) VALUES (?, ?, ?, ?)").run(
        collectionId, ctx.userId, ctx.projectId || null, collectionId
      );
    }

    this.db.prepare(
      "INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, collectionId, doc.title || "", doc.content, doc.source || "", JSON.stringify(doc.metadata || {}));

    this.db.prepare(
      "INSERT INTO knowledge_doc_meta (doc_id, user_id, project_id) VALUES (?, ?, ?)"
    ).run(id, ctx.userId, ctx.projectId || null);

    return { id };
  }

  async listCollections(ctx: ProviderContext): Promise<Collection[]> {
    const rows = this.db.prepare(
      "SELECT * FROM knowledge_collections WHERE user_id = ? AND (project_id = ? OR project_id IS NULL) ORDER BY name"
    ).all(ctx.userId, ctx.projectId || null) as any[];
    return rows.map(r => {
      const countRow = this.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_fts WHERE collection_id = ?").get(r.id) as { cnt: number };
      return {
        id: r.id,
        name: r.name,
        documentCount: countRow?.cnt || 0,
        description: r.description || "",
      };
    });
  }

  async listDocuments(ctx: ProviderContext, collection?: string): Promise<KnowledgeDocument[]> {
    const accessibleIds = this.getDocIds(ctx);
    if (accessibleIds.length === 0) return [];

    const placeholders = accessibleIds.map(() => "?").join(",");
    let sql = `SELECT id, collection_id, title, content, source, metadata FROM knowledge_fts WHERE id IN (${placeholders})`;
    const params: any[] = [...accessibleIds];

    if (collection) {
      sql += " AND collection_id = ?";
      params.push(collection);
    }

    sql += " ORDER BY title";

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      collection_id: r.collection_id,
      title: r.title || "",
      content: r.content || "",
      source: r.source || "",
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
    }));
  }

  async getDocument(ctx: ProviderContext, id: string): Promise<KnowledgeDocument | null> {
    // Verify ownership
    const meta = this.db.prepare("SELECT doc_id FROM knowledge_doc_meta WHERE doc_id = ? AND user_id = ?").get(id, ctx.userId);
    if (!meta) return null;

    const row = this.db.prepare(
      "SELECT id, collection_id, title, content, source, metadata FROM knowledge_fts WHERE id = ?"
    ).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      collection_id: row.collection_id,
      title: row.title || "",
      content: row.content || "",
      source: row.source || "",
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }

  async updateDocument(ctx: ProviderContext, id: string, doc: Partial<DocumentInput>): Promise<void> {
    const existing = await this.getDocument(ctx, id);
    if (!existing) throw new Error("Document not found");

    this.db.prepare("DELETE FROM knowledge_fts WHERE id = ?").run(id);
    this.db.prepare(
      "INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      existing.collection_id,
      doc.title ?? existing.title,
      doc.content ?? existing.content,
      doc.source ?? existing.source,
      JSON.stringify(doc.metadata ?? existing.metadata)
    );
  }

  async deleteDocument(ctx: ProviderContext, id: string): Promise<void> {
    // Verify ownership before delete
    const meta = this.db.prepare("SELECT doc_id FROM knowledge_doc_meta WHERE doc_id = ? AND user_id = ?").get(id, ctx.userId);
    if (!meta) return;

    this.db.prepare("DELETE FROM knowledge_fts WHERE id = ?").run(id);
    this.db.prepare("DELETE FROM knowledge_doc_meta WHERE doc_id = ?").run(id);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
