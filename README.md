# WhatsApp Business Platform — Starter Schema & Build Spec

This is not a finished app. It's the **foundation** for the platform
described in your architecture doc: a real database schema, real business
configuration contracts, and a precise build spec — so you (and Copilot)
build the actual platform on solid ground instead of improvising the data
model as you go, which is how these projects usually end up rebuilt twice.

## What's in here

```
whatsapp-platform/
├── prisma/
│   └── schema.prisma          ← full multi-tenant DB schema (Postgres + Prisma)
├── config/
│   └── business-types/
│       ├── clinic.json        ← dynamic onboarding questions + workflow templates
│       ├── agency.json
│       └── restaurant.json    ← add more files here for each business type you support
└── docs/
    └── ARCHITECTURE.md        ← layer-by-layer build spec with exact Copilot prompts
```

## How to use this with Copilot

1. Open this folder in VS Code.
2. Open `docs/ARCHITECTURE.md` and read it top to bottom once, fully, before writing anything — it tells you the build order and why.
3. Work through it **one layer at a time**. Each layer section has a ready-to-paste Copilot Chat prompt. Paste it, review what Copilot generates against the "manual checklist" notes under that layer, fix what's wrong, then move to the next layer.
4. Don't let Copilot touch `prisma/schema.prisma` or the `config/business-types/*.json` files casually — they're the contracts everything else reads from. If a layer genuinely needs a schema change (Layer 5 does — see the `VectorChunk` note), the spec says so explicitly.

## Setup

```bash
# 1. Install Postgres locally or use a hosted instance (Supabase/Neon/RDS all fine)
#    Enable the pgvector extension if you're following the Layer 5 default.

# 2. Init the project
npm init -y
npm install express @prisma/client prisma zod bullmq ioredis dotenv
npm install -D typescript ts-node @types/express @types/node

# 3. Set your DB connection
echo "DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_platform" > .env

# 4. Run the schema migration
npx prisma migrate dev --name init

# 5. Open Prisma Studio to sanity-check the tables exist
npx prisma studio
```

You'll also need, before Layer 1 is usable end-to-end:

- A **Meta Developer App** with WhatsApp Business product added, a test phone number, and a permanent access token (Meta's quickstart docs cover this — search "WhatsApp Cloud API getting started" if you haven't set one up).
- A webhook URL Meta can reach — use `ngrok` for local dev (`ngrok http 3000`), then register that URL + your `webhookVerifyToken` in the Meta App dashboard.
- Redis running locally (`docker run -p 6379:6379 redis`) for BullMQ once you reach Layer 5/10.

## Adding a new business type

Copy `config/business-types/restaurant.json`, rename it (e.g. `real-estate.json`), and edit:

- `config` block → which platform capabilities turn on (booking, payments, lead gen, etc.)
- `onboarding_questions` → the extra questions specific to this business type
- `default_services_prompt` → how the AI asks the owner to list their services/products
- `workflow_templates` → which automated workflows get generated for this business type
- `default_agents` → which AI agents this business type gets routed through

No code changes needed for a new business type *unless* its workflow needs a step type that doesn't exist yet in your workflow engine — that's the one case the spec calls out as a real engineering task, not just config.

## Why this approach instead of a generated app

The original doc describes a genuinely large platform — multi-tenant data
isolation, a conversational state machine, RAG knowledge retrieval, agent
orchestration, and async job processing all need to compose correctly with
each other and there's no shortcut to that. Code generated in one shot
against a spec this size reliably produces something that looks complete
and fails the moment two layers interact (e.g. a restaurant tenant getting
asked the clinic's "buffer time between appointments" question, because the
business-type branching wasn't actually wired through). Building from a
correct schema and a layer-ordered spec, checking each layer before moving
to the next, is slower per-layer but is the version that actually reaches
production.

## Deploy on Render

This repository includes a Render blueprint file: `render.yaml`.

### 1) Push this repo to GitHub
- Create a new GitHub repository and push this project.
- Render will deploy from that repository.

### 2) Create services from blueprint
- In Render dashboard, choose **New +** > **Blueprint** and select this repo.
- Render will create:
  - `whatsapp-platform-api` (Node web service)
  - `whatsapp-platform-db` (Postgres)
  - `whatsapp-platform-redis` (Redis)

### 3) Configure required secrets
In Render, set these env vars on the web service:
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`

`DATABASE_URL`, `REDIS_URL`, and `PORT` are wired automatically by `render.yaml`.

### 4) Database bootstrap on deploy
Build command runs:
- `prisma generate`
- `CREATE EXTENSION IF NOT EXISTS vector;`
- `prisma db push`
- `npm run build`

This ensures Postgres schema and pgvector are ready for the app.
