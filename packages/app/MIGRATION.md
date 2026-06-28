# ai-native: Platform Abstraction Migration

This `packages/app` directory is the **unified Next.js app** that replaces both `packages/saas` and `packages/busibox` using the `@jazzmind/busibox-app` platform abstraction layer.

## How it works

The app detects the deployment environment via environment variables:

| Environment | Detection | Adapters loaded |
|-------------|-----------|-----------------|
| Vercel/local | `DATABASE_URL` is set | `VercelAIAdapter` + `VercelDataAdapter` + `VercelSearchAdapter` + `VercelStorageAdapter` + `VercelAuthAdapter` |
| Busibox | `AGENT_API_URL` or `DATA_API_URL` is set | `BusiboxAIAdapter` + `BusiboxDataAdapter` + `BusiboxSearchAdapter` + `BusiboxStorageAdapter` + `BusiboxAuthAdapter` |

No code changes are needed to switch platforms — only environment variables.

## Migration steps

### 1. Verify the new app works on Vercel

```bash
cd packages/app
cp ../../saas/.env.local .env.local
# Ensure DATABASE_URL + ANTHROPIC_API_KEY are set
pnpm install
pnpm dev
```

All existing features should work: chat, conversations, knowledge search.

### 2. Verify it works on Busibox

```bash
cd packages/app
# Set: AGENT_API_URL, DATA_API_URL, SEARCH_API_URL, AUTHZ_BASE_URL
pnpm dev
```

### 3. Migrate custom saas functionality

The following files in `packages/saas/src/lib/` have platform-specific logic that still needs migration:

| File | Migration approach |
|------|--------------------|
| `session-manager.ts` | Uses CMA sessions → `platform.ai.streamChat()` already handles this |
| `auto-extract.ts` | Post-chat extraction → keep as-is, call `platform.ai.invoke()` |
| `billing.ts` | Stripe-specific → stays Vercel-only, guard with `process.env.STRIPE_SECRET_KEY` |
| `analytics.ts` | Posthog → stays Vercel-only, wrap in `if (process.env.NEXT_PUBLIC_POSTHOG_KEY)` |
| `deploy/` | Deploy API client → use `@jazzmind/busibox-app/lib/deploy/*` on Busibox |

### 4. Remove old packages (after full validation)

```bash
# Only after verifying packages/app is feature-complete
rm -rf packages/saas packages/busibox
```

Update `pnpm-workspace.yaml` to only include `packages/app` and `packages/core`.

## Key pattern: per-request token injection

On Busibox, API routes need to obtain a service token per request:

```typescript
// In an API route
export async function POST(request: NextRequest) {
  await initPlatform();
  const platform = getPlatformInstance();
  const user = await platform.auth.getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Use platform services — they handle token exchange internally
  const result = await platform.data.query('conversations', {
    filters: [{ field: 'user_id', op: 'eq', value: user.id }]
  });
}
```

## Files in this package

| File | Purpose |
|------|---------|
| `src/lib/platform.ts` | Platform bootstrap — call `initPlatform()` before using `getPlatformInstance()` |
| `src/lib/auth.ts` | Auth.js v5 config (Vercel path only) — configure providers here |
| `src/app/api/chat/route.ts` | Unified streaming chat (replaces both platforms' chat routes) |
| `src/app/api/conversations/route.ts` | Unified conversation CRUD |
| `src/app/api/knowledge/route.ts` | Unified knowledge search |
| `next.config.ts` | Conditional standalone output for Busibox |
