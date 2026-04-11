import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { KnowledgeProvider, SearchResult, Collection, DocumentInput } from "./knowledge-provider";

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
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  async search(query: string, options?: { limit?: number; collection?: string }): Promise<SearchResult[]> {
    const limit = options?.limit || 10;

    let sql = "SELECT id, title, content, source, metadata, rank FROM knowledge_fts WHERE knowledge_fts MATCH ?";
    const params: any[] = [query];

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

  async ingest(doc: DocumentInput, collection?: string): Promise<{ id: string }> {
    const id = uuidv4();
    const collectionId = collection || "default";

    const existingCollection = this.db.prepare("SELECT id FROM knowledge_collections WHERE id = ?").get(collectionId);
    if (!existingCollection) {
      this.db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run(collectionId, collectionId);
    }

    this.db.prepare(
      "INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, collectionId, doc.title || "", doc.content, doc.source || "", JSON.stringify(doc.metadata || {}));

    return { id };
  }

  async listCollections(): Promise<Collection[]> {
    const rows = this.db.prepare("SELECT * FROM knowledge_collections ORDER BY name").all() as any[];
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

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
