import { describe, it, expect, vi, beforeEach } from "vitest";

const DOC_IDS = {
  projects: "doc-projects",
  conversations: "doc-conversations",
  messages: "doc-messages",
  tasks: "doc-tasks",
  eaMemory: "doc-ea-memory",
  feedback: "doc-feedback",
  behaviors: "doc-behaviors",
};

// vi.hoisted() is required because vi.mock() factories are hoisted above
// top-level const declarations.
const { updateRecordsMock, deleteRecordsMock, ensureDataDocumentsMock, getProjectMock } = vi.hoisted(() => ({
  updateRecordsMock: vi.fn(),
  deleteRecordsMock: vi.fn(),
  ensureDataDocumentsMock: vi.fn(),
  getProjectMock: vi.fn(),
}));

vi.mock("@jazzmind/busibox-app", () => ({
  updateRecords: updateRecordsMock,
  deleteRecords: deleteRecordsMock,
  getNow: () => "2024-01-01T00:00:00.000Z",
}));

vi.mock("../../data-api-client", () => ({
  ensureDataDocuments: ensureDataDocumentsMock,
  getProject: (...args: unknown[]) => getProjectMock(...args),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getOrCreateDefaultProject: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  updateConversationTitle: vi.fn(),
  createMessage: vi.fn(),
  listMessages: vi.fn(),
  createTask: vi.fn(),
  listPendingTasks: vi.fn().mockResolvedValue([]),
  updateTaskStatus: vi.fn(),
  upsertEaMemory: vi.fn(),
  listEaMemory: vi.fn(),
  getEaMemoryByKey: vi.fn(),
  deleteEaMemory: vi.fn(),
  addFeedback: vi.fn(),
  listActiveBehaviors: vi.fn(),
  addBehavior: vi.fn(),
  deactivateBehavior: vi.fn(),
}));

import { BusiboxStorageProvider } from "../storage-provider";

describe("BusiboxStorageProvider", () => {
  beforeEach(() => {
    updateRecordsMock.mockReset();
    deleteRecordsMock.mockReset().mockResolvedValue({ count: 1 });
    ensureDataDocumentsMock.mockReset().mockResolvedValue(DOC_IDS);
    getProjectMock.mockReset();
  });

  it("deleteProject issues a deleteRecords call filtered by id against the projects document", async () => {
    const storage = new BusiboxStorageProvider("token-123");
    await storage.deleteProject("proj-1");

    expect(deleteRecordsMock).toHaveBeenCalledWith(
      "token-123",
      DOC_IDS.projects,
      { field: "id", op: "eq", value: "proj-1" },
    );
  });

  it("deleteConversation issues a deleteRecords call filtered by id against the conversations document", async () => {
    const storage = new BusiboxStorageProvider("token-123");
    await storage.deleteConversation("conv-1");

    expect(deleteRecordsMock).toHaveBeenCalledWith(
      "token-123",
      DOC_IDS.conversations,
      { field: "id", op: "eq", value: "conv-1" },
    );
  });

  it("updateProject updates the record then re-fetches it", async () => {
    const updated = {
      id: "proj-1",
      orgId: "org1",
      userId: "user1",
      name: "New name",
      description: "New description",
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    getProjectMock.mockResolvedValue(updated);

    const storage = new BusiboxStorageProvider("token-123");
    const result = await storage.updateProject("proj-1", { name: "New name", description: "New description" });

    expect(updateRecordsMock).toHaveBeenCalledWith(
      "token-123",
      DOC_IDS.projects,
      { name: "New name", description: "New description", updatedAt: "2024-01-01T00:00:00.000Z" },
      { field: "id", op: "eq", value: "proj-1" },
    );
    expect(result).toBe(updated);
  });

  it("updateProject throws if the record is missing after the update", async () => {
    getProjectMock.mockResolvedValue(null);
    const storage = new BusiboxStorageProvider("token-123");

    await expect(storage.updateProject("missing", { name: "x" })).rejects.toThrow(/not found/);
  });

  it("memoizes ensureDataDocuments across multiple calls", async () => {
    const storage = new BusiboxStorageProvider("token-123");
    await storage.deleteProject("a");
    await storage.deleteConversation("b");

    expect(ensureDataDocumentsMock).toHaveBeenCalledTimes(1);
  });
});
