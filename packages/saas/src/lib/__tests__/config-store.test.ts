import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const TEST_DB_PATH = path.join(process.cwd(), `test-config-${Date.now()}.db`);

const MACHINE_KEY = crypto.createHash("sha256")
  .update(`coach-platform-test-key`)
  .digest();

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", MACHINE_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", MACHINE_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function createTestDb() {
  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deploy_targets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_deployed_at TEXT,
      agent_state_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mcp_connections (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      mcp_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      vault_id TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe("config store", () => {
  let db: Database.Database;

  beforeEach(() => { db = createTestDb(); });
  afterEach(() => {
    db.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    try { fs.unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
    try { fs.unlinkSync(TEST_DB_PATH + "-shm"); } catch {}
  });

  describe("key-value config", () => {
    it("sets and gets a config value", () => {
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("theme", "dark");
      const row = db.prepare("SELECT value FROM config WHERE key = ?").get("theme") as any;
      expect(row.value).toBe("dark");
    });

    it("upserts config values", () => {
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("theme", "dark");
      db.prepare(`
        INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
      `).run("theme", "light");

      const row = db.prepare("SELECT value FROM config WHERE key = ?").get("theme") as any;
      expect(row.value).toBe("light");
    });

    it("returns all config", () => {
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("a", "1");
      db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("b", "2");

      const rows = db.prepare("SELECT key, value FROM config").all() as any[];
      expect(rows).toHaveLength(2);
    });
  });

  describe("deploy targets", () => {
    it("creates a CMA target", () => {
      db.prepare(`
        INSERT INTO deploy_targets (id, type, name, config_json, status)
        VALUES (?, ?, ?, ?, ?)
      `).run("t1", "cma", "My CMA", '{"apiKey":"test"}', "configured");

      const row = db.prepare("SELECT * FROM deploy_targets WHERE id = ?").get("t1") as any;
      expect(row.type).toBe("cma");
      expect(row.name).toBe("My CMA");
      expect(row.status).toBe("configured");
    });

    it("creates a Busibox target", () => {
      db.prepare(`
        INSERT INTO deploy_targets (id, type, name, config_json, status)
        VALUES (?, ?, ?, ?, ?)
      `).run("t2", "busibox", "My Busibox", '{"hostUrl":"https://bb.example.com","apiKey":"key"}', "configured");

      const row = db.prepare("SELECT * FROM deploy_targets WHERE id = ?").get("t2") as any;
      expect(row.type).toBe("busibox");
      const config = JSON.parse(row.config_json);
      expect(config.hostUrl).toBe("https://bb.example.com");
    });

    it("updates target status", () => {
      db.prepare("INSERT INTO deploy_targets (id, type, name, status) VALUES (?, ?, ?, ?)")
        .run("t1", "cma", "Test", "configured");

      db.prepare("UPDATE deploy_targets SET status = ? WHERE id = ?").run("deployed", "t1");
      const row = db.prepare("SELECT status FROM deploy_targets WHERE id = ?").get("t1") as any;
      expect(row.status).toBe("deployed");
    });

    it("deletes a target", () => {
      db.prepare("INSERT INTO deploy_targets (id, type, name, status) VALUES (?, ?, ?, ?)")
        .run("t1", "cma", "Test", "configured");

      db.prepare("DELETE FROM deploy_targets WHERE id = ?").run("t1");
      const row = db.prepare("SELECT * FROM deploy_targets WHERE id = ?").get("t1");
      expect(row).toBeUndefined();
    });
  });

  describe("MCP connections", () => {
    it("creates and lists MCP connections for a target", () => {
      db.prepare("INSERT INTO deploy_targets (id, type, name) VALUES (?, ?, ?)")
        .run("t1", "cma", "Test");

      db.prepare("INSERT INTO mcp_connections (id, target_id, mcp_name, status) VALUES (?, ?, ?, ?)")
        .run("mc1", "t1", "notion", "connected");
      db.prepare("INSERT INTO mcp_connections (id, target_id, mcp_name, status) VALUES (?, ?, ?, ?)")
        .run("mc2", "t1", "slack", "disconnected");

      const rows = db.prepare("SELECT * FROM mcp_connections WHERE target_id = ? ORDER BY mcp_name").all("t1") as any[];
      expect(rows).toHaveLength(2);
      expect(rows[0].mcp_name).toBe("notion");
      expect(rows[0].status).toBe("connected");
      expect(rows[1].mcp_name).toBe("slack");
    });
  });

  describe("credential encryption", () => {
    it("encrypts and decrypts API keys", () => {
      const apiKey = "sk-ant-api03-test-key-12345";
      const encrypted = encrypt(apiKey);

      expect(encrypted).not.toBe(apiKey);
      expect(encrypted).toContain(":");
      expect(encrypted.split(":")).toHaveLength(3);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(apiKey);
    });

    it("produces different ciphertext for the same plaintext", () => {
      const key = "test-key";
      const enc1 = encrypt(key);
      const enc2 = encrypt(key);
      expect(enc1).not.toBe(enc2);
      expect(decrypt(enc1)).toBe(key);
      expect(decrypt(enc2)).toBe(key);
    });

    it("fails to decrypt with wrong key", () => {
      const encrypted = encrypt("secret");
      const wrongKey = crypto.createHash("sha256").update("wrong").digest();
      const [ivHex, tagHex, encHex] = encrypted.split(":");

      expect(() => {
        const iv = Buffer.from(ivHex, "hex");
        const tag = Buffer.from(tagHex, "hex");
        const enc = Buffer.from(encHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-gcm", wrongKey, iv);
        decipher.setAuthTag(tag);
        Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
      }).toThrow();
    });
  });
});
