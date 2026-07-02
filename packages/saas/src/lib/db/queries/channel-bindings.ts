import { eq, and, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { channelBindings } from '../schema';

export type ChannelType = 'telegram' | 'whatsapp' | 'signal';

export interface ChannelBinding {
  id: string;
  userId: string;
  orgId: string;
  channelType: ChannelType;
  externalId: string | null;
  displayName: string | null;
  linkCode: string | null;
  linkExpiresAt: Date | null;
  verifiedAt: Date | null;
  bridgeConversationId: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Creates or refreshes a link code for the given user + channel type.
 * If a binding already exists (even verified), resets the link code with a new 10-minute TTL.
 */
export async function createLinkCode(
  userId: string,
  orgId: string,
  channelType: ChannelType
): Promise<{ id: string; linkCode: string; expiresAt: Date }> {
  const db = getDb();
  const linkCode = generateLinkCode();
  const linkExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [existing] = await db
    .select()
    .from(channelBindings)
    .where(and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType)));

  if (existing) {
    const [updated] = await db
      .update(channelBindings)
      .set({ linkCode, linkExpiresAt, updatedAt: new Date() })
      .where(eq(channelBindings.id, existing.id))
      .returning();
    return { id: updated.id, linkCode, expiresAt: linkExpiresAt };
  }

  const id = uuidv4();
  await db.insert(channelBindings).values({
    id,
    userId,
    orgId,
    channelType,
    linkCode,
    linkExpiresAt,
    isActive: true,
  });
  return { id, linkCode, expiresAt: linkExpiresAt };
}

/**
 * Verifies a link code received from an external channel and activates the binding.
 * Sets the externalId (e.g. Telegram chat_id) and marks as verified.
 * Returns the userId + orgId on success, or null if the code is invalid/expired.
 */
export async function verifyLinkCode(
  code: string,
  channelType: ChannelType,
  externalId: string,
  displayName?: string
): Promise<{ userId: string; orgId: string } | null> {
  const db = getDb();
  const now = new Date();

  const [binding] = await db
    .select()
    .from(channelBindings)
    .where(
      and(
        eq(channelBindings.linkCode, code),
        eq(channelBindings.channelType, channelType)
      )
    );

  if (!binding) return null;
  if (binding.linkExpiresAt && binding.linkExpiresAt < now) return null;

  await db
    .update(channelBindings)
    .set({
      externalId,
      displayName: displayName || null,
      verifiedAt: now,
      linkCode: null,
      linkExpiresAt: null,
      isActive: true,
      updatedAt: now,
    })
    .where(eq(channelBindings.id, binding.id));

  return { userId: binding.userId, orgId: binding.orgId };
}

/**
 * Looks up an active, verified binding by channel type + external ID.
 * Used when a message arrives from an external channel to find the user.
 */
export async function lookupBinding(
  channelType: ChannelType,
  externalId: string
): Promise<{ userId: string; orgId: string } | null> {
  const db = getDb();

  const [binding] = await db
    .select()
    .from(channelBindings)
    .where(
      and(
        eq(channelBindings.channelType, channelType),
        eq(channelBindings.externalId, externalId),
        eq(channelBindings.isActive, true),
        isNotNull(channelBindings.verifiedAt)
      )
    );

  if (!binding) return null;
  return { userId: binding.userId, orgId: binding.orgId };
}

/**
 * Returns all active bindings for a user.
 */
export async function getUserBindings(userId: string): Promise<ChannelBinding[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(channelBindings)
    .where(and(eq(channelBindings.userId, userId), eq(channelBindings.isActive, true)));
  return rows as ChannelBinding[];
}

/**
 * Returns a single binding for a user + channel type (active or not).
 */
export async function getUserBinding(
  userId: string,
  channelType: ChannelType
): Promise<ChannelBinding | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(channelBindings)
    .where(and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType)));
  return row ? (row as ChannelBinding) : null;
}

/**
 * Deactivates (soft-deletes) a channel binding for a user.
 */
export async function removeBinding(userId: string, channelType: ChannelType): Promise<void> {
  const db = getDb();
  await db
    .update(channelBindings)
    .set({ isActive: false, externalId: null, verifiedAt: null, updatedAt: new Date() })
    .where(and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType)));
}

/**
 * Returns a verified binding's externalId for a given userId + channelType.
 * Used by the notification dispatcher to send outbound messages.
 */
export async function getVerifiedExternalId(
  userId: string,
  channelType: ChannelType
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ externalId: channelBindings.externalId })
    .from(channelBindings)
    .where(
      and(
        eq(channelBindings.userId, userId),
        eq(channelBindings.channelType, channelType),
        eq(channelBindings.isActive, true),
        isNotNull(channelBindings.verifiedAt)
      )
    );
  return row?.externalId ?? null;
}

/**
 * Persists the conversation ID used for bridge chat history on a verified binding.
 */
export async function setBridgeConversationId(
  userId: string,
  channelType: ChannelType,
  conversationId: string
): Promise<void> {
  const db = getDb();
  await db
    .update(channelBindings)
    .set({ bridgeConversationId: conversationId, updatedAt: new Date() })
    .where(and(eq(channelBindings.userId, userId), eq(channelBindings.channelType, channelType)));
}
