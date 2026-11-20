# Zenvyro system design

This document draws the [System design](../README.md#system-design) in diagrams. It covers three things:

1. [System design flow](#1-system-design-flow): the architecture and the main request flows.
2. [API design](#2-api-design): REST endpoints and the realtime (Socket.IO) contract.
3. [Database](#3-database): the entity-relationship diagram and the conversation lifecycle.

**Legend.** **Built** means the code exists today. **Planned** means it appears only in the README or roadmap, or as a table that no code uses yet. In flowcharts, planned parts have dashed borders.

---

## 1. System design flow

### 1a. Architecture

```mermaid
flowchart LR
    subgraph Clients
        W["Customer widget<br/>(iframe injected by zenvyro-widget.js)"]
        A["Agent interface<br/>(React SPA, 3-pane inbox)"]
        D["Business dashboard<br/>(React SPA)"]
    end

    subgraph Server["Node.js process (port 4000)"]
        direction TB
        subgraph API["Express 5 API"]
            direction TB
            R["Routes"] --> M["Middleware<br/>validation · session check · errors"]
            M --> C["Controllers"]
            C --> S["Services"]
            S --> REPO["Repositories<br/>(parameterised SQL)"]
        end
        GW["Socket.IO gateway<br/>rooms: business:{id}, conversation:{id}"]
        C -- "publish after commit" --> GW

        subgraph Domain["Domain services"]
            GEO["Geo-origin service"]
            ROUTER["Conversation router<br/>mode: ai | human"]
            AI["AI pipeline<br/>intent → knowledge → rules<br/>→ generate → confidence gate"]
            VER["Verification service<br/>grammar · policy · tone + rewrite"]
        end
        S --> GEO
        S -.-> ROUTER
        ROUTER -.-> AI
        S -.-> VER
    end

    DB[("PostgreSQL 16<br/>pg_trgm · full-text search")]

    subgraph External["External services"]
        IPWHO["ipwho.is<br/>(geo-IP)"]
        RC["REST Countries"]
        OR["OpenRouter<br/>(LLM)"]
        DJ["DummyJSON<br/>(orders, products)"]
    end

    W -- "REST /api/widget (Bearer)" --> R
    W <-- "WebSocket (widget token)" --> GW
    A -- "REST /api (cookie)" --> R
    A <-- "WebSocket (cookie)" --> GW
    D -- "REST /api (cookie)" --> R

    REPO --> DB
    GEO --> IPWHO
    GEO --> RC
    AI -.-> OR
    VER -.-> OR
    AI -.-> DJ

    classDef planned stroke-dasharray: 5 5
    class ROUTER,AI,VER,OR,DJ,D planned
```

**Notes**

- The API and the Socket.IO gateway run in **one Node process**. Realtime events are published from controllers **after the database transaction commits**.
- There is no Redis adapter yet, so realtime works on a single instance only.
- The Business dashboard exists as a page. Its metrics API and its rule and knowledge management are Planned.

### 1b. Who starts each request, and where it ends

> **Animated version:** open [system-design-flows.html](system-design-flows.html) in a browser. Press Play to watch each request travel from sender to receiver, with a caption for every step.

How to read the diagrams below:

- **▶ START** marks who begins the flow.
- **■ END** marks the last thing that happens.
- A tall bar on a participant (an *activation*) shows how long that participant holds an open request. The bar begins when the request arrives and ends when the response leaves.
- Solid arrows (`->>`) are requests and events. Dashed arrows (`-->>`) are responses and pushed events.

| Flow | Started by | HTTP request ends | Flow ends |
|---|---|---|---|
| Widget starts a session (1c) | **Visitor's browser** loads the widget | `201 {sessionToken}` reaches the widget | **Agent inbox** receives `conversation:created` |
| Customer sends a message (1d) | **Visitor** presses Send | `201 {message}` reaches the widget | **Agent inbox** receives `conversation:updated` and re-sorts |
| Agent replies with Copilot (1e) | **Agent** writes a draft | Verification: verdicts reach the agent (Planned). Send: `201 {message}` | **Widget** receives `message:created`, and the customer reads the reply |
| AI Autopilot reply (1f) | **Customer's message** in a conversation with `mode = ai` | The customer's POST already returned. The AI runs afterwards | **Widget** shows the AI reply, or the **Agent inbox** shows the escalation |
| Staff signs in | **Agent** submits the sign-in form | `200` with the `zenvyro_session` cookie | The agent's socket joins `business:{id}` |

### 1c. Flow: the widget starts a session (Built)

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitor
    participant Wg as Widget iframe
    participant API as Express API
    participant Geo as Geo-origin service
    participant DB as PostgreSQL
    participant GW as Socket.IO gateway
    participant Ag as Agent inbox

    Note over V: ▶ START: the visitor opens the store page
    V->>Wg: zenvyro-widget.js injects /widget?key=wk_…
    alt token saved in localStorage (returning visitor)
        Wg->>+API: GET /api/widget/session (Bearer token)
        API->>+DB: find widget_session by SHA-256(token), not expired
        DB-->>-API: session, conversation, newest 50 messages
        API-->>-Wg: 200 {business, conversation, messages}
        Note over Wg: Request ends. On 401 the widget deletes the token and takes the "no token" path
    else no token (new visitor)
        Wg->>+API: POST /api/widget/sessions {widgetKey, name?, email?}
        API->>+DB: find business by widget_key (401 if unknown)
        DB-->>-API: business
        API->>+Geo: lookup(request.ip), before the transaction
        Geo-->>-API: origin (detected · unavailable · private_address)
        API->>+DB: BEGIN, insert customer, conversation (origin_*), widget_session, COMMIT
        DB-->>-API: rows created
        API-->>-Wg: 201 {sessionToken, business, customer, conversation}
        Note over Wg: Request ends. The token is saved in localStorage
        API->>GW: publish conversation:created → business:{id}
        GW-->>Ag: conversation:created {conversation}
        Note over Ag: ■ END: the new conversation appears in the inbox
    end
    Wg->>GW: connect, auth {widgetSessionToken}
    GW-->>Wg: joined conversation:{id}, live from now on
```

### 1d. Flow: the customer sends a message (Built)

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitor
    participant Wg as Widget
    participant API as Express API
    participant DB as PostgreSQL
    participant GW as Socket.IO gateway
    participant Ag as Agent inbox

    Note over V: ▶ START: the visitor presses Send
    V->>Wg: types the message
    Wg->>+API: POST /api/widget/messages {body} (Bearer)
    API->>+DB: BEGIN, SELECT conversation … FOR UPDATE
    opt status = resolved
        API->>DB: set status = open (reopen)
    end
    API->>DB: INSERT message (sender_type = customer), set last_message_at
    DB-->>-API: COMMIT ok
    API-->>-Wg: 201 {message}
    Note over Wg: Request ends
    API->>GW: publish after commit
    GW-->>Wg: message:created (merged by id, no duplicate)
    GW-->>Ag: message:created (if the agent has this thread open)
    GW-->>Ag: conversation:updated → business:{id}
    Note over Ag: ■ END: the inbox moves the conversation to the top
    opt mode = ai (Planned)
        API->>API: hand off to the AI Autopilot flow (1f)
    end
```

### 1e. Flow: the agent replies with Copilot verification

Sending the reply is Built. The verification steps in the shaded box are Planned.

```mermaid
sequenceDiagram
    autonumber
    actor Agent
    participant Ag as Agent inbox
    participant API as Express API
    participant Ver as Verification service
    participant LLM as OpenRouter
    participant DB as PostgreSQL
    participant GW as Socket.IO gateway
    participant Wg as Widget

    Note over Agent: ▶ START: the agent writes a draft
    Agent->>Ag: write draft
    rect rgba(127,127,127,0.12)
        Note over Ag,LLM: Planned: Copilot verification
        Ag->>+API: POST /api/conversations/:id/draft-verifications {body}
        API->>DB: load enabled business_rules and brand_tone
        API->>+Ver: verify(draft, rules, tone)
        Ver->>+LLM: JSON-schema prompt
        LLM-->>-Ver: {grammar, policy, tone, issues[], suggestion}
        Ver->>DB: INSERT message_verifications, INSERT ai_events
        Ver-->>-API: verdicts
        API-->>-Ag: verdicts + suggested rewrite (nothing sent yet)
        Note over Ag: Verification request ends
        Agent->>Ag: approve · edit · reject
    end
    Ag->>+API: POST /api/conversations/:id/messages {body}
    API->>+DB: BEGIN, lock conversation (409 if resolved)
    API->>DB: INSERT message (sender_type = agent, original_body)
    DB-->>-API: COMMIT ok
    API-->>-Ag: 201 {message}
    Note over Ag: Send request ends
    API->>GW: publish message:created + conversation:updated
    GW-->>Wg: message:created
    Note over Wg: ■ END: the customer reads the reply
```

### 1f. Flow: AI Autopilot reply (Planned)

```mermaid
sequenceDiagram
    autonumber
    participant Wg as Widget
    participant API as Express API
    participant Rt as Conversation router
    participant AI as AI pipeline
    participant LLM as OpenRouter
    participant DB as PostgreSQL
    participant GW as Socket.IO gateway
    participant Ag as Agent inbox

    Note over Wg: ▶ START: a customer message in a conversation with mode = ai
    Wg->>+API: POST /api/widget/messages (saved and broadcast as in 1d)
    API-->>-Wg: 201 {message}
    Note over Wg: The customer's request ends here. The AI runs in the background
    API->>+Rt: customer message saved (conversation.mode = ai)
    Rt->>+AI: run(conversation, history)
    deactivate Rt
    AI->>+LLM: classify intent
    LLM-->>-AI: {intent, entities, confidence}
    AI->>DB: search knowledge_articles (search_vector, GIN)
    AI->>DB: load enabled business_rules
    AI->>+LLM: generate reply (context + knowledge + rules + brand tone)
    LLM-->>-AI: {reply, confidence}
    AI->>AI: confidence gate + rule enforcement check
    AI->>DB: INSERT ai_events for every step (type, confidence, latency, model)
    alt confident and compliant
        AI->>DB: INSERT message (sender_type = ai)
        AI->>GW: message:created, conversation:updated
        GW-->>Wg: message:created
        Note over Wg: ■ END: the customer reads the AI reply
    else low confidence or a rule hit
        AI->>DB: set status = escalated, mode = human
        AI->>GW: conversation:updated
        GW-->>Ag: conversation:updated (escalated)
        Note over Ag: ■ END: an agent picks it up from the queue
    end
    deactivate AI
```

---

## 2. API design

### 2a. Endpoint map

```mermaid
flowchart LR
    API(["/api"])

    API --> AUTH["/authentication"]
    AUTH --> A1["POST /sign-up"]
    AUTH --> A2["POST /sign-in"]
    AUTH --> A3["GET /me"]
    AUTH --> A4["POST /sign-out"]

    API --> CONV["/conversations"]
    CONV --> C1["POST /"]
    CONV --> C2["GET / (view, status, mode, cursor)"]
    CONV --> C3["GET /:id"]
    CONV --> C4["PATCH /:id (status, mode, assignee)"]
    CONV --> C5["GET /:id/messages"]
    CONV --> C6["POST /:id/messages"]
    CONV --> C7["PUT /:id/labels"]
    CONV --> C8["POST /:id/draft-verifications"]
    CONV --> C9["GET · POST /:id/notes"]

    API --> LAB["/labels"]
    LAB --> L1["GET /"]
    LAB --> L2["POST /"]

    API --> USR["/users"]
    USR --> U1["GET /"]
    USR --> U2["POST /invitations"]

    API --> WID["/widget"]
    WID --> W1["POST /sessions"]
    WID --> W2["GET /session"]
    WID --> W3["POST /messages"]

    API --> RUL["/business-rules<br/>GET · POST · PATCH · DELETE"]
    API --> KB["/knowledge-articles<br/>GET · POST · PATCH · DELETE"]
    API --> CAN["/canned-responses<br/>GET · POST · DELETE"]
    API --> DASH["/dashboard/metrics<br/>GET"]

    classDef public fill:#e8f5e9,stroke:#2e7d32,color:#1b1b1b
    classDef staff fill:#e3f2fd,stroke:#1565c0,color:#1b1b1b
    classDef widget fill:#fff3e0,stroke:#e65100,color:#1b1b1b
    classDef planned stroke-dasharray: 5 5

    class A1,A2,W1 public
    class A3,A4,C1,C2,C3,C4,C5,C6,C7,L1,L2,U1,C8,C9,U2,RUL,KB,CAN,DASH staff
    class W2,W3 widget
    class C8,C9,U2,RUL,KB,CAN,DASH planned
```

Colours show the auth type: **green** is public, **blue** needs the staff cookie `zenvyro_session`, and **orange** needs the widget Bearer token. Dashed boxes are Planned.

**Conventions**

- JSON over REST, under `/api`. Errors are returned as `{ "error": "…" }`, without SQL or stack details. Unknown routes return 404.
- Lists use **keyset cursors**, never offsets. `limit` defaults to 20, with a maximum of 50. The response is `{ items, nextCursor }`.
- Every staff query is scoped to the signed-in user's `business_id`. The widget is scoped by its token.
- CORS: `/api/widget` accepts any origin without credentials. Every other route needs an allowlisted origin and sends credentials.

### 2b. Endpoint reference

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/authentication/sign-up` | public | `{businessName, name, email, password}` | 201 `{user, business}`, sets cookie |
| POST | `/api/authentication/sign-in` | public | `{email, password}` | 200 `{user, business}`, sets cookie · 401 |
| GET | `/api/authentication/me` | cookie | none | 200 `{user, business}` |
| POST | `/api/authentication/sign-out` | cookie | none | 204, deletes the session |
| POST | `/api/conversations` | cookie | `{customerId}` or `{customer{name, email?, externalId?}}`, `firstMessageText?` | 201 `{conversation}` |
| GET | `/api/conversations` | cookie | `?view=all\|mine\|unassigned&status&mode&customerId&limit&cursor` | 200 `{conversations, nextCursor}` |
| GET | `/api/conversations/:id` | cookie | none | 200 `{conversation}` · 404 |
| PATCH | `/api/conversations/:id` | cookie | `{status?, mode?, assignedAgentId?}` | 200 `{conversation}` |
| GET | `/api/conversations/:id/messages` | cookie | `?limit&cursor` (pages toward older messages) | 200 `{messages, nextCursor}` |
| POST | `/api/conversations/:id/messages` | cookie | `{body}` (1–5000 characters) | 201 `{message}` · 409 if resolved |
| PUT | `/api/conversations/:id/labels` | cookie | `{labelIds}` (up to 20) | 200 `{conversation}` |
| GET | `/api/labels` | cookie | none | 200 `{labels}` |
| POST | `/api/labels` | cookie | `{name, colorHex?}` | 201 `{label}` · 409 for a duplicate name |
| GET | `/api/users` | cookie | none | 200 `{users}` |
| POST | `/api/widget/sessions` | public (`widgetKey`) | `{widgetKey, name?, email?}` | 201 `{sessionToken, business, customer, conversation}` |
| GET | `/api/widget/session` | Bearer | none | 200 `{business, conversation, messages}` · 401 |
| POST | `/api/widget/messages` | Bearer | `{body}` | 201 `{message}` |
| POST | `/api/conversations/:id/draft-verifications` | cookie | `{body}` | **Planned:** `{grammar, policy, tone, issues[], suggestion, verificationId}` |
| GET · POST · PATCH · DELETE | `/api/business-rules` | cookie | `{title, description, severity, isEnabled}` | **Planned** |
| GET · POST · PATCH · DELETE | `/api/knowledge-articles` | cookie | `{title, body, tags[]}`, search with `?q=` | **Planned** |
| GET · POST · DELETE | `/api/canned-responses` | cookie | `{shortcutText, body}` | **Planned** |
| GET · POST | `/api/conversations/:id/notes` | cookie | `{body}` | **Planned** |
| POST | `/api/users/invitations` | cookie (owner or admin) | `{email, role}` | **Planned** |
| GET | `/api/dashboard/metrics` | cookie | `?from&to` | **Planned** |

Every conversation object includes the customer's name and email, `labels[]`, `origin{…}` and `lastMessage{preview, senderType, createdAt}`.

### 2c. Realtime contract (Socket.IO)

```mermaid
sequenceDiagram
    participant V as Visitor socket
    participant S as Staff socket
    participant GW as Socket.IO gateway

    V->>GW: connect, auth {widgetSessionToken}
    Note right of GW: A widget token wins,<br/>even if a staff cookie is also sent
    GW->>GW: join conversation:{own id}
    S->>GW: connect with the zenvyro_session cookie
    GW->>GW: join business:{businessId}
    S->>GW: conversation:join {conversationId}
    GW-->>S: ack {isSuccessful, conversationId}
    S->>GW: conversation:leave {conversationId}
    GW-->>S: ack {isSuccessful, conversationId}
    Note over GW: Server → client events
    GW-->>V: message:created {conversationId, message}
    GW-->>S: message:created {conversationId, message}
    GW-->>S: conversation:created {conversation}
    GW-->>S: conversation:updated {conversation}
```

| Direction | Event | Room or target | Payload |
|---|---|---|---|
| client → server | `conversation:join` | staff only, same business | `{conversationId}`, ack `{isSuccessful, conversationId \| error}` |
| client → server | `conversation:leave` | staff only | `{conversationId}`, ack as above |
| server → client | `message:created` | `conversation:{id}` | `{conversationId, message}` |
| server → client | `conversation:created` | `business:{id}` | `{conversation}` |
| server → client | `conversation:updated` | `business:{id}` | `{conversation}` |

---

## 3. Database

### 3a. Entity-relationship diagram

Source: [backend/db/schema.sql](../backend/db/schema.sql). All ids are `uuid` values generated by `gen_random_uuid()`.

```mermaid
erDiagram
    businesses ||--o{ users : "employs"
    businesses ||--o{ teams : "has"
    businesses ||--o{ customers : "serves"
    businesses ||--o{ conversations : "owns"
    businesses ||--o{ labels : "defines"
    businesses ||--o{ business_rules : "enforces"
    businesses ||--o{ knowledge_articles : "publishes"
    businesses ||--o{ canned_responses : "keeps"
    businesses ||--o{ ai_events : "audits"
    businesses ||--o{ widget_sessions : "issues"

    users ||--o{ sessions : "logs in with"
    users |o--o{ conversations : "assigned to"
    users |o--o{ internal_notes : "writes"
    teams |o--o{ conversations : "routes"

    customers ||--o{ conversations : "starts"
    customers ||--o{ widget_sessions : "holds"

    conversations ||--o{ messages : "contains"
    conversations ||--o{ conversation_labels : "tagged"
    labels ||--o{ conversation_labels : "applied"
    conversations ||--o{ internal_notes : "has"
    conversations ||--o{ message_verifications : "has"
    conversations |o--o{ ai_events : "logs"
    conversations ||--o{ widget_sessions : "accessed by"
    messages |o--o{ message_verifications : "verified by"

    businesses {
        uuid id PK
        text name
        text slug UK
        text widget_key UK "wk_ + 32 hex"
        text brand_tone
        jsonb settings
        timestamptz created_at
    }
    users {
        uuid id PK
        uuid business_id FK
        text name
        text email UK
        text password_hash "bcrypt"
        text role "owner | admin | agent"
    }
    sessions {
        uuid id PK
        uuid user_id FK
        text token_hash UK "SHA-256 hex"
        timestamptz expires_at "now + 3 days"
    }
    teams {
        uuid id PK
        uuid business_id FK
        text name "unique per business"
    }
    customers {
        uuid id PK
        uuid business_id FK
        text external_id
        text name
        text email
    }
    conversations {
        uuid id PK
        uuid business_id FK
        uuid customer_id FK
        uuid assigned_agent_id FK
        uuid team_id FK
        text channel "web_widget"
        text mode "ai | human"
        text status "open | pending | resolved | escalated"
        text category
        text sentiment "positive | neutral | negative"
        smallint csat_score "1 to 5"
        text origin_detection_status
        char origin_country_code
        jsonb origin_languages
        jsonb origin_currencies
        timestamptz last_message_at
        timestamptz resolved_at
    }
    messages {
        uuid id PK
        uuid conversation_id FK
        text sender_type "customer | ai | agent | system"
        uuid sender_id "no FK"
        text body
        text original_body "before rewrite"
        timestamptz created_at
    }
    widget_sessions {
        uuid id PK
        uuid business_id FK
        uuid customer_id FK
        uuid conversation_id FK
        text token_hash UK "SHA-256 hex"
        timestamptz expires_at "30 days"
    }
    labels {
        uuid id PK
        uuid business_id FK
        text name "unique per business"
        text color_hex
    }
    conversation_labels {
        uuid conversation_id PK, FK
        uuid label_id PK, FK
    }
    business_rules {
        uuid id PK
        uuid business_id FK
        text title
        text description
        text severity "low | medium | high | critical"
        boolean is_enabled
    }
    knowledge_articles {
        uuid id PK
        uuid business_id FK
        text title
        text body
        text_array tags
        tsvector search_vector "generated, GIN"
    }
    message_verifications {
        uuid id PK
        uuid conversation_id FK
        uuid message_id FK
        text original_body
        text suggested_body
        text grammar_status
        text policy_status
        text tone_status
        jsonb issues
        text agent_action "approved | edited | rejected"
        text final_body
    }
    ai_events {
        uuid id PK
        uuid business_id FK
        uuid conversation_id FK
        text event_type
        jsonb payload
        numeric confidence "0 to 1"
        int latency_in_milliseconds
        text model_name
    }
    canned_responses {
        uuid id PK
        uuid business_id FK
        text shortcut_text "unique per business"
        text body
    }
    internal_notes {
        uuid id PK
        uuid conversation_id FK
        uuid author_user_id FK
        text body
    }
```

| Status | Tables |
|---|---|
| **Built** (used by code) | `businesses`, `users`, `sessions`, `customers`, `conversations`, `messages`, `widget_sessions`, `labels`, `conversation_labels` |
| **Planned** (table exists, no code yet) | `teams`, `business_rules`, `knowledge_articles`, `message_verifications`, `ai_events`, `canned_responses`, `internal_notes` |

**Invariants**

- `businesses` is the tenant root. Every row of business data reaches a `business_id`, either directly or through its conversation.
- The widget creates exactly **one customer, one conversation and one widget session** per visitor. The schema allows more, so the service layer enforces this.
- Only SHA-256 hashes of session tokens are stored (`sessions`, `widget_sessions`). A database leak does not expose working sessions.
- `messages.original_body` keeps the text as it was before any compliance rewrite.

**Indexes**

- `conversations (business_id, last_message_at DESC, id DESC)`: inbox keyset pagination.
- `conversations (business_id, status)` and `conversations (business_id, assigned_agent_id)`: inbox filters.
- `messages (conversation_id, created_at)`: loading a thread.
- `knowledge_articles USING GIN (search_vector)`: knowledge base full-text search.
- `sessions (expires_at)` and `widget_sessions (expires_at)`: for a future job that deletes expired sessions.

### 3b. Conversation lifecycle

```mermaid
stateDiagram-v2
    [*] --> open: widget session or agent creates it
    open --> pending: agent (PATCH status)
    pending --> open: agent, or a new customer message
    open --> resolved: agent resolves (sets resolved_at)
    pending --> resolved: agent resolves
    resolved --> open: a new customer message reopens it
    open --> escalated: AI has low confidence or a rule hit (Planned)
    escalated --> open: agent picks it up
    escalated --> resolved: agent resolves

    state open {
        [*] --> human
        human --> ai: PATCH mode = ai
        ai --> human: escalation or PATCH mode = human
    }
```

Agents cannot reply to a `resolved` conversation (the API returns 409), but a new customer message reopens it.
