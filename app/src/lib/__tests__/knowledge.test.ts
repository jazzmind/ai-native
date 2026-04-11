import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const TEST_DB_PATH = path.join(process.cwd(), `test-knowledge-${Date.now()}.db`);

function createTestDb() {
  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
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
  return db;
}

describe("standalone knowledge provider (FTS5)", () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => {
    db.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    try { fs.unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
    try { fs.unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
  });

  it("inserts and searches documents", () => {
    const id = uuidv4();
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("default", "Default");
    db.prepare(
      "INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, "default", "Q1 Financial Report", "Revenue grew 30% YoY driven by enterprise expansion.", "internal", "{}");

    const results = db.prepare(
      "SELECT id, title, content, rank FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 5"
    ).all("revenue") as any[];

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Q1 Financial Report");
    expect(results[0].id).toBe(id);
  });

  it("searches across multiple documents", () => {
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("default", "Default");

    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "default", "Tech Architecture", "The system uses microservices with Kubernetes orchestration.", "", "{}");
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "default", "HR Policy", "Employees are entitled to 20 days of paid time off.", "", "{}");
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "default", "DevOps Guide", "Kubernetes clusters are managed via Terraform.", "", "{}");

    const results = db.prepare(
      "SELECT id, title, content, rank FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 5"
    ).all("kubernetes") as any[];

    expect(results).toHaveLength(2);
    const titles = results.map((r: any) => r.title);
    expect(titles).toContain("Tech Architecture");
    expect(titles).toContain("DevOps Guide");
  });

  it("filters by collection", () => {
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("finance", "Finance");
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("tech", "Tech");

    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "finance", "Budget", "The annual budget is $5M.", "", "{}");
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "tech", "Infra Budget", "Infrastructure budget is allocated for cloud services.", "", "{}");

    const financeResults = db.prepare(
      "SELECT id, title FROM knowledge_fts WHERE knowledge_fts MATCH ? AND collection_id = ? ORDER BY rank"
    ).all("budget", "finance") as any[];

    expect(financeResults).toHaveLength(1);
    expect(financeResults[0].title).toBe("Budget");
  });

  it("returns empty results for no match", () => {
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "default", "Test", "This is about cats.", "", "{}");

    const results = db.prepare(
      "SELECT id, title FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank"
    ).all("kubernetes") as any[];

    expect(results).toHaveLength(0);
  });

  it("lists collections with document counts", () => {
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("c1", "Collection One");
    db.prepare("INSERT INTO knowledge_collections (id, name) VALUES (?, ?)").run("c2", "Collection Two");

    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "c1", "Doc 1", "Content 1", "", "{}");
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "c1", "Doc 2", "Content 2", "", "{}");
    db.prepare("INSERT INTO knowledge_fts (id, collection_id, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), "c2", "Doc 3", "Content 3", "", "{}");

    const collections = db.prepare("SELECT * FROM knowledge_collections ORDER BY name").all() as any[];
    expect(collections).toHaveLength(2);

    const c1Count = db.prepare("SELECT COUNT(*) as cnt FROM knowledge_fts WHERE collection_id = ?").get("c1") as any;
    const c2Count = db.prepare("SELECT COUNT(*) as cnt FROM knowledge_fts WHERE collection_id = ?").get("c2") as any;
    expect(c1Count.cnt).toBe(2);
    expect(c2Count.cnt).toBe(1);
  });
});
