import { v4 as uuidv4 } from "uuid";
import type {
  Project,
  CreateProjectInput,
  Conversation,
  CreateConversationInput,
  Message,
  CreateMessageInput,
  AgentTask,
  CreateAgentTaskInput,
  TaskStatus,
  EaMemoryEntry,
  UpsertEaMemoryInput,
  MessageFeedback,
  AgentBehavior,
  StorageProvider,
} from "@ai-native/core";
import type { EaMemoryType } from "@/lib/db/queries/ea-memory";

import {
  createProject as dbCreateProject,
  listProjects as dbListProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  getOrCreateDefaultProject as dbGetOrCreateDefaultProject,
} from "@/lib/db/queries/projects";
import {
  createConversation as dbCreateConversation,
  getConversationById,
  listConversationsByOrg,
  updateConversationTitle as dbUpdateConversationTitle,
  deleteConversationById,
  addMessage,
  getMessages,
} from "@/lib/db/queries/conversations";
import {
  createAgentTask as dbCreateAgentTask,
  updateTaskStatus as dbUpdateTaskStatus,
  listPendingTasksForUser,
  LOCAL_TO_CORE_STATUS,
} from "@/lib/db/queries/agent-tasks";
import {
  upsertEaMemory as dbUpsertEaMemory,
  listEaMemory as dbListEaMemory,
  getEaMemory as dbGetEaMemory,
  deleteEaMemory as dbDeleteEaMemory,
} from "@/lib/db/queries/ea-memory";
import { addFeedback } from "@/lib/db/queries/feedback";
import {
  listActiveBehaviorsForOrg,
  createBehaviorForOrg,
  deactivateBehaviorById,
} from "@/lib/db/queries/behaviors";

// ── Row → core shape mappers ────────────────────────────────────────────────

function toCoreProject(p: {
  id: string;
  user_id: string;
  org_id?: string;
  name: string;
  description: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}): Project {
  return {
    id: p.id,
    orgId: p.org_id ?? "",
    userId: p.user_id,
    name: p.name,
    description: p.description,
    isDefault: p.is_default === 1,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  };
}

function toCoreConversation(c: {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  org_id: string;
}): Conversation {
  return {
    id: c.id,
    orgId: c.org_id,
    userId: c.user_id,
    projectId: c.project_id,
    title: c.title,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  };
}

function toCoreMessage(m: {
  id: number;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  coach_key: string | null;
  created_at: string;
}): Message {
  return {
    id: String(m.id),
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    coachKey: m.coach_key,
    // Not persisted by the local messages schema (only coachKey/mode are tracked).
    metadata: null,
    createdAt: new Date(m.created_at),
  };
}

interface LocalAgentTaskRow {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  conversationId: string | null;
  taskType: AgentTask["taskType"];
  status: "pending" | "triggered" | "completed" | "dismissed";
  triggerAt: Date;
  repeatInterval: string | null;
  context: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function toCoreAgentTask(row: LocalAgentTaskRow): AgentTask {
  const context = row.context ?? {};
  const { title, triggerDescription, contextKey, result, ...metadata } = context as {
    title?: string;
    triggerDescription?: string;
    contextKey?: string;
    result?: string;
    [key: string]: unknown;
  };

  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    projectId: row.projectId,
    conversationId: row.conversationId,
    taskType: row.taskType,
    title: title ?? "",
    status: LOCAL_TO_CORE_STATUS[row.status],
    triggerAt: row.triggerAt,
    // Not persisted by the local schema (ephemeral, client-display-only in the
    // chat route today) — reconstructed from context.title when available.
    triggerDescription: triggerDescription ?? title ?? "",
    repeatInterval: row.repeatInterval,
    contextKey: contextKey ?? null,
    result: result ?? null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

interface LocalBehaviorRow {
  id: string;
  coach_key: string;
  user_id: string;
  directive: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function toCoreBehavior(orgId: string, b: LocalBehaviorRow, sourceMessageId: string | null = null): AgentBehavior {
  return {
    id: b.id,
    orgId,
    userId: b.user_id,
    coachKey: b.coach_key,
    directive: b.directive,
    // Not persisted by the local agent_behaviors schema.
    sourceMessageId,
    isActive: b.is_active === 1,
    createdAt: new Date(b.created_at),
    updatedAt: new Date(b.updated_at),
  };
}

/**
 * PostgresStorageProvider implements the shared StorageProvider contract by
 * delegating to the existing lib/db/queries/*.ts Drizzle query modules.
 *
 * Several core methods have no 1:1 local equivalent (different scoping keys,
 * missing columns, or a different return shape) — see the small wrapper
 * functions added alongside the originals in lib/db/queries/{projects,
 * conversations,agent-tasks,behaviors}.ts, each documented at its call site.
 */
export class PostgresStorageProvider implements StorageProvider {
  readonly type = "postgres";

  // ── Projects ────────────────────────────────────────────────────────────

  async getOrCreateDefaultProject(orgId: string, userId: string): Promise<Project> {
    const p = await dbGetOrCreateDefaultProject(userId, orgId);
    return toCoreProject(p);
  }

  async getProject(id: string): Promise<Project | null> {
    const p = await getProjectById(id);
    return p ? toCoreProject(p) : null;
  }

  async listProjects(orgId: string, userId: string): Promise<Project[]> {
    const rows = await dbListProjects(userId, orgId);
    return rows.map(toCoreProject);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const p = await dbCreateProject(input.userId, input.name, input.description, input.orgId);
    return toCoreProject(p);
  }

  async updateProject(id: string, updates: Partial<Pick<Project, "name" | "description">>): Promise<Project> {
    await updateProjectById(id, updates);
    const p = await getProjectById(id);
    if (!p) throw new Error(`Project not found: ${id}`);
    return toCoreProject(p);
  }

  async deleteProject(id: string): Promise<void> {
    await deleteProjectById(id);
  }

  // ── Conversations ───────────────────────────────────────────────────────

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const id = input.id ?? uuidv4();
    await dbCreateConversation(id, input.title, input.userId, input.projectId, input.orgId);
    return {
      id,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      title: input.title,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const c = await getConversationById(id);
    return c ? toCoreConversation(c) : null;
  }

  async listConversations(orgId: string, userId: string, projectId?: string): Promise<Conversation[]> {
    const rows = await listConversationsByOrg(orgId, userId, projectId);
    return rows.map(toCoreConversation);
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    await dbUpdateConversationTitle(id, title);
  }

  async deleteConversation(id: string): Promise<void> {
    await deleteConversationById(id);
  }

  // ── Messages ────────────────────────────────────────────────────────────

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const m = await addMessage(input.conversationId, input.role, input.content, input.coachKey ?? null, null);
    return toCoreMessage(m);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const rows = await getMessages(conversationId);
    return rows.map(toCoreMessage);
  }

  // ── Agent tasks ─────────────────────────────────────────────────────────

  async createAgentTask(input: CreateAgentTaskInput): Promise<AgentTask> {
    const task = await dbCreateAgentTask({
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      conversationId: input.conversationId ?? "",
      taskType: input.taskType,
      // Not modeled by the core interface — the local schema requires a
      // coachKey (NOT NULL); tasks created through this generic path are
      // attributed to a synthetic "system" coach.
      coachKey: "system",
      triggerAt: input.triggerAt,
      repeatInterval: input.repeatInterval ?? null,
      context: {
        title: input.title,
        triggerDescription: input.triggerDescription,
        ...(input.contextKey ? { contextKey: input.contextKey } : {}),
        ...(input.metadata ?? {}),
      },
    });
    return toCoreAgentTask(task as unknown as LocalAgentTaskRow);
  }

  async listPendingTasks(userId: string, before?: Date): Promise<AgentTask[]> {
    const rows = await listPendingTasksForUser(userId, before);
    return (rows as unknown as LocalAgentTaskRow[]).map(toCoreAgentTask);
  }

  async updateTaskStatus(id: string, status: TaskStatus, result?: string): Promise<void> {
    await dbUpdateTaskStatus(id, status, result);
  }

  // ── EA memory ───────────────────────────────────────────────────────────

  async upsertEaMemory(input: UpsertEaMemoryInput): Promise<EaMemoryEntry> {
    return dbUpsertEaMemory(input as UpsertEaMemoryInput & { memoryType: EaMemoryType }) as Promise<EaMemoryEntry>;
  }

  async listEaMemory(userId: string, projectId: string, memoryType?: EaMemoryType): Promise<EaMemoryEntry[]> {
    return dbListEaMemory(userId, projectId, memoryType) as Promise<EaMemoryEntry[]>;
  }

  async getEaMemory(userId: string, projectId: string, key: string): Promise<EaMemoryEntry | null> {
    return dbGetEaMemory(userId, projectId, key) as Promise<EaMemoryEntry | null>;
  }

  async deleteEaMemory(userId: string, projectId: string, key: string): Promise<void> {
    await dbDeleteEaMemory(userId, projectId, key);
  }

  // ── Feedback ────────────────────────────────────────────────────────────

  async addMessageFeedback(input: Omit<MessageFeedback, "id" | "createdAt">): Promise<MessageFeedback> {
    const local = await addFeedback(
      Number(input.messageId),
      input.conversationId,
      input.userId,
      input.value,
      input.coachKey ?? undefined,
      undefined,
      input.comment ?? undefined
    );
    return {
      id: local.id,
      messageId: String(local.message_id),
      conversationId: local.conversation_id,
      userId: local.user_id,
      // Not persisted by the local message_feedback schema (no org_id column) —
      // echoed back from the input for shape completeness.
      orgId: input.orgId,
      coachKey: local.coach_key,
      value: local.rating,
      comment: local.comment,
      createdAt: new Date(local.created_at),
    };
  }

  // ── Behaviors ───────────────────────────────────────────────────────────

  async listActiveBehaviors(orgId: string, userId: string, coachKey?: string): Promise<AgentBehavior[]> {
    const rows = await listActiveBehaviorsForOrg(orgId, userId, coachKey);
    return rows.map((b) => toCoreBehavior(orgId, b));
  }

  async addBehavior(input: Omit<AgentBehavior, "id" | "createdAt" | "updatedAt">): Promise<AgentBehavior> {
    const b = await createBehaviorForOrg(input.orgId, input.userId, input.coachKey ?? "", input.directive);
    return toCoreBehavior(input.orgId, b, input.sourceMessageId);
  }

  async deactivateBehavior(id: string): Promise<void> {
    await deactivateBehaviorById(id);
  }
}
