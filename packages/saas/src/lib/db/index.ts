// Barrel re-export — all query functions available from '@/lib/db'
// Note: All functions are now async (migrated from sync SQLite to async Postgres/Drizzle)

export { getDb, type DrizzleDb } from './client';

// Organizations
export {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  getUserOrganization,
  getUserMembership,
  updateOrganization,
  incrementMessageCount,
  getMessageCount,
  listOrganizationMembers,
  addOrgMember,
  type Organization,
} from './queries/organizations';

// Projects
export {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  getOrCreateDefaultProject,
  countProjects,
  getProjectStats,
  type Project,
  type ProjectStats,
} from './queries/projects';

// Conversations & Messages
export {
  createConversation,
  listConversations,
  getConversation,
  addMessage,
  getMessages,
  setCoachSession,
  getCoachSession,
  type Conversation,
  type Message,
} from './queries/conversations';

// Feedback
export {
  addFeedback,
  getFeedbackForMessage,
  getFeedbackStats,
  getFeedbackByCoach,
  getFeedbackTimeline,
  getModeUsageDistribution,
  getRecentNegativeFeedback,
  type MessageFeedback,
} from './queries/feedback';

// Behaviors
export {
  createBehavior,
  listBehaviors,
  getActiveBehaviors,
  updateBehavior,
  deleteBehavior,
  createRevision,
  listRevisions,
  updateRevisionStatus,
  type AgentBehavior,
  type BehaviorRevision,
} from './queries/behaviors';

// Reviews & Expert Comments
export {
  createReviewRequest,
  getReviewRequest,
  getReviewByToken,
  listReviewRequests,
  listReviewsForUser,
  listReviewsForExpert,
  updateReviewStatus,
  addExpertComment,
  getExpertComments,
  getExpertCommentsByReview,
  type ReviewRequest,
  type ExpertComment,
} from './queries/reviews';

// Expert Marketplace
export {
  createExpertProfile,
  getExpertProfile,
  getExpertProfileByUserId,
  listExpertProfiles,
  updateExpertProfile,
  findEligibleExperts,
  countEligibleExperts,
  createBid,
  getBid,
  getBidsForRequest,
  updateBidStatus,
  getBidByExpertAndRequest,
} from './queries/experts';

// Knowledge Shares
export {
  createKnowledgeShare,
  listKnowledgeShares,
  deleteKnowledgeShare,
  type KnowledgeShare,
} from './queries/knowledge-shares';

// Tool Trust
export {
  getToolTrust,
  setToolTrust,
  listToolTrust,
  deleteToolTrust,
  type ToolTrust,
} from './queries/tool-trust';

// Agent Tasks
export {
  createAgentTask,
  getDueTasks,
  markTaskTriggered,
  rescheduleTask,
  dismissTask,
  listAgentTasksForUser,
  updateAgentTask,
  getAgentTask,
} from './queries/agent-tasks';

// EA Memory (Chief of Staff)
export {
  upsertEaMemory,
  getEaMemory,
  listEaMemory,
  deleteEaMemory,
  formatEaMemoryForPrompt,
  type EaMemoryEntry,
  type EaMemoryType,
} from './queries/ea-memory';

// Notifications
export {
  createNotification,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './queries/notifications';

// API Keys — NOT re-exported here because api-keys.ts imports encryption.ts
// which uses Node.js crypto, incompatible with Edge Runtime (middleware).
// Import directly: import { storeApiKey, ... } from '@/lib/db/queries/api-keys';

// Task Artifacts
export {
  createArtifact,
  listArtifactsForTask,
  getArtifact,
  getArtifactForUser,
  countArtifactsForTask,
  getLatestArtifactForTask,
  type TaskArtifact,
} from './queries/task-artifacts';

// Data Collection Sessions
export {
  createDataCollectionSession,
  getSessionByToken,
  updateSessionData,
  completeSession,
  type DataCollectionSession,
  type CollectedMessage,
} from './queries/data-collection';

// App Settings
export {
  getAppSetting,
  setAppSetting,
} from './queries/app-settings';

// Schema (for direct access when needed)
export * as schema from './schema';
