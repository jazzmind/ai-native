import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db/client";
import { deployTargets, mcpConnections, appSettings, organizations } from "./db/schema";

// ── Encryption (same key derivation as before) ──────────────────────────────

const MACHINE_KEY = crypto.createHash("sha256")
  .update(process.env.CONFIG_ENCRYPTION_KEY || `coach-platform-${process.cwd()}`)
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

// ── DeployTarget types ───────────────────────────────────────────────────────

export interface DeployTarget {
  id: string;
  userId: string;
  orgId: string;
  type: "cma" | "busibox";
  name: string;
  config: Record<string, any>;
  status: "unconfigured" | "configured" | "deploying" | "deployed" | "error";
  lastDeployedAt: string | null;
  agentState: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

function rowToTarget(row: typeof deployTargets.$inferSelect): DeployTarget {
  const configJson = (row.configJson as Record<string, any>) || {};
  const config = { ...configJson };
  if (config._encrypted_api_key) {
    try { config.apiKey = decrypt(config._encrypted_api_key as string); } catch { config.apiKey = ""; }
    delete config._encrypted_api_key;
  }
  return {
    id: row.id,
    userId: row.userId,
    orgId: row.orgId,
    type: row.type as "cma" | "busibox",
    name: row.name,
    config,
    status: row.status as DeployTarget["status"],
    lastDeployedAt: row.lastDeployedAt?.toISOString() ?? null,
    agentState: (row.agentState as Record<string, any>) || {},
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ── Deploy Targets ───────────────────────────────────────────────────────────

export async function listTargets(userId?: string): Promise<DeployTarget[]> {
  const db = getDb();
  const rows = userId
    ? await db.select().from(deployTargets).where(eq(deployTargets.userId, userId)).orderBy(deployTargets.createdAt)
    : await db.select().from(deployTargets).orderBy(deployTargets.createdAt);
  return rows.map(rowToTarget);
}

export async function getTarget(id: string, userId?: string): Promise<DeployTarget | undefined> {
  const db = getDb();
  const condition = userId
    ? and(eq(deployTargets.id, id), eq(deployTargets.userId, userId))
    : eq(deployTargets.id, id);
  const [row] = await db.select().from(deployTargets).where(condition);
  return row ? rowToTarget(row) : undefined;
}

export async function upsertTarget(target: DeployTarget): Promise<void> {
  const db = getDb();
  const configToStore = { ...target.config };
  if (configToStore.apiKey) {
    configToStore._encrypted_api_key = encrypt(configToStore.apiKey as string);
    delete configToStore.apiKey;
  }

  // Resolve orgId — callers that don't supply one get it from the user's org
  let orgId = target.orgId;
  if (!orgId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);
    orgId = org?.id ?? "unknown";
  }

  await db
    .insert(deployTargets)
    .values({
      id: target.id,
      orgId,
      userId: target.userId,
      type: target.type,
      name: target.name,
      configJson: configToStore,
      status: target.status,
      lastDeployedAt: target.lastDeployedAt ? new Date(target.lastDeployedAt) : null,
      agentState: target.agentState,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: deployTargets.id,
      set: {
        userId: target.userId,
        type: target.type,
        name: target.name,
        configJson: configToStore,
        status: target.status,
        lastDeployedAt: target.lastDeployedAt ? new Date(target.lastDeployedAt) : null,
        agentState: target.agentState,
        updatedAt: new Date(),
      },
    });
}

export async function deleteTarget(id: string, userId?: string): Promise<void> {
  const db = getDb();
  const condition = userId
    ? and(eq(deployTargets.id, id), eq(deployTargets.userId, userId))
    : eq(deployTargets.id, id);
  await db.delete(deployTargets).where(condition);
}

export async function updateTargetStatus(
  id: string,
  status: DeployTarget["status"],
  agentState?: Record<string, any>
): Promise<void> {
  const db = getDb();
  await db
    .update(deployTargets)
    .set({
      status,
      ...(agentState ? { agentState, lastDeployedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(deployTargets.id, id));
}

// ── Config KV (mapped to app_settings, org-scoped) ──────────────────────────

export async function getConfig(key: string, userId = "legacy-user"): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, `config:${userId}:${key}`));
  return row ? (row.value as string) : null;
}

export async function setConfig(key: string, value: string, userId = "legacy-user"): Promise<void> {
  const db = getDb();
  const compositeKey = `config:${userId}:${key}`;
  // appSettings requires an orgId — use a sentinel for the legacy KV store
  // Real org-scoped settings go through the appSettings API directly
  const [first] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  const orgId = first?.id ?? "system";
  await db
    .insert(appSettings)
    .values({ id: uuidv4(), orgId, key: compositeKey, value })
    .onConflictDoUpdate({
      target: [appSettings.orgId, appSettings.key],
      set: { value, updatedAt: new Date() },
    });
}

export async function getAllConfig(userId = "legacy-user"): Promise<Record<string, string>> {
  const db = getDb();
  const prefix = `config:${userId}:`;
  const rows = await db.select().from(appSettings);
  const result: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.startsWith(prefix)) {
      result[r.key.slice(prefix.length)] = r.value as string;
    }
  }
  return result;
}

// ── MCP Connections ──────────────────────────────────────────────────────────

export interface McpConnection {
  id: string;
  targetId: string;
  mcpName: string;
  status: "disconnected" | "connected" | "error";
  vaultId: string | null;
  connectionId?: string | null;
}

export async function listMcpConnections(targetId: string): Promise<McpConnection[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.targetId, targetId))
    .orderBy(mcpConnections.mcpName);
  return rows.map(r => ({
    id: r.id,
    targetId: r.targetId,
    mcpName: r.mcpName,
    status: r.status as McpConnection["status"],
    vaultId: r.vaultId,
    connectionId: r.connectionId,
  }));
}

export async function upsertMcpConnection(conn: McpConnection): Promise<void> {
  const db = getDb();
  await db
    .insert(mcpConnections)
    .values({
      id: conn.id,
      targetId: conn.targetId,
      mcpName: conn.mcpName,
      status: conn.status,
      vaultId: conn.vaultId ?? null,
      connectionId: conn.connectionId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mcpConnections.targetId, mcpConnections.mcpName],
      set: {
        status: conn.status,
        vaultId: conn.vaultId ?? null,
        connectionId: conn.connectionId ?? null,
        updatedAt: new Date(),
      },
    });
}
