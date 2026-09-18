<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Finance Tracker — agent guide

Simple AI-assisted personal finance tracker. Next.js 16 App Router + React 19 + Tailwind CSS 4. Single-password gate, multi-workspace transactions/budgets, CSV import, receipt OCR, and tool-calling chat.

## Commands

- `npm run dev` — local dev (http://localhost:3000)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — eslint (`eslint-config-next` core-web-vitals + typescript)
- No test runner, Makefile, or CI configured.

## Env

Copy `.env.local.example` to `.env.local`:

- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` — any OpenAI-compatible endpoint (chat in `app/api/chat/route.ts`, receipt structuring in `app/api/ocr/route.ts`). `lib/openai.ts` falls back to `gpt-4o-mini` / `"placeholder"` key.
- `OCRSPACE_API_KEY` (required for Scan) — ocr.space extracts receipt text, `OPENAI_MODEL` structures it into a transaction list (`lib/ocrSpace.ts`). Without the key `/api/ocr` answers 503.
- `DATABASE_URL` — unset = local SQLite at `data/finance.db` (gitignored, WAL mode); set = Postgres via `pg` + Drizzle. Driver is picked once in `lib/db/client.ts` (`dialect`).

## Structure

- `app/layout.tsx` — fonts (Atkinson Hyperlegible + Geist Mono), theme-init script, `AuthGate > WorkspaceProvider` wrapper.
- `app/page.tsx` — main dashboard (summary, filters, debounced search box, paged list, add form, receipt upload, chat widget).
- `app/budget/page.tsx` — monthly budget vs. spent by category (`?month=YYYY-MM&type=`).
- `app/api/` — `transactions/`, `transactions/[id]/`, `transactions/bulk/`, `accounts`, `budgets`, `categories`, `workspaces`, `chat`, `ocr`, `auth/{setup,login,logout,status,change}`.
- `lib/db/` — `client.ts` (dialect + init/seed), `schema.sqlite.ts` / `schema.pg.ts`, `queries.ts` (all SQL lives here). `lib/db.ts` is just a barrel — `import { ... } from "@/lib/db"`.
- `lib/` — `auth.ts` (scrypt + session), `workspace.ts` (`getWorkspaceId`), `apiFetch.ts` (workspace header), `openai.ts`, `importCsv.ts` (CSV row validation), `format.ts` (`fmtCurrency`: `id-ID`/`IDR`), `types.ts`, `ui.ts` (`ICON_BTN` 44px tap target), `search.ts` (`toLikePattern` LIKE escaping), `chatHistory.ts` (chat session persist/restore), `ocrSpace.ts` (ocr.space client + structuring prompt).
- `components/` — one feature per file (`AddTransactionForm`, `TransactionList`, `FilterBar`, `ImportCsv`, `ReceiptUpload`, `ChatPanel`/`ChatWidget`, `CategoryManager`, `AccountManager`, `WorkspaceSwitcher`/`WorkspaceProvider`, `AuthGate`, `SettingsMenu`, `ThemeToggle`, `LogoutButton`, `SummaryCards`).
- Path alias: `@/*` maps to repo root. TS `strict`, `noEmit`, `moduleResolution: bundler`.

## Database

- Every data table (`transactions`, `accounts`, `categories`, `budgets`) is scoped by `workspace_id`. `workspaces` has `id, name (unique), created_at`.
- Defaults are seeded on init: accounts `Cash, Bank, Credit Card, E-Wallet`; categories Food/Transport/Bills/Health/Entertainment/Shopping/Other (expense) + Salary/Gift/Investment/Other (income).
- SQLite init runs inline DDL in `lib/db/client.ts`, including renames from the old `projects`/`project_id` naming — keep that migration block when touching init.
- No Drizzle migrations / `drizzle.config` — schema changes must update **both** `schema.sqlite.ts` and `schema.pg.ts` plus the SQLite DDL.

## Auth + workspace conventions (follow for every API route)

1. `const unauthorized = await requireAuth(req); if (unauthorized) return unauthorized;` — returns 401 JSON, reads `session` httpOnly cookie, 30-day TTL (`sessions` table).
2. `const workspaceId = await getWorkspaceId(req);` — reads `x-workspace-id` header, falls back to first workspace (never 500 on missing header).
3. Password = base + rotating 4-digit suffix in UTC+7: `(dayOfMonth+27)(hour+10)` — see `lib/auth.ts:expectedSuffix`. First-time setup goes through `/api/auth/setup`; login issues a 32-byte hex token cookie.

## Frontend conventions

- Client-side data fetching must use `apiFetch()` from `lib/apiFetch.ts`, never bare `fetch()` (except `/api/workspaces` bootstrap in `WorkspaceProvider`), so the workspace header is attached. Gate workspace-dependent loads on `ready` from `useWorkspace()`.
- `GET /api/transactions` does server-side filter/pagination (`category, account, from, to, q, limit, offset`); it fetches `limit+1` rows to compute `hasMore` without a COUNT. Keep `PAGE_SIZE = 30` in sync between `app/page.tsx` and the route. `q` matches description/category/account case-insensitively via `lower()` LIKE (`lib/search.ts` escapes `%_\\`); `summarize()` honors it too so the summary cards reflect search results.
- POST validation returns 400 `{ error: "missing fields" }`; OCR returns 503 without `OCRSPACE_API_KEY`, 422 on unreadable/unparseable receipts. New transactions default `account` to `"Cash"`.
- Styling: Tailwind 4 (`@import "tailwindcss"`, `@custom-variant dark`). Dark mode is a `.dark` class on `<html>` set pre-hydration from `localStorage("theme")` — don't switch to `media`-only dark mode. Reuse `ICON_BTN` for icon-only buttons and `fmtCurrency` for money.
- Chat tools (`add_transaction`, `get_summary`, `list_transactions`) are defined in `app/api/chat/route.ts`; the OCR structuring prompt (`lib/ocrSpace.ts`) expects a strict JSON array of `{date, description, category, amount, type}` (one object per receipt line item); `ReceiptUpload` shows each as an editable draft and saves via `POST /api/transactions/bulk`. CSV parsing (`parseImportRow`) tolerates header casing, infers `type` from amount sign, strips non-numeric chars.
- Chat history persists per device in `localStorage` (`chat-history:<workspaceId>`, see `lib/chatHistory.ts`): same-day sessions resume, a new day starts fresh, and the New chat button resets. `ChatWidget` remounts `ChatPanel` per workspace via `key` — pass `workspaceId` as a prop.

## Production (Vercel)

- `DATABASE_URL` is mandatory in production: without it the app falls back to SQLite, which crashes on Vercel's read-only filesystem (`data/` can't be created) — every API route 500s and `AuthGate` sits on its blank loading state forever. Use the provider's pooled/serverless URL with `?sslmode=require` (the installed `pg` honors it; no driver config needed).
- Schema + seeds self-apply on first request (`initPg()` DDL); there is no migration step.
- Env vars must cover the environment being tested (Preview vs Production redeploys separately); Deployment Protection puts the whole site behind a Vercel login.
