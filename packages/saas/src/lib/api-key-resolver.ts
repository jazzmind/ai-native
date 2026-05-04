import { getApiKey } from './db/queries/api-keys';

export class BYOKeyRequiredError extends Error {
  code = 'BYO_KEY_REQUIRED' as const;
  constructor() {
    super('Free plan requires your own API key. Please add your Anthropic API key in Settings.');
    this.name = 'BYOKeyRequiredError';
  }
}

export async function resolveAnthropicKey(
  orgId: string,
  userId: string,
  orgPlan: 'free' | 'pro' | 'team'
): Promise<string> {
  if (orgPlan === 'free') {
    const keyInfo = await getApiKey(orgId, userId);
    if (!keyInfo.hasKey || !keyInfo.decrypted) {
      throw new BYOKeyRequiredError();
    }
    return keyInfo.decrypted;
  }

  // Pro/Team: check if user has a preferred BYO key
  const keyInfo = await getApiKey(orgId, userId);
  if (keyInfo.hasKey && keyInfo.decrypted) {
    return keyInfo.decrypted;
  }

  // Use platform key
  const platformKey = process.env.ANTHROPIC_API_KEY;
  if (!platformKey) {
    throw new Error('Platform API key not configured');
  }
  return platformKey;
}
