/**
 * skills-service.ts
 *
 * Wraps the Anthropic beta.skills API and manages the agent_skills DB table
 * so that custom skill uploads are tracked per-org and merged at deploy time.
 */

import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { agentSkills } from "@/lib/db/schema";

export interface SkillRecord {
  id: string;
  orgId: string;
  skillId: string;
  version: string;
  name: string;
  description: string;
  skillType: string;
  assignedCoaches: string[];
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Shape returned to coach-loader for merging at deploy time. */
export interface SkillAssignment {
  coachKey: string;
  skillId: string;
  skillType: string;
  version: string | null;
}

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Upload a skill file to the Anthropic API and persist a record in the DB.
 * `fileContent` should be a Buffer of the skill zip/archive.
 */
export async function uploadSkill(params: {
  orgId: string;
  userId: string;
  name: string;
  description: string;
  fileContent: Buffer;
  filename: string;
  apiKey: string;
}): Promise<SkillRecord> {
  const { orgId, userId, name, description, fileContent, filename, apiKey } = params;
  const client = makeClient(apiKey);

  // Upload to Anthropic
  const skill = await (client.beta as any).skills.create({
    name,
    description,
    content: fileContent,
    filename,
  });

  const id = uuidv4();
  const [record] = await getDb()
    .insert(agentSkills)
    .values({
      id,
      orgId,
      skillId: skill.id,
      version: String(skill.version ?? "latest"),
      name,
      description,
      skillType: "custom",
      assignedCoaches: [],
      createdBy: userId,
    })
    .returning();

  return toRecord(record);
}

/** List all custom skills for an org. */
export async function listSkills(orgId: string): Promise<SkillRecord[]> {
  const rows = await getDb().select().from(agentSkills).where(eq(agentSkills.orgId, orgId));
  return rows.map(toRecord);
}

/** Get a single skill record by DB id. */
export async function getSkill(id: string): Promise<SkillRecord | null> {
  const [row] = await getDb().select().from(agentSkills).where(eq(agentSkills.id, id));
  return row ? toRecord(row) : null;
}

/**
 * Replace a skill with a new version — uploads a new archive to Anthropic,
 * then updates the DB record to point to the new skill ID and version.
 */
export async function replaceSkill(params: {
  id: string;
  orgId: string;
  userId: string;
  fileContent: Buffer;
  filename: string;
  apiKey: string;
}): Promise<SkillRecord> {
  const { id, orgId, userId, fileContent, filename, apiKey } = params;

  const existing = await getSkill(id);
  if (!existing || existing.orgId !== orgId) {
    throw new Error("Skill not found");
  }

  const client = makeClient(apiKey);

  // Create new version at Anthropic
  const newSkill = await (client.beta as any).skills.versions.create(existing.skillId, {
    content: fileContent,
    filename,
  });

  const [updated] = await getDb()
    .update(agentSkills)
    .set({
      version: String(newSkill.version ?? "latest"),
      updatedAt: new Date(),
    })
    .where(eq(agentSkills.id, id))
    .returning();

  return toRecord(updated);
}

/**
 * Assign or unassign a skill to one or more coaches.
 * Replaces the full assignedCoaches list.
 */
export async function assignSkill(params: {
  id: string;
  orgId: string;
  coachKeys: string[];
}): Promise<SkillRecord> {
  const { id, orgId, coachKeys } = params;

  const existing = await getSkill(id);
  if (!existing || existing.orgId !== orgId) {
    throw new Error("Skill not found");
  }

  const [updated] = await getDb()
    .update(agentSkills)
    .set({ assignedCoaches: coachKeys, updatedAt: new Date() })
    .where(eq(agentSkills.id, id))
    .returning();

  return toRecord(updated);
}

/**
 * Delete a skill from the DB and optionally archive at Anthropic.
 * Archived skills are no longer usable at deploy time.
 */
export async function deleteSkill(params: {
  id: string;
  orgId: string;
  apiKey: string;
  archiveAtAnthropic?: boolean;
}): Promise<void> {
  const { id, orgId, apiKey, archiveAtAnthropic = true } = params;

  const existing = await getSkill(id);
  if (!existing || existing.orgId !== orgId) {
    throw new Error("Skill not found");
  }

  if (archiveAtAnthropic) {
    try {
      const client = makeClient(apiKey);
      await (client.beta as any).skills.archive(existing.skillId);
    } catch {
      // Non-fatal — still remove the DB record
    }
  }

  await getDb().delete(agentSkills).where(eq(agentSkills.id, id));
}

/**
 * Returns all skill assignments across an org, flattened into per-coach entries.
 * Used by coach-loader.ts at deploy time.
 */
export async function getAllCustomSkillAssignments(orgId: string): Promise<SkillAssignment[]> {
  const skills = await listSkills(orgId);
  const assignments: SkillAssignment[] = [];
  for (const skill of skills) {
    for (const coachKey of skill.assignedCoaches) {
      assignments.push({
        coachKey,
        skillId: skill.skillId,
        skillType: skill.skillType,
        version: skill.version,
      });
    }
  }
  return assignments;
}

function toRecord(row: typeof agentSkills.$inferSelect): SkillRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    skillId: row.skillId,
    version: row.version,
    name: row.name,
    description: row.description,
    skillType: row.skillType,
    assignedCoaches: (row.assignedCoaches as string[]) ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
