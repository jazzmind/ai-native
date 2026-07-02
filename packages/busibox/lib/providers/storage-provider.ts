/**
 * StorageProvider — Busibox implementation.
 *
 * Wraps lib/data-api-client.ts's document CRUD functions as bound methods
 * on a class that resolves (and memoizes) the underlying data-api document
 * ids from a single bearer token, matching the shape of the shared
 * StorageProvider interface used by both platforms.
 */

import { updateRecords, deleteRecords, getNow } from "@jazzmind/busibox-app";
import type {
  AgentBehavior,
  AgentTask,
  Conversation,
  CreateAgentTaskInput,
  CreateConversationInput,
  CreateMessageInput,
  CreateProjectInput,
  EaMemoryEntry,
  EaMemoryType,
  Message,
  MessageFeedback,
  Project,
  StorageProvider,
  TaskStatus,
  UpsertEaMemoryInput,
} from "@ai-native/core";
import {
  type DataDocumentIds,
  ensureDataDocuments,
  listProjects as apiListProjects,
  getProject as apiGetProject,
  createProject as apiCreateProject,
  getOrCreateDefaultProject as apiGetOrCreateDefaultProject,
  createConversation as apiCreateConversation,
  getConversation as apiGetConversation,
  listConversations as apiListConversations,
  updateConversationTitle as apiUpdateConversationTitle,
  createMessage as apiCreateMessage,
  listMessages as apiListMessages,
  createTask as apiCreateTask,
  listPendingTasks as apiListPendingTasks,
  updateTaskStatus as apiUpdateTaskStatus,
  upsertEaMemory as apiUpsertEaMemory,
  listEaMemory as apiListEaMemory,
  getEaMemoryByKey as apiGetEaMemoryByKey,
  deleteEaMemory as apiDeleteEaMemory,
  addFeedback as apiAddFeedback,
  listActiveBehaviors as apiListActiveBehaviors,
  addBehavior as apiAddBehavior,
  deactivateBehavior as apiDeactivateBehavior,
} from "../data-api-client";

export class BusiboxStorageProvider implements StorageProvider {
  readonly type = "busibox-data-api";

  private documentIdsPromise: Promise<DataDocumentIds> | null = null;

  constructor(private readonly token: string) {}

  private docs(): Promise<DataDocumentIds> {
    if (!this.documentIdsPromise) {
      this.documentIdsPromise = ensureDataDocuments(this.token);
    }
    return this.documentIdsPromise;
  }

  // ── Projects ────────────────────────────────────────────

  async getOrCreateDefaultProject(orgId: string, userId: string): Promise<Project> {
    const docs = await this.docs();
    return apiGetOrCreateDefaultProject(this.token, docs.projects, orgId, userId);
  }

  async getProject(id: string): Promise<Project | null> {
    const docs = await this.docs();
    return apiGetProject(this.token, docs.projects, id);
  }

  async listProjects(orgId: string, userId: string): Promise<Project[]> {
    const docs = await this.docs();
    return apiListProjects(this.token, docs.projects, userId);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const docs = await this.docs();
    return apiCreateProject(this.token, docs.projects, input);
  }

  async updateProject(id: string, updates: Partial<Pick<Project, "name" | "description">>): Promise<Project> {
    const docs = await this.docs();
    await updateRecords(this.token, docs.projects, { ...updates, updatedAt: getNow() }, { field: "id", op: "eq", value: id });
    const updated = await apiGetProject(this.token, docs.projects, id);
    if (!updated) {
      throw new Error(`Project ${id} not found after update`);
    }
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    const docs = await this.docs();
    await deleteRecords(this.token, docs.projects, { field: "id", op: "eq", value: id });
  }

  // ── Conversations ───────────────────────────────────────

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const docs = await this.docs();
    return apiCreateConversation(this.token, docs.conversations, input);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const docs = await this.docs();
    return apiGetConversation(this.token, docs.conversations, id);
  }

  async listConversations(orgId: string, userId: string, projectId?: string): Promise<Conversation[]> {
    const docs = await this.docs();
    return apiListConversations(this.token, docs.conversations, userId, projectId);
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const docs = await this.docs();
    return apiUpdateConversationTitle(this.token, docs.conversations, id, title);
  }

  async deleteConversation(id: string): Promise<void> {
    const docs = await this.docs();
    await deleteRecords(this.token, docs.conversations, { field: "id", op: "eq", value: id });
  }

  // ── Messages ────────────────────────────────────────────

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const docs = await this.docs();
    return apiCreateMessage(this.token, docs.messages, input);
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const docs = await this.docs();
    return apiListMessages(this.token, docs.messages, conversationId);
  }

  // ── Agent tasks ─────────────────────────────────────────

  async createAgentTask(input: CreateAgentTaskInput): Promise<AgentTask> {
    const docs = await this.docs();
    return apiCreateTask(this.token, docs.tasks, input);
  }

  async listPendingTasks(userId: string, before?: Date): Promise<AgentTask[]> {
    const docs = await this.docs();
    const tasks = await apiListPendingTasks(this.token, docs.tasks, userId);
    return before ? tasks.filter((t) => t.triggerAt <= before) : tasks;
  }

  async updateTaskStatus(id: string, status: TaskStatus, result?: string): Promise<void> {
    const docs = await this.docs();
    return apiUpdateTaskStatus(this.token, docs.tasks, id, status, result);
  }

  // ── EA memory ───────────────────────────────────────────

  async upsertEaMemory(input: UpsertEaMemoryInput): Promise<EaMemoryEntry> {
    const docs = await this.docs();
    return apiUpsertEaMemory(this.token, docs.eaMemory, input);
  }

  async listEaMemory(userId: string, projectId: string, memoryType?: EaMemoryType): Promise<EaMemoryEntry[]> {
    const docs = await this.docs();
    return apiListEaMemory(this.token, docs.eaMemory, userId, projectId, memoryType);
  }

  async getEaMemory(userId: string, projectId: string, key: string): Promise<EaMemoryEntry | null> {
    const docs = await this.docs();
    return apiGetEaMemoryByKey(this.token, docs.eaMemory, userId, projectId, key);
  }

  async deleteEaMemory(userId: string, projectId: string, key: string): Promise<void> {
    const docs = await this.docs();
    return apiDeleteEaMemory(this.token, docs.eaMemory, userId, projectId, key);
  }

  // ── Feedback ────────────────────────────────────────────

  async addMessageFeedback(input: Omit<MessageFeedback, "id" | "createdAt">): Promise<MessageFeedback> {
    const docs = await this.docs();
    return apiAddFeedback(this.token, docs.feedback, input);
  }

  // ── Behaviors ───────────────────────────────────────────

  async listActiveBehaviors(orgId: string, userId: string, coachKey?: string): Promise<AgentBehavior[]> {
    const docs = await this.docs();
    return apiListActiveBehaviors(this.token, docs.behaviors, orgId, userId, coachKey);
  }

  async addBehavior(input: Omit<AgentBehavior, "id" | "createdAt" | "updatedAt">): Promise<AgentBehavior> {
    const docs = await this.docs();
    return apiAddBehavior(this.token, docs.behaviors, input);
  }

  async deactivateBehavior(id: string): Promise<void> {
    const docs = await this.docs();
    return apiDeactivateBehavior(this.token, docs.behaviors, id);
  }
}
