import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import {
  findEligibleExperts,
  createBid,
  getBidsForRequest,
  updateBidStatus,
  updateExpertProfile,
  getExpertProfile,
} from './db';
import { marketplaceRequests } from './db/schema';
import { getDb } from './db/client';
import { eq, and, lt } from 'drizzle-orm';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function notifyEligibleExperts(requestId: string): Promise<void> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.id, requestId));

  if (!request) return;

  const eligibleExperts = await findEligibleExperts(request.domain, request.budgetCents);

  // Score experts: (rating * 0.6) + (acceptance_rate * 0.3) + (1/avg_delivery_hours * 0.1)
  const scored = eligibleExperts.map((expert) => {
    const ratingScore = (expert.averageRating || 3) * 0.6;
    const acceptanceScore = (expert.acceptanceRate || 0.5) * 0.3;
    const speedScore = expert.avgDeliveryHours
      ? (1 / expert.avgDeliveryHours) * 0.1
      : 0.05;
    return { expert, score: ratingScore + acceptanceScore + speedScore };
  });

  scored.sort((a, b) => b.score - a.score);
  const topExperts = scored.slice(0, 10);

  for (const { expert } of topExperts) {
    await createBid({
      requestId,
      expertId: expert.id,
      bidCents: request.budgetCents,
    });

    // Email notification happens in Sprint 7 via the email module
  }
}

export async function processExpiredBids(): Promise<void> {
  const db = getDb();
  const now = new Date();

  // Find open requests past their award window
  const openRequests = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.status, 'open'));

  for (const request of openRequests) {
    const createdAt = request.createdAt || new Date();
    const windowMs = (request.awardWindowHours || 4) * 60 * 60 * 1000;
    const expiry = new Date(createdAt.getTime() + windowMs);

    if (now <= expiry) continue;

    const bids = await getBidsForRequest(request.id);
    const hasAccepted = bids.some((b) => b.status === 'accepted');

    if (hasAccepted) continue;

    // Check if there are unnotified eligible experts
    const eligibleExperts = await findEligibleExperts(request.domain, request.budgetCents);
    const notifiedIds = new Set(bids.map((b) => b.expertId));
    const unnotified = eligibleExperts.filter((e) => !notifiedIds.has(e.id));

    if (unnotified.length > 0) {
      // Notify next batch
      const next = unnotified.slice(0, 5);
      for (const expert of next) {
        await createBid({
          requestId: request.id,
          expertId: expert.id,
          bidCents: request.budgetCents,
        });
      }
    } else {
      // No more experts — mark expired, cancel payment
      await db
        .update(marketplaceRequests)
        .set({ status: 'expired' })
        .where(eq(marketplaceRequests.id, request.id));

      if (request.stripePaymentIntentId) {
        try {
          const stripe = getStripe();
          await stripe.paymentIntents.cancel(request.stripePaymentIntentId);
        } catch {
          // Payment may have already been canceled
        }
      }
    }
  }
}

export async function awardRequest(
  requestId: string,
  expertId: string
): Promise<{ accessToken: string; deliveryDeadline: Date }> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(marketplaceRequests)
    .where(eq(marketplaceRequests.id, requestId));

  if (!request) throw new Error('Request not found');
  if (request.status !== 'open') throw new Error('Request is no longer open');

  const expert = await getExpertProfile(expertId);
  if (!expert) throw new Error('Expert not found');

  const now = new Date();
  const deliveryDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const accessToken = uuidv4();

  const platformFeeCents = Math.round(request.budgetCents * (expert.platformFeeRate || 0.20));
  const expertPayoutCents = request.budgetCents - platformFeeCents;

  // Capture the Stripe PaymentIntent
  if (request.stripePaymentIntentId) {
    try {
      const stripe = getStripe();
      await stripe.paymentIntents.capture(request.stripePaymentIntentId);
    } catch (err) {
      throw new Error(`Failed to capture payment: ${err}`);
    }
  }

  // Update request
  await db
    .update(marketplaceRequests)
    .set({
      status: 'awarded',
      awardedExpertId: expertId,
      awardedAt: now,
      deliveryDeadline,
      platformFeeCents,
      expertPayoutCents,
      accessToken,
    })
    .where(eq(marketplaceRequests.id, requestId));

  // Reject other bids
  const bids = await getBidsForRequest(requestId);
  for (const bid of bids) {
    if (bid.expertId !== expertId) {
      await updateBidStatus(bid.id, 'rejected');
    } else {
      await updateBidStatus(bid.id, 'accepted');
    }
  }

  return { accessToken, deliveryDeadline };
}
