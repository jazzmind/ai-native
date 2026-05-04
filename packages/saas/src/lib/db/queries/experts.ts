import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { expertProfiles, expertBids, marketplaceRequests } from '../schema';

export async function createExpertProfile(data: {
  userId: string;
  email: string;
  displayName: string;
  bio?: string;
  domains: string;
  rateMinCents: number;
  rateMaxCents: number;
  isFoundingExpert?: boolean;
}) {
  const db = getDb();
  const id = uuidv4();
  await db.insert(expertProfiles).values({
    id,
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    bio: data.bio || null,
    domains: data.domains,
    rateMinCents: data.rateMinCents,
    rateMaxCents: data.rateMaxCents,
    isFoundingExpert: data.isFoundingExpert || false,
    platformFeeRate: data.isFoundingExpert ? 0.10 : 0.20,
  });
  const [row] = await db.select().from(expertProfiles).where(eq(expertProfiles.id, id));
  return row;
}

export async function getExpertProfile(id: string) {
  const db = getDb();
  const [row] = await db.select().from(expertProfiles).where(eq(expertProfiles.id, id));
  return row;
}

export async function getExpertProfileByUserId(userId: string) {
  const db = getDb();
  const [row] = await db.select().from(expertProfiles).where(eq(expertProfiles.userId, userId));
  return row;
}

export async function listExpertProfiles(onlyActive = true) {
  const db = getDb();
  const condition = onlyActive ? eq(expertProfiles.isActive, true) : undefined;
  return db.select().from(expertProfiles).where(condition).orderBy(desc(expertProfiles.createdAt));
}

export async function updateExpertProfile(id: string, updates: Partial<{
  displayName: string;
  bio: string;
  domains: string;
  rateMinCents: number;
  rateMaxCents: number;
  stripeConnectAccountId: string;
  stripeConnectOnboarded: boolean;
  isActive: boolean;
  isFoundingExpert: boolean;
  platformFeeRate: number;
  averageRating: number;
  totalReviews: number;
  acceptanceRate: number;
  avgDeliveryHours: number;
}>) {
  const db = getDb();
  await db
    .update(expertProfiles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(expertProfiles.id, id));
}

export async function findEligibleExperts(domain: string, budgetCents: number) {
  const db = getDb();
  const allActive = await db
    .select()
    .from(expertProfiles)
    .where(
      and(
        eq(expertProfiles.isActive, true),
        lte(expertProfiles.rateMinCents, budgetCents)
      )
    );

  return allActive.filter((expert) => {
    const domains = expert.domains.split(',').map((d) => d.trim().toLowerCase());
    return domains.includes(domain.toLowerCase());
  });
}

export async function countEligibleExperts(domain: string, budgetCents: number): Promise<number> {
  const experts = await findEligibleExperts(domain, budgetCents);
  return experts.length;
}

export async function createBid(data: {
  requestId: string;
  expertId: string;
  bidCents: number;
  estimatedHours?: number;
  note?: string;
}) {
  const db = getDb();
  const id = uuidv4();
  await db.insert(expertBids).values({
    id,
    requestId: data.requestId,
    expertId: data.expertId,
    bidCents: data.bidCents,
    estimatedHours: data.estimatedHours || null,
    note: data.note || null,
    notifiedAt: new Date(),
  });
  const [row] = await db.select().from(expertBids).where(eq(expertBids.id, id));
  return row;
}

export async function getBid(id: string) {
  const db = getDb();
  const [row] = await db.select().from(expertBids).where(eq(expertBids.id, id));
  return row;
}

export async function getBidsForRequest(requestId: string) {
  const db = getDb();
  return db.select().from(expertBids).where(eq(expertBids.requestId, requestId));
}

export async function updateBidStatus(id: string, status: string) {
  const db = getDb();
  await db.update(expertBids).set({ status, respondedAt: new Date() }).where(eq(expertBids.id, id));
}

export async function getBidByExpertAndRequest(expertId: string, requestId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(expertBids)
    .where(and(eq(expertBids.expertId, expertId), eq(expertBids.requestId, requestId)));
  return row;
}
