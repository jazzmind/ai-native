import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { organizations, conversations, messages, marketplaceRequests, expertProfiles } from "@/lib/db/schema";
import { sql, count, eq, gte } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getRequiredUser();
    const db = getDb();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalOrgs,
      totalConversations,
      totalMessages,
      recentMessages7d,
      recentMessages30d,
      totalMarketplaceRequests,
      completedRequests,
      totalExperts,
      activeExperts,
      orgsByPlan,
    ] = await Promise.all([
      db.select({ count: count() }).from(organizations),
      db.select({ count: count() }).from(conversations),
      db.select({ count: count() }).from(messages),
      db.select({ count: count() }).from(messages).where(gte(messages.createdAt, sevenDaysAgo)),
      db.select({ count: count() }).from(messages).where(gte(messages.createdAt, thirtyDaysAgo)),
      db.select({ count: count() }).from(marketplaceRequests),
      db.select({ count: count() }).from(marketplaceRequests).where(eq(marketplaceRequests.status, 'completed')),
      db.select({ count: count() }).from(expertProfiles),
      db.select({ count: count() }).from(expertProfiles).where(eq(expertProfiles.isActive, true)),
      db.select({
        plan: organizations.plan,
        count: count(),
      }).from(organizations).groupBy(organizations.plan),
    ]);

    return Response.json({
      organizations: {
        total: totalOrgs[0]?.count || 0,
        byPlan: orgsByPlan.reduce((acc, row) => {
          acc[row.plan] = row.count;
          return acc;
        }, {} as Record<string, number>),
      },
      conversations: {
        total: totalConversations[0]?.count || 0,
      },
      messages: {
        total: totalMessages[0]?.count || 0,
        last7Days: recentMessages7d[0]?.count || 0,
        last30Days: recentMessages30d[0]?.count || 0,
      },
      marketplace: {
        totalRequests: totalMarketplaceRequests[0]?.count || 0,
        completedRequests: completedRequests[0]?.count || 0,
      },
      experts: {
        total: totalExperts[0]?.count || 0,
        active: activeExperts[0]?.count || 0,
      },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
