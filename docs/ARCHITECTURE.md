# Build Spec — Multi-Tenant WhatsApp Business Platform

This file is the implementation contract. Give this whole repo to Copilot
(or Copilot Chat / Copilot Workspace) and work through it **layer by layer,
in order**. Don't ask it to "build the whole platform" in one prompt — it
will produce shallow, disconnected code. Each layer below has its own
prompt block you can paste directly.

The schema (`prisma/schema.prisma`) and business-type configs
(`config/business-types/*.json`) are already written and are the source of
truth. Don't let Copilot regenerate or "improve" them without checking
back — every layer depends on these matching exactly.

---

## 0. Stack assumptions

- **Runtime:** Node.js + TypeScript
- **Framework:** Express (swap for NestJS later if you want structure — not required to start)
- **DB:** PostgreSQL + Prisma (schema already provided)
- **Queue:** BullMQ + Redis (for async knowledge processing, reminders, reports)
- **WhatsApp:** Meta Cloud API (webhook + Graph API send)
- **Vector store:** pgvector extension on the same Postgres (simplest to start; swap for Pinecone/Weaviate later if scale demands it)

Run this first:

```bash
npm init -y
npm install express @prisma/client prisma zod bullmq ioredis dotenv
npm install -D typescript ts-node @types/express @types/node
npx prisma init
```

Then copy the provided `prisma/schema.prisma` over the generated one and run:

```bash
npx prisma migrate dev --name init
```

---

## 1. Layer 1 — WhatsApp Onboarding Engine

**Goal:** A webhook receiver that, on first message from an unrecognized phone number connected to a tenant's WhatsApp number, starts the `OnboardingSession` state machine and walks through `OnboardingStep` enum values in order.

**Copilot prompt to use:**
> Using the Prisma models `Tenant`, `WhatsAppAccount`, and `OnboardingSession` from `prisma/schema.prisma`, build an Express webhook route `POST /webhooks/whatsapp/:phoneNumberId` that:
> 1. Verifies the request against the Meta webhook signature.
> 2. Looks up the `WhatsAppAccount` by `phoneNumberId`.
> 3. Loads or creates an `OnboardingSession` for that tenant if `Tenant.status === 'ONBOARDING'`.
> 4. Routes the incoming message to a step handler based on `currentStep`, validates the answer, writes it into `OnboardingSession.answers` (a JSON blob keyed by step name), and advances `currentStep` to the next value in the `OnboardingStep` enum.
> 5. Sends the next question back via the WhatsApp Graph API send-message endpoint, using quick-reply buttons where the step has a fixed set of options (category, business model, working-hours format, etc).
> Keep one file per step handler under `src/onboarding/steps/`, each exporting `{ prompt, validate, quickReplies }`. Add a `STEP_ORDER` array and a `getNextStep(current)` helper rather than hardcoding transitions inline.

**Manual checklist (don't skip):**
- [ ] Idempotency: re-sending the same WhatsApp message ID twice must not double-advance the step (Meta retries webhooks).
- [ ] Resume support: if the owner goes silent and comes back days later, re-show the last question, don't restart.
- [ ] Step `OPERATIONS_MODEL` is special — its answer (`business_type`) determines which `config/business-types/<type>.json` file gets loaded for the next step. Wire this explicitly; don't let Copilot guess it.

---

## 2. Layer 2 — Dynamic Business Modeling Engine

**Goal:** Once `OPERATIONS_MODEL` is answered, load the matching file from `config/business-types/`, ask its `onboarding_questions` array dynamically, then write the final `Business.config` JSON by merging the static `config` block from the JSON file with anything the owner customized.

**Copilot prompt to use:**
> Build a `BusinessConfigResolver` service in `src/business-config/resolver.ts` that:
> 1. Takes a `businessType` string and loads `config/business-types/<businessType>.json`.
> 2. Returns its `onboarding_questions` array to drive the `DYNAMIC_BUSINESS_QUESTIONS` onboarding step — one question per WhatsApp message, in array order, using each question's `quick_replies` as WhatsApp interactive buttons when present.
> 3. After all dynamic questions are answered, calls `resolver.buildBusinessProfile(businessType, answers)` which returns the final config object to persist into `Business.config`, and a default `Business.businessType` value.
> 4. If `businessType` doesn't match any file in `config/business-types/`, fall back to a generic `custom` profile with no preset workflow templates, and flag the tenant for manual platform-team review (write an `AnalyticsEvent` with `eventType: "custom_business_needs_review"`).
> Write this as pure functions with no DB calls inside the resolver itself — DB writes happen in the onboarding step handler that calls it.

**Why this matters:** every other layer (workflows, agents, services prompt) reads `Business.config` and `Business.businessType` — get this layer right and the rest mostly falls out of it.

---

## 3. Layer 3 — Team & Department Management

**Copilot prompt to use:**
> Build onboarding step handlers for `TEAM_SIZE_SELECTION`, `DEPARTMENTS_SETUP`, and `STAFF_SETUP` using the `Department` and `Staff` Prisma models. Behavior:
> - If the owner selects "Owner only" at `TEAM_SIZE_SELECTION`, skip both `DEPARTMENTS_SETUP` and `STAFF_SETUP` entirely (create the owner as a single `Staff` row with `role: "Owner"`, no department).
> - If "Medium" or "Enterprise," walk `DEPARTMENTS_SETUP` by accepting a comma-separated list of department names in one message, creating one `Department` row per name, then loop `STAFF_SETUP` asking for one staff member at a time (name, role, phone, email, department — use a quick-reply list of the departments just created) until the owner sends "done".
> - Respect `Business.config.multi_department` from Layer 2 — if false, force "Owner only" behavior regardless of team size answer.

---

## 4. Layer 4 — Service & Product Builder

**Copilot prompt to use:**
> Build the `SERVICES_SETUP` onboarding step using the `Service` Prisma model. Use `config/business-types/<type>.json`'s `default_services_prompt` field as the prompt text shown to the owner (already written per business type — don't regenerate it). Accept services one per message until "done", parsing `name`, optional `price`, optional `duration`. After basic capture, if `Business.config.staff_assignment === true`, run a follow-up micro-loop asking which staff member(s) handle each service (link via the `StaffServices` relation). Skip the staff-assignment loop entirely if `staff_assignment` is false (e.g. restaurant menu items).

---

## 5. Layer 5 — AI Knowledge Collection

**Goal:** Collect raw knowledge (text answers, uploaded files, URLs) into `KnowledgeItem` rows, then process them asynchronously into vector chunks for retrieval.

**Copilot prompt to use:**
> Part A — Collection: Build the `KNOWLEDGE_COLLECTION` onboarding step accepting: free-text answers for About Us / Mission / Policies / FAQ (write each as a separate `KnowledgeItem` with the matching `KnowledgeType`), WhatsApp media uploads (PDF/DOCX — download via Graph API media endpoint, store in S3/equivalent, save the storage URL as `KnowledgeItem.sourceUrl`), and pasted URLs (`WEBSITE_URL` / `GOOGLE_DOC` types). Every created item gets `status: PENDING`.
>
> Part B — Processing: Build a BullMQ worker `knowledge-processor` that picks up `PENDING` items, sets `status: PROCESSING`, extracts text (PDF via `pdf-parse`, DOCX via `mammoth`, URLs via fetch + readability extraction), chunks it (~500 tokens, 50 token overlap), embeds chunks with an embedding model, stores vectors in a `VectorChunk` table (`id, knowledgeItemId, content, embedding vector(1536), tenantId`) using pgvector, then sets `status: INDEXED` (or `FAILED` with an error log on exception).
>
> Add the `VectorChunk` model to `prisma/schema.prisma` yourself in this step — it was intentionally left out of the base schema since its shape depends on your embedding model's dimension size.

**Critical:** every vector query at retrieval time MUST filter `WHERE tenantId = $current_tenant` before the similarity search, not after. This is the most common multi-tenant data leak in RAG systems — flag it explicitly to Copilot.

---

## 6. Layer 6 — Workflow Generator

**Copilot prompt to use:**
> Build a `WorkflowGenerator` service that runs once at the end of onboarding (`REVIEW_AND_CONFIRM` → `COMPLETE` transition). For each entry in `config/business-types/<type>.json`'s `workflow_templates` array, create one `Workflow` row with `type` set from the template and `definition` set to the `steps` array, scoped to the tenant. Don't let the owner manually build workflows in v1 — the templates are the workflow; customization comes later as an "edit workflow steps" feature, not part of onboarding.

---

## 7. Layer 7 — AI Agent Orchestration

**Goal:** Route each inbound WhatsApp message (post-onboarding, i.e. `Tenant.status === 'ACTIVE'`) to the right `AgentType`, using `Business.config` + knowledge retrieval + conversation history.

**Copilot prompt to use:**
> Build `src/agents/orchestrator.ts`. On each inbound message for an active tenant:
> 1. Load or create a `Conversation` by `(tenantId, customerPhone)`.
> 2. Run intent classification (a single LLM call: "given this message and the business's `default_agents` list from its config, which agent should handle this?") to decide `AgentType`.
> 3. Dispatch to the matching agent handler under `src/agents/handlers/{reception,sales,support,booking,escalation}.ts`. Each handler receives `(conversation, message, business, knowledgeRetriever)` and returns the reply text + optional state changes (e.g. booking handler creates a `Booking` row).
> 4. The `support` handler MUST query `VectorChunk` (filtered by tenantId) before answering — never let it answer from general LLM knowledge alone for business-specific questions (pricing, policies, hours).
> 5. Persist every inbound and outbound message as a `Message` row tied to the `Conversation`.
> Only wire the agents listed in that tenant's `Business.config` resolved `default_agents` — a restaurant tenant should never route to a `SALES` agent that doesn't exist for it.

---

## 8. Layer 8 — Human Handoff System

**Copilot prompt to use:**
> Build the escalation handler (`src/agents/handlers/escalation.ts`) so that when triggered (either by explicit customer request like "talk to a human," or by the support handler failing to find a confident knowledge match twice in a row):
> 1. Set `Conversation.status = 'PENDING_HUMAN'`.
> 2. Generate an `aiSummary` via one LLM call over the conversation's last ~10 messages, written as 1-2 plain sentences (use the example in the source doc as the target style: "Customer interested in X consultation. Asked about pricing and available dates.").
> 3. Pick a target `Staff` member: if the conversation already has an `assignedStaffId`, notify them directly; otherwise pick by `Department` matching the agent type (SALES → Sales dept, etc.), preferring staff marked available in their `availability` JSON for the current time.
> 4. Send the summary + a link to the conversation to that staff member's WhatsApp number (or your internal agent dashboard, if you build one later) as a separate outbound message — don't put it in the customer-facing thread.
> Add a simple `POST /api/conversations/:id/takeover` and `POST /api/conversations/:id/resolve` endpoint pair so a human agent can flip `status` to `HUMAN_HANDLING` and back to `RESOLVED`. These will be called from a future agent dashboard UI — not part of this build.

---

## 9. Layer 9 — Multi-Tenant Isolation (do this alongside every other layer, not after)

**Copilot prompt to use:**
> Add a Prisma client middleware (`prisma.$use(...)`) in `src/lib/prisma.ts` that, for every query against a model with a `tenantId` field, throws if the query args don't include a `tenantId` filter (for `findMany`/`findFirst`/`updateMany`/`deleteMany`) or a `tenantId` in the data (for `create`). This is a guardrail against accidental cross-tenant leaks, not a replacement for explicitly scoping queries — every service function should still take `tenantId` as an explicit first argument, never read it from a global/ambient context.

**Non-negotiable rule to give Copilot verbatim:** *"Never write a database query in this codebase that can return rows from more than one tenant. If a function needs data across all tenants (e.g. a platform admin report), name it explicitly with an `Admin` prefix and gate it behind a separate auth check — never let it share a code path with tenant-scoped functions."*

---

## 10. Layer 10 — Enterprise Analytics

**Copilot prompt to use:**
> Build:
> 1. An `AnalyticsEvent` emitter helper (`trackEvent(tenantId, eventType, payload)`) called at key points already built in earlier layers: conversation started, lead qualified, booking created, human takeover, conversation resolved.
> 2. A scheduled BullMQ job (weekly, cron) `weekly-report-generator` that, per active tenant, aggregates the past 7 days of `AnalyticsEvent` + `Booking` + `Conversation` rows into the metrics shape `{ conversations, leadsGenerated, bookingsCreated, conversionRate, humanTakeovers, csat, revenue }`, writes a `WeeklyReport` row, generates a short written narrative via one LLM call over those metrics, and sends it to the business owner's WhatsApp number as a formatted message.
> CSAT requires a post-resolution rating prompt — add a `RESOLVED` conversation-status hook that sends a 1-5 quick-reply rating request to the customer 1x per conversation, store the answer in `AnalyticsEvent` with `eventType: "csat_rating"`.

---

## Build order recap

Do these in order — each genuinely depends on the previous:

1. Prisma schema + migration (already done — just run it)
2. Layer 1 (onboarding skeleton, no dynamic branching yet)
3. Layer 2 (plug in dynamic config — now onboarding is feature-complete for "ask questions")
4. Layer 3 → 4 (team, then services — services optionally reference staff from layer 3)
5. Layer 5 (knowledge — can be built in parallel with 3/4, no dependency)
6. Layer 6 (workflow generation — trivial once 2 is solid, it's just reading the config)
7. Layer 9 middleware — wire this in *before* layer 7, not after, so every new query from here on is forced through it
8. Layer 7 → 8 (agent orchestration + handoff — the "live" runtime, depends on everything above existing)
9. Layer 10 (analytics — purely additive, do last)

## What's deliberately NOT specified here (decide before you scale)

- Auth/RBAC for the future owner-facing dashboard (this spec only covers the WhatsApp-side runtime)
- Billing/subscription logic for the platform itself
- Which embedding model and LLM provider you're standardizing on
- Whether `VectorChunk` stays in Postgres/pgvector or moves to a dedicated vector DB once you have real tenant volume
