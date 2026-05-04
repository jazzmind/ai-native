/**
 * Data API Client for AI Advisory Busibox App
 *
 * Maps the core StorageProvider data model to Busibox data-api documents.
 * All data goes through the Busibox data-api service — no direct DB access.
 *
 * Document naming convention: ai-native-{entity}
 */

import {
  generateId,
  getNow,
  queryRecords,
  insertRecords,
  updateRecords,
  deleteRecords,
  ensureDocuments,
} from "@jazzmind/busibox-app";
import type { AppDataSchema } from "@jazzmind/busibox-app";
import type {
  Project,
  Conversation,
  Message,
  AgentTask,
  EaMemoryEntry,
  MessageFeedback,
  AgentBehavior,
} from "@ai-native/core";
import type { EaMemoryType } from "@ai-native/core";

// ── Document Names ─────────────────────────────────────────

export const DOCUMENTS = {
  PROJECTS: "ai-native-projects",
  CONVERSATIONS: "ai-native-conversations",
  MESSAGES: "ai-native-messages",
  TASKS: "ai-native-tasks",
  EA_MEMORY: "ai-native-memory",
  FEEDBACK: "ai-native-feedback",
  BEHAVIORS: "ai-native-behaviors",
} as const;

// ── Schemas ────────────────────────────────────────────────

const projectSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    name: { type: "string", required: true, label: "Name", order: 1 },
    description: { type: "string", label: "Description", multiline: true, order: 2 },
    isDefault: { type: "boolean", label: "Default Project", order: 3 },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
    updatedAt: { type: "string", label: "Updated", readonly: true, hidden: true },
  },
  displayName: "Projects",
  itemLabel: "Project",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeProject",
  graphRelationships: [],
};

const conversationSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    projectId: { type: "string", required: true, hidden: true },
    title: { type: "string", required: true, label: "Title", order: 1 },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
    updatedAt: { type: "string", label: "Updated", readonly: true, hidden: true },
  },
  displayName: "Conversations",
  itemLabel: "Conversation",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeConversation",
  graphRelationships: [],
};

const messageSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    conversationId: { type: "string", required: true, hidden: true },
    role: { type: "string", required: true, label: "Role" },
    content: { type: "string", required: true, label: "Content", multiline: true },
    coachKey: { type: "string", label: "Advisor Key", hidden: true },
    metadata: { type: "string", label: "Metadata", hidden: true },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
  },
  displayName: "Messages",
  itemLabel: "Message",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeMessage",
  graphRelationships: [
    { source_label: "AiNativeMessage", relationship: "BELONGS_TO", target_label: "AiNativeConversation", target_field: "conversationId" },
  ],
};

const taskSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    projectId: { type: "string", required: true, hidden: true },
    conversationId: { type: "string", hidden: true },
    taskType: { type: "string", required: true, label: "Type" },
    title: { type: "string", required: true, label: "Title", order: 1 },
    status: { type: "string", required: true, label: "Status", order: 2 },
    triggerAt: { type: "string", required: true, label: "Trigger At" },
    triggerDescription: { type: "string", label: "Trigger Description" },
    repeatInterval: { type: "string", label: "Repeat Interval" },
    contextKey: { type: "string", label: "Context Key", hidden: true },
    result: { type: "string", label: "Result", multiline: true, hidden: true },
    metadata: { type: "string", label: "Metadata", hidden: true },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
    updatedAt: { type: "string", label: "Updated", readonly: true, hidden: true },
  },
  displayName: "Agent Tasks",
  itemLabel: "Task",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeTask",
  graphRelationships: [],
};

const eaMemorySchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    projectId: { type: "string", required: true, hidden: true },
    memoryType: { type: "string", required: true, label: "Memory Type" },
    key: { type: "string", required: true, label: "Key" },
    title: { type: "string", required: true, label: "Title", order: 1 },
    content: { type: "string", required: true, label: "Content", multiline: true, order: 2 },
    metadata: { type: "string", label: "Metadata", hidden: true },
    isActive: { type: "boolean", label: "Active", hidden: true },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
    updatedAt: { type: "string", label: "Updated", readonly: true, hidden: true },
  },
  displayName: "EA Memory",
  itemLabel: "Memory Entry",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeMemory",
  graphRelationships: [],
};

const feedbackSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    messageId: { type: "string", required: true, hidden: true },
    conversationId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    coachKey: { type: "string", label: "Advisor Key", hidden: true },
    value: { type: "string", required: true, label: "Rating" },
    comment: { type: "string", label: "Comment", multiline: true },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
  },
  displayName: "Feedback",
  itemLabel: "Feedback Entry",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeFeedback",
  graphRelationships: [],
};

const behaviorSchema: AppDataSchema = {
  fields: {
    id: { type: "string", required: true, hidden: true },
    orgId: { type: "string", required: true, hidden: true },
    userId: { type: "string", required: true, hidden: true },
    coachKey: { type: "string", label: "Advisor Key", hidden: true },
    directive: { type: "string", required: true, label: "Directive", multiline: true, order: 1 },
    sourceMessageId: { type: "string", label: "Source Message", hidden: true },
    isActive: { type: "boolean", label: "Active", hidden: true },
    createdAt: { type: "string", label: "Created", readonly: true, hidden: true },
    updatedAt: { type: "string", label: "Updated", readonly: true, hidden: true },
  },
  displayName: "Agent Behaviors",
  itemLabel: "Behavior",
  sourceApp: "ai-native",
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "AiNativeBehavior",
  graphRelationships: [],
};

// ── ensureDataDocuments ────────────────────────────────────

export interface DataDocumentIds {
  projects: string;
  conversations: string;
  messages: string;
  tasks: string;
  eaMemory: string;
  feedback: string;
  behaviors: string;
}

export async function ensureDataDocuments(token: string): Promise<DataDocumentIds> {
  const ids = await ensureDocuments(
    token,
    {
      projects: { name: DOCUMENTS.PROJECTS, schema: projectSchema, visibility: "authenticated" },
      conversations: { name: DOCUMENTS.CONVERSATIONS, schema: conversationSchema, visibility: "authenticated" },
      messages: { name: DOCUMENTS.MESSAGES, schema: messageSchema, visibility: "authenticated" },
      tasks: { name: DOCUMENTS.TASKS, schema: taskSchema, visibility: "authenticated" },
      eaMemory: { name: DOCUMENTS.EA_MEMORY, schema: eaMemorySchema, visibility: "authenticated" },
      feedback: { name: DOCUMENTS.FEEDBACK, schema: feedbackSchema, visibility: "authenticated" },
      behaviors: { name: DOCUMENTS.BEHAVIORS, schema: behaviorSchema, visibility: "authenticated" },
    },
    "ai-native",
  );
  return ids as DataDocumentIds;
}

// ── Projects ───────────────────────────────────────────────

export async function listProjects(token: string, documentId: string, userId: string): Promise<Project[]> {
  const result = await queryRecords<Project>(token, documentId, {
    where: { field: "userId", op: "eq", value: userId },
    orderBy: [{ field: "createdAt", direction: "asc" }],
  });
  return result.records;
}

export async function getProject(token: string, documentId: string, id: string): Promise<Project | null> {
  const result = await queryRecords<Project>(token, documentId, {
    where: { field: "id", op: "eq", value: id },
    limit: 1,
  });
  return result.records[0] ?? null;
}

export async function createProject(
  token: string,
  documentId: string,
  input: Pick<Project, "orgId" | "userId" | "name" | "description"> & { isDefault?: boolean },
): Promise<Project> {
  const now = getNow();
  const project: Project = {
    id: generateId(),
    orgId: input.orgId,
    userId: input.userId,
    name: input.name,
    description: input.description,
    isDefault: input.isDefault ?? false,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  await insertRecords(token, documentId, [{ ...project, createdAt: now, updatedAt: now }]);
  return project;
}

export async function getOrCreateDefaultProject(
  token: string,
  documentId: string,
  orgId: string,
  userId: string,
): Promise<Project> {
  const result = await queryRecords<Project & { createdAt: string; updatedAt: string }>(
    token,
    documentId,
    {
      where: { field: "userId", op: "eq", value: userId },
      orderBy: [{ field: "isDefault", direction: "desc" }, { field: "createdAt", direction: "asc" }],
      limit: 1,
    },
  );
  if (result.records.length > 0) {
    const r = result.records[0]!;
    return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
  }
  return createProject(token, documentId, {
    orgId,
    userId,
    name: "Default",
    description: "Your default project",
    isDefault: true,
  });
}

// ── Conversations ──────────────────────────────────────────

export async function createConversation(
  token: string,
  documentId: string,
  input: { orgId: string; userId: string; projectId: string; title: string; id?: string },
): Promise<Conversation> {
  const now = getNow();
  const conv: Conversation = {
    id: input.id ?? generateId(),
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    title: input.title,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  await insertRecords(token, documentId, [{ ...conv, createdAt: now, updatedAt: now }]);
  return conv;
}

export async function getConversation(token: string, documentId: string, id: string): Promise<Conversation | null> {
  const result = await queryRecords<Conversation & { createdAt: string; updatedAt: string }>(
    token,
    documentId,
    { where: { field: "id", op: "eq", value: id }, limit: 1 },
  );
  if (!result.records[0]) return null;
  const r = result.records[0];
  return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
}

export async function listConversations(
  token: string,
  documentId: string,
  userId: string,
  projectId?: string,
): Promise<Conversation[]> {
  const result = await queryRecords<Conversation & { createdAt: string; updatedAt: string }>(
    token,
    documentId,
    {
      where: projectId
        ? { field: "projectId", op: "eq", value: projectId }
        : { field: "userId", op: "eq", value: userId },
      orderBy: [{ field: "updatedAt", direction: "desc" }],
    },
  );
  return result.records.map((r) => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) }));
}

export async function updateConversationTitle(
  token: string,
  documentId: string,
  id: string,
  title: string,
): Promise<void> {
  await updateRecords(token, documentId, { title, updatedAt: getNow() }, { field: "id", op: "eq", value: id });
}

// ── Messages ───────────────────────────────────────────────

export async function createMessage(
  token: string,
  documentId: string,
  input: { conversationId: string; role: string; content: string; coachKey?: string | null; metadata?: Record<string, unknown> | null; id?: string },
): Promise<Message> {
  const now = getNow();
  const msg: Message = {
    id: input.id ?? generateId(),
    conversationId: input.conversationId,
    role: input.role as "user" | "assistant" | "system",
    content: input.content,
    coachKey: input.coachKey ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(now),
  };
  await insertRecords(token, documentId, [
    { ...msg, createdAt: now, metadata: msg.metadata ? JSON.stringify(msg.metadata) : null },
  ]);
  return msg;
}

export async function listMessages(token: string, documentId: string, conversationId: string): Promise<Message[]> {
  const result = await queryRecords<Message & { createdAt: string; metadata: string | null }>(
    token,
    documentId,
    {
      where: { field: "conversationId", op: "eq", value: conversationId },
      orderBy: [{ field: "createdAt", direction: "asc" }],
    },
  );
  return result.records.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
  }));
}

// ── Agent Tasks ────────────────────────────────────────────

export async function createTask(
  token: string,
  documentId: string,
  input: {
    orgId: string;
    userId: string;
    projectId: string;
    conversationId?: string | null;
    taskType: string;
    title: string;
    triggerAt: Date;
    triggerDescription: string;
    repeatInterval?: string | null;
    contextKey?: string | null;
  },
): Promise<AgentTask> {
  const now = getNow();
  const task: AgentTask = {
    id: generateId(),
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    conversationId: input.conversationId ?? null,
    taskType: input.taskType as AgentTask["taskType"],
    title: input.title,
    status: "pending",
    triggerAt: input.triggerAt,
    triggerDescription: input.triggerDescription,
    repeatInterval: input.repeatInterval ?? null,
    contextKey: input.contextKey ?? null,
    result: null,
    metadata: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  await insertRecords(token, documentId, [
    { ...task, triggerAt: input.triggerAt.toISOString(), createdAt: now, updatedAt: now },
  ]);
  return task;
}

export async function listPendingTasks(
  token: string,
  documentId: string,
  userId: string,
): Promise<AgentTask[]> {
  const result = await queryRecords<AgentTask & { triggerAt: string; createdAt: string; updatedAt: string }>(
    token,
    documentId,
    {
      where: { field: "userId", op: "eq", value: userId },
      orderBy: [{ field: "triggerAt", direction: "asc" }],
    },
  );
  return result.records
    .filter((r) => r.status === "pending" && new Date(r.triggerAt) <= new Date())
    .map((r) => ({
      ...r,
      triggerAt: new Date(r.triggerAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
}

export async function updateTaskStatus(
  token: string,
  documentId: string,
  id: string,
  status: string,
  result?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { status, updatedAt: getNow() };
  if (result !== undefined) updates["result"] = result;
  await updateRecords(token, documentId, updates, { field: "id", op: "eq", value: id });
}

// ── EA Memory ──────────────────────────────────────────────

export async function upsertEaMemory(
  token: string,
  documentId: string,
  input: {
    orgId: string;
    userId: string;
    projectId: string;
    memoryType: EaMemoryType;
    key: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  },
): Promise<EaMemoryEntry> {
  const now = getNow();

  // data-api doesn't have native upsert — check existing first
  const existing = await queryRecords<{ id: string }>(token, documentId, {
    where: { field: "key", op: "eq", value: input.key },
    limit: 1,
  });

  if (existing.records.length > 0) {
    const id = existing.records[0]!.id;
    await updateRecords(
      token,
      documentId,
      {
        title: input.title,
        content: input.content,
        memoryType: input.memoryType,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        isActive: true,
        updatedAt: now,
      },
      { field: "id", op: "eq", value: id },
    );
    return {
      id,
      orgId: input.orgId,
      userId: input.userId,
      projectId: input.projectId,
      memoryType: input.memoryType,
      key: input.key,
      title: input.title,
      content: input.content,
      metadata: input.metadata ?? null,
      isActive: true,
      createdAt: null,
      updatedAt: new Date(now),
    };
  }

  const entry: EaMemoryEntry = {
    id: generateId(),
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    memoryType: input.memoryType,
    key: input.key,
    title: input.title,
    content: input.content,
    metadata: input.metadata ?? null,
    isActive: true,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };

  await insertRecords(token, documentId, [
    {
      ...entry,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return entry;
}

export async function listEaMemory(
  token: string,
  documentId: string,
  userId: string,
  projectId: string,
  memoryType?: EaMemoryType,
): Promise<EaMemoryEntry[]> {
  const result = await queryRecords<EaMemoryEntry & { metadata: string | null; createdAt: string; updatedAt: string }>(
    token,
    documentId,
    { where: { field: "userId", op: "eq", value: userId } },
  );
  return result.records
    .filter(
      (r) =>
        r.projectId === projectId &&
        r.isActive &&
        (!memoryType || r.memoryType === memoryType),
    )
    .map((r) => ({
      ...r,
      metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
    }));
}

export async function getEaMemoryByKey(
  token: string,
  documentId: string,
  userId: string,
  projectId: string,
  key: string,
): Promise<EaMemoryEntry | null> {
  const all = await listEaMemory(token, documentId, userId, projectId);
  return all.find((e) => e.key === key) ?? null;
}

export async function deleteEaMemory(token: string, documentId: string, userId: string, projectId: string, key: string): Promise<void> {
  const entry = await getEaMemoryByKey(token, documentId, userId, projectId, key);
  if (!entry) return;
  await updateRecords(token, documentId, { isActive: false, updatedAt: getNow() }, { field: "id", op: "eq", value: entry.id });
}

// ── Feedback ───────────────────────────────────────────────

export async function addFeedback(
  token: string,
  documentId: string,
  input: Omit<MessageFeedback, "id" | "createdAt">,
): Promise<MessageFeedback> {
  const now = getNow();
  const entry: MessageFeedback = {
    id: generateId(),
    messageId: input.messageId,
    conversationId: input.conversationId,
    userId: input.userId,
    orgId: input.orgId,
    coachKey: input.coachKey ?? null,
    value: input.value,
    comment: input.comment ?? null,
    createdAt: new Date(now),
  };
  await insertRecords(token, documentId, [{ ...entry, createdAt: now }]);
  return entry;
}

// ── Behaviors ──────────────────────────────────────────────

export async function listActiveBehaviors(
  token: string,
  documentId: string,
  orgId: string,
  userId: string,
  coachKey?: string,
): Promise<AgentBehavior[]> {
  const result = await queryRecords<AgentBehavior & { createdAt: string; updatedAt: string }>(
    token,
    documentId,
    { where: { field: "userId", op: "eq", value: userId } },
  );
  return result.records
    .filter(
      (r) =>
        r.orgId === orgId &&
        r.isActive &&
        (!coachKey || r.coachKey === coachKey || r.coachKey === null),
    )
    .map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
}

export async function addBehavior(
  token: string,
  documentId: string,
  input: Omit<AgentBehavior, "id" | "createdAt" | "updatedAt">,
): Promise<AgentBehavior> {
  const now = getNow();
  const behavior: AgentBehavior = {
    id: generateId(),
    ...input,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  await insertRecords(token, documentId, [{ ...behavior, createdAt: now, updatedAt: now }]);
  return behavior;
}

export async function deactivateBehavior(token: string, documentId: string, id: string): Promise<void> {
  await updateRecords(token, documentId, { isActive: false, updatedAt: getNow() }, { field: "id", op: "eq", value: id });
}
