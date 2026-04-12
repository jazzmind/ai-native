import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  real,
  jsonb,
  unique,
  serial,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ══════════════════════════════════════════════
// Organizations & Memberships
// ══════════════════════════════════════════════

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'team'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  monthlyMessageCount: integer('monthly_message_count').notNull().default(0),
  monthlyMessageResetAt: timestamp('monthly_message_reset_at'),
  expertReviewCredits: integer('expert_review_credits').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orgMemberships = pgTable('org_memberships', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.orgId, t.userId),
}));

// ══════════════════════════════════════════════
// User API Keys (BYO key storage)
// ══════════════════════════════════════════════

export const userApiKeys = pgTable('user_api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull().default('anthropic'),
  encryptedKey: text('encrypted_key').notNull(),
  keyHint: text('key_hint').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Usage Events
// ══════════════════════════════════════════════

export const usageEvents = pgTable('usage_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata'),
  billingPeriod: text('billing_period').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Projects (migrated from SQLite, now org-scoped)
// ══════════════════════════════════════════════

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Conversations & Messages (migrated, now org-scoped)
// ══════════════════════════════════════════════

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull().default(''),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  coachKey: text('coach_key'),
  mode: text('mode'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Coach Sessions
// ══════════════════════════════════════════════

export const coachSessions = pgTable('coach_sessions', {
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  coachKey: text('coach_key').notNull(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  pk: unique().on(t.conversationId, t.coachKey),
}));

// ══════════════════════════════════════════════
// Knowledge Shares
// ══════════════════════════════════════════════

export const knowledgeShares = pgTable('knowledge_shares', {
  id: text('id').primaryKey(),
  sourceProjectId: text('source_project_id').notNull(),
  targetProjectId: text('target_project_id').notNull(),
  collectionId: text('collection_id'),
  sharedByUserId: text('shared_by_user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Message Feedback
// ══════════════════════════════════════════════

export const messageFeedback = pgTable('message_feedback', {
  id: text('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => messages.id),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id').notNull(),
  coachKey: text('coach_key'),
  mode: text('mode'),
  rating: text('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Agent Behaviors (now org-scoped)
// ══════════════════════════════════════════════

export const agentBehaviors = pgTable('agent_behaviors', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  coachKey: text('coach_key').notNull(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  directive: text('directive').notNull(),
  isActive: boolean('is_active').default(true),
  source: text('source').default('manual'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Behavior Revisions (now org-scoped)
// ══════════════════════════════════════════════

export const behaviorRevisions = pgTable('behavior_revisions', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  coachKey: text('coach_key').notNull(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  status: text('status').default('proposed'),
  analysis: text('analysis').notNull(),
  proposedDirective: text('proposed_directive').notNull(),
  sourceFeedbackIds: text('source_feedback_ids'),
  createdAt: timestamp('created_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

// ══════════════════════════════════════════════
// Tool Trust (now org-scoped)
// ══════════════════════════════════════════════

export const toolTrust = pgTable('tool_trust', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull(),
  toolPattern: text('tool_pattern').notNull(),
  trustLevel: text('trust_level').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.projectId, t.toolPattern),
}));

// ══════════════════════════════════════════════
// Review Requests (extended for marketplace)
// ══════════════════════════════════════════════

export const reviewRequests = pgTable('review_requests', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  messageId: integer('message_id'),
  requesterUserId: text('requester_user_id').notNull(),
  expertEmail: text('expert_email').notNull(),
  expertUserId: text('expert_user_id'),
  status: text('status').default('pending'),
  contextSummary: text('context_summary'),
  question: text('question'),
  accessToken: text('access_token').unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  budgetCents: integer('budget_cents'),
  domain: text('domain'),
  awardWindowHours: integer('award_window_hours').default(4),
  awardedExpertId: text('awarded_expert_id'),
  platformFeeCents: integer('platform_fee_cents'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
});

// ══════════════════════════════════════════════
// Expert Comments (extended for marketplace)
// ══════════════════════════════════════════════

export const expertComments = pgTable('expert_comments', {
  id: text('id').primaryKey(),
  reviewRequestId: text('review_request_id').notNull().references(() => reviewRequests.id),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  authorEmail: text('author_email').notNull(),
  authorName: text('author_name'),
  authorUserId: text('author_user_id'),
  content: text('content').notNull(),
  parentMessageId: integer('parent_message_id'),
  createdAt: timestamp('created_at').defaultNow(),
  deliveryStatus: text('delivery_status').default('pending'),
  expertRating: integer('expert_rating'),
  payoutStatus: text('payout_status').default('pending'),
  stripeTransferId: text('stripe_transfer_id'),
});

// ══════════════════════════════════════════════
// Expert Profiles (Marketplace)
// ══════════════════════════════════════════════

export const expertProfiles = pgTable('expert_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  domains: text('domains').notNull(),
  rateMinCents: integer('rate_min_cents').notNull().default(2500),
  rateMaxCents: integer('rate_max_cents').notNull().default(50000),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  stripeConnectOnboarded: boolean('stripe_connect_onboarded').default(false),
  isActive: boolean('is_active').default(false),
  isFoundingExpert: boolean('is_founding_expert').default(false),
  platformFeeRate: real('platform_fee_rate').default(0.20),
  averageRating: real('average_rating'),
  totalReviews: integer('total_reviews').default(0),
  acceptanceRate: real('acceptance_rate'),
  avgDeliveryHours: real('avg_delivery_hours'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Marketplace Requests
// ══════════════════════════════════════════════

export const marketplaceRequests = pgTable('marketplace_requests', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  messageId: integer('message_id'),
  requesterUserId: text('requester_user_id').notNull(),
  title: text('title').notNull(),
  question: text('question').notNull(),
  contextSummary: text('context_summary').notNull(),
  domain: text('domain').notNull(),
  budgetCents: integer('budget_cents').notNull(),
  platformFeeCents: integer('platform_fee_cents'),
  expertPayoutCents: integer('expert_payout_cents'),
  status: text('status').notNull().default('open'),
  awardWindowHours: integer('award_window_hours').notNull().default(4),
  awardedAt: timestamp('awarded_at'),
  awardedExpertId: text('awarded_expert_id').references(() => expertProfiles.id),
  deliveryDeadline: timestamp('delivery_deadline'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId: text('stripe_transfer_id'),
  expertRating: integer('expert_rating'),
  expertRatingNote: text('expert_rating_note'),
  accessToken: text('access_token').unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ══════════════════════════════════════════════
// Expert Bids
// ══════════════════════════════════════════════

export const expertBids = pgTable('expert_bids', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => marketplaceRequests.id),
  expertId: text('expert_id').notNull().references(() => expertProfiles.id),
  status: text('status').notNull().default('pending'),
  bidCents: integer('bid_cents').notNull(),
  estimatedHours: real('estimated_hours'),
  note: text('note'),
  notifiedAt: timestamp('notified_at'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ══════════════════════════════════════════════
// Relations
// ══════════════════════════════════════════════

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(orgMemberships),
  apiKeys: many(userApiKeys),
}));

export const orgMembershipsRelations = relations(orgMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMemberships.orgId],
    references: [organizations.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const marketplaceRequestsRelations = relations(marketplaceRequests, ({ many, one }) => ({
  bids: many(expertBids),
  awardedExpert: one(expertProfiles, {
    fields: [marketplaceRequests.awardedExpertId],
    references: [expertProfiles.id],
  }),
}));

export const expertBidsRelations = relations(expertBids, ({ one }) => ({
  request: one(marketplaceRequests, {
    fields: [expertBids.requestId],
    references: [marketplaceRequests.id],
  }),
  expert: one(expertProfiles, {
    fields: [expertBids.expertId],
    references: [expertProfiles.id],
  }),
}));
