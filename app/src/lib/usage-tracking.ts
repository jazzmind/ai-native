import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db/client';
import { usageEvents } from './db/schema';

function getBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function trackEvent(
  orgId: string,
  userId: string,
  eventType: string,
  metadata?: Record<string, any>,
) {
  try {
    const db = getDb();
    await db.insert(usageEvents).values({
      id: uuidv4(),
      orgId,
      userId,
      eventType,
      metadata: metadata || {},
      billingPeriod: getBillingPeriod(),
    });
  } catch (err) {
    console.error('Failed to track event:', err);
  }
}

// Standard event types for growth tracking
export const Events = {
  // Activation funnel
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_EMAIL_VERIFIED: 'signup_email_verified',
  SIGNUP_COMPLETED: 'signup_completed',

  // Engagement
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_CREATED: 'conversation_created',
  PROJECT_CREATED: 'project_created',
  KNOWLEDGE_EXTRACTED: 'knowledge_extracted',
  CONVERSATION_EXPORTED: 'conversation_exported',

  // Feature adoption
  API_KEY_ADDED: 'api_key_added',
  API_KEY_REMOVED: 'api_key_removed',
  EXPERT_REVIEW_REQUESTED: 'expert_review_requested',
  FEEDBACK_GIVEN: 'feedback_given',

  // Monetization
  PLAN_UPGRADE_STARTED: 'plan_upgrade_started',
  PLAN_UPGRADED: 'plan_upgraded',
  PLAN_DOWNGRADED: 'plan_downgraded',
  PLAN_CANCELED: 'plan_canceled',
  PAYMENT_FAILED: 'payment_failed',

  // Session signals
  SESSION_START: 'session_start',
  LOGIN: 'login',
} as const;
