import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getRequiredUser, handleAuthError } from "@/lib/auth";
import { getExpertProfileByUserId, updateExpertProfile } from "@/lib/db";

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  let accountId = expert.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: expert.email,
      metadata: { expertId: expert.id },
    });
    accountId = account.id;
    await updateExpertProfile(expert.id, { stripeConnectAccountId: accountId });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/expert/dashboard`,
    return_url: `${appUrl}/expert/dashboard?stripe_connected=true`,
    type: 'account_onboarding',
  });

  return Response.json({ url: accountLink.url });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getRequiredUser();
  } catch (err) {
    return handleAuthError(err);
  }

  const expert = await getExpertProfileByUserId(user.id);
  if (!expert?.stripeConnectAccountId) {
    return Response.json({ error: "No Stripe account found" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const account = await stripe.accounts.retrieve(expert.stripeConnectAccountId);

  if (account.charges_enabled) {
    await updateExpertProfile(expert.id, { stripeConnectOnboarded: true });
    return Response.json({ onboarded: true });
  }

  return Response.json({ onboarded: false });
}
