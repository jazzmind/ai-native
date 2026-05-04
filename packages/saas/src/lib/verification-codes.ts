import { createHmac, randomInt, timingSafeEqual } from 'crypto';

interface StoredCode {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

// In-memory store — works for single-instance deployments.
// For multi-instance, swap to Redis or DB.
const codes = new Map<string, StoredCode>();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function cleanExpired() {
  const now = Date.now();
  for (const [key, val] of codes) {
    if (val.expiresAt < now) codes.delete(key);
  }
}

export function generateVerificationCode(email: string): string {
  cleanExpired();

  const code = String(randomInt(100000, 999999));
  const normalizedEmail = email.toLowerCase().trim();

  codes.set(normalizedEmail, {
    code,
    email: normalizedEmail,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });

  return code;
}

export function verifyCode(email: string, code: string): { valid: boolean; error?: string } {
  cleanExpired();

  const normalizedEmail = email.toLowerCase().trim();
  const stored = codes.get(normalizedEmail);

  if (!stored) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  if (stored.expiresAt < Date.now()) {
    codes.delete(normalizedEmail);
    return { valid: false, error: 'Code expired. Please request a new one.' };
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    codes.delete(normalizedEmail);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  stored.attempts++;

  if (stored.code !== code.trim()) {
    return { valid: false, error: `Incorrect code. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.` };
  }

  codes.delete(normalizedEmail);
  return { valid: true };
}

function getHmacSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is required for token signing');
  return Buffer.from(secret);
}

function signData(data: string): string {
  return createHmac('sha256', getHmacSecret()).update(data).digest('base64url');
}

/**
 * Generates an HMAC-signed verification token.
 * Format: base64url(payload).base64url(hmac-sha256-signature)
 */
export function generateVerificationToken(email: string): string {
  const data = Buffer.from(JSON.stringify({
    email: email.toLowerCase().trim(),
    exp: Date.now() + 30 * 60 * 1000, // 30 min
    nonce: randomInt(1_000_000, 9_999_999),
  })).toString('base64url');
  const sig = signData(data);
  return `${data}.${sig}`;
}

/**
 * Validates an HMAC-signed verification token.
 * Returns the email on success, null on any failure (invalid, expired, tampered).
 */
export function validateVerificationToken(token: string): { email: string } | null {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const data = token.slice(0, dotIdx);
    const providedSig = token.slice(dotIdx + 1);
    const expectedSig = signData(data);

    // Constant-time comparison to prevent timing attacks
    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.email || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
