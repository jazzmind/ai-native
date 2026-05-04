import { randomInt } from 'crypto';

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

export function generateVerificationToken(email: string): string {
  const payload = JSON.stringify({
    email: email.toLowerCase().trim(),
    exp: Date.now() + 30 * 60 * 1000, // 30 min
    nonce: randomInt(1_000_000, 9_999_999),
  });
  return Buffer.from(payload).toString('base64url');
}

export function validateVerificationToken(token: string): { email: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!payload.email || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
