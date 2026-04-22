# LabFlow MCP Studio

> Multi-tenant AI Agent orchestration platform for laboratory report script generation, powered by LLM and MCP (Model Context Protocol).

## What It Does

LabFlow MCP Studio automates the generation of LabsCare LIMS report scripts. It uses Large Language Models (LLMs) to analyze template images, placeholder descriptions, and expected result images, then produces the JavaScript scripts required by the LabsCare report engine — replacing tedious manual scripting with intelligent, rule-guided automation.

Key capabilities:

- **AI-powered script generation** — LLM agents analyze templates and data structures to produce report scripts following LabsCare engine conventions
- **Multi-tenant lab isolation** — Each lab operates in its own data space with independent projects, reports, and scripts
- **Document processing pipeline** — Upload Word/PDF documents; the system auto-converts to PDF, generates cover images, and stores them in MinIO
- **Script sandbox execution** — Test generated scripts in an `isolated-vm` sandbox with mock data before deploying
- **Streaming task execution** — BullMQ workers process tasks asynchronously with Redis Stream-based real-time progress updates
- **MCP integration** — Connect to MCP servers via Streamable HTTP for extensible tool orchestration

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js 15 App                  │
│  Dashboard · Projects · Tasks · Conversation    │
├─────────────────────────────────────────────────┤
│                   API Layer                      │
│  /api/labs · /api/tasks · /api/llm · /api/runner│
├──────────────┬──────────────┬───────────────────┤
│   LangChain  │   BullMQ     │   MCP Client      │
│  ReactAgent  │   Workers    │  (Streamable HTTP) │
├──────────────┴──────────────┴───────────────────┤
│  PostgreSQL (Prisma)  │  Redis  │  MinIO         │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 15 (App Router), React 19, TypeScript 5.6 |
| **Styling** | TailwindCSS 3 + shadcn/ui (Radix UI) |
| **State** | Zustand 5 |
| **Database** | PostgreSQL via Prisma ORM 5.22 |
| **Queue** | Redis (ioredis) + BullMQ 5 |
| **Storage** | MinIO (S3-compatible object storage) |
| **LLM** | LangChain + ChatOpenAI / ChatOpenRouter / ChatGoogleGenAI |
| **MCP** | @modelcontextprotocol/sdk 1.27 |
| **Sandbox** | isolated-vm (safe script execution) |
| **Documents** | LibreOffice (docx→PDF), sharp (image), pdf-to-img, mammoth |
| **Monitoring** | prom-client (Prometheus metrics) |
| **i18n** | i18next + react-i18next (English / Chinese) |
| **Logging** | Pino + pino-pretty |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- MinIO (or S3-compatible storage)
- LibreOffice (for Word→PDF conversion)

### 1. Clone and Install

```bash
git clone <repo-url>
cd labscare-report-mcp-client
npm install
```

### 2. Configure Environment

Copy `.env` and fill in your values:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/labscare-report-mcp-client"

# Redis
REDIS_URL="redis://localhost:6379"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_ACCESS_KEY="admin"
MINIO_SECRET_KEY="password123"

# LLM (choose one provider)
FLOW_API_KEY="your-api-key"
FLOW_API_BASE_URL="https://openrouter.ai/api/v1"
LLM_MODEL_NAME="Pro/moonshotai/Kimi-K2.5"

# MCP Server (optional)
MCP_SERVER_URL="http://localhost:8000"

# LibreOffice
SOFFICE_PATH="C:/Program Files/LibreOffice/program/soffice.exe"
```

### 3. Initialize Database

```bash
npm run db:init    # Run Prisma migrations
npm run db:gen     # Generate Prisma client
```

### 4. Start Services

Start the required infrastructure with Docker Compose:

```bash
docker compose -f redis.yaml up -d
docker compose -f minio.yaml up -d
```

### 5. Run the Application

```bash
# Start Next.js dev server
npm run dev

# Start BullMQ worker (in a separate terminal)
npm run worker:dev
```

The app will be available at `http://localhost:3000`.

> [!NOTE]
> Set `USE_MOCK_LLM=true` in `.env` to use simulated LLM responses for development without consuming API credits.

## Project Structure

```
├── app/                        # Next.js App Router
│   ├── dashboard/              # Overview & statistics
│   ├── projects/               # Project management
│   ├── tasks/                  # Task creation & monitoring
│   ├── conversation/           # AI chat interface (SSE streaming)
│   ├── scripts/                # Script viewer & editor
│   ├── documents/              # Document upload & management
│   ├── knowledge/              # Knowledge base configuration
│   └── api/                    # Backend API routes
│       ├── labs/               # Lab CRUD + nested resources
│       ├── tasks/              # Task management & streaming
│       ├── llm/                # LLM conversation (SSE)
│       ├── runner/             # Script sandbox execution
│       └── sse/                # Upload progress SSE
├── components/                 # React components
│   ├── ui/                     # shadcn/ui primitives
│   ├── layout/                 # Header, sidebar, lab switcher
│   ├── conversation/           # Chat UI, virtualized messages
│   └── workspace/              # Document viewer, script generator
├── lib/                        # Core libraries
│   ├── llm/                    # Agent factory, ReactAgent, skill loader, API tools
│   ├── mcp/                    # MCP client (Streamable HTTP)
│   ├── redis/                  # BullMQ workers (document + task processing)
│   ├── minio/                  # MinIO client (upload, download, JSON parsing)
│   ├── queue/                  # Redis Stream publisher
│   ├── docx/                   # Word→PDF conversion + cover generation
│   ├── config/                 # Zod-validated environment config
│   ├── monitoring/             # Prometheus metrics
│   └── i18n/                   # Internationalization setup
├── skills/                     # AI skill definitions
│   └── labscare-script/        # LabsCare report script skill
│       ├── SKILL.md            # Core rules & workflow
│       ├── references/         # API reference, patterns, examples
│       └── scripts/            # Test & auto-fix utilities
├── prisma/                     # Database schema & seed
├── store/                      # Zustand state stores
├── types/                      # TypeScript type definitions
└── public/                     # Static assets & i18n locales
```

## Key Features

### AI Conversation Interface

The `/conversation` page provides a full-featured chat UI with:

- SSE streaming responses with thought/reasoning display
- File attachment support (images, JSON, Markdown)
- Tool call visualization (see which tools the agent invokes)
- Conversation history management
- Model switching

### Task Pipeline

1. **Create a task** — Select a lab, project, and report template
2. **Upload documents** — Template images, placeholder docs, JSON data
3. **Agent processes** — LLM analyzes inputs and generates scripts
4. **Real-time progress** — Redis Stream pushes updates to the UI
5. **Review & test** — Execute scripts in the sandbox, auto-fix errors

### Script Sandbox

The `/api/runner` endpoint executes scripts in an `isolated-vm` sandbox with:

- `load('/tools.js')` — LabsCare helper functions
- `helper.getProjectData()` / `helper.getProjectSamples()` — Data access
- `getJsonFromMinio()` — Fetch JSON data sources
- 128MB memory limit, 2-second timeout

### Monitoring

Prometheus metrics are exposed for:

- Task counts, durations, and active counts
- LLM call latency, TTFT, and token usage
- API request rates and latencies
- SSE connection counts
- Queue sizes and error rates

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server with Pino pretty logging |
| `npm run build` | Production build |
| `npm run start` | Start production server on port 8081 |
| `npm run worker:dev` | Start BullMQ worker with hot reload |
| `npm run db:init` | Run Prisma migrations |
| `npm run db:gen` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |

## AI Skill System

The `skills/labscare-script/` directory contains a self-contained knowledge skill that the LLM agent loads at runtime. It defines:

- **Decision priority** — Template placeholders > expected results > user instructions > historical patterns
- **Workflow** — Collect materials → identify placeholders → determine structure family → generate script → test & auto-fix
- **Non-negotiable rules** — Output keys match template placeholders exactly; field names are never "normalized"
- **Auto-fix loop** — Test scripts with mock data, measure accuracy, apply fixes up to 3 iterations

## License

Private — All rights reserved.
