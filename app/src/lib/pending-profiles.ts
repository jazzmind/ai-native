interface PendingProfile {
  companyName?: string;
  firstName?: string;
  expiresAt: number;
}

const profiles = new Map<string, PendingProfile>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpired() {
  const now = Date.now();
  for (const [key, val] of profiles) {
    if (val.expiresAt < now) profiles.delete(key);
  }
}

export function storePendingProfile(email: string, data: { companyName?: string; firstName?: string }) {
  cleanExpired();
  profiles.set(email.toLowerCase().trim(), {
    ...data,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function consumePendingProfile(email: string): PendingProfile | null {
  cleanExpired();
  const key = email.toLowerCase().trim();
  const profile = profiles.get(key);
  if (!profile) return null;
  profiles.delete(key);
  return profile;
}
