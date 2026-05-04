import { NextRequest } from "next/server";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { marketplaceRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getExpertProfile, updateExpertProfile } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { user } = await getRequiredUserAndOrg();
    const { requestId } = await params;

    const db = getDb();
    const [request] = await db
      .select()
      .from(marketplaceRequests)
      .where(eq(marketplaceRequests.id, requestId));

    if (!request || request.requesterUserId !== user.id) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status !== 'completed') {
      return Response.json({ error: "Can only rate completed reviews" }, { status: 400 });
    }

    const body = await req.json();
    const { rating, note } = body as { rating: number; note?: string };

    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // Update marketplace request
    await db
      .update(marketplaceRequests)
      .set({ expertRating: rating, expertRatingNote: note || null })
      .where(eq(marketplaceRequests.id, requestId));

    // Update expert's average rating
    if (request.awardedExpertId) {
      const expert = await getExpertProfile(request.awardedExpertId);
      if (expert) {
        const currentTotal = expert.totalReviews || 1;
        const currentAvg = expert.averageRating || rating;
        const newAvg = (currentAvg * (currentTotal - 1) + rating) / currentTotal;

        await updateExpertProfile(expert.id, { averageRating: newAvg });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
