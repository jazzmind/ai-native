# AI-Native Coach Platform

An AI-powered executive coaching team that provides specialized business guidance across seven domains, plus a QA Judge for quality control. Coaches can work independently or together, with multi-agent orchestration that routes questions to the right expert and synthesizes responses when topics span multiple domains.

## Coaches

| Coach | Domain | Key Topics |
|-------|--------|------------|
| **Founder** | Personal alignment | Goals, vision, focus, work-life balance |
| **Strategy** | Business strategy | Market positioning, KPIs/OKRs, competitive analysis |
| **Funding** | Capital strategy | VC, angel, bootstrapping, debt, cap tables |
| **Finance** | Financial operations | Accounting, tax, compliance, risk, FP&A |
| **Legal** | Legal strategy | Contracts, IP, corporate structure, employment law |
| **Growth** | Go-to-market | Sales, marketing, PLG, retention, pricing |
| **Technology** | Technical architecture | System design, AI/ML, DevOps, security |
| **QA Judge** | Quality control | Research credibility, GEO detection, source verification |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Coach Platform App                       │
│  ┌──────────┐                              ┌─────────────────┐  │
│  │  Chat UI │                              │ Admin Console   │  │
│  │ (Next.js)│                              │ (Setup Wizard)  │  │
│  └─────┬────┘                              └────────┬────────┘  │
│        │                                            │          │
│  ┌─────┴────────────────────────────────────────────┴─────────┐  │
│  │                    API Routes                              │  │
│  │  /api/chat  /api/admin  /api/knowledge                     │  │
│  └─────┬──────────────────────────────────────────────────────┘  │
│        │                                                      │
│  ┌─────┴─────────┐  ┌──────────────────────────────────────┐  │
│  │  Router       │  │  Deploy Adapters                      │  │
│  │  Session      │  │  CMA | Busibox                        │  │
│  │  Manager      │  │  Knowledge Providers                  │  │
│  └─────┬─────────┘  └──────────────────────────────────────┘  │
│        │                                                     │
│  ┌─────┴──────────────────────────────────────────────────┐  │
│  │              SQLite (coach-router.db)                   │  │
│  │  conversations | messages | coach_sessions              │  │
│  │  deploy_targets | config | mcp_connections              │  │
│  │  knowledge_fts (FTS5)                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
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

### Deploy Agents (Claude Managed Agents)

```bash
cd coaches
python deploy.py deploy
```

This creates all 8 agents (7 coaches + QA Judge) and an environment on Claude's managed infrastructure.

### Run the App

```bash
cd coaches/app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run as Desktop App (Electron)

```bash
cd coaches/app
npm run electron:dev
```

## Documentation

Full documentation is available at the [project documentation site](https://jazzmind.github.io/ai-native/).

- [Architecture Guide](docs/architecture.md)
- [Coach Agent Reference](docs/coaches.md)
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
│   │   │   └── api/             # API endpoints
│   │   ├── components/          # React components
│   │   └── lib/                 # Core libraries
│   │       ├── deploy/          # Deployment adapters (CMA, Busibox)
│   │       └── knowledge/       # Knowledge base providers
│   ├── electron-builder.yml     # Electron packaging config
│   └── package.json
├── founder/INSTRUCTIONS.md      # Coach agent definitions
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
