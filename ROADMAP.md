# Zenvyro – AI Customer Support Platform with Business Rule Enforcement
## Full Product & Engineering Roadmap

Derived from `Plan.md` and the three images in `Design inspiration/`.

---

## 1. Product Summary

A multi-tenant SaaS: a business embeds a chat widget; customers chat; replies are produced in one of two modes.

| Mode | Who writes | AI role |
|---|---|---|
| **Autopilot** | AI | Intent → KB retrieval → policy check → reply → escalate if not confident |
| **Copilot** | Human agent | Intercepts the draft → verifies (grammar, policy, tone) → suggests rewrite → agent approves / edits / rejects → send |

**Differentiator:** every outgoing message, AI or human, passes through the **Rule Enforcement Layer** (verification + rewrite that preserves the agent's intent).

### Three surfaces (from design inspiration)
1. **Business dashboard** (`1.jpeg`, "Relay"): sidebar nav, KPI cards, volume line chart, AI activity card, tickets by category, CSAT donut, recent conversations table.
2. **Customer live chat widget** (`2.jpeg`, Crisp-style): floating launcher button, header with business name and online dot, bubble thread, composer.
3. **Human agent interface** (`3.jpeg`, Chatwoot-style): 3-pane layout (inboxes/teams/labels, conversation list with Mine/Unassigned/All tabs, thread + reply box), assignment, labels, reports row.

---

## 2. Tech Stack and Constraints

- **Frontend:** React + Vite (one app, three route areas: `/dashboard`, `/agent`, `/widget`, plus a standalone embeddable widget bundle)
- **Backend:** Node.js + Express
- **DB:** PostgreSQL via `pg`, **raw SQL only** (no ORM), run with Docker Compose
- **Realtime:** WebSocket (`ws` or Socket.IO) for chat. This is not in Plan.md but is required for live chat (see open decisions).
- **External API:** DummyJSON, used as the mock e-commerce backend (see §6)
- **AI:** OpenRouter free models
- **Testing:** Jest + Supertest (backend), Postman collection (API)
- **Rules:** separate `frontend/` and `backend/` folders · one commit per feature (message generated, **committed and pushed manually by you**, see 5c) · SQL schema file · README documenting everything

### Target repo layout
```
Saad Product/
├── backend/
│   ├── src/{config,routes,controllers,services,middleware,db,ai,realtime,utils}
│   ├── db/{schema.sql,seed.sql,migrations/}
│   ├── tests/
│   ├── Dockerfile  └─ package.json
├── frontend/
│   ├── src/{dashboard,agent,widget,components,api,hooks,styles}
│   └── vite.config.js
├── docker-compose.yml        (postgres + backend)
├── postman/Zenvyro.postman_collection.json
├── README.md  (root overview)  + backend/README.md + frontend/README.md
├── .gitignore  └─ .env.example
├── Plan.md   └─ ROADMAP.md
```

---

## 3. Architecture

```
Widget (customer) ──WS/REST──┐
                             ▼
Agent UI ───────WS/REST──► Express API ──► PostgreSQL
Dashboard ──────REST─────►     │
                               ├─► Conversation Router (mode: autopilot | copilot)
                               ├─► AI Pipeline (OpenRouter)
                               │     intent → retrieve KB → rules check → generate → confidence gate
                               ├─► Verification Service (draft → verdicts + suggested rewrite)
                               └─► DummyJSON client (orders, products, customers)
```

### Core AI services (the heart of the product)
| Service | Input | Output |
|---|---|---|
| `customerIntentClassifier` (`classifyCustomerIntent`) | customer message + history | `{intent, entities, confidence}` |
| `knowledgeArticleSearcher` (`findRelevantKnowledgeArticles`) | query | top-k articles (Postgres full-text search + `pg_trgm`; no vector DB needed for MVP) |
| `businessRuleChecker` (`checkTextAgainstBusinessRules`) | message/draft + company rules | per-rule `{ruleId, status, reason}` |
| `customerReplyGenerator` (`generateCustomerReply`) | context + KB + rules + brand tone | reply + confidence |
| `agentDraftVerifier` (`verifyAgentDraft`) | agent draft | `{grammar, policy, tone, issues[], suggestion}` (strict JSON) |
| `escalationDecider` (`decideWhetherToEscalate`) | confidence, intent, sentiment, rule hits | `answer \| escalate` |

Reliability notes for free OpenRouter models: force **JSON-schema outputs** and validate them with plain checks in code. Keep a **fallback model chain** with retry and backoff for rate limits. Put all prompts in versioned files. Give every AI call a deterministic **mock provider** so Jest tests never hit the network.

---

## 4. Data Model (raw SQL, `db/schema.sql`)

| Table | Key columns |
|---|---|
| `businesses` | id, name, slug, widget_key, brand_tone, settings JSONB |
| `users` | id, business_id, name, email, password_hash, role (`owner\|admin\|agent`) |
| `customers` | id, business_id, external_id (DummyJSON user), name, email |
| `conversations` | id, business_id, customer_id, channel, mode (`ai\|human`), status (`open\|pending\|resolved\|escalated`), assigned_agent_id, team_id, category, sentiment, csat, timestamps |
| `messages` | id, conversation_id, sender_type (`customer\|ai\|agent\|system`), sender_id, body, original_body, created_at |
| `business_rules` | id, business_id, title, description, severity, enabled |
| `knowledge_articles` | id, business_id, title, body, tags, tsvector |
| `message_verifications` | id, message/draft ref, original, suggested, grammar_status, policy_status, tone_status, issues JSONB, agent_action (`approved\|edited\|rejected`), final_body |
| `ai_events` | id, conversation_id, type (intent, retrieval, escalation…), payload JSONB, confidence, latency_ms, model |
| `teams`, `labels`, `conversation_labels` | for the agent-UI sidebar |
| `canned_responses` | shortcuts (`/` in composer, seen in `3.jpeg`) |
| `internal_notes` | private notes tab |

Indexes: `messages(conversation_id, created_at)`, `conversations(business_id, status)`, GIN on `knowledge_articles.tsv`. Use `schema_migrations` plus plain `.sql` migration files.

---

## 5. Roadmap: 3-Week MVP (15 working days + 2 buffer days)

**Deadline: MVP complete in 3 weeks.** Each numbered item = **one feature = one commit** (Conventional Commits; I generate only the commit message, you stage, commit and push manually on the correct branch, see 5c). Each backend feature ships with its Jest tests and README section **in the same commit**. **Feature freeze at end of day 15**; days 16–17 are bug-fixing, polish and demo prep only.

Scope rule: if a task slips, cut from the **Deferred list** first, never from the two core modes or the verification layer.

### Week 1 – Foundation and human chat (no AI) · Days 1–5
1. `chore: scaffold backend and frontend (Express, React + Vite, eslint naming rules, jest config, .gitignore and .env.example)` — Day 1
2. `feat(db): docker-compose Postgres, connection pool, full schema.sql, migration and seed runner` — Day 1–2
3. `feat(auth): authentication route with sign-up (business + owner), sign-in, me and sign-out; opaque session token in a 3-day HttpOnly cookie, SHA-256 hashed session stored in the sessions table, role middleware, tenant scoping` — Day 2
   - Routes live under one `/api/authentication` route: `POST /sign-up`, `POST /sign-in`, `GET /me`, `POST /sign-out`. Each endpoint has its own validation or session middleware and its own controller.
   - Sign-up registers a business and its owner in one transaction. Admins and agents are added later from the business dashboard.
   - Every sign-up and sign-in creates a row in `sessions` and sets a random session token in an HttpOnly cookie with a 3-day expiry. No JWT is used.
   - The database stores only `token_hash`, the SHA-256 hash of the session token. The raw token never touches the database.
   - `me` and `sign-out` hash the cookie value and look up a session row whose hash matches and whose `expires_at` is in the future. Sign-out deletes that row and clears the cookie.
4. `feat(conversations): conversation and message REST API (create, list, paginate, filter)` — Day 3
5. `feat(realtime): Socket.IO gateway with a room per conversation` — Day 3
6. `feat(widget): embeddable customer chat widget with widget-key auth, per 2.jpeg` — Day 4
7. `feat(agent-inbox): 3-pane agent inbox (Mine / Unassigned / All), assignment and labels, per 3.jpeg` — Day 5
7b. `feat(geo): customer origin detection from IP (IP to country code lookup, enrich with REST Countries API: name, flag, region, languages, currencies; cache per conversation, store on conversation/customer record, graceful fallback if lookup fails)` — Day 5

End of week 1: a customer and a human agent can chat end-to-end, and the agent sees the customer's country.

### Week 2 – The differentiator and AI · Days 6–10
8. `feat(rules): business rules CRUD and knowledge article CRUD with full-text search` — Day 6
9. `feat(ai): OpenRouter client with model fallback chain, retries, JSON validation, mock provider` — Day 6
10. `feat(verify): agent draft verifier (grammar, policy, tone verdicts and intent-preserving rewrite) with verify-draft endpoint` — Day 7
11. `feat(agent-inbox): pre-send review panel (verdict badges, original vs suggested, approve / edit / reject) and server-side "no send without approval"` — Day 8
12. `test(verify): golden test using the refund and delivery example from Plan.md` — Day 8
13. `feat(autopilot): AI reply pipeline (intent, knowledge retrieval, rule check, generate, verify the AI reply before sending)` — Day 9
14. `feat(autopilot): confidence gate, escalation to human, handoff and mode switching` — Day 10

Acceptance test: the Plan.md example message must yield *Grammar: Passed, Policy: Failed, Tone: Needs improvement* and a rewrite that drops the refund and delivery promises.

### Week 3 – Integration, dashboard, polish · Days 11–15 (+16–17 buffer)
15. `feat(integration): DummyJSON client (users, carts as orders, products) and order lookup for the AI` — Day 11
16. `feat(agent-inbox): customer sidebar with order history` — Day 11
17. `feat(analytics): metrics API (open, waiting, resolved today, average response time, volume, categories, satisfaction, AI vs human resolved)` — Day 12
18. `feat(dashboard): overview page per 1.jpeg (KPI cards, volume chart, AI activity, categories, satisfaction, recent conversations)` — Day 13
19. `feat(dashboard): rules and knowledge base management screens` — Day 13–14
20. `feat(security): rate limiting, helmet, input validation, prompt-injection guard` — Day 14
21. `test: backend coverage pass (all routes with Supertest, services at 80% or more)` — Day 14
22. `docs(postman): complete Postman collection and environment` — Day 15
23. `docs: final README for backend and frontend, setup, env vars, API reference, AI pipeline` — Day 15
24. `chore: demo seed data ("Acme Shoes") and end-to-end demo script` — Day 15

### Deferred to post-MVP (cut first if behind schedule)
Canned responses, internal notes, team invitations and teams management, a brand-tone settings page (MVP uses one `brand_tone` text field on the business), sentiment analytics, extra dashboard pages (Inbox, Customers, Analytics, Settings), typing indicators and presence, PII redaction in logs, email and WhatsApp channels.

---

## 5b. Code Naming Standards (mandatory, also added as Rule 6 in Plan.md)

Code must read like plain English so anyone can understand it without comments.

1. **No cryptic names.** No abbreviations except universal ones (`id`, `url`). Never use `msg`, `res`, `req` as variable names for domain data, `tmp`, `data`, `obj`, `val`, `cb`, or single letters, even in loops and callbacks. (Framework-standard Express handler parameters are written out: `request`, `response`.)
2. **Functions are verb phrases that say what they do:** `findOpenConversationsForAgent`, `verifyAgentDraftAgainstBusinessRules`, `escalateConversationToHumanAgent`.
3. **Variables are descriptive nouns:** `customerMessageText`, `suggestedReplyText`, `openConversations`.
4. **Booleans start with `is`, `has`, `can` or `should`:** `isConversationEscalated`, `hasAgentApprovedSuggestion`.
5. **Plurals and units:** arrays are plural; counts end in `Count`; timestamps end in `At` (`createdAt`); durations carry the unit (`responseTimeInSeconds`).
6. **Files and components** are named after their single responsibility: `agentDraftVerifierService.js`, `businessRulesRoutes.js`; React components in PascalCase (`SuggestedReplyReviewPanel`); hooks start with `use` (`useConversationMessages`).
7. **Database:** tables are plural snake_case (`business_rules`); columns are snake_case and explicit (`assigned_agent_id`, `created_at`).
8. **Prefer a longer, clear name over a short, ambiguous one.** Comments explain *why*, not *what*.
9. **Enforced automatically** with ESLint (`id-length` minimum 3 with `id` allowed, `camelcase`) and a pre-commit self-checklist.

---

## 5c. Git Workflow Rules (mandatory)

1. **`main`** holds only stable, working, reviewed code. Never work or commit directly on `main`. Changes reach it only by merging `backend` or `frontend` at the end of a working feature or week.
2. **`backend`** branch: all work inside `backend/` (API, DB, AI services, tests, backend README).
3. **`frontend`** branch: all work inside `frontend/` (dashboard, agent inbox, widget, frontend README).
4. Shared files (`docker-compose.yml`, root `README.md`, `ROADMAP.md`, `postman/`) change on the branch of the feature that needs them, never on `main`.
5. Before starting a task, check you are on the right branch, and sync with `main` regularly (`git merge main`).
6. **Every commit is made manually by you.** Claude never runs `git add`, `git commit`, `git push`, merge or branch operations.
7. **Claude generates only the commit message** (Conventional Commits, one feature = one commit, as in section 5) and nothing else about git.
8. A cross-stack feature (e.g. a widget that needs a new endpoint) is split into two commits: the backend part on `backend`, the frontend part on `frontend`.

---

## 5d. Secrets and Environment Rules (mandatory)

1. Secrets never go in git: the OpenRouter API key, database password, and any geo-IP key.
2. They live in `.env` files (root for docker-compose, plus `backend/.env` and `frontend/.env` if needed). Code reads them only through `process.env`, via a single config module in `backend/src/config`.
3. **`.gitignore` is created before the first commit.** It lists `.env`, `.env.*` (with `!.env.example`), `node_modules/`, and build output. Run `git status` before every commit to confirm no `.env` is staged.
4. A committed `.env.example` documents every variable with placeholder values only, never real keys.
5. Never put secrets in code, tests, the README, the Postman collection, logs, or commit messages. Tests use the mock provider and fake values.
6. If a secret is ever committed, treat it as leaked: rotate the key or password immediately. Removing it from history is not enough.

---

## 6. DummyJSON Mapping

DummyJSON has no real order tracking, so use it as a stand-in for the merchant's e-commerce system:

| DummyJSON | Role in product |
|---|---|
| `/users` | Customers (identify the chat visitor, show profile) |
| `/carts` | Orders (items, totals, a faux status derived from the id) |
| `/products` | Product questions and KB seed data |
| `/auth/login` | Optional demo customer login |

Isolate it behind an `ecommerceProvider` interface so a real Shopify/WooCommerce adapter can replace it later.

---

## 7. Testing Strategy

- **Jest + Supertest:** every route and service; DB tests use a separate `saad_test` Postgres database (the Docker container), migrated and truncated per suite.
- **AI tests:** mock OpenRouter; add a small **golden dataset** (message → expected verdicts) that can optionally run against the live model with `npm run test:ai-live`.
- **Postman:** one folder per domain, with environment variables for base URL and token, and test scripts on status/schema.
- **Frontend:** manual QA against the design images (optional Vitest and React Testing Library for the verification panel).

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Free OpenRouter models: rate limits, variable quality, malformed JSON | Fallback chain, retries, schema validation, repair-or-reject, queueing; a "model" setting so a paid model is one env var away |
| AI hallucinating policy or promises | Retrieval-grounded prompts, the same verification layer on AI output, escalate when no KB match |
| Latency in Copilot interception | Run grammar and policy checks in a single call; show a loading state; allow "send as-is" only if the business setting permits |
| Prompt injection from customers | Delimit user content, never allow customer text to alter rules, strip tool-call-like text, log and flag |
| Rewrite changing agent's meaning | Prompt constraint + show a diff; the agent always has the final say |
| 3-week deadline | Feature freeze at day 15; cut the Deferred list first; core modes and verification are never cut; demo-able build at the end of every week |
| Raw SQL maintenance | Repository modules per table, parameterized queries only, migrations in version control |
| Tenant data leakage | `business_id` on every query via a scoped repository helper; tests proving isolation |

---

## 9. Definition of Done (MVP)

- [ ] A customer chats through the widget on a demo storefront
- [ ] Autopilot answers from KB, respects the business rules, and escalates when unsure
- [ ] An agent takes over; every draft is verified; Approve / Edit / Reject works; nothing sends unapproved
- [ ] The Plan.md refund example produces the expected verdicts and rewrite
- [ ] The dashboard shows live metrics and AI activity
- [ ] `docker compose up` brings up the DB and backend; `schema.sql` creates everything
- [ ] Jest suite green; Postman collection complete; READMEs document every backend and frontend detail
- [ ] All code follows the Code Naming Standards (section 5b), checked by ESLint
- [ ] Delivered within 3 weeks (15 working days plus 2 buffer days)

---

## 10. Open Decisions (my defaults are in bold)

1. **Realtime transport:** **Socket.IO** vs raw `ws` (Socket.IO is easier for rooms and reconnects).
2. **Language:** **JavaScript** (matches Plan.md) vs TypeScript.
3. **Auth:** **opaque session token for staff** in a 3-day HttpOnly cookie, stored as a SHA-256 hash in the `sessions` table (logout deletes the row). No JWT. Widget-key + anonymous session token for customers.
4. **Rules format:** **plain-language rules the LLM evaluates** (as in the Plan.md example) vs structured/regex rules. Hybrid later.
5. **Frontend styling:** **plain CSS modules with design tokens** matching the images vs Tailwind.
6. **Languages:** **English only for MVP**; multilingual later.

## 11. Post-MVP Ideas
Email / WhatsApp channels (shown in the dashboard sidebar), Automations, rule-violation analytics ("most-caught mistakes" for agent coaching), per-agent quality scores, vector search, file attachments, a real e-commerce adapter, billing and plans.
