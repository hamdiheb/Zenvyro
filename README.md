# Zenvyro

**Zenvyro is an AI customer support platform with business rule enforcement.**

A business embeds the Zenvyro chat widget on its website or app. Customers chat with the business, and every reply, whether written by AI or by a human agent, passes through a compliance layer before it is sent. That layer checks the reply against the company's rules, tone, and grammar, and rewrites it when needed. The rewrite keeps the original intent.

Website: **zenvyro.io** (domain planned, not yet registered)

---

## Table of contents

- [Why Zenvyro](#why-zenvyro)
- [How it works](#how-it-works)
- [Key feature: AI message verification](#key-feature-ai-message-verification)
- [System design](#system-design)
- [Data model](#data-model)
- [Security design](#security-design)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [What works today](#what-works-today)
- [Project status](#project-status)
- [Documentation](#documentation)

---

## Why Zenvyro

Most AI chat tools answer customers without checking what they promise. Most grammar tools only fix spelling. Zenvyro checks **what a reply promises**.

A reply such as *"we will definitely refund you tomorrow"* can create legal and financial risk for a business, even when it is written politely and spelled correctly. Zenvyro flags that promise, explains which rule it breaks, and suggests a compliant version that still answers the customer's question.

---

## How it works

Zenvyro runs in two operating modes per conversation.

### Mode 1: AI Autopilot

The AI handles the conversation on its own.

1. The customer sends a message.
2. The AI classifies the customer's intent.
3. The AI retrieves relevant articles from the business's knowledge base.
4. The AI checks the company's business rules.
5. The AI generates a reply.
6. The reply passes the rule enforcement layer and is sent.

If the AI is not confident it can resolve the issue, it **escalates the conversation to a human agent**.

### Mode 2: Human Agent Copilot

A human agent writes the reply, and the AI acts as a communication and compliance assistant.

1. The customer sends a message.
2. The agent writes a draft reply.
3. Zenvyro intercepts the draft before it is sent.
4. The AI checks grammar, spelling, tone, and business rules.
5. The AI produces a corrected version and lists the issues it found.
6. The agent **approves, edits, or rejects** the suggestion.
7. Only the approved message is sent to the customer.

Every outgoing message, from AI or human, goes through the same enforcement layer.

---

## Key feature: AI message verification

**Business rules (example):**

- Never promise refunds without checking eligibility.
- Never guarantee delivery dates.
- Always keep a professional and friendly tone.
- Never disclose internal company information.
- Follow the official refund and cancellation policies.

**Agent's original draft:**

> "Don't worry, we will definitely refund you tomorrow. Sorry for the inconvenience, your package should arrive soon."

**Verification result:**

| Check | Result |
|---|---|
| Grammar and spelling | Passed |
| Business policy compliance | Failed (promises a refund and a delivery time) |
| Brand tone | Needs improvement |

**AI-suggested version:**

> "We sincerely apologize for the inconvenience. We would be happy to review your refund request and check its eligibility. Regarding your package, we'll provide you with the latest available delivery information."

The agent reviews this suggestion and can approve it, edit it, or reject it. The rewrite keeps the agent's intention and removes only the risky promises.

---

## System design

### High-level architecture

```
  Customer widget ──── WebSocket / REST ───┐
                                           ▼
  Agent interface ──── WebSocket / REST ──► Express API ──────────► PostgreSQL
                                           │
  Business dashboard ─────── REST ───────► │
                                           ├─► Conversation router (mode: ai | human)
                                           ├─► AI pipeline (OpenRouter)
                                           │     intent → retrieve knowledge → rules check
                                           │     → generate reply → confidence gate
                                           ├─► Verification service
                                           │     draft → grammar / policy / tone verdicts
                                           │     + suggested rewrite
                                           └─► DummyJSON client (orders, products, customers)
```

### Components

| Component | Responsibility |
|---|---|
| **Customer widget** | Embeddable chat launcher and thread that customers use on the business's site. |
| **Agent interface** | Three-pane inbox: filters (Mine, Unassigned, All), conversation thread, and reply box with verification suggestions. |
| **Business dashboard** | KPIs, conversation volume, AI activity, ticket categories, and rule and knowledge management. |
| **Express API** | REST endpoints for authentication, conversations, messages, rules, and knowledge articles. |
| **Realtime gateway** | One room per conversation, so messages reach the widget and agent interface immediately, and one room per business for inbox-wide `conversation:created` and `conversation:updated` events. |
| **Conversation router** | Decides whether a conversation is handled by AI or by a human, and handles escalation. |
| **AI pipeline** | Intent classification, knowledge retrieval, rules check, reply generation, and a confidence gate. |
| **Verification service** | Checks an agent's draft and returns strict JSON verdicts plus a suggested rewrite. |
| **Geo-origin service** | Detects the customer's country from the IP address, with graceful fallback when lookup fails. |
| **PostgreSQL** | System of record. Raw SQL only, with no ORM. |

### Core AI services

| Service | Input | Output |
|---|---|---|
| Customer intent classifier | Customer message and history | `{ intent, entities, confidence }` |
| Knowledge article searcher | Query | Top matching articles (PostgreSQL full-text search with `pg_trgm`) |
| Business rule checker | Message or draft, plus company rules | Per-rule `{ ruleId, status, reason }` |
| Customer reply generator | Context, knowledge, rules, brand tone | Reply and confidence |
| Agent draft verifier | Agent draft | `{ grammar, policy, tone, issues[], suggestion }` |
| Escalation decider | Confidence, intent, sentiment, rule hits | `answer` or `escalate` |

**Reliability approach for free OpenRouter models:**

- Force JSON-schema outputs and validate them in code.
- Use a fallback model chain with retry and backoff for rate limits.
- Keep prompts in versioned files.
- Provide a deterministic mock AI provider so tests never call the network.

### Request flow: agent sends a draft

1. The agent submits a draft through the API.
2. The verification service runs the grammar, policy, and tone checks against the business's rules and brand tone.
3. The response returns the verdicts, the issues, and the suggested rewrite. The draft is not sent yet.
4. The agent chooses approve, edit, or reject. The decision is stored in `message_verifications`.
5. The approved text is saved as a message and broadcast to the conversation room.

### Request flow: AI autopilot reply

1. A customer message is saved and broadcast.
2. The intent classifier and knowledge search run.
3. The rules checker and reply generator run.
4. The escalation decider checks confidence. If it is low, the conversation moves to `escalated` and goes to the agent queue.
5. Otherwise the reply is checked by the enforcement layer, saved, and sent.

Every AI call is recorded in `ai_events` with its type, confidence, latency, and model name, so AI behaviour can be audited.

### Multi-tenancy

Zenvyro is multi-tenant. Each business has its own users, customers, conversations, rules, and knowledge articles. Every table that holds business data has a `business_id`, and every query is scoped to the signed-in user's business. A business is identified on the public widget by a `widget_key`, which is separate from user credentials.

---

## Data model

The full schema is in [backend/db/schema.sql](backend/db/schema.sql). Main tables:

| Table | Purpose |
|---|---|
| `businesses` | Tenant record: name, slug, widget key, brand tone, settings. |
| `users` | Staff accounts with role `owner`, `admin`, or `agent`. |
| `sessions` | Login sessions. Stores only the SHA-256 hash of the session token. |
| `customers` | End customers of a business, optionally linked to an external ID. |
| `conversations` | Chat threads: mode (`ai`, `human`), status, assignee, team, category, sentiment, CSAT, and customer origin. |
| `messages` | Messages with sender type `customer`, `ai`, `agent`, or `system`. Keeps `original_body` before any rewrite. |
| `message_verifications` | Verification results for an agent draft and the agent's final decision. |
| `business_rules` | Rules the enforcement layer checks against. |
| `knowledge_articles` | Knowledge base with a generated full-text search vector. |
| `ai_events` | Audit trail of AI calls. |
| `teams`, `labels`, `conversation_labels` | Inbox organisation for the agent interface. |
| `canned_responses` | Shortcut replies, triggered with `/` in the composer. |
| `internal_notes` | Private notes that customers never see. |

**Indexes:** `messages(conversation_id, created_at)`, `conversations(business_id, status)`, and a GIN index on `knowledge_articles.search_vector`.

---

## Security design

- **No JWT.** Sessions are random opaque tokens.
- The session token is stored in an **HttpOnly, SameSite=Lax cookie** for 3 days. It is marked `Secure` in production.
- The database stores only the **SHA-256 hash** of the token. A database leak does not expose working sessions.
- Expired or deleted sessions are rejected, and the cookie is cleared.
- Sign-in returns the same error for an unknown email and a wrong password, so attackers cannot tell which emails are registered.
- Passwords are hashed with bcrypt.
- All SQL is parameterised.
- Error responses never include SQL or stack details.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 and Vite, React Router, CSS modules with design tokens, `socket.io-client`, `lucide-react` icons |
| Backend | Node.js and Express 5 |
| Realtime | Socket.IO |
| Database | PostgreSQL 16, accessed with `pg` using raw SQL |
| Local infrastructure | Docker Compose |
| Testing | Jest and Supertest against a real PostgreSQL test database |
| API testing | Postman |
| External data | DummyJSON (mock e-commerce data) and REST Countries |
| AI | OpenRouter (free models) |

---

## Repository layout

```
saas/
├── backend/                 Express API, SQL schema, tests
│   ├── src/
│   │   ├── config/          Environment loading and configuration
│   │   ├── routes/          HTTP routes
│   │   ├── controllers/     Request and response handling
│   │   ├── services/        Business rules
│   │   ├── repositories/    Parameterised SQL, one module per table
│   │   ├── middleware/      Validation, session check, error handling
│   │   ├── realtime/        Socket.IO gateway, rooms and event publisher
│   │   ├── db/              Connection pool
│   │   └── utils/           Shared helpers
│   ├── db/                  schema.sql, seed.sql, migrations/
│   ├── tests/               Jest and Supertest suites
│   └── Dockerfile
├── frontend/                React + Vite app for every screen
│   ├── src/
│   │   ├── agent/           Agent inbox pages
│   │   ├── auth/            Sign-in and sign-up pages
│   │   ├── dashboard/       Dashboard (placeholder)
│   │   ├── widget/          Customer chat widget page (runs inside the embed iframe)
│   │   ├── demoStore/       Acme Shoes demo storefront that embeds the widget
│   │   ├── components/      ui, layout, sections, inbox and widget components
│   │   ├── api/             fetch client, one module per backend domain
│   │   ├── hooks/           Session, conversations, messages, labels, realtime, widget chat
│   │   └── styles/          Design tokens and global styles
│   ├── public/              zenvyro-widget.js embed loader
│   └── Design.md            Design plan
├── docker/postgres/init/    Creates the test database on first start
├── docker-compose.yml       PostgreSQL and backend services
├── .env.example             Documented environment variables
├── Plan.md                  Original product brief
└── ROADMAP.md               Feature plan, schedule, and architecture decisions
```

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- Docker and Docker Compose

### 1. Configure the environment

```bash
cp .env.example .env
```

Open `.env` and set real values. Never commit `.env`.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
docker compose ps    # wait until the status is "healthy"
```

Port 5432 must be free on your machine. Stop any local PostgreSQL first.

### 3. Create the development schema and seed data

The migration runner (`npm run db:migrate` / `npm run db:seed`) is not written yet, so load the SQL files by hand. Run this once on a fresh database, from `saas/`:

```bash
docker compose exec -T postgres psql -U saad -d saad < backend/db/schema.sql
docker compose exec -T postgres psql -U saad -d saad < backend/db/seed.sql
```

Use the `POSTGRES_USER` and `POSTGRES_DB` values from your `.env` if you changed them. `schema.sql` is not idempotent; `seed.sql` is. The seed creates the **Acme Shoes** demo business with the widget key `wk_ace5ace5ace5ace5ace5ace5ace5ace5`.

### 4. Run the backend tests

```bash
cd backend
npm install
npm test
```

The tests run against the `saad_test` database and apply `backend/db/schema.sql` if the tables are missing.

### 5. Start the API

```bash
cd backend
npm run dev
```

The API and the Socket.IO server listen on `http://localhost:4000`. `CORS_ALLOWED_ORIGINS` in `.env` must include `http://localhost:5173` for the frontend. See the [backend README](backend/README.md) for the full endpoint and event reference.

### 6. Start the frontend

```bash
cd frontend
cp .env.example .env      # already holds the seeded Acme Shoes widget key
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/socket.io` to the backend, so the session cookie works in development. See the [frontend README](frontend/README.md) for routes, env vars and components.

### 7. Try the full flow

1. Sign up at `/sign-up`. This creates a new business and its owner, and opens the agent inbox.
2. Open `/demo-store` in another browser (or a private window) and send a message from the chat widget.
3. To see the widget's conversation in the inbox, sign in as staff of the business that owns the widget key. The demo store uses the Acme Shoes key, so either seed a staff user for Acme Shoes or set `VITE_DEMO_WIDGET_KEY` to the `widget_key` of the business you signed up with (`SELECT widget_key FROM businesses;`).
4. Reply from the inbox. The reply appears in the widget in real time.

> The full `docker compose up` (backend and database together) is not usable yet. Its backend command calls `src/db/databaseCommands.js`, the migration runner that is planned for the next step in the roadmap.

---

## What works today

Human-to-human chat works end to end: a visitor writes from the embedded widget and a staff member answers from the agent inbox, in real time. AI features are not built yet.

### Agent inbox (`/agent`)

- Sign-up creates a business and its owner. Sign-in, sign-out and session restore use the HttpOnly session cookie. The business name from `GET /me` appears in the app shell.
- Three-pane layout: conversation list, thread, and details.
- List views **Mine**, **Unassigned** and **All**, a status filter, and cursor pagination. The view and filter stay in the URL.
- Each row shows the customer, status, labels, the time of the newest message, and a **last-message preview** with an icon for team or AI replies.
- Thread with message bubbles, day separators, older-page loading, and a reply composer. New messages arrive live through `message:created`.
- Actions card: assign to me or unassign, change status, and add or create labels.
- **Customer origin** card: country, flag, region, languages, and currencies (code and symbol) detected from the visitor's IP.

### Customer widget

- One-line embed: [frontend/public/zenvyro-widget.js](frontend/public/zenvyro-widget.js) adds an isolated iframe with a launcher button and a chat window (full screen on phones).
- Anonymous visitor session from the public widget key. The 30-day token is kept in `localStorage`, so a reload resumes the same conversation.
- The header shows the **business name returned by the widget session**. The embed's `data-business-name` is only a fallback.
- Replies arrive live over a visitor socket. A dot on the launcher marks unread replies while the window is closed.
- `/demo-store` is a fictional Acme Shoes storefront that embeds the widget, for demos and manual testing.

### Backend

- REST API for authentication, conversations, messages, assignment, labels, staff users, and the widget.
- Socket.IO gateway with a room per conversation and a room per business. Staff sockets authenticate with the session cookie, visitor sockets with the widget token. A socket that carries a widget token is always treated as a visitor, even when the browser also has a staff cookie.
- Visitor geo-origin from the IP address (ipwho.is), enriched with REST Countries, with graceful fallback.
- Jest and Supertest suites against a real PostgreSQL test database.

### Backend features the frontend does not use yet

- **`GET /api/users`** (staff of the business). The inbox still offers only "Assign to me" and "Unassign"; an agent picker can use this.
- **Per-business realtime events** `conversation:created` and `conversation:updated`. The inbox list still refetches every 20 seconds and on each `message:created`; it could update rows from these events instead.

---

## Project status

The MVP is planned for three weeks. The schedule and feature list are in [ROADMAP.md](ROADMAP.md).

| Area | Status |
|---|---|
| Backend project setup (Express, Jest, ESLint) | Done |
| PostgreSQL with Docker Compose, connection pool, full schema, demo seed | Done (migration runner pending) |
| Authentication: sign-up, sign-in, me, sign-out | Done, with tests |
| Conversations and messages API | Done, with tests |
| Assignment, labels and staff list API | Done, with tests |
| Realtime chat (Socket.IO, conversation and business rooms) | Done, with tests |
| Visitor geo-origin detection | Done, with tests |
| Embeddable customer widget (API, loader, chat UI) | Done |
| Agent inbox UI (list, thread, actions, origin card) | Done |
| Sign-in and sign-up UI, app shell | Done |
| Demo storefront | Done |
| Agent picker and live inbox list from business-room events | Backend done, UI pending |
| Business dashboard | Placeholder page |
| Business rules and knowledge base | Planned |
| AI autopilot and verification layer | Planned |
| Canned responses, internal notes, order history card | Planned |

---

## Documentation

- [System design diagrams: flow, API and database](docs/system-design.md)
- [Animated request flows: who starts each request and where it ends](docs/system-design-flows.html) (open in a browser)
- [Product brief](Plan.md)
- [Roadmap, data model, and architecture decisions](ROADMAP.md)
- [Backend guide: setup, endpoints, realtime events, widget API, and session design](backend/README.md)
- [Frontend guide: setup, routes, widget embedding, design tokens, and components](frontend/README.md)
- [Frontend design plan](frontend/Design.md)
- [Environment variables](.env.example) and [frontend environment variables](frontend/.env.example)
