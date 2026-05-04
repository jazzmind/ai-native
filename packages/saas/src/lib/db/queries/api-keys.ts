import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { userApiKeys } from '../schema';
import { encryptApiKey, decryptApiKey, getKeyHint } from '../../encryption';

export async function storeApiKey(
  orgId: string,
  userId: string,
  apiKey: string,
  provider = 'anthropic'
): Promise<{ id: string; hint: string }> {
  const db = getDb();
  const encrypted = encryptApiKey(apiKey);
  const hint = getKeyHint(apiKey);

  const existing = await db
    .select()
    .from(userApiKeys)
    .where(
      and(
        eq(userApiKeys.orgId, orgId),
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider)
      )
    );

  if (existing.length > 0) {
    await db
      .update(userApiKeys)
      .set({ encryptedKey: encrypted, keyHint: hint, isActive: true })
      .where(eq(userApiKeys.id, existing[0].id));
    return { id: existing[0].id, hint };
  }

  const id = uuidv4();
  await db.insert(userApiKeys).values({
    id,
    orgId,
    userId,
    provider,
    encryptedKey: encrypted,
    keyHint: hint,
  });
  return { id, hint };
}

export async function getApiKey(
  orgId: string,
  userId: string,
  provider = 'anthropic'
): Promise<{ hasKey: boolean; hint: string | null; decrypted?: string }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userApiKeys)
    .where(
      and(
        eq(userApiKeys.orgId, orgId),
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider),
        eq(userApiKeys.isActive, true)
      )
    );

  if (!row) return { hasKey: false, hint: null };

  return {
    hasKey: true,
    hint: row.keyHint,
    decrypted: decryptApiKey(row.encryptedKey),
  };
}

export async function getApiKeyInfo(
  orgId: string,
  userId: string,
  provider = 'anthropic'
): Promise<{ hasKey: boolean; hint: string | null; provider: string }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userApiKeys)
    .where(
      and(
        eq(userApiKeys.orgId, orgId),
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider),
        eq(userApiKeys.isActive, true)
      )
    );

  return {
    hasKey: !!row,
    hint: row?.keyHint || null,
    provider,
  };
}

export async function deleteApiKey(
  orgId: string,
  userId: string,
  provider = 'anthropic'
): Promise<void> {
  const db = getDb();
  await db
    .delete(userApiKeys)
    .where(
      and(
        eq(userApiKeys.orgId, orgId),
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider)
      )
    );
}
