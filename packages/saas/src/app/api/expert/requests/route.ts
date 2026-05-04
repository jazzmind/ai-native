import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getExpertProfileByUserId, getBidsForRequest } from "@/lib/db";
import { getDb } from "@/lib/db/client";
import { marketplaceRequests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const expert = await getExpertProfileByUserId(user.id);
  if (!expert) {
    return Response.json({ error: "Expert profile not found" }, { status: 403 });
  }

  const db = getDb();

  // Get open requests matching expert's domains and rate
  const openRequests = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.status, 'open'))
    .orderBy(desc(marketplaceRequests.budgetCents));

  const expertDomains = expert.domains.split(',').map((d) => d.trim().toLowerCase());

  const matching = openRequests.filter((req) => {
    const domainMatch = expertDomains.includes(req.domain.toLowerCase());
    const rateMatch = expert.rateMinCents <= req.budgetCents;
    return domainMatch && rateMatch;
  });

  // Also get expert's active and completed reviews
  const allRequests = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.awardedExpertId, expert.id))
    .orderBy(desc(marketplaceRequests.createdAt));

  return Response.json({
    available: matching,
    active: allRequests.filter((r) => r.status === 'awarded'),
    completed: allRequests.filter((r) => r.status === 'completed'),
    expert: {
      id: expert.id,
      displayName: expert.displayName,
      domains: expert.domains,
      averageRating: expert.averageRating,
      totalReviews: expert.totalReviews,
      acceptanceRate: expert.acceptanceRate,
    },
  });
}
