import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/db/client";
import { marketplaceRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { addExpertComment, getExpertProfile, updateExpertProfile } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const db = getDb();
  const [request] = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.id, requestId));

  if (!request) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  // Validate token
  if (token !== request.accessToken) {
    return Response.json({ error: "Invalid access token" }, { status: 403 });
  }

  if (request.status !== 'awarded') {
    return Response.json({ error: "Request is not in awarded status" }, { status: 400 });
  }

  if (request.deliveryDeadline && new Date() > request.deliveryDeadline) {
    return Response.json({ error: "Delivery deadline has passed" }, { status: 400 });
  }

  const body = await req.json();
  const { whatWentRight, whatToReconsider, recommendation } = body;

  if (!whatWentRight || !whatToReconsider || !recommendation) {
    return Response.json(
      { error: "whatWentRight, whatToReconsider, and recommendation are required" },
      { status: 400 }
    );
  }

  const fullContent = [
    "## What the AI advisors got right\n" + whatWentRight,
    "## What to reconsider or correct\n" + whatToReconsider,
    "## My recommendation\n" + recommendation,
  ].join("\n\n");

  if (fullContent.length < 200) {
    return Response.json({ error: "Review must be at least 200 characters" }, { status: 400 });
  }

  const expert = request.awardedExpertId
    ? await getExpertProfile(request.awardedExpertId)
    : null;

  // Create the expert comment
  await addExpertComment(
    requestId,
    request.conversationId,
    expert?.email || 'expert@unknown',
    fullContent,
    expert?.displayName,
    expert?.userId
  );

  // Update request status
  await db
    .update(marketplaceRequests)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(marketplaceRequests.id, requestId));

  // Trigger Stripe Transfer to expert
  if (request.expertPayoutCents && expert?.stripeConnectAccountId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const transfer = await stripe.transfers.create({
        amount: request.expertPayoutCents,
        currency: 'usd',
        destination: expert.stripeConnectAccountId,
        metadata: { requestId },
      });

      await db
        .update(marketplaceRequests)
        .set({ stripeTransferId: transfer.id })
        .where(eq(marketplaceRequests.id, requestId));
    } catch (err) {
      console.error('Stripe transfer failed:', err);
    }
  }

  // Update expert stats
  if (expert) {
    const awardedAt = request.awardedAt || new Date();
    const deliveryHours = (Date.now() - awardedAt.getTime()) / (1000 * 60 * 60);
    const currentTotal = expert.totalReviews || 0;
    const currentAvgHours = expert.avgDeliveryHours || deliveryHours;
    const newAvgHours = (currentAvgHours * currentTotal + deliveryHours) / (currentTotal + 1);

    await updateExpertProfile(expert.id, {
      totalReviews: currentTotal + 1,
      avgDeliveryHours: newAvgHours,
    });
  }

  return Response.json({ success: true });
}
