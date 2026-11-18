# Zenvyro frontend

One React + Vite app serves every Zenvyro screen: the agent inbox, the dashboard, the customer chat widget and a demo storefront. It uses plain CSS modules with design tokens (no Tailwind), JavaScript only, and `useState`, `useEffect` and context (no Redux or React Query). The design plan is in [Design.md](Design.md).

## Setup

```bash
cd frontend
cp .env.example .env      # then set VITE_DEMO_WIDGET_KEY
npm install
npm run dev               # http://localhost:5173
```

The backend must run on `http://localhost:4000` (see the root README). Vite proxies `/api` and `/socket.io` (WebSocket included) to it, so the staff HttpOnly session cookie is same-origin in development. The backend's `CORS_ALLOWED_ORIGINS` must include `http://localhost:5173`.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with the API proxy |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build |
| `npm run lint` | ESLint with the naming rules from ROADMAP.md §5b (`id-length`, `camelcase`) plus React hooks rules |

## Environment variables

Only `VITE_` variables reach the browser, so this file never holds secrets.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_BACKEND_ORIGIN` | `http://localhost:4000` | Where the dev proxy sends `/api` and `/socket.io` |
| `VITE_DEMO_WIDGET_KEY` | none | Widget key that `/demo-store` embeds. Use the value in `businesses.widget_key` (`wk_` + 32 hex characters). |

## Routes

| Route | Screen | Access |
|---|---|---|
| `/sign-in`, `/sign-up` | Auth cards | Public; signed-in users go to `/agent` |
| `/agent` | Agent inbox. `?view=mine\|unassigned\|all` and `?status=…` are kept in the URL | Staff |
| `/agent/conversations/:conversationId` | Inbox with a conversation open | Staff |
| `/dashboard` | Overview (Week 3 placeholder with greeting) | Staff |
| `/widget?key=wk_…&name=…` | Chat widget page, loaded inside the embed iframe | Visitors |
| `/demo-store` | Fictional Acme Shoes store that embeds the widget | Public |

## Embedding the widget

```html
<script src="https://YOUR-ZENVYRO-ORIGIN/zenvyro-widget.js"
        data-widget-key="wk_…" data-business-name="Your shop" async></script>
```

[public/zenvyro-widget.js](public/zenvyro-widget.js) adds one fixed iframe at the bottom-right. The iframe keeps the host site's CSS out. The widget and the loader talk through `postMessage`:

- `zenvyro:widget-ready` (widget → host): the widget asks for the host's viewport.
- `zenvyro:host-viewport` (host → widget): `{ isCompactLayout }`, true at 480px wide or less. The window then fills the screen.
- `zenvyro:widget-state` (widget → host): `{ isOpen }`. The loader resizes the iframe to 88×88 when closed and 402×660 when open (full screen on phones).

`window.ZenvyroWidget.destroy()` removes the widget. The visitor's 30-day session token is stored in the iframe's `localStorage` under `zenvyro.widgetSession.{widgetKey}` and resumed with `GET /api/widget/session`. The visitor socket connects with `auth: { widgetSessionToken }`.

## Design tokens

[src/styles/designTokens.css](src/styles/designTokens.css) defines every colour, radius, spacing step, font size and shadow as a CSS custom property on `:root`. Tokens are named by role (`--color-surface`, `--color-text-muted`), not by colour, so a later dark mode only overrides this block.

| Group | Tokens |
|---|---|
| Brand | `--color-primary` `#5B5BF6`, `--color-primary-hover` `#4A4AE0`, `--color-primary-soft` `#EEF0FF` |
| Surfaces | `--color-app-background` `#F5F6FB`, `--color-surface` `#FFFFFF`, `--color-border` `#E7E8F0` |
| Text | `--color-text` `#1B1D29`, `--color-text-muted` `#6B6F80` |
| Status | success `#16A34A` (Resolved), warning `#F59E0B` (Pending), danger `#EF4444` (Escalated), info `#3B82F6` (Open) |
| AI | `--gradient-ai` from `#6366F1` to `#A78BFA`. Only AI surfaces use it (AI badge, AI message bubbles, and later the AI Activity card and verification panel). |
| Shape | radius 8 / 12 / 20 / pill, 4px spacing scale (`--space-1` … `--space-16`) |
| Type | Inter at 12 / 13 / 14 / 16 / 20 / 28 |

## Components

Each component has its own folder with `ComponentName.jsx`, `ComponentName.module.css` and an `index.js` re-export. Pages in `src/agent`, `src/auth`, `src/dashboard`, `src/widget` and `src/demoStore` only compose them.

| Folder | Components |
|---|---|
| `components/ui` | Button, IconButton, TextInput, TextArea, Select, Avatar, StatusPill, ModeBadge, LabelChip, Tabs, Card, EmptyState, Spinner, Toast, CountryFlag, RelativeTime, BrandLogo |
| `components/layout` | AppShell, Sidebar, SidebarNavItem, Navbar, UserMenu, Footer, PageHeader |
| `components/sections` | AuthCardSection, HeroSection, ProductGridSection, FeatureHighlightsSection |
| `components/inbox` | ConversationListPane, ConversationListItem, ConversationThreadPane, ThreadHeader, MessageBubble, DaySeparator, ReplyComposer, ConversationDetailsPane, ConversationActionsCard, LabelPickerPopover, CustomerOriginCard |
| `components/widget` | ChatLauncherButton, ChatWindow, ChatWindowHeader, ChatMessageList, ChatMessageBubble, ChatComposer, PreChatForm |

Reserved slots for later weeks: `ReplyComposer` takes a `reviewPanel` prop for the Week 2 `SuggestedReplyReviewPanel`. The details pane has an Order history card for Week 3. Rules and Knowledge base are disabled "Soon" items in the sidebar.

## Data layer

- [src/api/apiClient.js](src/api/apiClient.js): a `fetch` wrapper with `credentials: 'include'`. Every error becomes one `ApiRequestError` with `statusCode` and the server's message. There is one module per domain: `authenticationApi`, `conversationsApi`, `labelsApi`, `widgetApi`.
- Hooks in `src/hooks`:
  - `useCurrentUser` (`SessionProvider`)
  - `useConversationList` (cursor pages; refetches every 20s)
  - `useConversation`
  - `useConversationMessages` (older pages and live appends, deduplicated by id)
  - `useLabels`
  - `useRealtimeSocket`, `useConversationRoom`, `useMessageCreatedListener`
  - `useWidgetChat`
  - `useToast`

## Known backend gaps

These need backend commits. The frontend works around them for now.

1. **The seeded widget key fails validation.** `backend/db/seed.sql` uses `wk_acme_demo_local_only`, but `validateStartWidgetSessionMiddleware` only accepts `wk_` + 32 hex characters. Until the seed is fixed, use the key of a business created through sign-up.
2. **`GET /me` has no business name.** The sidebar shows the name saved at sign-up on this device, or "Your workspace".
3. **The conversation list has no last-message preview.** List rows show the customer's email instead.
4. **The widget session responses have no business name.** The loader passes it with `data-business-name`.
5. **There is no staff list endpoint** (`GET /api/users`). Assignment offers only "Assign to me" and "Unassign".
6. **Realtime only covers the open conversation's room.** The list refetches every 20s and on every `message:created`. A per-business room with `conversation:created` and `conversation:updated` events would make the list fully live.
