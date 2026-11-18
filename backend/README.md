# Zenvyro Backend

Express 5 API for the support platform. Raw SQL on PostgreSQL through `pg`, no ORM.

## Setup

1. Copy `../.env.example` to `../.env` (the `saas/` folder) and fill in real values. Never commit `.env`.
2. Start Postgres from `saas/`: `docker compose up -d postgres`. Wait until `docker compose ps` shows the container as `healthy`.
   - The compose file publishes port 5432 to the host. Stop any local PostgreSQL that already uses that port first.
   - The `saad_test` database is created only when the data volume is first created. If it is missing, run `docker compose down -v` and then `docker compose up -d postgres` again. That deletes the volume's data.
3. Run tests from `backend/`: `npm test`. Tests run against `TEST_DATABASE_URL` (the `saad_test` database). The test setup applies `db/schema.sql` itself if the tables are missing.

`src/config/loadProjectEnvironmentFile.js` loads `saas/.env` whatever folder the command runs from. Values already set in the environment (for example by docker compose) take priority over the file.

The full `docker compose up` (backend + postgres) is not usable yet: the backend command runs `src/db/databaseCommands.js`, which is the Week 1 item 2 migration runner and not written yet.

## Authentication

Base path: `/api/authentication`. Sessions are opaque random tokens. No JWT is used.

| Method | Path | Session needed | Success | Notes |
|---|---|---|---|---|
| POST | `/sign-up` | no | 201 `{ user, business }` | Creates the business and its owner in one transaction, starts a session, sets the cookie. |
| POST | `/sign-in` | no | 200 `{ user }` | Starts a new session and sets the cookie. Wrong password and unknown email both return the same 401. |
| GET | `/me` | yes | 200 `{ user }` | Returns the signed-in user. |
| POST | `/sign-out` | yes | 204 | Deletes the session row and clears the cookie. |

Errors are JSON: `{ "error": "message" }`. Expected failures return 400 (validation), 401 (not signed in or wrong credentials) or 409 (email already registered).

### Session design

- **Cookie:** `zenvyro_session`, HttpOnly, SameSite=Lax, path `/`, 3-day lifetime. `Secure` is set when `NODE_ENV=production`.
- **Token:** 32 random bytes, base64url encoded. Only the cookie holds the raw value.
- **Database:** `sessions.token_hash` stores the SHA-256 hex of the token. The raw token is never stored.
- **Each request** (`/me`, `/sign-out`): the middleware hashes the cookie value and loads the session only if `expires_at` is in the future. An unknown, expired or deleted session gets 401 and the cookie is cleared.

### Layout

- `middleware/validateSignUpMiddleware.js`, `validateSignInMiddleware.js`: plain checks on the request body (no validation library), using helpers in `utils/inputValidation.js`. Each check returns a 400 with a readable message.
- `middleware/errorHandlerMiddleware.js`: turns expected errors into JSON. Unexpected errors become a generic 500, so SQL and stack details are never sent to the client.
- `middleware/requireSessionMiddleware.js`: session check for protected routes. Sets `request.authenticatedUser`.
- `controllers/authenticationController.js`: HTTP handling and cookie setting.
- `services/authenticationService.js`: sign-up, sign-in and sign-out rules.
- `services/sessionTokenService.js`: token generation and hashing.
- `repositories/*Repository.js`: parameterized SQL, one module per table.

## Realtime (Socket.IO)

Socket.IO runs on the same HTTP server as Express (`src/server.js`). Path: the Socket.IO default (`/socket.io`). Same CORS origins as the REST API, with credentials.

### Connecting

- The browser sends the `zenvyro_session` cookie during the handshake. Each connection is checked against the `sessions` table, the same way REST requests are.
- No cookie, an unknown session, or an expired session fails the connection with an error message (`You must be signed in.` or `Your session has ended. Please sign in again.`).

### Events

| Direction | Event | Payload | Acknowledgement |
|---|---|---|---|
| client to server | `conversation:join` | `{ conversationId }` | `{ isSuccessful: true, conversationId }`, or `{ isSuccessful: false, error }` |
| client to server | `conversation:leave` | `{ conversationId }` | Same shape as join |
| server to client | `message:created` | `{ conversationId, message }` | none, sent after the message is saved |

- Each conversation has one room, named `conversation:<conversationId>`.
- A socket can join only a conversation that belongs to its own business. Another business's conversation, a missing one and a malformed id all return `Conversation not found.`
- `message:created` is sent when `POST /api/conversations/:conversationId/messages` saves a message. Only sockets that joined the room receive it.

### Layout

- `realtime/socketGateway.js`: authentication, join and leave handlers.
- `realtime/conversationRealtimePublisher.js`: sends `message:created` to a room.
- `realtime/realtimeEventNames.js`, `realtime/conversationRoomNames.js`: shared names.

## Website widget (customer chat)

Base path: `/api/widget`. Visitors are anonymous customers, not staff. They never use the staff cookie. The widget key identifies the business and is public (it is in the embed code). Visitor tokens are random and stored only as SHA-256 hashes in `widget_sessions`. Sessions last 30 days.

Widget routes accept any browser origin, because they use a bearer token and no cookie.

| Method | Path | Auth | Success | Notes |
|---|---|---|---|---|
| POST | `/sessions` | `widgetKey` in body | 201 `{ sessionToken, customer, conversation }` | Creates the visitor customer, a conversation and a session token. `name` (default "Website visitor") and `email` are optional. Unknown key: 401. |
| GET | `/session` | `Authorization: Bearer <sessionToken>` | 200 `{ conversation, messages }` | The visitor's conversation and newest 50 messages, oldest first. Only visitor-safe fields. |
| POST | `/messages` | `Authorization: Bearer <sessionToken>` | 201 `{ message }` | Body `{ body }`, 1 to 5000 characters. Saved as a `customer` message. A resolved conversation is reopened. |

### Realtime for visitors

A visitor connects to Socket.IO with `io(url, { auth: { widgetSessionToken } })`. The server places the socket in its own room `conversation:<conversationId>` on connect, so it receives `message:created` for its conversation. Joining any other conversation gets `Conversation not found.`

### Layout

- `routes/widgetRoutes.js`, `controllers/widgetController.js`
- `services/widgetSessionService.js`: start session, read conversation, post visitor message, token lookup
- `middleware/requireWidgetSessionMiddleware.js`, `validateStartWidgetSessionMiddleware.js`
- `repositories/widgetSessionsRepository.js`
- `db/migrations/002_widget_sessions.sql` (also in `db/schema.sql`)

## Agent inbox: assignment and labels

### Assignment

`PATCH /api/conversations/:conversationId` also accepts `assignedAgentId`. Send a staff user's id to assign, or `null` to unassign. Other fields in the same request are unchanged when `assignedAgentId` is absent. The assignee must be a staff member of the same business, otherwise 400. The inbox views are `GET /api/conversations?view=mine` (assigned to the signed-in user), `unassigned`, and `all`.

### Labels

Labels belong to a business. Names are unique per business (409 on a duplicate).

| Method | Path | Success | Notes |
|---|---|---|---|
| GET | `/api/labels` | 200 `{ labels: [{ id, name, colorHex }] }` | Sorted by name. |
| POST | `/api/labels` | 201 `{ label }` | Body `{ name, colorHex? }`. Name 1 to 40 characters. `colorHex` defaults to `#4a6cf7`. |
| PUT | `/api/conversations/:conversationId/labels` | 200 `{ conversation }` | Body `{ labelIds: [...] }` replaces the whole label set. Up to 20 ids. Every label must belong to this business, otherwise 400. |

Every conversation object (single and list) includes `labels: [{ id, name, colorHex }]`, read in the same query.

### Layout

- `routes/labelsRoutes.js`, `controllers/labelsController.js`, `services/labelsService.js`, `repositories/labelsRepository.js`
- `middleware/validateCreateLabelMiddleware.js`, `validateSetConversationLabelsMiddleware.js`
- `utils/labelValues.js`
