import { eq, and, desc, count, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { organizations, orgMemberships, conversations, messages, userApiKeys } from '../schema';

export interface Organization {
  id: string;
  name: string;
  companyName: string | null;
  slug: string;
  plan: 'free' | 'pro' | 'team';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
  monthlyMessageCount: number;
  monthlyMessageResetAt: Date | null;
  expertReviewCredits: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export async function createOrganization(
  name: string,
  slug: string,
  ownerUserId: string,
  plan: 'free' | 'pro' | 'team' = 'free',
  companyName?: string,
): Promise<Organization> {
  const db = getDb();
  const orgId = uuidv4();
  const membershipId = uuidv4();

  await db.insert(organizations).values({
    id: orgId,
    name,
    companyName: companyName || null,
    slug,
    plan,
  });

  await db.insert(orgMemberships).values({
    id: membershipId,
    orgId,
    userId: ownerUserId,
    role: 'owner',
  });

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  return org as Organization;
}

export async function getOrganization(id: string): Promise<Organization | undefined> {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  return org as Organization | undefined;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return org as Organization | undefined;
}

export async function getUserOrganization(userId: string): Promise<Organization | undefined> {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId));

  if (!membership) return undefined;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, membership.orgId));

  return org as Organization | undefined;
}

export async function getUserMembership(userId: string, orgId: string) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, orgId)));
  return membership;
}

export async function updateOrganization(
  id: string,
  updates: Partial<{
    name: string;
    plan: 'free' | 'pro' | 'team';
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    subscriptionStatus: string;
    monthlyMessageCount: number;
    monthlyMessageResetAt: Date;
    expertReviewCredits: number;
  }>
): Promise<void> {
  const db = getDb();
  await db
    .update(organizations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(organizations.id, id));
}

export async function incrementMessageCount(orgId: string): Promise<void> {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return;

  const now = new Date();
  const resetAt = org.monthlyMessageResetAt;

  if (!resetAt || now > resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db
      .update(organizations)
      .set({
        monthlyMessageCount: 1,
        monthlyMessageResetAt: nextReset,
        updatedAt: now,
      })
      .where(eq(organizations.id, orgId));
  } else {
    await db
      .update(organizations)
      .set({
        monthlyMessageCount: org.monthlyMessageCount + 1,
        updatedAt: now,
      })
      .where(eq(organizations.id, orgId));
  }
}

export async function getMessageCount(orgId: string): Promise<number> {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return 0;

  const now = new Date();
  if (org.monthlyMessageResetAt && now > org.monthlyMessageResetAt) {
    return 0;
  }
  return org.monthlyMessageCount;
}

export async function listOrganizationMembers(orgId: string) {
  const db = getDb();
  return db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId));
}

export async function addOrgMember(orgId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member') {
  const db = getDb();
  const id = uuidv4();
  await db.insert(orgMemberships).values({ id, orgId, userId, role });
}

export async function listAllOrganizations() {
  const db = getDb();
  return db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));
}

export async function getOrgWithMembers(orgId: string) {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return null;

  const members = await db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId));

  const hasApiKey = await db
    .select({ count: count() })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.orgId, orgId), eq(userApiKeys.isActive, true)));

  const convCount = await db
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.orgId, orgId));

  const msgCount = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.orgId, orgId));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentMsgCount = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.orgId, orgId), gte(messages.createdAt, thirtyDaysAgo)));

  const lastMessage = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.orgId, orgId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return {
    ...org,
    members,
    stats: {
      hasApiKey: (hasApiKey[0]?.count || 0) > 0,
      conversationCount: convCount[0]?.count || 0,
      messageCount: msgCount[0]?.count || 0,
      messagesLast30Days: recentMsgCount[0]?.count || 0,
      lastActiveAt: lastMessage[0]?.createdAt || null,
    },
  };
}

export async function listAllOrganizationsWithStats() {
  const db = getDb();

  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const result = [];
  for (const org of orgs) {
    const members = await db.select().from(orgMemberships).where(eq(orgMemberships.orgId, org.id));

    const msgCount = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.orgId, org.id));

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentMsgs = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.orgId, org.id), gte(messages.createdAt, sevenDaysAgo)));

    const lastMsg = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.orgId, org.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    result.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      subscriptionStatus: org.subscriptionStatus,
      monthlyMessageCount: org.monthlyMessageCount,
      createdAt: org.createdAt,
      members: members.map(m => ({ userId: m.userId, role: m.role })),
      totalMessages: msgCount[0]?.count || 0,
      messagesLast7Days: recentMsgs[0]?.count || 0,
      lastActiveAt: lastMsg[0]?.createdAt || null,
    });
  }

  return result;
}
