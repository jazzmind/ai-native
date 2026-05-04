import type { EaMemoryType } from '../types/ea-memory';

/**
 * StorageProvider abstracts persistent state for the application.
 *
 * SaaS implementation: Drizzle ORM + Neon Postgres
 * Busibox implementation: data-api document CRUD (queryRecords / insertRecords)
 */

// ── Projects ──────────────────────────────────────────────

export interface Project {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProjectInput = Pick<Project, 'orgId' | 'userId' | 'name' | 'description'> & {
  isDefault?: boolean;
};

// ── Conversations ──────────────────────────────────────────

export interface Conversation {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateConversationInput = Pick<Conversation, 'orgId' | 'userId' | 'projectId' | 'title'> & {
  id?: string;
};

// ── Messages ───────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  coachKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type CreateMessageInput = Pick<Message, 'conversationId' | 'role' | 'content'> & {
  id?: string;
  coachKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ── Agent Tasks ────────────────────────────────────────────

export type TaskType =
  | 'coaching_followup'
  | 'reminder'
  | 'deadline'
  | 'check_in'
  | 'status_report_collection'
  | 'ea_briefing';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AgentTask {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  conversationId: string | null;
  taskType: TaskType;
  title: string;
  status: TaskStatus;
  triggerAt: Date;
  triggerDescription: string;
  repeatInterval: string | null;
  contextKey: string | null;
  result: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAgentTaskInput = Pick<
  AgentTask,
  | 'orgId'
  | 'userId'
  | 'projectId'
  | 'taskType'
  | 'title'
  | 'triggerAt'
  | 'triggerDescription'
> & {
  conversationId?: string | null;
  repeatInterval?: string | null;
  contextKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ── EA Memory ─────────────────────────────────────────────

export interface EaMemoryEntry {
  id: string;
  orgId: string;
  userId: string;
  projectId: string;
  memoryType: EaMemoryType;
  key: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type UpsertEaMemoryInput = Pick<
  EaMemoryEntry,
  'orgId' | 'userId' | 'projectId' | 'memoryType' | 'key' | 'title' | 'content'
> & {
  metadata?: Record<string, unknown>;
};

// ── Feedback & Behaviors ───────────────────────────────────

export type FeedbackValue = 'up' | 'down';

export interface MessageFeedback {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  orgId: string;
  coachKey: string | null;
  value: FeedbackValue;
  comment: string | null;
  createdAt: Date;
}

export interface AgentBehavior {
  id: string;
  orgId: string;
  userId: string;
  coachKey: string | null;
  directive: string;
  sourceMessageId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── The Provider Interface ─────────────────────────────────

export interface StorageProvider {
  readonly type: string;

  // Projects
  getOrCreateDefaultProject(orgId: string, userId: string): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(orgId: string, userId: string): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Conversations
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(orgId: string, userId: string, projectId?: string): Promise<Conversation[]>;
  updateConversationTitle(id: string, title: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;

  // Messages
  createMessage(input: CreateMessageInput): Promise<Message>;
  listMessages(conversationId: string): Promise<Message[]>;

  // Agent tasks
  createAgentTask(input: CreateAgentTaskInput): Promise<AgentTask>;
  listPendingTasks(userId: string, before?: Date): Promise<AgentTask[]>;
  updateTaskStatus(id: string, status: TaskStatus, result?: string): Promise<void>;

  // EA memory
  upsertEaMemory(input: UpsertEaMemoryInput): Promise<EaMemoryEntry>;
  listEaMemory(userId: string, projectId: string, memoryType?: EaMemoryType): Promise<EaMemoryEntry[]>;
  getEaMemory(userId: string, projectId: string, key: string): Promise<EaMemoryEntry | null>;
  deleteEaMemory(userId: string, projectId: string, key: string): Promise<void>;

  // Feedback
  addMessageFeedback(input: Omit<MessageFeedback, 'id' | 'createdAt'>): Promise<MessageFeedback>;

  // Behaviors (active directives injected into agent context)
  listActiveBehaviors(orgId: string, userId: string, coachKey?: string): Promise<AgentBehavior[]>;
  addBehavior(input: Omit<AgentBehavior, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentBehavior>;
  deactivateBehavior(id: string): Promise<void>;
}
