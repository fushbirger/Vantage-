# Vantage

**Brunei's effortless, non-custodial group expense splitter and money-pooling companion.**

<div align="center">
  <img src="assets/logo.png" width="200" alt="Vantage Logo">
</div>

Vantage keeps the shared ledger, nets out who owes whom, and routes each remaining transfer to a local payment rail (tarus, tarusQR or Pocket). It never holds, stores or moves your money — there is no wallet and no float. You settle directly from your own bank account, then confirm the ledger entry.

> **Non-custodial by design.** Vantage is a smart ledger and payment-routing layer, not an e-money issuer. It does not process card payments, store balances, or act as an intermediary. See [Non-custodial model](#non-custodial-model).

---

## Table of contents

- [What is implemented](#what-is-implemented)
- [Quickstart](#quickstart)
- [Demo accounts](#demo-accounts)
- [Stack](#stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Debt simplification](#debt-simplification)
- [Split rules](#split-rules)
- [Multi-currency](#multi-currency)
- [Payment routing and settlement lifecycle](#payment-routing-and-settlement-lifecycle)
- [Virtual pools](#virtual-pools)
- [WhatsApp integration](#whatsapp-integration)
- [API routes](#api-routes)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Design decisions and trade-offs](#design-decisions-and-trade-offs)
- [Production hardening checklist](#production-hardening-checklist)
- [Legacy prototype](#legacy-prototype)

---

## What is implemented

### 1. Tracker — expense and pooling ledger

- **Groups** for trips, dinners, gifts, households and one-off plans, with emoji, type, note and member selection.
- **Expenses** with:
  - receipt photo upload (camera or file picker, compressed client-side);
  - optional itemisation (`items_json`) for receipt lines;
  - four split rules — equal, exact amounts, percentages and weighted shares;
  - multi-currency entry (BND, MYR, SGD, USD) auto-converted to BND with an editable per-expense FX rate;
  - payer, category, date and notes.
- **Group dashboard** with totals, your net position, members, simplified transfers, pools, recent payments and expandable expense details.
- **Virtual pools** with goals, deadlines, member pledges and "already handed over" status. No cash is collected by the app.

### 2. Simplification — debt minimisation engine

- Greedy **min-cash-flow** algorithm that nets multi-person chains (`A → B → C` becomes `A → C`).
- Produces at most `n − 1` transfers for `n` members and is deterministic.
- Balances account for expenses, splits and **completed** settlements only; pending claims do not move the ledger.
- Unit-tested (see [Testing](#testing)).

### 3. Payment routing — tarus and Pocket

- Per-user **payment profile** with a preferred rail:
  - **tarus** proxy / phone number,
  - **tarusQR** image upload,
  - **Pocket** payment link.
- **Settle Up** screen shows the exact BND amount, the creditor's QR/proxy/link, and a one-tap *Copy amount & payment details* button.
- **Mark as paid** flow with optional payment screenshot.
- Recipient **confirms** (ledger becomes square) or **rejects** the claim.
- A recipient can also record an incoming payment directly as *Received* — it completes immediately.
- Friendly **WhatsApp reminders** with a deep link to the group's Settle Up page.
- Duplicate pending claims for the same transfer are blocked, and the debtor's card switches to *Awaiting confirm*.

### 4. WhatsApp integration

- Modular service layer + **Cloud API webhook** (verification + event persistence).
- **Outbox** for every notification, visible in the Activity screen with retry support.
- Automated messages for: expense added, pool created, pool pledge, payment marked, payment confirmed, payment rejected, payment reminder and group invite.
- **Share Summary to WhatsApp** on every group dashboard (and the settle page) using `https://wa.me/?text=...` with a formatted expense/settlement breakdown and a deep link.
- **Simulation mode** when Cloud API credentials are absent — the whole flow stays demoable without Meta approval.

---

## Quickstart

**Requirements:** Node.js 22+ and npm 9+.

```bash
cd ~/Projects/Vantage-
npm install
npm run dev
```

Open <http://localhost:3000>. On first run Vantage creates `data/vantage.db`, applies `db/schema.sql` and seeds a demo workspace — no database server or migration step is required.

Optional configuration:

```bash
cp .env.example .env.local
```

Everything works with defaults. `.env.local` only matters for a custom session secret, a different SQLite path, or live WhatsApp delivery.

### Reset the demo data

```bash
# stop the dev server first, then:
npm run db:reset
npm run dev
```

The database is re-created and re-seeded on the next request.

---

## Demo accounts

Authentication is demo-only: pick a seeded account, no password. Sessions are HMAC-signed httpOnly cookies.

| Name | Username | Phone | Good for |
| --- | --- | --- | --- |
| Aiman | `@aiman` | +673 812 3456 | Owner of **Miri Road Trip**; owes Sofia BND 68.15 |
| Nurul | `@nurul` | +673 823 4567 | Has a **pending payment claim from Hakim** in Friday Dinner to confirm |
| Hakim | `@hakim` | +673 834 5678 | Owes Sofia in the Miri trip; Pocket rail |
| Sofia | `@sofia` | +673 845 6789 | Main creditor in **Miri Road Trip** (owed BND 291.66) |
| Faridah | `@faridah` | +673 856 7890 | Owes Sofia BND 104.33 |

**Suggested tour**

1. Sign in as **Aiman** → open **Miri Road Trip** → expand an expense, check the splits, then open **Settle up** and see four simplified transfers to Sofia.
2. Mark Aiman's BND 68.15 transfer as paid (add a note/screenshot if you like).
3. Sign out, sign in as **Sofia** → **Settle up** shows Aiman's claim under *Awaiting confirmation* — confirm it and Aiman becomes square.
4. Sign in as **Nurul** → **Activity** (or **Friday Dinner → Settle up**) has a pending claim from Hakim to confirm.
5. Visit **Account** to edit your payment rails, then open any group and use **Share** to send the summary to WhatsApp.

New accounts can also be created from the login screen (display name, username, phone). They start with no groups.

---

## Account connections and multi-side confirmation

Nobody can put an expense on another person's ledger on their own.

- **People (`/connections`)** — connect by username. A request must be accepted
  by the other person (crossing requests auto-accept). Only accepted
  connections can be invited to a group.
- **Invitations** — the group owner invites connections; they stay `invited`
  (no ledger access, cannot be in a split or settlement) until they accept or
  decline. The owner can withdraw a pending invitation.
- **Multi-side confirmation** — a per-group switch (owner only, on by default).
  When on, an expense needs a yes from the payer and from every person in the
  split, except its author (submitting is the author's yes). It stays
  `pending` and out of balances and totals until everyone confirms; one *no*
  marks it `rejected`. The author can withdraw anything not yet confirmed.
  Every answer is notified over WhatsApp (simulated without credentials).
- **Existing databases** — `db.ts` migrates old databases once
  (`PRAGMA user_version = 1`): adds the new columns, marks existing expenses
  confirmed, and connects people who already share a group.

New routes: `GET/POST /api/connections`, `PATCH/DELETE /api/connections/[id]`,
`PATCH /api/groups/[id]` (`requireConfirmation`), `POST /api/groups/[id]/invite`,
`POST/DELETE /api/groups/[id]/members`, `POST /api/expenses/[id]`
(`confirm` / `reject` / `withdraw`).

Demo data adds **dayang** (a request waiting for Aiman, and an invitation to
Friday Dinner) and one pending expense, "Ice cream — Pelita Mall", waiting for
Aiman and Sofia.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, server components, route handlers) |
| UI | React 19, TypeScript (strict), Tailwind CSS 3 |
| Icons | lucide-react |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Tests | Vitest |
| Styling | Manrope + Fraunces, mobile-first with safe-area support |

The app is a single Next.js project; there is no separate backend service. Data access lives in `src/lib/queries.ts` and talks to SQLite synchronously, which keeps the MVP easy to run and audit. The domain logic (splits, balances, simplification, currency) is pure TypeScript and independently testable.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│  Server components (pages) + client modals/forms             │
└───────────────┬──────────────────────────────────────────────┘
                │ fetch / server actions via route handlers
┌───────────────▼──────────────────────────────────────────────┐
│ src/app/api/**                                               │
│  auth · groups · expenses · pools · pledges · settlements    │
│  profiles · payment profiles · WhatsApp webhook/outbox       │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Domain + data layer (src/lib)                                │
│  split.ts        split engine (largest remainder)            │
│  balances.ts     net positions from ledger entries           │
│  simplify.ts     greedy min-cash-flow                        │
│  currency.ts     minor units, FX, formatting                 │
│  queries.ts      typed SQLite reads/writes                   │
│  notify.ts       notification fan-out + opt-out              │
│  whatsapp.ts     Cloud API sender, outbox, retry              │
│  wa.ts           message builders, wa.me links               │
│  db.ts           schema bootstrap + demo seed                │
└───────────────┬──────────────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │ SQLite (WAL)   │  data/vantage.db
        └────────────────┘
```

Key invariants:

- All ledger amounts are stored as **integer BND cents** (`amount_bnd_cents`).
- The original amount, currency and FX rate are kept for auditability.
- Balances and simplification are derived on read — there are no denormalised balance columns to drift.
- Pending settlements are excluded from balances until the recipient confirms.

---

## Data model

Schema: [`db/schema.sql`](db/schema.sql).

| Table | Purpose |
| --- | --- |
| `users` | Demo accounts: username, display name, phone, avatar colour. |
| `payment_profiles` | Preferred rail, tarus proxy, tarusQR data URL, Pocket link, WhatsApp opt-in. |
| `groups` | Group name, emoji, kind (`trip`, `dinner`, `gift`, `home`, `other`), description, owner. |
| `group_members` | Join table with `owner`/`member` role; unique per group+user. |
| `expenses` | Original `amount_cents` + `currency` + `fx_rate_to_bnd`, canonical `amount_bnd_cents`, split rule, receipt data URL, itemisation JSON, notes, spent date. |
| `expense_splits` | Per-member BND share plus optional `share_units` / `percent`, unique per expense+user. |
| `settlements` | Peer-to-peer payment claims: from/to, BND amount, status (`pending` / `completed` / `rejected`), rail, optional proof screenshot, note, timestamps. |
| `pools` | Virtual pooling goal: title, note, goal in BND, deadline, creator. |
| `pool_pledges` | Per-member pledge amount and status (`pledged` / `received`), one row per pool+user. |
| `whatsapp_outbox` | Every outbound notification and its delivery state (`queued`, `simulated`, `sent`, `failed`) plus error detail. |
| `whatsapp_events` | Inbound webhook messages and delivery statuses, stored as JSON for audit. |

The schema deliberately contains no wallet, balance, card or bank-account tables. There is nowhere for Vantage to hold user funds.

---

## Debt simplification

[`src/lib/simplify.ts`](src/lib/simplify.ts) implements the standard **greedy min-cash-flow** algorithm:

1. Compute each member's net position: `paid − owed + settlements sent − settlements received`.
2. Split members into **creditors** (positive, owed money) and **debtors** (negative, owe money).
3. Repeatedly match the largest debtor with the largest creditor for `min(debt, credit)`.
4. Stop when one side is exhausted.

```text
A owes B $10, B owes C $10
→ balances: A −10, B 0, C +10
→ simplified: A pays C $10
```

Properties:

- Produces at most `n − 1` transfers, so a five-person trip settles in four payments or fewer.
- Deterministic — ties are broken by user id, so screenshots and tests are stable.
- Greedy is the practical industry approach; computing the true global minimum across arbitrary debt graphs is NP-hard.
- Pending claims are intentionally ignored, so marking a payment paid does not make a debt disappear before the recipient confirms it.

Seeded **Miri Road Trip** result: **4 transfers, BND 291.66 total** — Faridah → Sofia 104.33, Nurul → Sofia 98.34, Aiman → Sofia 68.15, Hakim → Sofia 20.84.

---

## Split rules

[`src/lib/split.ts`](src/lib/split.ts) works entirely in integer cents and guarantees the splits sum exactly to the expense total.

| Rule | Input | Validation |
| --- | --- | --- |
| `equal` | participant list | at least one person; remainder distributed by largest fractional part |
| `exact` | amount per person in the **original currency** | must add up to the expense total; each share converted to BND, FX rounding absorbed by the largest share |
| `percent` | percentage per person | must total 100% (tolerance 0.011) |
| `shares` | positive weight per person | every participant needs at least one share |

The UI previews each person's BND share while typing, and the API recomputes the split server-side rather than trusting client totals.

---

## Multi-currency

- Default and canonical settlement currency: **BND**.
- Entry currencies: **BND, SGD, MYR, USD** with sensible starting rates in [`src/lib/currency.ts`](src/lib/currency.ts) (SGD at par, MYR ≈ 0.30, USD ≈ 1.34).
- The rate is editable per expense; Vantage stores `currency`, `amount_cents`, `fx_rate_to_bnd` and the derived `amount_bnd_cents`.
- Every settlement and balance is expressed in BND.
- Rates are static defaults, not a live FX feed — suitable for an MVP and clearly labelled in the UI.

---

## Payment routing and settlement lifecycle

### Saved rails

A user saves any combination of:

- **tarus** proxy / phone number,
- **tarusQR** image (compressed to a data URL in this MVP),
- **Pocket** payment link,
- a preferred rail and a WhatsApp opt-in flag.

Payment details are only surfaced on settle-up screens, to group members who need to pay.

### Settlement flow

```
Payer opens Settle up
  → sees creditor's QR / proxy / Pocket link + exact BND amount
  → pays in their own banking app (tarus, tarusQR, Pocket or cash)
  → taps "I've paid — mark it" (+ optional screenshot)
      → settlements.status = pending
      → WhatsApp alert to the creditor
  → creditor checks their bank, then:
      confirm → status = completed → balances update
      reject  → status = rejected  → balance stays outstanding
```

A creditor may instead tap **Received** after checking their bank. That writes a `completed` settlement immediately and notifies the payer.

Rules enforced by the API:

- Only the payer or recipient can record a transfer.
- Only the recipient can confirm or reject it.
- A payer cannot create a second pending claim for the same transfer/amount (`409`).
- Pending claims do not affect balances; completed ones do; rejected ones are ignored.

---

## Virtual pools

Pools track a shared goal (a wedding gift, a photo book, a deposit) **without collecting money**:

- creator sets a title, BND goal, optional deadline and note;
- members pledge an amount and mark it `pledged` or `received` ("already handed over offline");
- the dashboard shows pledged total, percentage of goal, who pledged, and how much was handed over;
- the organiser buys the gift offline; Vantage only records who has contributed.

---

## WhatsApp integration

### Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| **Simulated** | `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` missing | Messages are stored in `whatsapp_outbox` with status `simulated`; visible in Activity and retryable. |
| **Live** | Both set | Messages are POSTed to the WhatsApp Business Cloud API; status becomes `sent` or `failed` with the provider error. |

### Configuration

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_TOKEN` | Cloud API bearer token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender phone-number ID. |
| `WHATSAPP_VERIFY_TOKEN` | Shared token for the webhook `hub.verify_token` challenge (default `vantage-verify`). |
| `WHATSAPP_APP_SECRET` | Optional. When set, inbound POSTs must carry a valid `X-Hub-Signature-256` HMAC. |
| `WHATSAPP_API_VERSION` | Graph API version (default `v23.0`). |
| `NEXT_PUBLIC_APP_URL` | Public base URL used in WhatsApp deep links. |
| `VANTAGE_SESSION_SECRET` | HMAC secret for demo session cookies. |
| `VANTAGE_DB_PATH` | Optional SQLite file location. |

### Message coverage

`expense_added`, `pool_created`, `pool_pledge`, `settlement_marked`, `settlement_confirmed`, `settlement_rejected`, `payment_reminder`, `group_invite`.

Recipients respect the user's `whatsapp_opt_in` flag and need a phone number. Messages are plain text with link previews; a production deployment should move to Meta-approved message templates for business-initiated conversations.

### Webhook

- `GET /api/whatsapp/webhook` answers Meta's verification challenge.
- `POST /api/whatsapp/webhook` verifies the signature (when configured), parses inbound messages and delivery statuses, and persists each event in `whatsapp_events`.

### Sharing

Every group dashboard and settle page has **Share** → `https://wa.me/?text=...` plus a copy button. The generated summary includes:

- group name and total logged;
- recent expenses with original currency notes;
- simplified "who pays whom" transfers;
- net positions;
- a deep link to the group and a non-custodial reminder.

Reminders open a pre-filled `wa.me` chat with the debtor's phone number and a link to the Settle Up page.

---

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in with a demo user id or username. |
| `POST` | `/api/auth/register` | Create a demo account and sign in. |
| `POST` | `/api/auth/logout` | Clear the session cookie. |
| `GET` | `/api/groups` | List the current user's groups. |
| `POST` | `/api/groups` | Create a group and invite members. |
| `POST` | `/api/groups/[id]/expenses` | Validate, split and store an expense. |
| `POST` | `/api/groups/[id]/pools` | Create a pooling goal. |
| `POST` | `/api/groups/[id]/settlements` | Record a payment claim or received payment. |
| `POST` | `/api/pools/[id]/pledges` | Create or update a pledge. |
| `POST` | `/api/settlements/[id]` | Recipient confirms or rejects a claim. |
| `PATCH` | `/api/me/profile` | Update display name / phone. |
| `GET`, `PUT` | `/api/me/payment-profile` | Read / save payment rails and WhatsApp opt-in. |
| `GET`, `POST` | `/api/whatsapp/webhook` | Meta verification + inbound events. |
| `POST` | `/api/whatsapp/outbox/[id]/retry` | Retry one outbox message. |

All group/resource routes require a signed-in session and verify group membership. Input is normalised and validated in `src/lib/validation.ts`; server-side split totals are always recomputed.

---

## Scripts

```bash
npm run dev        # Next dev server on :3000
npm run build      # production build + type check
npm run start      # serve the production build
npm run lint       # ESLint via Next
npm run typecheck  # tsc --noEmit
npm test           # Vitest, single run
npm run test:watch # Vitest in watch mode
npm run db:reset   # delete the SQLite file (run with the server stopped)
```

---

## Testing

```bash
npm test
```

19 unit tests cover the domain logic:

- `src/lib/simplify.test.ts` (6) — chain netting, n−1 bounds, conservation of money, zero balances, cent-level rounding, determinism.
- `src/lib/balances.test.ts` (5) — payer/split netting, pending vs completed vs rejected settlements, canonical multi-currency amounts, total spend.
- `src/lib/split.test.ts` (8) — largest-remainder allocation, all four rules, percentage and exact-total validation, FX conversion, participant de-duplication.

The full app was also exercised in a real browser (mobile 390px and desktop 1280px) through login, group creation, expense creation with MYR conversion, pool creation/pledge, payment-profile save, mark-paid, and recipient confirmation. Type checking (`npx tsc --noEmit`) and `npm run build` both pass.

---

## Project layout

```
Vantage-/
├── db/
│   └── schema.sql              # SQLite schema (no wallet/funds tables)
├── src/
│   ├── app/
│   │   ├── (app)/              # authenticated shell
│   │   │   ├── groups/         # list, dashboard, settle up
│   │   │   ├── activity/       # WhatsApp outbox + pending claims
│   │   │   └── account/        # profile + payment rails
│   │   ├── api/                # route handlers
│   │   ├── login/              # demo sign-in / register
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/             # shell, modals, cards, forms, avatars
│   └── lib/
│       ├── balances.ts         # net positions
│       ├── currency.ts         # cents, FX, formatting
│       ├── db.ts               # SQLite bootstrap + seed
│       ├── notify.ts           # notification fan-out
│       ├── queries.ts          # typed data access
│       ├── seed.ts             # demo workspace
│       ├── session.ts          # signed demo sessions
│       ├── simplify.ts         # greedy min-cash-flow
│       ├── split.ts            # split engine
│       ├── validation.ts       # input normalisation
│       ├── wa.ts               # message builders + wa.me links
│       └── whatsapp.ts         # Cloud API, outbox, retry
├── legacy-prototype/           # earlier static prototype, kept aside
├── .env.example
└── README.md
```

---

## Design decisions and trade-offs

- **SQLite over Postgres** — zero setup for a demo/MVP, synchronous queries, easy to inspect. The data layer is isolated in `queries.ts`, so migrating to Postgres later is contained.
- **Server components + small client modals** — fast initial render and less client state. Interactive forms (add expense, create group/pool, settle, profile) are client components.
- **Derived balances** — no stored balance fields, so edits and confirmations cannot leave stale totals.
- **Pending-first settlement** — a claim only changes the ledger after the recipient confirms. This trades a little immediacy for trust and matches how bank transfers actually work.
- **Images as data URLs** — receipts, proofs and QR images are compressed in the browser and stored in SQLite. This makes the MVP fully self-contained; production should use object storage with signed URLs.
- **Static FX defaults** — rates are editable at entry time and stored per expense. A live FX feed is deliberately out of scope.
- **Free-form WhatsApp messages** — great for simulation and demos. Live business-initiated messaging requires approved templates and opt-in handling in production.
- **Demo auth** — no passwords or OTP. Sessions are HMAC-signed httpOnly cookies. This is explicitly not production authentication.
- **Greedy simplification** — practical and fast, but not guaranteed to find the mathematically minimal transfer set (NP-hard in general).

---

## Non-custodial model

Vantage never:

- holds a balance or wallet for a user;
- accepts card or bank payments;
- stores card numbers, CVV, bank credentials or account balances;
- initiates a transfer on a user's behalf;
- guarantees that a marked payment actually arrived.

It stores **payment-routing details** (a proxy ID, a QR image, a public payment link) and **ledger claims**. Money moves directly between users through licensed rails (tarus / Pocket / cash). A settled ledger entry means "the recipient confirmed they received the money", not "Vantage moved money".

Before any commercial launch, confirm this posture with local counsel and the relevant regulator (e.g. Brunei's e-money and payment-services rules), and complete the production hardening below.

---

## Production hardening checklist

- [ ] Replace demo account selection with real authentication (phone OTP / passkeys) and rate limiting.
- [ ] Move to Postgres (or Supabase) with versioned migrations and backups.
- [ ] Store receipts, proofs and QR images in object storage; serve signed URLs.
- [ ] Add CSRF protection, strict Content-Security-Policy and request-size limits at the edge.
- [ ] Encrypt PII at rest; define retention/deletion for screenshots and phone numbers.
- [ ] Move WhatsApp delivery to an outbox worker with retries/backoff and approved message templates.
- [ ] Verify webhook signatures unconditionally in production (`WHATSAPP_APP_SECRET`).
- [ ] Add real-time updates or polling so both parties see confirmations promptly.
- [ ] Add group administration (invite links, member removal, group deletion) and an audit log.
- [ ] Add observability (structured logs, error tracking, delivery metrics).
- [ ] Revisit FX: live rates, rounding policy and historical-rate display.
- [ ] Legal review of the non-custodial/e-money position, terms and privacy policy.

---

## Legacy prototype

An earlier static prototype (`index.html`, `style.css`, `app.js`) lived in this repository before the Vantage MVP. It has been moved unchanged to [`legacy-prototype/`](legacy-prototype/) for reference and is not part of the running application.
