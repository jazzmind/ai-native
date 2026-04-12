import { PostHog } from 'posthog-node';

let _posthog: PostHog | null = null;

function getServerPosthog(): PostHog | null {
  if (_posthog) return _posthog;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;

  _posthog = new PostHog(key, {
    host: host || 'https://app.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  return _posthog;
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>,
) {
  const ph = getServerPosthog();
  if (!ph) return;

  ph.capture({
    distinctId,
    event,
    properties,
  });
}

export function trackMessageSent(userId: string, orgId: string, advisor: string) {
  trackServerEvent(userId, 'message_sent', { orgId, advisor });
}

export function trackMarketplaceRequest(userId: string, orgId: string, domain: string, budgetCents: number) {
  trackServerEvent(userId, 'marketplace_request_created', { orgId, domain, budgetCents });
}

export function trackExpertDelivery(expertId: string, requestId: string) {
  trackServerEvent(expertId, 'expert_review_delivered', { requestId });
}

export function trackPlanUpgrade(userId: string, orgId: string, plan: string) {
  trackServerEvent(userId, 'plan_upgraded', { orgId, plan });
}
