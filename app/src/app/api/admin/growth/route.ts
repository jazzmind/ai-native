import { getRequiredUser, handleAuthError, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { usageEvents, organizations, orgMemberships, conversations, messages, userApiKeys } from '@/lib/db/schema';
import { sql, count, eq, gte, and, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getRequiredUser();
    if (!isAdmin(user.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDb();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      signupsLast7d,
      signupsLast30d,
      activeLast7d,
      activeLast30d,
      totalConvs,
      totalMsgs,
      msgsLast7d,
      msgsLast30d,
      totalApiKeys,
      eventsByType,
      dailyActivity,
      signupFunnel,
      churnCandidates,
    ] = await Promise.all([
      db.select({ count: count() }).from(orgMemberships),

      db.select({ count: count() }).from(organizations).where(gte(organizations.createdAt, sevenDaysAgo)),
      db.select({ count: count() }).from(organizations).where(gte(organizations.createdAt, thirtyDaysAgo)),

      // Active users: distinct users who sent messages in last 7d
      db.select({ count: sql<number>`count(distinct ${messages.conversationId})` })
        .from(messages)
        .where(gte(messages.createdAt, sevenDaysAgo)),

      db.select({ count: sql<number>`count(distinct ${messages.conversationId})` })
        .from(messages)
        .where(gte(messages.createdAt, thirtyDaysAgo)),

      db.select({ count: count() }).from(conversations),
      db.select({ count: count() }).from(messages),
      db.select({ count: count() }).from(messages).where(gte(messages.createdAt, sevenDaysAgo)),
      db.select({ count: count() }).from(messages).where(gte(messages.createdAt, thirtyDaysAgo)),

      db.select({ count: count() }).from(userApiKeys).where(eq(userApiKeys.isActive, true)),

      // Event counts by type (last 30d)
      db.select({
        eventType: usageEvents.eventType,
        count: count(),
      })
        .from(usageEvents)
        .where(gte(usageEvents.createdAt, thirtyDaysAgo))
        .groupBy(usageEvents.eventType)
        .orderBy(desc(count())),

      // Daily message volume (last 30d)
      db.select({
        day: sql<string>`to_char(${messages.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
        .from(messages)
        .where(gte(messages.createdAt, thirtyDaysAgo))
        .groupBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${messages.createdAt}, 'YYYY-MM-DD')`),

      // Signup funnel from usage_events
      db.select({
        eventType: usageEvents.eventType,
        count: count(),
      })
        .from(usageEvents)
        .where(and(
          gte(usageEvents.createdAt, thirtyDaysAgo),
          sql`${usageEvents.eventType} IN ('signup_started', 'signup_email_verified', 'signup_completed', 'login')`,
        ))
        .groupBy(usageEvents.eventType),

      // Churn risk: orgs with no messages in last 14d but had messages between 14-60d ago
      db.select({
        orgId: conversations.orgId,
        lastMessage: sql<Date>`max(${messages.createdAt})`,
      })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(gte(messages.createdAt, sixtyDaysAgo))
        .groupBy(conversations.orgId)
        .having(sql`max(${messages.createdAt}) < ${sevenDaysAgo}`),
    ]);

    // Calculate per-org engagement for retention analysis
    const orgEngagement = await db
      .select({
        orgId: conversations.orgId,
        totalMsgs: count(),
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .groupBy(conversations.orgId)
      .orderBy(desc(count()));

    return Response.json({
      overview: {
        totalUsers: totalUsers[0]?.count || 0,
        signupsLast7Days: signupsLast7d[0]?.count || 0,
        signupsLast30Days: signupsLast30d[0]?.count || 0,
        activeConversationsLast7Days: activeLast7d[0]?.count || 0,
        activeConversationsLast30Days: activeLast30d[0]?.count || 0,
        totalConversations: totalConvs[0]?.count || 0,
        totalMessages: totalMsgs[0]?.count || 0,
        messagesLast7Days: msgsLast7d[0]?.count || 0,
        messagesLast30Days: msgsLast30d[0]?.count || 0,
        activeApiKeys: totalApiKeys[0]?.count || 0,
      },
      signupFunnel: signupFunnel.reduce((acc, row) => {
        acc[row.eventType] = row.count;
        return acc;
      }, {} as Record<string, number>),
      eventBreakdown: eventsByType.map(row => ({
        event: row.eventType,
        count: row.count,
      })),
      dailyActivity: dailyActivity.map(row => ({
        date: row.day,
        messages: row.count,
      })),
      churn: {
        atRiskOrgs: churnCandidates.length,
        candidates: churnCandidates.slice(0, 20).map(c => ({
          orgId: c.orgId,
          lastActive: c.lastMessage,
        })),
      },
      engagement: {
        topOrgs: orgEngagement.slice(0, 10).map(o => ({
          orgId: o.orgId,
          totalMessages: o.totalMsgs,
        })),
        distribution: {
          power: orgEngagement.filter(o => o.totalMsgs >= 50).length,
          active: orgEngagement.filter(o => o.totalMsgs >= 10 && o.totalMsgs < 50).length,
          casual: orgEngagement.filter(o => o.totalMsgs >= 3 && o.totalMsgs < 10).length,
          trial: orgEngagement.filter(o => o.totalMsgs < 3).length,
        },
      },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
