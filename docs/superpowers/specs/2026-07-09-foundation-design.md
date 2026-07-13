# WorkOS Foundation Slice — Design

Date: 2026-07-09
Status: Approved by user (conversation), pending spec review

## Scope

First working slice of WorkOS: authentication, RBAC, minimal org data model,
and the base app shell — wired end to end. Everything else in the PRD
(dashboards with real widgets, projects, tasks, kanban, calendar, follow-ups,
notifications, AI) is explicitly out of scope for this slice.

## Decisions (from brainstorming)

- Backend lives in **`backend/`** in this repo (user restructured to a monorepo on 2026-07-09), created
  from scratch (Express + MongoDB + Mongoose per AGENT.md).
- MongoDB is **external** — user provides a connection string in `.env`.
  No Docker Compose Mongo service.
- **All 4 roles** from day one: `admin`, `manager`, `sublead`, `member`.
- Approach **B**: full User/Department/Team schema + RBAC middleware now;
  org-management UI deferred to the Module 2 slice. Seed script creates the
  first Admin.
- Frontend and backend built together, **wired end to end** — login works
  for real by the end of this slice.

## Backend (`backend/`)

Folder structure per AGENT.md: `src/{controllers,routes,models,middleware,
services,validators,utils,config,constants,db}`.

### Models (`src/models/`)

- `User.js` — name, email (unique), password (bcrypt hash), role
  (enum: admin/manager/sublead/member), designation, department (ref),
  team (ref), reportingManager (ref User), isActive (default true),
  refreshToken (single string field — single-session per AGENT.md's example;
  multi-device sessions out of scope).
- `Department.js` — name, description.
- `Team.js` — name, department (ref).

### Auth

- `POST /api/auth/login` — verify credentials, return access token (15m) in
  response body, set refresh token (7d) as HTTP-only cookie, store refresh
  token on the User doc.
- `POST /api/auth/refresh` — validate cookie token against DB, rotate, issue
  new access token.
- `POST /api/auth/logout` — clear cookie, null out stored refreshToken.
- `GET /api/auth/me` — return current user (populated department/team).
- Middleware: `authenticate` (verifies access token), `authorize(...roles)`.
- Env: `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`,
  `ACCESS_TOKEN_EXPIRES=15m`, `REFRESH_TOKEN_EXPIRES=7d`, `MONGODB_URI`,
  `CLIENT_ORIGIN`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

### User management (admin-only)

- `POST /api/users` — create user (admin only).
- `GET /api/users` — list users (admin only).
- `PATCH /api/users/:id` — update role/department/team/reportingManager,
  deactivate (admin only).
- Request validation on all write endpoints (validators/).

### Bootstrapping

- `scripts/seed.js` — creates the first Admin from `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` if no admin exists. No public signup route.

### Error handling

- try/catch in controllers, `{ success, message, data? }` envelope per
  AGENT.md, catch-all error middleware.
- CORS configured for `CLIENT_ORIGIN` with credentials.

### Verification

- `scripts/smoke-auth.js` — axios script against a running server:
  login → me → refresh → logout, asserting each response. The one runnable
  check for the auth path; no test framework.

### Docker

- `Dockerfile` + `.dockerignore`. No docker-compose yet (single service,
  external DB) — add when nginx/frontend containers join.

## Frontend (`frontend/`)

JavaScript only, App Router, Tailwind, per AGENT.md. Read
`node_modules/next/dist/docs/` guides before writing code (AGENTS.md
warning: breaking changes vs training data).

### Structure

- `services/axiosInstance.js` — baseURL from `NEXT_PUBLIC_API_URL`,
  `withCredentials: true`; request interceptor attaches in-memory access
  token; response interceptor retries once via `/auth/refresh` on 401,
  redirects to `/login` on failure.
- `services/authService.js` — login/logout/refresh/me calls.
- `store/authStore.js` — Zustand; `user` + `accessToken` in memory only.
- `app/login/page.js` — React Hook Form + Yup; inline errors.
- `app/(app)/layout.js` — authenticated shell: Sidebar + Header + content
  area; redirects to `/login` when unauthenticated.
- `components/layout/Sidebar.jsx` — 280px expanded / 80px collapsed,
  collapsible with 150–250ms ease animation, icon+label nav
  (Dashboard, Calendar, Projects, Tasks, Follow-ups, Team, Notifications,
  Settings), current-page left indicator + background highlight.
- `components/layout/Header.jsx` — page title, search placeholder,
  notifications placeholder, user menu with logout.
- `app/(app)/dashboard/page.js` — role-aware placeholder proving the
  auth+RBAC pipe end to end (shows user name, role, role-specific heading).
  Real widgets are a later slice.

### Design tokens

Extend Tailwind/globals with DESIGN.md tokens: Inter font, 8pt spacing
scale, radius scale (cards 16, buttons/inputs 10, dialogs 18, dropdowns 12,
badges 999), semantic color CSS variables (primary, background, surface,
border, success, warning, danger, info) — light theme now, dark-ready.
No raw hex in components. Icons: lucide-react, outline, 16–24px.
Minimalist editorial styling; animations fade/slide/scale/collapse only,
150–250ms, no bounce/elastic.

### Error handling

- Yup inline validation errors below inputs.
- Inline error banner for API failures. No toast library (notifications are
  Module 12's slice).

## Out of scope (this slice)

Department/Team management UI, dashboards with widgets, personal time board,
follow-ups, projects/modules/tasks, kanban, calendar, notifications,
activity timeline, all AI features, dark mode toggle, global Ctrl+K search,
password reset (needs email infra — deferred), profile management UI.

## Success criteria

1. `node scripts/seed.js` creates an admin; `scripts/smoke-auth.js` passes.
2. Login page → dashboard shell works in the browser against the real
   backend; refresh token flow survives access-token expiry; logout
   invalidates the session.
3. Admin can create a user via API (curl/smoke script) and that user can
   log in and sees a member dashboard placeholder.
4. UI matches DESIGN.md tokens (spacing, radius, Inter, semantic colors).
