# AI Executive Team

An AI-native advisory team framework with seven specialized advisors, five operational modes, human/expert-in-the-loop controls, behavioral adaptation, and multi-agent orchestration. Advisors work independently or together, with intelligent routing that assembles the right team for each question and synthesizes their perspectives.

## Advisors

| Advisor | Domain | Key Topics |
|---------|--------|------------|
| **Founder** | Personal alignment | Goals, vision, focus, work-life balance |
| **Strategy** | Business strategy | Market positioning, KPIs/OKRs, competitive analysis |
| **Funding** | Capital strategy | VC, angel, bootstrapping, debt, cap tables |
| **Finance** | Financial operations | Accounting, tax, compliance, risk, FP&A |
| **Legal** | Legal strategy | Contracts, IP, corporate structure, employment law |
| **Growth** | Go-to-market | Sales, marketing, PLG, retention, pricing |
| **Technology** | Technical architecture | System design, AI/ML, DevOps, security |
| **QA Judge** | Quality control | Research credibility, GEO detection, source verification |

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

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    AI Executive Team App                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Chat UI │  │  Modes   │  │ Feedback │  │ Expert Review │  │
│  │ (Next.js)│  │ Selector │  │ Buttons  │  │ Dialog/View   │  │
│  └─────┬────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│        │             │             │                │          │
│  ┌─────┴─────────────┴─────────────┴────────────────┴────────┐ │
│  │                     API Routes                             │ │
│  │  /api/chat  /api/feedback  /api/behaviors  /api/reviews    │ │
│  │  /api/tools  /api/effectiveness  /api/knowledge            │ │
│  └─────┬──────────────────────────────────────────────────────┘ │
│        │                                                       │
│  ┌─────┴──────────┐  ┌──────────────────────────────────────┐  │
│  │  Router        │  │  Providers (Adapter Pattern)          │  │
│  │  Session Mgr   │  │  Knowledge: Standalone | Busibox      │  │
│  │  Mode Loader   │  │  Profile:   Standalone | Busibox      │  │
│  │  Behavior Inj. │  │  Activity:  Standalone | Busibox      │  │
│  └─────┬──────────┘  │  Deploy:    CMA | Busibox             │  │
│        │             └──────────────────────────────────────┘  │
│  ┌─────┴──────────────────────────────────────────────────┐    │
│  │              SQLite (coach-router.db)                   │    │
│  │  conversations | messages | projects | coach_sessions   │    │
│  │  message_feedback | agent_behaviors | behavior_revisions│    │
│  │  tool_trust | review_requests | expert_comments         │    │
│  │  user_profile | knowledge_fts | deploy_targets | config │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
         │                              │
    ┌────┴─────┐                  ┌─────┴──────┐
    │  Claude  │                  │  Busibox   │
    │ Managed  │                  │ (Agent API │
    │ Agents   │                  │  Search,   │
    │          │                  │  RAG)      │
    └──────────┘                  └────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+ (for `deploy.py`)
- An Anthropic API key

### Installation

```bash
cd coaches/app
npm install
```

### Configuration

Create a `.env` file in the `coaches/` directory:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Create `coaches/app/.env.local` for auth:

```env
AUTH_SECRET=<random-32-char-string>
AUTH_TRUST_HOST=true
AUTH_ADMIN_EMAILS=you@example.com
```

### Deploy Agents (Claude Managed Agents)

```bash
cd coaches
python deploy.py deploy
```

This creates all 8 agents (7 advisors + QA Judge) and an environment on Claude's managed infrastructure.

### Run the App

```bash
cd coaches/app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit you'll go through onboarding to configure your deployment target.

### Run as Desktop App (Electron)

```bash
cd coaches/app
npm run electron:dev
```

## Documentation

Full documentation is available at the [project documentation site](https://jazzmind.github.io/ai-native/).

- [Architecture Guide](docs/architecture.md)
- [Advisor Reference](docs/coaches.md)
- [Admin Console](docs/admin.md)
- [Deployment Guide](docs/deployment.md)
- [Knowledge Base Integration](docs/knowledge.md)
- [API Reference](docs/api.md)
- [Development Guide](docs/development.md)

## Project Structure

```
coaches/
├── app/                         # Next.js + Electron app
│   ├── electron/                # Electron main process + preload
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages + API routes
│   │   │   ├── admin/           # Admin console pages
│   │   │   ├── behaviors/       # Behavioral directives management
│   │   │   ├── effectiveness/   # Effectiveness dashboard
│   │   │   ├── reviews/         # Expert review tracking
│   │   │   ├── settings/tools/  # Tool trust configuration
│   │   │   ├── review/[token]/  # Guest expert review page
│   │   │   └── api/             # API endpoints
│   │   ├── components/          # React components
│   │   └── lib/                 # Core libraries
│   │       ├── deploy/          # Deployment adapters (CMA, Busibox)
│   │       ├── knowledge/       # Knowledge base providers
│   │       ├── profile/         # User profile providers
│   │       ├── activity/        # Agent activity providers
│   │       ├── modes.ts         # Mode types and metadata (client-safe)
│   │       ├── modes-server.ts  # Mode template loader (server-only)
│   │       ├── behavior-analysis.ts  # AI-driven behavioral revision
│   │       └── review-tokens.ts # Guest access token generation
│   ├── electron-builder.yml     # Electron packaging config
│   └── package.json
├── modes/                       # Agent mode templates
│   ├── advise.md
│   ├── coach.md
│   ├── plan.md
│   ├── assist.md
│   └── execute.md
├── founder/INSTRUCTIONS.md      # Advisor agent definitions
├── strategy/INSTRUCTIONS.md
├── funding/INSTRUCTIONS.md
├── finance/INSTRUCTIONS.md
├── legal/INSTRUCTIONS.md
├── growth/INSTRUCTIONS.md
├── technology/INSTRUCTIONS.md
├── qa-judge/INSTRUCTIONS.md
├── deploy.py                    # Python deployment script for CMA
└── docs/                        # Documentation (GitHub Pages)
```

## Testing

```bash
cd coaches/app
npm test
```

See the [Development Guide](docs/development.md) for details on running specific test suites.

## License

Private - jazzmind/ai-native
