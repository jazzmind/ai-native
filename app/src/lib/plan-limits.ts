import { getMessageCount, incrementMessageCount as dbIncrementMessageCount, countProjects } from './db';

export const PLAN_LIMITS = {
  free: {
    messagesPerMonth: 100,
    projectsMax: 3,
    seatsMax: 1,
    expertReviewCredits: 0,
    byoKeyRequired: true,
  },
  pro: {
    messagesPerMonth: Infinity,
    projectsMax: 10,
    seatsMax: 1,
    expertReviewCredits: 1,
    byoKeyRequired: false,
  },
  team: {
    messagesPerMonth: Infinity,
    projectsMax: 50,
    seatsMax: 5,
    expertReviewCredits: 3,
    byoKeyRequired: false,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: 'pro' | 'team';
  currentUsage?: number;
  limit?: number;
}

export async function checkMessageLimit(orgId: string, plan: Plan): Promise<LimitCheckResult> {
  const limits = PLAN_LIMITS[plan];
  if (limits.messagesPerMonth === Infinity) {
    return { allowed: true };
  }

  const currentCount = await getMessageCount(orgId);
  if (currentCount >= limits.messagesPerMonth) {
    return {
      allowed: false,
      reason: `Message limit reached (${currentCount}/${limits.messagesPerMonth} this month)`,
      upgradeRequired: 'pro',
      currentUsage: currentCount,
      limit: limits.messagesPerMonth,
    };
  }

  return { allowed: true, currentUsage: currentCount, limit: limits.messagesPerMonth };
}

export async function checkProjectLimit(orgId: string, plan: Plan): Promise<LimitCheckResult> {
  const limits = PLAN_LIMITS[plan];
  const currentCount = await countProjects(orgId);

  if (currentCount >= limits.projectsMax) {
    return {
      allowed: false,
      reason: `Project limit reached (${currentCount}/${limits.projectsMax})`,
      upgradeRequired: plan === 'free' ? 'pro' : 'team',
      currentUsage: currentCount,
      limit: limits.projectsMax,
    };
  }

  return { allowed: true, currentUsage: currentCount, limit: limits.projectsMax };
}

export async function incrementMessageCount(orgId: string): Promise<void> {
  await dbIncrementMessageCount(orgId);
}
