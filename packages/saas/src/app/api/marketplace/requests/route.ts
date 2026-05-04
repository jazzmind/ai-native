import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";
import { getRequiredUserAndOrg, handleAuthError } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { marketplaceRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyEligibleExperts } from "@/lib/marketplace-engine";
import { getMessages, getConversation } from "@/lib/db";

export async function GET() {
  try {
    const { org } = await getRequiredUserAndOrg();
    const db = getDb();
    const requests = await db
      .select()
      .from(marketplaceRequests)
      .where(eq(marketplaceRequests.orgId, org.id))
      .orderBy(marketplaceRequests.createdAt);
    return Response.json({ requests });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, org } = await getRequiredUserAndOrg();
    const body = await req.json();
    const { conversationId, title, question, domain, budgetCents } = body;

    if (!conversationId || !title || !question || !domain || !budgetCents) {
      return Response.json(
        { error: "conversationId, title, question, domain, and budgetCents are required" },
        { status: 400 }
      );
    }

    if (budgetCents < 2500) {
      return Response.json({ error: "Minimum budget is $25 (2500 cents)" }, { status: 400 });
    }

    // Verify the conversation belongs to this user before reading messages
    const conversation = await getConversation(conversationId, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Build context summary from conversation
    const messages = await getMessages(conversationId);
    const recentMessages = messages.slice(-10);
    const contextSummary = recentMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // Create Stripe PaymentIntent with manual capture
    let stripePaymentIntentId: string | undefined;
    let clientSecret: string | undefined;
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: budgetCents,
        currency: "usd",
        capture_method: "manual",
        metadata: { orgId: org.id, domain },
      });
      stripePaymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret!;
    }

    const requestId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const db = getDb();
    await db.insert(marketplaceRequests).values({
      id: requestId,
      orgId: org.id,
      conversationId,
      requesterUserId: user.id,
      title,
      question,
      contextSummary,
      domain,
      budgetCents,
      stripePaymentIntentId,
      expiresAt,
    });

    // Notify eligible experts (async, don't block response)
    notifyEligibleExperts(requestId).catch(console.error);

    return Response.json({ requestId, clientSecret });
  } catch (err) {
    return handleAuthError(err);
  }
}
