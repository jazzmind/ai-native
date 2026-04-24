# AI Executive Team

An AI-native advisory platform with eight specialized advisors, a Chief of Staff orchestrator, five operational modes, human/expert-in-the-loop controls, behavioral adaptation, and persistent memory. Advisors work independently or together, with intelligent routing that assembles the right team for each question and synthesizes their perspectives.

## Advisors

| Advisor | Domain | Key Topics |
|---------|--------|------------|
| **Chief of Staff** | Orchestration & EA | Day planning, task tracking, status reports, advisor coordination |
| **Founder** | Personal alignment | Goals, vision, focus, work-life balance |
| **Strategy** | Business strategy | Market positioning, KPIs/OKRs, competitive analysis |
| **Funding** | Capital strategy | VC, angel, bootstrapping, debt, cap tables |
| **Finance** | Financial operations | Accounting, tax, compliance, risk, FP&A |
| **Legal** | Legal strategy | Contracts, IP, corporate structure, employment law |
| **Growth** | Go-to-market | Sales, marketing, PLG, retention, pricing |
| **Technology** | Technical architecture | System design, AI/ML, DevOps, security |
| **QA Judge** | Quality control | Research credibility, GEO detection, source verification |

## Chief of Staff

The Chief of Staff is an orchestrating executive assistant that sits above the advisory team. It handles two categories of work:

**Executive assistance** — Operational tasks the other advisors don't do:
- Day planning ("plan my day", "what's on my plate")
- Task and follow-up tracking via `ea-state/` markdown files
- Meeting note ingestion and action item extraction
- Status report collection and delivery

**Advisor orchestration** — For complex cross-domain questions, the Chief of Staff:
1. Analyzes the request and decides which advisors to engage
2. Dispatches targeted questions to each selected advisor in parallel
3. Synthesizes their responses into a unified answer with attribution

### Memory

The Chief of Staff maintains persistent memory across sessions via the `ea_memory` database table. Memory is organized into five types:

| Type | What it stores |
|------|---------------|
| `template` | Document and report templates you've provided |
| `recurring_task` | Workflows that repeat on a schedule |
| `contact` | Colleague names, roles, and communication cadence |
| `preference` | How you want things done (format, tone, process) |
| `context` | Standing facts about the business or team |

Memory is saved automatically when the Chief of Staff produces a `:::memory` block in a response. You can also manage memory directly via `GET/POST/DELETE /api/ea/memory`.

### Recurring Tasks

The Chief of Staff can schedule recurring tasks. The canonical example: give it a status report template and it will automatically prompt you for updates on the defined cadence.

**How it works:**
1. Give the Chief of Staff a template: *"Here's my weekly status report format — use this every Friday"*
2. It stores the template as an `ea_memory` entry with key `weekly_status_report`
3. It schedules a `status_report_collection` task with `repeat: 7d` linked to the template
4. Every week, the cron job at `/api/cron/ea-tasks` fires a notification prompting you to collect updates
5. When you respond, the Chief of Staff loads the saved template and fills in what it knows

The repeat interval supports: `m` (minutes), `h` (hours), `d` (days), `w` (weeks). Example: `repeat: 1w`.

## Modes

Advisors operate across a spectrum of autonomy:

| Mode | Behavior | Output |
|------|----------|--------|
| **Advise** | Research + knowledge to recommend | Analysis with clear recommendation |
| **Coach** | Socratic method, build user capability | Probing questions + frameworks |
| **Plan** | Produce structured action items | Prioritized plan with owners and timelines |
| **Assist** | Do all prep work, stop before decisions | Drafted artifacts ready for human review |
| **Execute** | Make decisions and act via tools | Actions taken + rationale + results |

Modes can be selected explicitly or auto-detected from message intent by the router.

## Key Features

### Multi-Agent Collaboration
Route questions to 1-4 advisors automatically. A lead advisor synthesizes perspectives into a unified recommendation with attribution.

### Behavioral Adaptation
Thumbs up/down feedback on every response. When negative feedback accumulates, the system proposes behavioral changes (AI-analyzed, human-approved) that are injected as runtime directives without redeploying agents.

### Human in the Loop (Execute Mode)
Configurable tool trust levels per project: **auto** (executes immediately), **confirm** (requires approval), **blocked** (unavailable). Session-level batch approval after first confirmation to avoid click fatigue.

### Expert in the Loop
Invite external experts (accountants, lawyers, technical advisors) to review conversations and provide inline feedback. Supports both registered users and guest access via signed links. Expert comments are automatically incorporated into agent context.

### Effectiveness Dashboard
Per-advisor feedback trends, mode usage distribution, per-advisor-per-mode performance matrix, and behavioral adaptation history.

### Multi-User & Projects
OAuth/SSO authentication (Google, GitHub, generic OIDC) via Auth.js v5. Project-scoped workspaces with per-user deployment targets and shared/private knowledge bases.

### Knowledge Base
Adapter-based knowledge system supporting standalone SQLite FTS5 or Busibox RAG. Knowledge scoped per-project with a common pool and explicit sharing between projects.

---

## Installation

There are two ways to run this: **local development** (everything on your machine) and **Vercel SaaS** (hosted, multi-user, with Postgres and blob storage). Both require deploying the advisor agents to Claude Managed Agents first.

### Prerequisites

- Node.js 20+
- Python 3.11+ (for `deploy.py`)
- An Anthropic API key with Managed Agents access
- A Neon (or compatible Postgres) database

---

### Step 1 — Deploy the Agents

Agents are deployed once to Claude's managed infrastructure, independent of where you run the app.

```bash
cd ai-native
pip install anthropic
python deploy.py deploy
```

This creates 9 agents (7 advisors + QA Judge + Chief of Staff) and an environment. State is saved to `.deploy-state.json`. To update agents after changing `INSTRUCTIONS.md` files, run `deploy` again — it will update in place.

**Check deployment:**
```bash
python deploy.py list
```

---

### Step 2 — Database Migrations

The app uses Drizzle ORM with Neon (Postgres). **Migrations do not run automatically** — you must run them explicitly after initial setup and whenever the schema changes.

Set your database URL in `app/.env.local`:
```env
DATABASE_URL=postgresql://...
```

Then run:
```bash
cd ai-native/app
npm install
npm run db:migrate
```

> **Important:** `npm run dev`, `npm start`, and Vercel deploy do **not** apply migrations. You must run `npm run db:migrate` yourself. On Vercel, the easiest approach is to run migrations locally against the production database URL before deploying, or use the Neon console.

If you've changed the schema (e.g., added a new table), regenerate migrations first:
```bash
npm run db:generate   # generates SQL migration files in drizzle/migrations/
npm run db:migrate    # applies pending migrations to the database
```

---

### Local Development

```bash
cd ai-native/app
cp .env.local.example .env.local
```

Edit `.env.local` with:
```env
# Database
DATABASE_URL=postgresql://...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Auth
AUTH_SECRET=<random 32-char string>
AUTH_TRUST_HOST=true
AUTH_ADMIN_EMAILS=you@example.com

# Optional: file storage (defaults to local filesystem if not set)
# BLOB_READ_WRITE_TOKEN=...

# Optional: cron security (leave unset for local dev)
# CRON_SECRET=...
```

Run:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit you'll go through onboarding to configure your deployment target (points to the agent IDs from Step 1).

**Desktop app (Electron):**
```bash
npm run electron:dev
```

---

### Vercel SaaS Deployment

1. **Fork or clone** the repo and connect it to Vercel
2. Set the **Root Directory** to `ai-native/app`
3. Configure these environment variables in the Vercel dashboard:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `ANTHROPIC_API_KEY` | Anthropic console |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_ADMIN_EMAILS` | Your email(s), comma-separated |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob → Create store |
| `CRON_SECRET` | Any random string (protects cron endpoints) |
| `STRIPE_SECRET_KEY` | Stripe dashboard (optional, for billing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (optional) |
| `RESEND_API_KEY` | Resend.com (optional, for email) |

4. **Run migrations** against your production database before the first deploy:
   ```bash
   DATABASE_URL=<production-url> npm run db:migrate
   ```

5. Deploy. Vercel will run `npm run build` automatically.

6. **Cron jobs** are configured in `vercel.json` and run automatically on Vercel's infrastructure:
   - `/api/cron/ea-tasks` — every 30 min, fires recurring EA task notifications
   - `/api/cron/process-bids` — every 30 min, processes marketplace bid timeouts
   - `/api/cron/heartbeat` — every 15 min, health check

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Executive Team App                        │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  Chat UI    │  │  Modes   │  │ Feedback │  │Expert Review│  │
│  │  (Next.js)  │  │ Selector │  │ Buttons  │  │Dialog/View  │  │
│  └──────┬──────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│         │              │             │               │          │
│  ┌──────┴──────────────┴─────────────┴───────────────┴───────┐  │
│  │                       API Routes                           │  │
│  │  /api/chat  /api/feedback  /api/behaviors  /api/reviews    │  │
│  │  /api/ea/memory  /api/cron/ea-tasks                        │  │
│  └──────┬─────────────────────────────────────────────────────┘  │
│         │                                                        │
│  ┌──────┴──────────────┐  ┌──────────────────────────────────┐   │
│  │  Router             │  │  Providers (Adapter Pattern)      │   │
│  │  EA Orchestrator    │  │  Knowledge: Standalone | Busibox  │   │
│  │  Session Manager    │  │  Profile:   Standalone | Busibox  │   │
│  │  Mode Loader        │  │  Activity:  Standalone | Busibox  │   │
│  │  Behavior Injection │  └──────────────────────────────────┘   │
│  └──────┬──────────────┘                                         │
│         │                                                        │
│  ┌──────┴──────────────────────────────────────────────────┐     │
│  │              Neon (Postgres + Drizzle ORM)               │     │
│  │  conversations | messages | projects | coach_sessions    │     │
│  │  agent_tasks | ea_memory | notifications                 │     │
│  │  agent_behaviors | review_requests | expert_comments     │     │
│  │  marketplace_requests | expert_bids | expert_profiles    │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
         │
    ┌────┴───────────────────────────────────┐
    │         Claude Managed Agents           │
    │  Chief of Staff (calls all advisors)   │
    │  Founder | Strategy | Technology        │
    │  Funding | Finance | Legal | Growth     │
    │  QA Judge                               │
    └────────────────────────────────────────┘
```

## Project Structure

```
ai-native/
├── app/                         # Next.js + Electron app
│   ├── drizzle/migrations/      # Generated SQL migration files
│   ├── electron/                # Electron main process + preload
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages + API routes
│   │   │   ├── admin/           # Admin console pages
│   │   │   ├── api/
│   │   │   │   ├── chat/        # Main chat endpoint (EA + advisor routing)
│   │   │   │   ├── ea/memory/   # EA memory CRUD
│   │   │   │   ├── cron/        # Scheduled jobs (ea-tasks, process-bids)
│   │   │   │   └── ...          # Other API endpoints
│   │   │   └── ...
│   │   ├── components/          # React components
│   │   └── lib/
│   │       ├── db/
│   │       │   ├── schema.ts    # Drizzle schema (all tables)
│   │       │   ├── client.ts    # Neon connection
│   │       │   └── queries/     # Per-domain query functions
│   │       ├── parse-dispatch.ts # Parse :::dispatch, :::memory blocks
│   │       ├── parse-tasks.ts    # Parse :::task blocks
│   │       ├── router.ts         # Message → advisor routing
│   │       ├── coaches.ts        # Advisor metadata
│   │       └── ...
│   ├── vercel.json              # Cron schedules
│   └── package.json
├── ea/
│   ├── INSTRUCTIONS.md          # Chief of Staff agent prompt
│   ├── SKILL.md                 # EA skill definition
│   ├── parse_tasks.py           # CLI: parse open.md to JSON
│   ├── stale_check.py           # CLI: report stale tasks
│   └── move_to_done.py          # CLI: archive completed tasks
├── founder/INSTRUCTIONS.md      # Advisor agent prompts
├── strategy/INSTRUCTIONS.md
├── funding/INSTRUCTIONS.md
├── finance/INSTRUCTIONS.md
├── legal/INSTRUCTIONS.md
├── growth/INSTRUCTIONS.md
├── technology/INSTRUCTIONS.md
├── qa-judge/INSTRUCTIONS.md
├── modes/                       # Mode templates (advise/coach/plan/assist/execute)
├── deploy.py                    # Deploy agents to Claude Managed Agents
└── docs/                        # Documentation (GitHub Pages)
```

## Testing

```bash
cd ai-native/app
npm test
```

## Documentation

- [Architecture Guide](docs/architecture.md)
- [Admin Console](docs/admin.md)
- [Deployment Guide](docs/deployment.md)
- [Knowledge Base Integration](docs/knowledge.md)
- [API Reference](docs/api.md)
- [Development Guide](docs/development.md)

## License

Private - jazzmind/ai-native
