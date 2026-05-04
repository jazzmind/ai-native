import Stripe from 'stripe';
import { getOrganization, updateOrganization } from './db';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const PRICE_MAP: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  team: process.env.STRIPE_PRICE_TEAM_MONTHLY || '',
};

export async function createStripeCustomer(
  orgId: string,
  email: string,
  name: string
): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { orgId },
  });
  await updateOrganization(orgId, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(params: {
  orgId: string;
  plan: 'pro' | 'team';
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const org = await getOrganization(params.orgId);
  if (!org) throw new Error('Organization not found');

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(params.orgId, '', org.name);
  }

  const priceId = PRICE_MAP[params.plan];
  if (!priceId) throw new Error(`No price configured for plan: ${params.plan}`);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { orgId: params.orgId, plan: params.plan },
  });

  return { url: session.url! };
}

export async function createPortalSession(
  orgId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const stripe = getStripe();
  const org = await getOrganization(orgId);
  if (!org?.stripeCustomerId) throw new Error('No Stripe customer found');

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function handleWebhookEvent(
  payload: string,
  signature: string
): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const plan = session.metadata?.plan as 'pro' | 'team';
      if (orgId && plan) {
        await updateOrganization(orgId, {
          plan,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: 'active',
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        const priceId = sub.items.data[0]?.price.id;
        let plan: 'free' | 'pro' | 'team' = 'free';
        if (priceId === PRICE_MAP.pro) plan = 'pro';
        else if (priceId === PRICE_MAP.team) plan = 'team';

        await updateOrganization(orgId, {
          plan,
          subscriptionStatus: sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        await updateOrganization(orgId, {
          plan: 'free',
          subscriptionStatus: 'canceled',
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // Find org by stripe customer ID and update status
      // For now, log the failure — email handling is in Sprint 7
      console.error(`Payment failed for customer: ${customerId}`);
      break;
    }
  }
}

export async function getSubscriptionStatus(orgId: string): Promise<{
  plan: 'free' | 'pro' | 'team';
  status: string;
  currentPeriodEnd?: Date;
}> {
  const org = await getOrganization(orgId);
  if (!org) return { plan: 'free', status: 'inactive' };

  if (org.stripeSubscriptionId && org.subscriptionStatus === 'active') {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
      const periodEnd = sub.items.data[0]?.current_period_end;
      return {
        plan: org.plan as 'free' | 'pro' | 'team',
        status: sub.status,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      };
    } catch {
      return { plan: org.plan as 'free' | 'pro' | 'team', status: org.subscriptionStatus || 'unknown' };
    }
  }

  return { plan: org.plan as 'free' | 'pro' | 'team', status: org.subscriptionStatus || 'inactive' };
}
