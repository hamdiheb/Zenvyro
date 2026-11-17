# Backend

Express 5 API for the support platform. Raw SQL on PostgreSQL through `pg`, no ORM.

## Setup

1. Copy `../.env.example` to `../.env` and fill in real values. Never commit `.env`.
2. Start Postgres: `docker compose up -d postgres` (from `saas/`).
3. Run tests: `npm test`. Tests run against `TEST_DATABASE_URL` (the `saad_test` database).

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

- **Cookie:** `saad_session`, HttpOnly, SameSite=Lax, path `/`, 3-day lifetime. `Secure` is set when `NODE_ENV=production`.
- **Token:** 32 random bytes, base64url encoded. Only the cookie holds the raw value.
- **Database:** `sessions.token_hash` stores the SHA-256 hex of the token. The raw token is never stored.
- **Each request** (`/me`, `/sign-out`): the middleware hashes the cookie value and loads the session only if `expires_at` is in the future. An unknown, expired or deleted session gets 401 and the cookie is cleared.

### Layout

- `middleware/validateSignUpMiddleware.js`, `validateSignInMiddleware.js`: zod checks on the request body.
- `middleware/requireSessionMiddleware.js`: session check for protected routes. Sets `request.authenticatedUser`.
- `controllers/authenticationController.js`: HTTP handling and cookie setting.
- `services/authenticationService.js`: sign-up, sign-in and sign-out rules.
- `services/sessionTokenService.js`: token generation and hashing.
- `repositories/*Repository.js`: parameterized SQL, one module per table.
