# Zenvyro Frontend Design

## Context
Week 1 backend is done on `backend` (auth, conversations REST, Socket.IO rooms, widget sessions, assignment + labels, geo origin). `frontend/` holds only empty folders (`src/{dashboard,agent,widget,components,api,hooks,styles}`); roadmap item 1's frontend scaffold never shipped. Week 1's exit goal is still open: "a customer and a human agent can chat end-to-end, and the agent sees the customer's country." It needs UI. This plan sets one design system for all three surfaces in `Design inspiration/` (1 = dashboard, 2 = widget, 3 = agent inbox). It builds the Week 1 screens now and reserves layout slots for the Week 2 and 3 screens, so later work fills slots without redesigning.

Roadmap rules this plan follows:
- React + Vite, one app with `/dashboard`, `/agent`, `/widget`.
- Plain CSS modules with design tokens (decision 10.5). No Tailwind.
- JavaScript, English only.
- Naming standards from §5b: PascalCase components, `use…` hooks, no `res`/`data`/`msg` names. ESLint enforces `id-length` and `camelcase`.
- Work stays in `frontend/` on the `frontend` branch, one feature per commit. Claude writes only the commit messages; you commit and push.
- Secrets live only in `frontend/.env`, with a committed `.env.example`.
- The brand is **Zenvyro**. Never copy the "Relay", Crisp or Chatwoot names, logos or art.

## 1. Design system (`frontend/src/styles/`)
- `designTokens.css`: CSS custom properties on `:root`, taken from 1.jpeg:
  - Primary indigo `#5B5BF6`; hover `#4A4AE0`; soft `#EEF0FF` for the active nav item and table header.
  - App background `#F5F6FB`, surface `#FFFFFF`, border `#E7E8F0`.
  - Text `#1B1D29`, muted text `#6B6F80`.
  - Status colors: success `#16A34A` (Resolved), warning `#F59E0B` (Pending), danger `#EF4444` (Escalated/urgent), info `#3B82F6` (Open).
  - AI accent: a gradient from `#6366F1` to `#A78BFA`. Only AI surfaces use it (AI Activity card, AI message bubbles, verification panel), so AI output always looks different from human output.
  - Radius 8/12/20/pill. Spacing on a 4px scale. Font Inter (Google Fonts) at 12/13/14/16/20/28.
  - Soft card shadow.
- `globalStyles.css`: reset, body background, focus rings, scrollbar.
- Dark mode is deferred. Tokens are named by role (`--color-surface`), not by color, so dark mode only needs a token override later.

### Components folder, divided by role (`src/components/`)
Each component gets its own folder holding `ComponentName.jsx`, `ComponentName.module.css` and an `index.js` re-export. Pages in `src/agent`, `src/widget`, `src/dashboard`, `src/auth` and `src/demoStore` only compose these components. They hold no large markup of their own.

```
src/components/
├── ui/          base building blocks
│   Button, IconButton, TextInput, TextArea, Select, Avatar (initials, online dot),
│   StatusPill (open/pending/resolved/escalated), ModeBadge (AI/Human), LabelChip,
│   Tabs (with counts, e.g. "Mine 4 · Unassigned 0 · All 250"), Card, EmptyState,
│   Spinner, Toast, CountryFlag (flagImageUrl → country code fallback), RelativeTime
├── layout/      page frame pieces
│   AppShell, Sidebar, SidebarNavItem, Navbar (top bar: title, greeting, search, avatar),
│   UserMenu, Footer, PageHeader
├── sections/    full-width page sections
│   HeroSection, ProductGridSection, FeatureHighlightsSection (demo store),
│   AuthCardSection (sign-in / sign-up frame), KpiCardsSection (Week 3)
├── inbox/       agent inbox pieces
│   ConversationListPane, ConversationListItem, ConversationThreadPane, ThreadHeader,
│   MessageBubble, DaySeparator, ReplyComposer, ConversationDetailsPane,
│   ConversationActionsCard, LabelPickerPopover, CustomerOriginCard,
│   SuggestedReplyReviewPanel (Week 2 slot)
└── widget/      customer chat widget pieces
    ChatLauncherButton, ChatWindow, ChatWindowHeader, ChatMessageList,
    ChatMessageBubble, ChatComposer, PreChatForm
```
- The demo storefront page is built from `Navbar`, `HeroSection`, `ProductGridSection` and `Footer`.
- Staff pages are built from `AppShell`, which combines `Sidebar` and `Navbar`.
- Icons come from `lucide-react` at a pinned version.

## 2. App structure and data layer
- Routes (`react-router-dom`):
  - `/sign-in`, `/sign-up`
  - `/agent` (inbox) and `/agent/conversations/:conversationId`
  - `/dashboard` (Week 3 placeholder)
  - `/widget` (iframe page)
  - `/demo-store` (demo storefront)
- `src/api/apiClient.js`: a `fetch` wrapper with `credentials: 'include'` that turns error bodies into one `ApiRequestError`. One module per domain: `authenticationApi.js`, `conversationsApi.js`, `labelsApi.js`, `widgetApi.js`.
- `vite.config.js` proxies `/api` and `/socket.io` (with `ws: true`) to `http://localhost:4000`, so the staff HttpOnly cookie is same-origin in dev. The Socket.IO server's `CORS_ALLOWED_ORIGINS` must include the Vite origin.
- Hooks:
  - `useCurrentUser` (a `SessionProvider` context backed by `GET /me`)
  - `useConversationList(view, status)` (cursor pagination, "Load more")
  - `useConversationMessages(conversationId)` (paged history plus live appends, deduplicated by id)
  - `useRealtimeSocket()` (one shared socket; emits `conversation:join` and `conversation:leave` on route change; listens for `message:created`)
- Plain `useState`, `useEffect` and context. No Redux or React Query, to match the "plain" stack.

## 3. Screens: Week 1 (build now)

### 3.1 Auth (`src/auth/`)
- A centered card on the lavender background, with the Zenvyro wordmark.
- Sign-in fields: email, password.
- Sign-up fields: business name, owner name, email, password.
- Errors appear inline under each field. On success, go to `/agent`.
- `ProtectedRoute` sends signed-out users to `/sign-in`.

### 3.2 App shell (`src/components/layout/AppShell/`, layout from 1.jpeg)
The left sidebar (240px, collapsible to icons) has:
- Zenvyro logo and the business name, read-only. The dropdown is deferred.
- **Main:** Overview, Inbox, Assigned to me.
- **Workspace:** Rules, Knowledge base. Both are disabled with a "Soon" tag until Week 2–3.
- **Channels:** Website Chat. Email and WhatsApp are not shown, since they are post-MVP.
- Footer: user card with name, role and a sign-out menu.

The top bar has the page title, a "Good morning, {name}" greeting on Overview only, and the avatar.

### 3.3 Agent inbox (`src/agent/`, layout from 3.jpeg, three panes)
| Pane | Width | Content |
|---|---|---|
| `ConversationListPane` | 340px | Search box (client-side filter for MVP). `Tabs`: Mine / Unassigned / All (`view` query). A status `Select` (open/pending/resolved/escalated). `ConversationListItem` rows: avatar, customer name, channel tag, flag, last-message preview, relative time, `StatusPill`, `ModeBadge`. "Load more" at the end for the cursor. |
| `ConversationThreadPane` | flex | Header: customer name, flag + country, `StatusPill`, `ModeBadge`, and a status-change menu (Resolve / Reopen / Pending). `MessageBubble` list grouped by day: customer messages on the left in grey, agent messages on the right in indigo, AI messages on the right with the AI gradient and a sparkle icon, system messages centered and muted. `ReplyComposer`: a "Reply to customer" tab (the "Private note" tab is shown disabled, as notes are deferred), auto-growing textarea, Enter to send, Shift+Enter for a new line, Send button. While the conversation is resolved, the composer is disabled and shows a "Reopen" call to action, matching the backend's 409-style rule. |
| `ConversationDetailsPane` | 300px, collapsible | **Conversation actions** card (3.jpeg): assigned agent with "Assign to me" and "Unassign" (`PATCH assignedAgentId`), plus the labels list with `LabelChip` remove and an "Add label" popover that can also create a label (`GET`/`POST /api/labels`, `PUT /conversations/:id/labels`). **Customer origin** card (item 7b): large flag, country name, region, languages, currencies, detected time. If `origin.status` is not detected, it shows "Location unavailable". The **Order history** slot holds a placeholder until Week 3 item 16. |

Empty states: "No conversation selected", "No conversations in this view".

### 3.4 Customer widget (`src/widget/`, 2.jpeg-style)
- `ChatLauncherButton`: a 56px indigo circle at bottom-right that toggles between a chat icon and a close icon.
- `ChatWindow`: 370×560 on desktop and full-screen on mobile. It has:
  - a header with the business name and green online dot, and a "Chat" tab (the "Help center" tab is deferred);
  - a day separator, then visitor bubbles on the right in grey and business/agent bubbles on the left in indigo with the business avatar;
  - a composer with the placeholder "Compose your message…".
- Pre-chat step (optional): a name and email form before `POST /api/widget/sessions`. "Skip" uses "Website visitor".
- The session token is saved in iframe `localStorage` under the key `zenvyro.widgetSession.{widgetKey}`, so the 30-day session resumes through `GET /api/widget/session`.
- The socket connects with `auth: { widgetSessionToken }`.
- **Embedding:** `public/zenvyro-widget.js` is a small loader that adds the launcher and an `<iframe src="{origin}/widget?key=…">`. The iframe keeps the host site's CSS out. This meets the "standalone embeddable bundle" goal with no second build.
- `/demo-store`: a simple fictional "Acme Shoes" storefront (hero, product grid) that embeds the loader. The Week 1 end-to-end demo runs on this page. It is original art and copy, not a copy of the Crisp demo.

## 4. Screens reserved for later (design spec now, build in their weeks)
- **Week 2, item 11, `SuggestedReplyReviewPanel`:** a slide-up panel above the `ReplyComposer` that the composer already has a slot for. It shows Grammar, Policy and Tone verdict badges (Passed in green, Failed in red, Needs improvement in amber), a list of issues, and the original and suggested replies side by side with a word diff. Buttons: Approve (sends the suggestion), Edit (puts the suggestion in the composer), Reject (keeps the original and returns to editing). Send stays disabled until a verdict is chosen.
- **Week 2, item 14:** an AI/Human mode toggle in the thread header, an "Escalated" banner on the thread, and an Escalated filter in the list.
- **Week 3, item 18, Overview (1.jpeg layout):** four KPI cards with change vs yesterday, a conversation volume line chart (Recharts), an AI Activity card with the gradient, tickets by category as horizontal bars, a CSAT donut and a recent conversations table.
- **Week 3, item 19:** Rules and Knowledge base pages, each a table with a create/edit drawer.

## 5. Backend gaps found (separate commits on `backend`, not `frontend`)
1. There is no staff list endpoint, so assignment can only offer "Assign to me" and "Unassign". Add `GET /api/users` (business-scoped) to enable an agent picker. This is optional for Week 1.
2. Realtime only covers `message:created` inside a conversation room. The inbox list will not see new conversations or new messages in conversations that are not open. For the MVP, the frontend refetches the list every 20s and on `message:created`. A follow-up backend commit can add a per-business room with `conversation:created` and `conversation:updated` events.

## 6. Commit sequence (frontend branch, one feature each)
1. `chore(frontend): scaffold React + Vite app with router, eslint naming rules, api client, dev proxy and .env.example`
2. `feat(ui): design tokens, global styles and shared base components`
3. `feat(auth-ui): sign-in and sign-up pages, session provider, protected routes and app shell sidebar`
4. `feat(agent-inbox): conversation list pane with Mine / Unassigned / All tabs, status filter and pagination`
5. `feat(agent-inbox): conversation thread with message bubbles, reply composer and realtime message:created`
6. `feat(agent-inbox): conversation actions panel (assign, status, labels) and customer origin card`
7. `feat(widget): customer chat widget with launcher, session start/resume and realtime thread`
8. `feat(widget): embed loader script and Acme Shoes demo storefront`
9. `docs(frontend): frontend README (setup, env vars, routes, design tokens, component list)`

Key files: `frontend/package.json`, `frontend/vite.config.js`, `frontend/eslint.config.js` (copy the rules from `backend/eslint.config.js`), `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/designTokens.css`, `frontend/src/api/apiClient.js`, `frontend/src/agent/AgentInboxPage.jsx`, `frontend/src/widget/ChatWindow.jsx`, `frontend/public/zenvyro-widget.js`.
Backend contracts used: `backend/src/routes/*.js`, `backend/src/services/conversationsService.js` (`toPublicConversation` and `toPublicMessage` shapes), and `backend/src/realtime/realtimeEventNames.js`.

## 7. Verification
1. `docker compose up -d`, then run the backend and `npm run dev` in `frontend/`.
2. Sign up a business, then sign in. Use the seeded widget key, or the one from `businesses.widget_key`.
3. Open `/demo-store` in a private window and send a message from the widget. It should appear live in the agent's **Unassigned** tab and thread.
4. As the agent, click "Assign to me" (it moves to **Mine**), add a label and reply. The reply should appear live in the widget.
5. Check the origin card. Locally it should show "Location unavailable", since private IPs fall back. Behind a public IP or a mocked lookup, it should show the flag and country.
6. Resolve the conversation: the composer locks. Reopen it: sending works again.
7. Reload the widget: the session resumes with its history.
8. Run `npm run lint` and confirm there are no naming-rule violations. Compare each screen side by side with 1.jpeg, 2.jpeg and 3.jpeg.
