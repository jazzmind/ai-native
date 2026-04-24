---
# Claude Code Implementation Brief
## ai-native → Commercial SaaS Platform
**Version 1.0 | For use with Claude Code**
---

## How to Use This Document

Give this document to Claude Code as the project brief. Work through the sprints **in order** — each sprint has explicit dependencies on the previous. Do not skip ahead. Each task lists exact file paths, schema SQL, package names, and behavioral contracts.

---

## Foundational Context

The existing app (`app/`) is a Next.js 16 + TypeScript application. Key facts Claude Code must know:

- **Database**: Currently `better-sqlite3` (synchronous, file-based). All DB logic is in `app/src/lib/db.ts` (889 lines). **This must be migrated to Postgres for multi-tenant SaaS.**
- **Auth**: Auth.js v5 (`next-auth`) with JWT sessions. `getRequiredUser()` in `app/src/lib/auth.ts` is the auth guard used in all API routes.
- **All data is currently user-scoped** (`user_id` on every table). Must become **org-scoped** while preserving user identity.
- **Chat API** (`app/src/app/api/chat/route.ts`) uses `process.env.ANTHROPIC_API_KEY` globally. Must support per-org API keys.
- **Existing review system** (`review_requests`, `expert_comments` tables) is the foundation for the Expert Marketplace — extend, don't replace it.
- **Keep Electron support untouched.** Do not modify `app/electron/`.
- **All new packages must be added to `app/package.json`** (not the repo root).

---

## Sprint 0: Infrastructure & Dependencies

### 0.1 — Install New Packages

Run inside `app/`:

```bash
npm install drizzle-orm @neondatabase/serverless drizzle-kit
npm install stripe @stripe/stripe-js
npm install resend
npm install @vercel/analytics
npm install crypto-js
npm install --save-dev @types/crypto-js
```

### 0.2 — Update Environment Variables

Update `.env.example` at repo root and create `app/.env.local.example`:

```bash
# === DATABASE ===
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
# Local dev: leave DATABASE_URL unset to use SQLite fallback

# === AUTH (existing) ===
AUTH_SECRET=<random-32-char-string>
AUTH_TRUST_HOST=true
AUTH_ADMIN_EMAILS=you@example.com
NEXTAUTH_URL=http://localhost:3000

# === ANTHROPIC (existing, now platform-level only) ===
ANTHROPIC_API_KEY=sk-ant-...   # Platform managed key for paid tiers

# === STRIPE ===
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...

# === EMAIL (Resend) ===
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=advisors@yourdomain.com

# === ENCRYPTION ===
ENCRYPTION_KEY=<random-64-char-hex>   # for encrypting BYO API keys

# === APP ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 0.3 — Create Drizzle Config

**Create: `app/drizzle.config.ts`**
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Sprint 1: Database Migration (SQLite → Postgres)

**Goal:** Replace `better-sqlite3` with Drizzle ORM + Neon Postgres while maintaining a SQLite fallback for local development.

**Strategy:** Create a new `app/src/lib/db/` directory. The existing `app/src/lib/db.ts` becomes the adapter interface. All API routes continue calling the same function signatures — only the implementation changes underneath.

### 1.1 — Create Database Client

**Create: `app/src/lib/db/client.ts`**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Singleton pattern for serverless
let _db: ReturnType<typeof drizzleNeon> | null = null;

export function getDb() {
  if (_db) return _db;
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const sql = neon(process.env.DATABASE_URL);
  _db = drizzleNeon(sql, { schema });
  return _db;
}
```

### 1.2 — Create Drizzle Schema

**Create: `app/src/lib/db/schema.ts`**

Define all tables using Drizzle ORM syntax. This is the complete schema including all new commercial tables. Implement the following tables (each with its columns exactly as specified):

**Table: `organizations`**
```typescript
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'pro', 'team'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  // Usage limits per plan
  monthlyMessageCount: integer('monthly_message_count').notNull().default(0),
  monthlyMessageResetAt: timestamp('monthly_message_reset_at'),
  // Expert review credits (included with plan)
  expertReviewCredits: integer('expert_review_credits').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**Table: `org_memberships`**
```typescript
export const orgMemberships = pgTable('org_memberships', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.orgId, t.userId),
}));
```

**Table: `user_api_keys`**
```typescript
export const userApiKeys = pgTable('user_api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull().default('anthropic'),
  // AES-256 encrypted with ENCRYPTION_KEY env var
  encryptedKey: text('encrypted_key').notNull(),
  keyHint: text('key_hint').notNull(), // last 4 chars of key, for display
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Table: `usage_events`**
```typescript
export const usageEvents = pgTable('usage_events', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(), // 'message', 'expert_review', 'api_call'
  metadata: jsonb('metadata'), // { tokens_in, tokens_out, coach_key, mode }
  billingPeriod: text('billing_period').notNull(), // 'YYYY-MM' format
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Migrate all existing tables** — re-declare all tables from the existing `db.ts` in Drizzle schema format, with these modifications:
- Add `orgId: text('org_id').notNull()` to: `projects`, `conversations`, `agent_behaviors`, `behavior_revisions`, `tool_trust`
- Keep `userId` on all tables (user within the org)
- `review_requests` table: add `budget_cents integer`, `domain text`, `award_window_hours integer DEFAULT 4`, `awarded_expert_id text`, `platform_fee_cents integer`, `stripe_payment_intent_id text`
- `expert_comments` table: add `delivery_status text DEFAULT 'pending'`, `expert_rating integer`, `payout_status text DEFAULT 'pending'`, `stripe_transfer_id text`

**New Tables for Expert Marketplace:**

**Table: `expert_profiles`**
```typescript
export const expertProfiles = pgTable('expert_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  // Comma-separated from: founder,strategy,funding,finance,legal,growth,technology
  domains: text('domains').notNull(),
  rateMinCents: integer('rate_min_cents').notNull().default(2500),  // $25
  rateMaxCents: integer('rate_max_cents').notNull().default(50000), // $500
  stripeConnectAccountId: text('stripe_connect_account_id'),
  stripeConnectOnboarded: boolean('stripe_connect_onboarded').default(false),
  isActive: boolean('is_active').default(false), // false until admin approves
  isFoundingExpert: boolean('is_founding_expert').default(false),
  platformFeeRate: real('platform_fee_rate').default(0.20), // 0.10 for founding experts
  averageRating: real('average_rating'),
  totalReviews: integer('total_reviews').default(0),
  acceptanceRate: real('acceptance_rate'),
  avgDeliveryHours: real('avg_delivery_hours'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**Table: `marketplace_requests`** (extends/replaces `review_requests` for marketplace flow)
```typescript
export const marketplaceRequests = pgTable('marketplace_requests', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  messageId: integer('message_id'),
  requesterUserId: text('requester_user_id').notNull(),
  // What the user is asking for
  title: text('title').notNull(),
  question: text('question').notNull(),
  contextSummary: text('context_summary').notNull(),
  domain: text('domain').notNull(), // must match expert_profiles.domains values
  // Pricing
  budgetCents: integer('budget_cents').notNull(),
  platformFeeCents: integer('platform_fee_cents'),
  expertPayoutCents: integer('expert_payout_cents'),
  // Status flow: open → awarded → in_review → completed | expired | disputed
  status: text('status').notNull().default('open'),
  // Award timing
  awardWindowHours: integer('award_window_hours').notNull().default(4),
  awardedAt: timestamp('awarded_at'),
  awardedExpertId: text('awarded_expert_id').references(() => expertProfiles.id),
  deliveryDeadline: timestamp('delivery_deadline'),
  // Stripe
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId: text('stripe_transfer_id'),
  // Result
  expertRating: integer('expert_rating'), // 1-5
  expertRatingNote: text('expert_rating_note'),
  accessToken: text('access_token').unique(), // for guest/expert access
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});
```

**Table: `expert_bids`**
```typescript
export const expertBids = pgTable('expert_bids', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => marketplaceRequests.id),
  expertId: text('expert_id').notNull().references(() => expertProfiles.id),
  // Bid status: pending → accepted | rejected | expired
  status: text('status').notNull().default('pending'),
  // Expert can optionally offer a lower rate than their listed max
  bidCents: integer('bid_cents').notNull(),
  estimatedHours: real('estimated_hours'),
  note: text('note'),
  notifiedAt: timestamp('notified_at'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 1.3 — Create Query Layer

**Create: `app/src/lib/db/queries/` directory with these files:**

- `organizations.ts` — org CRUD, plan checking, usage tracking
- `projects.ts` — migrate all project functions from `db.ts`, add `orgId` scoping
- `conversations.ts` — migrate all conversation/message functions, add `orgId` scoping
- `feedback.ts` — migrate feedback functions
- `behaviors.ts` — migrate behavior/revision functions
- `reviews.ts` — migrate review functions + new marketplace functions
- `experts.ts` — expert profile CRUD, bid management
- `api-keys.ts` — encrypted key storage/retrieval

**Create: `app/src/lib/db/index.ts`** — re-export all functions, preserving the same function signatures as the current `db.ts` so that no API route needs to change its import paths initially.

### 1.4 — Encryption Utilities

**Create: `app/src/lib/encryption.ts`**

```typescript
// AES-256-GCM encryption for API keys
// Uses ENCRYPTION_KEY env var as the master key
// Functions to export:
export function encryptApiKey(plaintext: string): string  // returns base64 ciphertext
export function decryptApiKey(ciphertext: string): string  // returns plaintext
export function getKeyHint(plaintext: string): string       // returns last 4 chars
```

Use Node.js built-in `crypto` module (`createCipheriv`/`createDecipheriv` with `aes-256-gcm`). Do not use `crypto-js` — use the native Node.js `crypto` module which is available in the Next.js Node runtime.

### 1.5 — Update `db.ts`

Replace `app/src/lib/db.ts` content with a re-export barrel:
```typescript
// Backwards compatibility — all existing API routes continue to work
export * from './db/index';
```

### 1.6 — Run Migrations

After schema is defined:
```bash
cd app
npx drizzle-kit generate
npx drizzle-kit migrate
```

**Success Criteria for Sprint 1:**
- [ ] `npm run dev` starts without errors
- [ ] `npm test` passes all existing tests
- [ ] A new user can sign in and create a project
- [ ] Chat works end-to-end with the Postgres backend

---

## Sprint 2: Multi-Tenancy & Organization Model

**Goal:** Every user belongs to an organization. All data is scoped to orgs. Users can invite team members.

### 2.1 — Organization Creation on First Login

**Modify: `app/src/lib/auth.ts`**

Add a callback to Auth.js `signIn` event: after successful authentication, check if the user has an org membership. If not, create a personal org:
- `name`: derived from user's name (e.g., "Alice's Team")
- `slug`: derived from email (e.g., `alice-doe-xyz`)
- `plan`: `'free'`
- Create an `org_memberships` record with `role: 'owner'`

### 2.2 — Org Context in Session

**Modify: `app/src/lib/auth.ts`**

Extend the JWT/session callback to include `orgId` and `orgPlan` in the session object. The active org is stored in the session. For now, users have one org (personal). Team invites come in Sprint 5.

**Modify: `app/src/app/api/chat/route.ts`**

Replace:
```typescript
user = await getRequiredUser();
```
With:
```typescript
const { user, org } = await getRequiredUserAndOrg();
```

Create `getRequiredUserAndOrg()` in `auth.ts` that returns both the user and their active org.

### 2.3 — Scope All Queries to Org

**Modify all API routes** to pass `org.id` instead of (or in addition to) `user.id` for data queries. Specifically:
- `/api/projects` — scope to `org.id`
- `/api/conversations` — scope to `org.id`
- `/api/behaviors` — scope to `org.id`
- `/api/knowledge` — scope to `org.id`
- `/api/effectiveness` — scope to `org.id`
- `/api/reviews` — scope to `org.id`

### 2.4 — Plan Limits Middleware

**Create: `app/src/lib/plan-limits.ts`**

```typescript
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

// Returns { allowed: boolean, reason?: string, upgradeRequired?: 'pro' | 'team' }
export async function checkMessageLimit(orgId: string): Promise<LimitCheckResult>
export async function checkProjectLimit(orgId: string): Promise<LimitCheckResult>
export async function incrementMessageCount(orgId: string): Promise<void>
```

**Modify: `app/src/app/api/chat/route.ts`**

At the top of the POST handler, after auth, add:
```typescript
const limitCheck = await checkMessageLimit(org.id);
if (!limitCheck.allowed) {
  return Response.json({ 
    error: 'Message limit reached', 
    upgradeRequired: limitCheck.upgradeRequired 
  }, { status: 402 });
}
```

After successful message processing, call `incrementMessageCount(org.id)`.

**Modify: `app/src/app/api/projects/route.ts`**

Add project count check before creation.

**Success Criteria for Sprint 2:**
- [ ] New user auto-gets an org on first login
- [ ] All data queries are org-scoped
- [ ] Free tier rejects messages after 100/month with a 402 + `upgradeRequired` flag
- [ ] Free tier rejects project creation after 3 projects

---

## Sprint 3: API Key Management

**Goal:** Free tier users provide their own Anthropic key. Pro/Team users use the platform key. Keys are stored encrypted.

### 3.1 — API Key Settings UI

**Create: `app/src/app/settings/api-keys/page.tsx`**

Page with:
- Section: "AI Provider Key" 
- Shows key hint if one is stored (e.g., `sk-ant-...****xxxx`)
- Input field to add/update BYO Anthropic API key
- Delete button to remove key
- Note: "Free plan requires your own API key. Upgrade to Pro to use our managed key."
- Link to Anthropic console to get a key

### 3.2 — API Key Routes

**Create: `app/src/app/api/settings/api-key/route.ts`**

```typescript
// GET — returns { hasKey: boolean, hint: string | null, provider: string }
// POST — body: { key: string, provider: 'anthropic' }
//   validates key format (must start with 'sk-ant-')
//   encrypts with encryptApiKey() 
//   upserts to user_api_keys table
// DELETE — removes the key
```

### 3.3 — Key Resolution in Chat Route

**Create: `app/src/lib/api-key-resolver.ts`**

```typescript
// Returns the Anthropic API key to use for a given org/user combination
// Logic:
// 1. If org.plan === 'free': MUST use org's stored BYO key (decrypt from user_api_keys)
//    - If no BYO key stored: throw error with code 'BYO_KEY_REQUIRED'
// 2. If org.plan === 'pro' | 'team': use process.env.ANTHROPIC_API_KEY (platform key)
//    - If org also has a BYO key stored AND they prefer it: use theirs (optional preference)
export async function resolveAnthropicKey(orgId: string, userId: string): Promise<string>
```

**Modify: `app/src/app/api/chat/route.ts`**

Replace the implicit `process.env.ANTHROPIC_API_KEY` usage (which happens deep in the session manager) by:
1. Calling `resolveAnthropicKey(org.id, user.id)` at the top of the handler
2. Passing the resolved key into `getOrCreateSession()` and the synthesis Anthropic client

**Modify: `app/src/lib/session-manager.ts`**

Update `getOrCreateSession()` and `streamCoachResponse()` to accept an optional `apiKey` parameter that overrides the env var.

### 3.4 — BYO Key Setup Prompt

**Modify: `app/src/app/page.tsx`** (the main chat page)

If `org.plan === 'free'` and no BYO key is stored, show a banner above the chat:

> ⚠️ **API key required.** The free plan uses your own Anthropic API key. [Add your key →] or [Upgrade to Pro →]

The chat input should be disabled until a key is added.

**Success Criteria for Sprint 3:**
- [ ] Free user can add their Anthropic API key in settings
- [ ] Free user's key is used in chat (verify with a test API key)
- [ ] Pro user uses platform key with no configuration
- [ ] Missing key on free plan shows correct error, not a 500

---

## Sprint 4: Stripe Billing

**Goal:** Stripe subscriptions gate Pro/Team features. Customer portal handles upgrades/downgrades/cancellation.

### 4.1 — Create Stripe Products (Manual Step — Document for Founder)

In the Stripe Dashboard, create:
- Product: **Quorum Pro** — `$49/month` recurring → note the `price_id`
- Product: **Quorum Team** — `$149/month` recurring → note the `price_id`

Set these price IDs as `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_TEAM_MONTHLY` env vars.

### 4.2 — Billing Library

**Create: `app/src/lib/billing.ts`**

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create Stripe customer for an org (called on org creation)
export async function createStripeCustomer(orgId: string, email: string, name: string): Promise<string>

// Create checkout session for plan upgrade
export async function createCheckoutSession(params: {
  orgId: string;
  plan: 'pro' | 'team';
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }>

// Create customer portal session (manage subscription)
export async function createPortalSession(orgId: string, returnUrl: string): Promise<{ url: string }>

// Handle Stripe webhook events
export async function handleWebhookEvent(payload: string, signature: string): Promise<void>
// Handles: checkout.session.completed, customer.subscription.updated, 
//          customer.subscription.deleted, invoice.payment_failed
// On each event: update organizations table (plan, subscriptionStatus, stripeSubscriptionId)

// Get subscription status for an org
export async function getSubscriptionStatus(orgId: string): Promise<{
  plan: 'free' | 'pro' | 'team';
  status: string;
  currentPeriodEnd?: Date;
}>
```

### 4.3 — Billing API Routes

**Create: `app/src/app/api/billing/checkout/route.ts`**
```typescript
// POST — body: { plan: 'pro' | 'team' }
// Creates Stripe checkout session, returns { url }
// Auth required
```

**Create: `app/src/app/api/billing/portal/route.ts`**
```typescript
// POST — no body
// Creates Stripe customer portal session, returns { url }
// Auth required
```

**Create: `app/src/app/api/billing/webhook/route.ts`**
```typescript
// POST — Stripe webhook endpoint
// NO auth middleware (Stripe calls this directly)
// Verify signature with STRIPE_WEBHOOK_SECRET
// Call handleWebhookEvent()
// export const config = { api: { bodyParser: false } }  ← critical for signature verification
```

### 4.4 — Pricing / Upgrade UI

**Create: `app/src/app/settings/billing/page.tsx`**

Shows:
- Current plan badge (Free / Pro / Team)
- Usage this month (messages used / limit)
- Upgrade cards for Pro and Team if on free plan
- "Manage subscription" button (→ Stripe portal) if on paid plan
- Expert review credits remaining

**Create: `app/src/components/UpgradeModal.tsx`**

Reusable modal that shows when a limit is hit (triggered by 402 response from API). Props:
```typescript
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'message_limit' | 'project_limit' | 'byo_key_required';
  requiredPlan: 'pro' | 'team';
}
```

**Modify: `app/src/app/page.tsx`** (chat page)

Handle 402 responses from `/api/chat` by opening `<UpgradeModal />`.

### 4.5 — Navigation Updates

**Modify: `app/src/components/`** (sidebar/nav component — identify correct file)

Add to navigation:
- Settings → Billing (link to `/settings/billing`)
- Settings → API Key (link to `/settings/api-keys`)
- Show plan badge next to user name/avatar

**Success Criteria for Sprint 4:**
- [ ] Free user sees upgrade prompt when hitting message limit
- [ ] Clicking "Upgrade" redirects to Stripe checkout
- [ ] After successful payment, org plan updates to 'pro' via webhook
- [ ] Pro user has unlimited messages
- [ ] "Manage subscription" opens Stripe customer portal
- [ ] Stripe webhook verified and updates DB correctly

---

## Sprint 5: Expert Marketplace

**Goal:** Users post review requests with a budget. Experts bid. Best expert wins. Stripe handles payment and payout.

### 5.1 — Expert Onboarding Flow

**Create: `app/src/app/expert/apply/page.tsx`**

Public page (no auth required to view, auth required to submit):
- Heading: "Join the Expert Network"
- Form fields:
  - Display name
  - Bio (textarea, 200 char min)
  - Domains (multi-select checkboxes: Founder Coaching, Business Strategy, Fundraising, Finance & Tax, Legal, Growth & GTM, Technology)
  - Minimum rate (slider: $25–$500)
  - Maximum rate (slider: $25–$500, must be ≥ min)
  - "Connect with Stripe" button (initiates Stripe Connect OAuth)
- On submit: creates `expert_profiles` record with `isActive: false`
- Shows: "Thanks! We'll review your application and reach out within 48 hours."

**Create: `app/src/app/api/expert/apply/route.ts`**
```typescript
// POST — body: { displayName, bio, domains, rateMinCents, rateMaxCents }
// Auth required
// Creates expert_profiles record (isActive: false)
// Sends email to admin (RESEND_FROM_EMAIL) with application details
```

**Create: `app/src/app/api/expert/stripe-connect/route.ts`**
```typescript
// GET — initiates Stripe Connect OAuth flow
// Redirects to Stripe Connect account creation URL
// Returns account link URL

// POST — body: { code } — exchange OAuth code for account ID
// Updates expert_profiles.stripeConnectAccountId
// Checks if onboarding complete → sets stripeConnectOnboarded: true
```

**Create: `app/src/app/admin/experts/page.tsx`** (admin only — check `AUTH_ADMIN_EMAILS`)

- Lists all expert applications
- Shows: name, domains, rate range, application date, current status
- Approve / Reject buttons → calls `/api/admin/experts/[id]/approve`
- Founding expert toggle (sets `platformFeeRate: 0.10`)

**Create: `app/src/app/api/admin/experts/[id]/approve/route.ts`**
```typescript
// POST — admin only
// body: { approved: boolean, isFoundingExpert?: boolean }
// Updates expert_profiles.isActive
// Sends welcome email to expert via Resend
```

### 5.2 — Request Posting (User Side)

**Create: `app/src/components/ExpertReviewButton.tsx`**

Button that appears in the chat interface after any assistant message. Label: "Get Expert Review ($25+)". Opens the request posting modal.

**Create: `app/src/components/PostReviewRequestModal.tsx`**

Modal with:
- Title field (pre-filled with first 80 chars of the conversation topic)
- Question field (what specifically do you want reviewed?)
- Domain selector (auto-detected from current conversation coach, but editable)
- Budget slider: $25 – $500 (increments of $25)
- Shows: "We'll find the best expert for your budget. Delivery within 4 hours or your money back."
- Shows: estimated available experts at this price (call `/api/marketplace/expert-count?domain=X&budgetCents=Y`)
- Submit button → creates payment intent → shows Stripe payment form

**Create: `app/src/app/api/marketplace/requests/route.ts`**
```typescript
// POST — auth required
// body: { conversationId, title, question, domain, budgetCents }
// Validates:
//   - org has paid plan OR has expert_review_credits > 0
//   - budgetCents >= 2500 ($25)
//   - domain is valid
// Creates Stripe PaymentIntent (holds funds, not captured yet)
// Creates marketplace_requests record with status: 'open'
// Calls notifyEligibleExperts() (see 5.3)
// Returns: { requestId, clientSecret } (clientSecret for Stripe Elements)

// GET — lists requests for the current org
```

**Create: `app/src/app/api/marketplace/expert-count/route.ts`**
```typescript
// GET — ?domain=X&budgetCents=Y
// Returns { count: number } — active experts where domain matches and rateMin <= budgetCents
// Public (no auth required, used for UX preview)
```

### 5.3 — Expert Notification & Bidding Engine

**Create: `app/src/lib/marketplace-engine.ts`**

```typescript
// Called when a new marketplace request is created
export async function notifyEligibleExperts(requestId: string): Promise<void>
// Logic:
// 1. Find active experts where: domain match AND rateMinCents <= request.budgetCents
// 2. Score each expert: (rating * 0.6) + (acceptance_rate * 0.3) + (1/avg_delivery_hours * 0.1)
// 3. Notify top 10 experts by score
// 4. Create expert_bids record with status: 'pending', notifiedAt: now()
// 5. Send email to each expert via Resend with: title, domain, budget, deadline, accept link

// Called by cron job / webhook every 30 minutes
export async function processExpiredBids(): Promise<void>
// Logic:
// 1. Find requests in status 'open' where no expert has accepted within awardWindowHours
// 2. For each such request: find next unnotified eligible expert
// 3. Notify them, or if exhausted: mark request as 'expired', refund payment intent

// Called when expert accepts a bid
export async function awardRequest(requestId: string, expertId: string): Promise<void>
// Logic:
// 1. Update marketplace_requests: status='awarded', awardedExpertId, awardedAt, deliveryDeadline
// 2. Capture Stripe PaymentIntent
// 3. Calculate platform fee: budgetCents * expert.platformFeeRate
// 4. Update request: platformFeeCents, expertPayoutCents
// 5. Update other bids for this request to status: 'rejected'
// 6. Send confirmation email to user and expert
// 7. Generate access token for expert (signed URL to view conversation)
```

**Create: `app/src/app/api/marketplace/bids/[requestId]/accept/route.ts`**
```typescript
// POST — expert auth required (check expert_profiles record exists for user)
// Calls awardRequest(requestId, expert.id)
// Returns: { success: true, accessToken, deliveryDeadline }
```

**Create: `app/src/app/api/marketplace/bids/[requestId]/decline/route.ts`**
```typescript
// POST — expert auth required
// Updates expert_bids record status: 'rejected', respondedAt: now()
// Updates expert acceptance_rate calculation
```

### 5.4 — Expert Delivery Interface

**Create: `app/src/app/expert/review/[token]/page.tsx`**

Expert-facing review page (accessed via signed token, no full auth required):
- Shows: request title, question, conversation context summary
- Shows: budget, delivery deadline (countdown timer)
- Full conversation thread read-only view (last 20 messages)
- Review submission form:
  - Structured feedback text area (required, min 200 chars)
  - Section: "What the AI advisors got right"
  - Section: "What to reconsider or correct"
  - Section: "My recommendation"
  - Optional: file attachment (upload to Cloudflare R2 — stubbed if R2 not configured)
- Submit button → calls `/api/marketplace/deliver/[requestId]`

**Create: `app/src/app/api/marketplace/deliver/[requestId]/route.ts`**
```typescript
// POST — token auth (from URL param, validated against marketplace_requests.accessToken)
// body: { whatWentRight, whatToReconsider, recommendation, attachmentUrl? }
// Validates: request is in 'awarded' status, expert matches awardedExpertId, before deadline
// Actions:
//   1. Create expert_comments record with the structured review
//   2. Update marketplace_requests: status='completed', completedAt: now()
//   3. Trigger Stripe Transfer to expert's Connect account (expertPayoutCents)
//   4. Update expert_profiles: totalReviews++, update avgDeliveryHours
//   5. Send completion email to user with link to view review in app
//   6. Returns: { success: true }
```

### 5.5 — User Receives Review

**Modify: `app/src/app/reviews/page.tsx`** (existing page)

Extend to show marketplace requests alongside existing invite-style reviews:
- Status badges: Open / Awaiting Expert / In Review / Completed / Expired
- Budget paid and delivery time shown
- Completed reviews link to conversation with expert comments highlighted
- Rating widget: 1–5 stars, appears after delivery, calls `/api/marketplace/rate/[requestId]`

**Create: `app/src/app/api/marketplace/rate/[requestId]/route.ts`**
```typescript
// POST — auth required, requester only
// body: { rating: 1-5, note?: string }
// Updates marketplace_requests.expertRating
// Updates expert_profiles.averageRating (weighted rolling average)
// If rating < 3: sends alert email to admin
```

### 5.6 — Expert Dashboard

**Create: `app/src/app/expert/dashboard/page.tsx`**

Auth required + must have `expert_profiles` record:
- Available requests (status: open, matching their domains and rate)
- Active reviews (awarded, in_review)
- Completed reviews history
- Earnings summary (current month, all time)
- Rating and acceptance rate stats
- Stripe payout dashboard link

**Create: `app/src/app/api/expert/requests/route.ts`**
```typescript
// GET — expert auth required
// Returns marketplace requests matching expert's domains and rate, status='open'
// Sorted by: (budget DESC, posted_at ASC) — highest value, oldest first
```

### 5.7 — Cron Job for Bid Expiry

**Create: `app/src/app/api/cron/process-bids/route.ts`**
```typescript
// GET — secured with CRON_SECRET header check
// Calls processExpiredBids()
// Configure in vercel.json:
// { "crons": [{ "path": "/api/cron/process-bids", "schedule": "*/30 * * * *" }] }
```

**Create: `vercel.json`** in `app/` directory:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-bids",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Success Criteria for Sprint 5:**
- [ ] Expert can apply and be approved via admin panel
- [ ] User can post a review request with budget and pay via Stripe
- [ ] Eligible experts receive email notification within 5 minutes
- [ ] Expert can accept/decline from email link
- [ ] Accepted expert can submit structured review via token-gated page
- [ ] User sees completed review in app
- [ ] Stripe Transfer executes automatically on review delivery
- [ ] Rating updates expert's profile score

---

## Sprint 6: Marketing Landing Page & Onboarding

**Goal:** Public-facing landing page. Improved post-signup onboarding flow.

### 6.1 — Landing Page

**Create: `app/src/app/(marketing)/page.tsx`**

Use a Next.js route group `(marketing)` so it has its own layout without the app sidebar. This IS the root `/` route — redirect authenticated users to `/dashboard`.

**Create: `app/src/app/(marketing)/layout.tsx`**

Marketing layout: full-width, no sidebar, has a header with logo + "Sign In" + "Get Started free" buttons.

**Landing page sections** (implement as separate components in `app/src/components/marketing/`):

1. **`HeroSection.tsx`**: 
   - Headline: "Your AI advisory board — always in session"
   - Sub: "Seven specialized advisors across strategy, finance, legal, growth, and technology. Human expert review when stakes are high."
   - CTAs: "Start free — no credit card" (→ `/auth/signin`) | "See it in action" (→ scroll to demo)
   - Background: subtle gradient, not flashy

2. **`AdvisorShowcaseSection.tsx`**:
   - Grid of 7 advisor cards (one per advisor)
   - Each card: icon, name, domain, 3 example topics they cover
   - Data sourced from `COACHES` constant in `app/src/lib/coaches.ts`

3. **`HowItWorksSection.tsx`**:
   - 3-step flow: "Ask anything" → "Your AI board convenes" → "Get expert review when needed"
   - Simple numbered steps with brief descriptions

4. **`PricingSection.tsx`**:
   - 3 columns: Free / Pro / Team
   - Feature comparison table
   - "Get started" / "Upgrade" CTAs linking to checkout or signup
   - Highlight Pro as recommended

5. **`ExpertNetworkSection.tsx`**:
   - "When you need more than AI" heading
   - Explains the expert marketplace: set your price, get matched, delivered in 4 hours
   - "Join as an expert" link for experts to apply

6. **`SocialProofSection.tsx`**:
   - Placeholder for testimonials (3 slots with founder headshot, name, company, quote)
   - Note in code: `// TODO: Replace with real testimonials after first 10 customers`

7. **`FooterSection.tsx`**:
   - Links: Pricing, Expert Network, Join as Expert, Privacy Policy, Terms of Service
   - Copyright

### 6.2 — Root Route Logic

**Modify: `app/src/app/page.tsx`** (current chat page)

Move the current chat interface to `app/src/app/dashboard/page.tsx`. 

The new `app/src/app/page.tsx`:
```typescript
// If authenticated → redirect to /dashboard
// If not authenticated → render landing page (or redirect to /marketing)
// Use Next.js middleware for this redirect logic
```

**Create: `app/src/middleware.ts`** (if not existing)
```typescript
// Protected routes: /dashboard/*, /settings/*, /projects/*, /behaviors/*, 
//                   /effectiveness/*, /reviews/*, /knowledge/*, /admin/*,
//                   /expert/dashboard/*
// Public routes: /, /auth/*, /review/[token]/*, /expert/apply/*
// /api/billing/webhook — must be public
// /api/marketplace/expert-count — must be public
```

### 6.3 — Post-Signup Onboarding

**Create: `app/src/app/onboarding/page.tsx`**

Step-wizard with 4 steps. Show after first login if `user.onboardingComplete !== true`.

**Step 1: Welcome**
- "Welcome to Quorum! Your AI advisory board is ready."
- One-sentence explanation of each advisor
- "Next →" button

**Step 2: Tell us about you**
- Business name / description (saved to user profile)
- Industry selector
- Stage selector (idea/pre-revenue/growth/scale)
- These go into the existing user profile system

**Step 3: Set up your API key** (Free plan only — skip for paid)
- Explains they need an Anthropic API key
- Link to console.anthropic.com to get one
- Key input field
- "I'll do this later" option (shows warning that chat won't work)

**Step 4: Ask your first question**
- Suggested starter questions based on their stage:
  - Idea stage: "What should my first 10 customers look like?"
  - Pre-revenue: "How should I structure my pitch deck?"
  - Growth: "What hiring mistakes should I avoid at this stage?"
- Click a question → goes to dashboard with that question pre-filled
- "Ask something else" → goes to dashboard with empty chat

**Create: `app/src/app/api/onboarding/complete/route.ts`**
```typescript
// POST — auth required
// Marks user profile as onboarding complete
// Saves any profile data from step 2
```

**Success Criteria for Sprint 6:**
- [ ] Landing page renders at `/` for unauthenticated users
- [ ] Authenticated users land on `/dashboard` (the chat interface)
- [ ] Landing page has all 6 sections with real content
- [ ] New user goes through onboarding wizard after first login
- [ ] Free user is prompted for API key in step 3
- [ ] Onboarding step 4 pre-populates chat with chosen question

---

## Sprint 7: Email Templates (Resend)

**Create: `app/src/lib/email/`** directory with:

**`templates.ts`** — all email content as TypeScript functions returning `{ subject, html }`:

| Function | Trigger | Recipients |
|---|---|---|
| `expertApplicationReceived(expert)` | Expert applies | Admin |
| `expertApproved(expert)` | Admin approves | Expert |
| `expertNewRequest(expert, request)` | New matching request | Expert |
| `expertAwardConfirmation(expert, request, deadline)` | Expert wins bid | Expert |
| `userRequestAwarded(user, request, expertName)` | Expert accepts | User |
| `expertDeliveryConfirmation(expert, request)` | Review delivered | Expert |
| `userReviewComplete(user, request, reviewUrl)` | Review delivered | User |
| `requestExpired(user, request)` | No expert found in time | User |
| `paymentFailed(user, org)` | Stripe payment fails | User |

**`sender.ts`** — wrapper around Resend SDK:
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void>
```

All emails must:
- Use plain HTML (no React Email dependency — keep it simple)
- Include unsubscribe link in footer
- Have the product name and logo in header

---

## Sprint 8: Analytics & Observability

**Goal:** Know what users are doing without building a data warehouse.

### 8.1 — Posthog Integration

**Modify: `app/src/app/layout.tsx`** (root layout)

Add PostHog provider (client-side only):
```typescript
// Install: npm install posthog-js
// Wrap children in PostHogProvider
// Use NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST env vars
// Only initialize in production (process.env.NODE_ENV === 'production')
```

**Create: `app/src/lib/analytics.ts`**

Server-side event tracking (for API routes):
```typescript
// Track key business events:
export async function trackEvent(event: string, properties: Record<string, unknown>, userId?: string): Promise<void>

// Events to track:
// - 'signup' (user, org, plan)
// - 'message_sent' (orgId, plan, coachKey, mode, tokenCount)
// - 'plan_upgraded' (orgId, fromPlan, toPlan)
// - 'expert_review_posted' (orgId, domain, budgetCents)
// - 'expert_review_completed' (requestId, deliveryHours, expertRating)
// - 'byo_key_added' (orgId)
// - 'limit_hit' (orgId, plan, limitType)
```

### 8.2 — Admin Analytics Dashboard

**Modify: `app/src/app/admin/page.tsx`** (existing admin page)

Add a metrics section visible to admins:
- Total orgs by plan (free / pro / team)
- Messages sent (last 30 days)
- Expert reviews: posted / completed / expired
- Revenue this month (from Stripe — call Stripe API to get MRR)
- New signups (last 7 days)

**Create: `app/src/app/api/admin/metrics/route.ts`**
```typescript
// GET — admin only
// Returns aggregated metrics from usage_events table and Stripe API
```

---

## File Structure Summary (New Files Only)

```
app/
├── drizzle.config.ts                          [NEW]
├── vercel.json                                [NEW]
├── drizzle/migrations/                        [NEW - generated]
└── src/
    ├── middleware.ts                          [NEW]
    ├── lib/
    │   ├── db/
    │   │   ├── client.ts                      [NEW]
    │   │   ├── schema.ts                      [NEW]
    │   │   ├── index.ts                       [NEW]
    │   │   └── queries/
    │   │       ├── organizations.ts           [NEW]
    │   │       ├── projects.ts                [NEW]
    │   │       ├── conversations.ts           [NEW]
    │   │       ├── feedback.ts                [NEW]
    │   │       ├── behaviors.ts               [NEW]
    │   │       ├── reviews.ts                 [NEW]
    │   │       ├── experts.ts                 [NEW]
    │   │       └── api-keys.ts                [NEW]
    │   ├── billing.ts                         [NEW]
    │   ├── encryption.ts                      [NEW]
    │   ├── plan-limits.ts                     [NEW]
    │   ├── api-key-resolver.ts                [NEW]
    │   ├── marketplace-engine.ts              [NEW]
    │   ├── analytics.ts                       [NEW]
    │   ├── email/
    │   │   ├── templates.ts                   [NEW]
    │   │   └── sender.ts                      [NEW]
    │   ├── auth.ts                            [MODIFY]
    │   ├── session-manager.ts                 [MODIFY]
    │   └── db.ts                              [MODIFY - becomes re-export]
    ├── components/
    │   ├── UpgradeModal.tsx                   [NEW]
    │   ├── ExpertReviewButton.tsx             [NEW]
    │   ├── PostReviewRequestModal.tsx         [NEW]
    │   └── marketing/
    │       ├── HeroSection.tsx                [NEW]
    │       ├── AdvisorShowcaseSection.tsx     [NEW]
    │       ├── HowItWorksSection.tsx          [NEW]
    │       ├── PricingSection.tsx             [NEW]
    │       ├── ExpertNetworkSection.tsx       [NEW]
    │       ├── SocialProofSection.tsx         [NEW]
    │       └── FooterSection.tsx              [NEW]
    └── app/
        ├── page.tsx                           [MODIFY - root redirect logic]
        ├── (marketing)/
        │   ├── layout.tsx                     [NEW]
        │   └── page.tsx                       [NEW - landing page]
        ├── dashboard/
        │   └── page.tsx                       [NEW - moved from app/page.tsx]
        ├── onboarding/
        │   └── page.tsx                       [NEW]
        ├── expert/
        │   ├── apply/page.tsx                 [NEW]
        │   ├── dashboard/page.tsx             [NEW]
        │   └── review/[token]/page.tsx        [NEW]
        ├── settings/
        │   ├── api-keys/page.tsx              [NEW]
        │   └── billing/page.tsx               [NEW]
        └── api/
            ├── billing/
            │   ├── checkout/route.ts          [NEW]
            │   ├── portal/route.ts            [NEW]
            │   └── webhook/route.ts           [NEW]
            ├── marketplace/
            │   ├── requests/route.ts          [NEW]
            │   ├── expert-count/route.ts      [NEW]
            │   ├── bids/[requestId]/
            │   │   ├── accept/route.ts        [NEW]
            │   │   └── decline/route.ts       [NEW]
            │   ├── deliver/[requestId]/route.ts [NEW]
            │   └── rate/[requestId]/route.ts  [NEW]
            ├── expert/
            │   ├── apply/route.ts             [NEW]
            │   ├── requests/route.ts          [NEW]
            │   └── stripe-connect/route.ts    [NEW]
            ├── settings/
            │   └── api-key/route.ts           [NEW]
            ├── onboarding/
            │   └── complete/route.ts          [NEW]
            ├── admin/
            │   ├── experts/[id]/approve/route.ts [NEW]
            │   └── metrics/route.ts           [NEW]
            └── cron/
                └── process-bids/route.ts      [NEW]
```

---

## Non-Negotiable Constraints for Claude Code

1. **Never break existing tests.** Run `npm test` after each sprint and fix failures before moving on.
2. **Preserve all existing API route signatures.** The frontend should continue working during the DB migration.
3. **Never hardcode credentials.** All secrets come from environment variables.
4. **Webhook route must disable body parsing.** Stripe signature verification requires raw body. Use `export const config = { api: { bodyParser: false } }` pattern.
5. **Stripe payment capture is deferred.** Create PaymentIntent with `capture_method: 'manual'` when user posts request. Only capture when `awardRequest()` is called. If no expert is found, cancel the PaymentIntent for automatic refund.
6. **Expert access tokens are time-limited.** Set `expiresAt` to `awardedAt + 48 hours`. Token validation must check expiry.
7. **All money amounts stored in cents** (integers), never floats. No rounding errors.
8. **Platform fee = 20% by default, 10% for founding experts.** Store rate on `expert_profiles.platformFeeRate` at creation time — do not compute dynamically.
9. **The `(marketing)` route group** must not include the app's sidebar layout. Implement separate layouts.
10. **Mobile responsive.** All new UI components must be Tailwind-responsive with `sm:`, `md:` breakpoints at minimum.