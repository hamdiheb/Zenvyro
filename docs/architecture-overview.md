# Zenvyro architecture overview

High-level diagrams of how Zenvyro works today. For the detailed design (API reference, full ER diagram, planned AI flows), see [system-design.md](system-design.md).

1. [The big picture](#1-the-big-picture)
2. [Inside the backend: layers](#2-inside-the-backend-layers)
3. [Two kinds of users, two ways to log in](#3-two-kinds-of-users-two-ways-to-log-in)
4. [A message's journey](#4-a-messages-journey-visitor-writes-agent-replies)
5. [The data model](#5-the-data-model-tables-in-use-today)
6. [Conversation lifecycle](#6-conversation-lifecycle)

---

## 1. The big picture

```mermaid
flowchart LR
    Visitor["🧑 Website visitor"]
    Agent["🎧 Support agent"]

    subgraph Browser["Browser"]
        Loader["zenvyro-widget.js<br/>loader on the shop's site"]
        Widget["Chat widget<br/>iframe at /widget"]
        Inbox["Agent inbox<br/>React app at /agent"]
    end

    subgraph Backend["Node.js server on port 4000"]
        API["REST API<br/>Express 5"]
        Live["Live updates<br/>Socket.IO"]
    end

    DB[("PostgreSQL")]
    Geo["Geo-IP services<br/>ipwho.is + REST Countries"]

    Visitor --> Loader --> Widget
    Agent --> Inbox
    Widget -- "HTTP, chat token" --> API
    Inbox -- "HTTP, login cookie" --> API
    Widget <-. "live messages" .-> Live
    Inbox <-. "live messages" .-> Live
    API --> DB
    Live --> DB
    API -- "where is the visitor?" --> Geo
```

## 2. Inside the backend: layers

```mermaid
flowchart TB
    Req["Incoming request"] --> Routes
    Routes["Routes<br/>which URL goes where"] --> MW
    MW["Middleware<br/>1. Is the caller logged in?<br/>2. Is the input valid?"] --> Ctrl
    Ctrl["Controllers<br/>read the request, send the response"] --> Svc
    Svc["Services<br/>business rules and transactions"] --> Repo
    Repo["Repositories<br/>raw SQL only"] --> DB[("PostgreSQL")]
    Ctrl -- "after the save is committed" --> Pub["Realtime publisher"]
    Pub --> Sock["Socket.IO rooms"]
    Err["Error handler<br/>turns errors into JSON"]
    Ctrl -. "on error" .-> Err
```

## 3. Two kinds of users, two ways to log in

```mermaid
flowchart LR
    subgraph Staff["Staff: owner, admin, agent"]
        S1["Sign in with email and password"] --> S2["Server stores the SHA-256 hash<br/>of a random token in 'sessions'"]
        S2 --> S3["Browser keeps the token<br/>in an HttpOnly cookie for 3 days"]
    end
    subgraph Visitors["Website visitor: anonymous"]
        V1["Widget sends the public widget key"] --> V2["Server creates customer, conversation<br/>and a 'widget_sessions' row"]
        V2 --> V3["Widget keeps the token in localStorage<br/>for 30 days, sent as a Bearer header"]
    end
    S3 --> Rooms1["Socket joins room business:ID<br/>and any conversation it opens"]
    V3 --> Rooms2["Socket joins only its own<br/>room conversation:ID"]
```

## 4. A message's journey: visitor writes, agent replies

```mermaid
sequenceDiagram
    autonumber
    participant V as Visitor widget
    participant API as Express API
    participant DB as PostgreSQL
    participant WS as Socket.IO
    participant A as Agent inbox

    V->>API: POST /api/widget/sessions with widget key
    API->>API: Look up the visitor's country, up to 6s
    API->>DB: One transaction: customer + conversation + session
    API-->>V: chat token
    API->>WS: conversation:created to the business room

    V->>API: POST /api/widget/messages
    API->>DB: Lock conversation, reopen if resolved, save message
    API->>WS: message:created to the conversation room
    WS-->>A: new message appears if the agent has the chat open

    A->>API: POST /api/conversations/:id/messages
    API->>DB: Lock row, refuse if resolved, save message
    API->>WS: message:created
    WS-->>V: reply appears live
```

## 5. The data model: tables in use today

```mermaid
erDiagram
    BUSINESSES ||--o{ USERS : employs
    BUSINESSES ||--o{ CUSTOMERS : has
    BUSINESSES ||--o{ CONVERSATIONS : owns
    BUSINESSES ||--o{ LABELS : defines
    USERS ||--o{ SESSIONS : "logs in with"
    CUSTOMERS ||--o{ CONVERSATIONS : starts
    CONVERSATIONS ||--o{ MESSAGES : contains
    CONVERSATIONS ||--o{ CONVERSATION_LABELS : tagged
    LABELS ||--o{ CONVERSATION_LABELS : used
    CONVERSATIONS ||--|| WIDGET_SESSIONS : "visitor access"
    USERS |o--o{ CONVERSATIONS : "assigned to"
```

These tables exist in `backend/db/schema.sql` but no code uses them yet: `teams`, `business_rules`, `knowledge_articles`, `message_verifications`, `ai_events`, `canned_responses`, `internal_notes`. They are reserved for the planned AI and Copilot features.

## 6. Conversation lifecycle

```mermaid
stateDiagram-v2
    [*] --> open : widget chat starts or agent creates it
    open --> pending : agent
    open --> escalated : agent
    pending --> open : agent
    escalated --> open : agent
    open --> resolved : agent, sets resolved_at
    pending --> resolved
    escalated --> resolved
    resolved --> open : visitor writes again, or agent reopens
    note right of resolved : Agents cannot post here until it is reopened
```
