import { eq, and, desc, gt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { reviewRequests, expertComments } from '../schema';

export interface ReviewRequest {
  id: string;
  conversation_id: string;
  message_id: number | null;
  requester_user_id: string;
  expert_email: string;
  expert_user_id: string | null;
  status: 'pending' | 'in_review' | 'completed' | 'expired';
  context_summary: string | null;
  question: string | null;
  access_token: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

export interface ExpertComment {
  id: string;
  review_request_id: string;
  conversation_id: string;
  author_email: string;
  author_name: string | null;
  author_user_id: string | null;
  content: string;
  parent_message_id: number | null;
  created_at: string;
}

function toReview(row: any): ReviewRequest {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    message_id: row.messageId,
    requester_user_id: row.requesterUserId,
    expert_email: row.expertEmail,
    expert_user_id: row.expertUserId,
    status: row.status as ReviewRequest['status'],
    context_summary: row.contextSummary,
    question: row.question,
    access_token: row.accessToken,
    expires_at: row.expiresAt?.toISOString() || '',
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
    completed_at: row.completedAt?.toISOString() || null,
  };
}

function toComment(row: any): ExpertComment {
  return {
    id: row.id,
    review_request_id: row.reviewRequestId,
    conversation_id: row.conversationId,
    author_email: row.authorEmail,
    author_name: row.authorName,
    author_user_id: row.authorUserId,
    content: row.content,
    parent_message_id: row.parentMessageId,
    created_at: row.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function createReviewRequest(
  conversationId: string,
  requesterId: string,
  expertEmail: string,
  question: string,
  contextSummary: string,
  accessToken: string,
  expiresAt: string,
  messageId?: number
): Promise<ReviewRequest> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(reviewRequests).values({
    id,
    conversationId,
    messageId: messageId || null,
    requesterUserId: requesterId,
    expertEmail,
    question,
    contextSummary,
    accessToken,
    expiresAt: new Date(expiresAt),
  });
  const [row] = await db.select().from(reviewRequests).where(eq(reviewRequests.id, id));
  return toReview(row);
}

export async function getReviewRequest(id: string): Promise<ReviewRequest | undefined> {
  const db = getDb();
  const [row] = await db.select().from(reviewRequests).where(eq(reviewRequests.id, id));
  return row ? toReview(row) : undefined;
}

export async function getReviewByToken(token: string): Promise<ReviewRequest | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(reviewRequests)
    .where(
      and(
        eq(reviewRequests.accessToken, token),
        gt(reviewRequests.expiresAt, new Date())
      )
    );
  return row ? toReview(row) : undefined;
}

export async function listReviewRequests(userId: string): Promise<ReviewRequest[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.requesterUserId, userId))
    .orderBy(desc(reviewRequests.createdAt));
  return rows.map(toReview);
}

export async function listReviewsForUser(userId: string): Promise<ReviewRequest[]> {
  return listReviewRequests(userId);
}

export async function listReviewsForExpert(expertEmail: string): Promise<ReviewRequest[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.expertEmail, expertEmail))
    .orderBy(desc(reviewRequests.createdAt));
  return rows.map(toReview);
}

export async function updateReviewStatus(
  id: string,
  status: 'pending' | 'in_review' | 'completed' | 'expired'
): Promise<void> {
  const db = getDb();
  const updates: Record<string, any> = { status };
  if (status === 'completed') {
    updates.completedAt = new Date();
  }
  await db.update(reviewRequests).set(updates).where(eq(reviewRequests.id, id));
}

export async function addExpertComment(
  reviewRequestId: string,
  conversationId: string,
  authorEmail: string,
  content: string,
  authorName?: string,
  authorUserId?: string,
  parentMessageId?: number
): Promise<ExpertComment> {
  const db = getDb();
  const id = uuidv4();
  await db.insert(expertComments).values({
    id,
    reviewRequestId,
    conversationId,
    authorEmail,
    authorName: authorName || null,
    authorUserId: authorUserId || null,
    content,
    parentMessageId: parentMessageId || null,
  });
  const [row] = await db.select().from(expertComments).where(eq(expertComments.id, id));
  return toComment(row);
}

export async function getExpertComments(conversationId: string): Promise<ExpertComment[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(expertComments)
    .where(eq(expertComments.conversationId, conversationId))
    .orderBy(expertComments.createdAt);
  return rows.map(toComment);
}

export async function getExpertCommentsByReview(reviewRequestId: string): Promise<ExpertComment[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(expertComments)
    .where(eq(expertComments.reviewRequestId, reviewRequestId))
    .orderBy(expertComments.createdAt);
  return rows.map(toComment);
}
