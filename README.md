# Vantage

**Brunei's effortless, non-custodial group expense splitter and money-pooling companion.**

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
- [Pairwise settlement maths](#pairwise-settlement-maths)
- [Split rules](#split-rules)
- [Multi-currency](#multi-currency)
- [Payment routing and settlement lifecycle](#payment-routing-and-settlement-lifecycle)
- [Virtual cash pools](#virtual-cash-pools)
- [Repayments](#repayments)
- [Scheduled monthly bills](#scheduled-monthly-bills)
- [Receipt OCR and screenshot checks](#receipt-ocr-and-screenshot-checks)
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
  - **Vision LLM receipt OCR** — one image call returns clean JSON that prefills the title, total, currency, date, category and items; manual entry always remains available;
  - optional itemisation (`items_json`) for receipt lines;
  - four split rules — equal, exact amounts, percentages and weighted shares;
  - multi-currency entry (BND, MYR, SGD, USD) auto-converted to BND with an editable per-expense FX rate;
  - payer, category, date and notes.
- **Group dashboard** with totals, your net position, members, direct pairwise transfers, pools, repayments, recurring bills, recent payments and expandable expense details.
- **Virtual cash pools** with goals, deadlines and **open capped contributions** — anyone can chip in any amount, repeatedly, until the goal is fulfilled.
- **Repayments** with open or equal-share contribution modes and a creator-only **Cash handed back** recorder, all capped at the target.
- **Scheduled monthly bills** generated from a database date, with pause/resume and no cron worker.

### 2. Pairwise settlement maths

- Simple **1-to-1 maths per pair**: each member's share of an expense is treated as owed to the payer, then netted against the reverse direction (`owed − paid`).
- Completed settlements reduce the same pair. Chains stay chains: `A → B` and `B → C` are **not** rerouted into `A → C`.
- Produces at most one net transfer per pair, is deterministic, and keeps the ledger explainable.
- Balances account for expenses, splits and **completed** settlements only; pending claims do not move the ledger.
- Unit-tested (see [Testing](#testing)).

### 3. Payment routing — tarus and Pocket

- Per-user **payment profile** with a preferred rail:
  - **tarus** proxy / phone number,
  - **tarusQR** image upload,
  - **Pocket** payment link.
- **Settle Up** screen shows the exact BND amount, the creditor's **static** QR/proxy/link, a one-tap **Copy phone number** button, and *Copy amount & payment details*.
- No dynamic payment QR is generated — users upload one static tarusQR/Pocket image and Vantage only displays it.
- **Mark as paid** flow with optional payment screenshot.
- Recipient **confirms manually** (ledger becomes square) or **rejects** the claim.
- Optional **Vision AI screenshot check** extracts the amount and highlights whether it matches. It is only a hint: the recipient always keeps the **Mark as paid (manual)** override, so a blurry scan never blocks settlement.
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

Everything works with defaults. `.env.local` only matters for a custom session secret, a different SQLite path, live WhatsApp delivery, or enabling Vision LLM receipt scanning.

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

1. Sign in as **Aiman** → open **Miri Road Trip** → expand an expense, check the splits, then open **Settle up** and see four direct pairwise transfers to Sofia.
2. Mark Aiman's BND 68.15 transfer as paid (add a note/screenshot if you like).
3. Sign out, sign in as **Sofia** → **Settle up** shows Aiman's claim under *Awaiting confirmation* — confirm it and Aiman becomes square.
4. Sign in as **Nurul** → **Activity** (or **Friday Dinner → Settle up**) has a pending claim from Hakim to confirm.
5. Visit **Account** to edit your payment rails, then open any group and use **Share** to send the summary to WhatsApp.

New accounts can also be created from the login screen (display name, username, phone). They start with no groups.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, server components, route handlers) |
| UI | React 19, TypeScript (strict), Tailwind CSS 3 |
| Icons | lucide-react |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Tests | Vitest |
| Styling | Manrope + Fraunces, mobile-first with safe-area support |

The app is a single Next.js project; there is no separate backend service. Data access lives in `src/lib/queries.ts` and talks to SQLite synchronously, which keeps the MVP easy to run and audit. The domain logic (splits, balances, pairwise transfers, monthly dates, currency) is pure TypeScript and independently testable. Vision OCR is isolated behind one server-side client.

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
│  pairwise.ts     direct 1-to-1 owed − paid transfers         │
│  recurring.ts    monthly bill materialisation                │
│  monthly.ts      pure next-run date helpers                  │
│  vision.ts       receipt OCR + screenshot check (LLM)        │
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
- Balances and direct pairwise transfers are derived on read — there are no denormalised balance columns to drift.
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
| `pools` | Virtual cash-pooling goal: title, note, goal in BND, deadline, creator. |
| `pool_pledges` | Open contributions: amount, `pledged` / `received` status and note. A member may have multiple rows; the API caps the pool total at its goal. |
| `repayments` | Target-based repayment collection: target, mode (`open` / `equal`), participant list, status (`open` / `fulfilled` / `cancelled`). |
| `repayment_contributions` | Each contribution or `cash_handed` record; capped so the sum never exceeds the target. |
| `recurring_bills` | Monthly bill template with amount, split, payer and `next_run_at` date. |
| `recurring_bill_runs` | One row per generated month, unique on `(bill_id, period_key)`, making posting idempotent. |
| `whatsapp_outbox` | Every outbound notification and its delivery state (`queued`, `simulated`, `sent`, `failed`) plus error detail. |
| `whatsapp_events` | Inbound webhook messages and delivery statuses, stored as JSON for audit. |

The schema deliberately contains no wallet, balance, card or bank-account tables. There is nowhere for Vantage to hold user funds.

---

## Pairwise settlement maths

[`src/lib/pairwise.ts`](src/lib/pairwise.ts) deliberately uses simple **1-to-1 debt maths** instead of a multi-person simplification graph:

1. For every expense, record that each participant owes the payer their split share.
2. Subtract completed settlements from the same ordered pair.
3. For each unordered pair, net the two directions: `A owes B − B owes A`.
4. Emit one transfer from the net debtor to the net creditor.

```text
A owes B 10, B owes C 10
→ A → B 10, B → C 10   (the chain is preserved)
```

```text
A owes B 50, B owes A 20
→ B pays A 30          (the same pair is netted)
```

Properties:

- One net transfer per pair, so the ledger stays transparent and easy to explain.
- Never reroutes a debt through a third person — great for trust and auditability.
- Deterministic ordering by user id, so screenshots and tests are stable.
- Pending claims are intentionally ignored, so marking a payment paid does not make a debt disappear before the recipient confirms it.
- Balances are still shown per member for a quick overview, and are derived from the same ledger entries.

Seeded **Miri Road Trip** result: **4 direct transfers, BND 291.66 total** — Faridah → Sofia 104.33, Nurul → Sofia 98.34, Aiman → Sofia 68.15, Hakim → Sofia 20.84 (all four debtors happen to owe Sofia directly).

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
- one **static tarusQR or Pocket QR image** (compressed to a data URL in this MVP),
- **Pocket** payment link,
- a preferred rail and a WhatsApp opt-in flag.

Vantage never generates a dynamic payment QR. The settle-up screen displays the saved image and offers a **Copy phone number** button for one-tap hand-off. Payment details are only surfaced to group members who need to pay.

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

## Virtual cash pools

Pools track a shared goal (a wedding gift, a photo book, a deposit) **without collecting money**:

- creator sets a title, BND goal, optional deadline and note;
- **anyone can contribute any amount, as many times as they like**;
- contributions are capped at the goal: once the pool total reaches the cap it is marked **Fulfilled** and the API rejects further contributions;
- each contribution can be marked `pledged` or `received` ("already handed over offline");
- the dashboard shows the running total, remaining amount, percentage, contributors and individual contributions;
- the organiser buys the gift offline; Vantage only records who has contributed.

## Repayments

A repayment is a target-based collection for one amount (for example, one person's share of a hotel bill):

- the creator sets a target in BND and chooses a mode:
  - **Open contribution** — any group member can contribute any amount;
  - **Equal split** — only selected members can contribute, with a suggested equal share shown for convenience;
- every contribution is capped at the amount still needed; reaching the target marks the repayment **Fulfilled** and closes it automatically;
- the creator also gets a **Cash handed back** action to record cash physically received, with the same cap;
- contributions are ledger records only. The money is handed over directly between members.

## Scheduled monthly bills

[`src/lib/recurring.ts`](src/lib/recurring.ts) keeps scheduled rules intentionally simple:

- create a monthly bill with a title, amount, currency, payer, equal participants and a day of the month (1–28);
- `next_run_at` is stored in SQLite and checked lazily whenever a group ledger is read;
- due bills are posted as normal expenses and the next date advances by one month;
- `recurring_bill_runs` has a unique `(bill_id, period_key)` row, so a bill can never post twice;
- the creator can pause or resume a schedule from the group page;
- no cron worker, queue or background service is required for V1.

## Receipt OCR and screenshot checks

Two focused Vision LLM calls replace custom OCR parsing:

| Feature | Endpoint | Behaviour |
| --- | --- | --- |
| Receipt scan | `POST /api/receipts/scan` | Sends the uploaded image to one OpenAI-compatible chat-completions endpoint and validates the returned JSON: merchant, title, date, currency, total, items, category, confidence. Prefills the Add Expense form. |
| Payment screenshot check | `POST /api/settlements/[id]/verify` | The recipient asks the model whether the proof looks like a completed payment and what amount it shows. The server compares it with the expected BND amount, but the recipient still confirms manually. |

Configuration uses `VISION_API_KEY`, `VISION_API_URL` and `VISION_MODEL`. Without a key the app stays fully usable: receipt scanning returns a clear message and manual entry continues to work.

**Email auto-forward is intentionally deferred to V2.** The recommended path is an inbound webhook (for example Postmark) feeding the same AI text parser, rather than building mailbox forwarding for the V1 scope.

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
| `VISION_API_KEY` | API key for receipt OCR and screenshot checks. Without it those features degrade to manual entry. |
| `VISION_API_URL` | OpenAI-compatible chat-completions endpoint (default `https://api.openai.com/v1/chat/completions`). |
| `VISION_MODEL` | Vision-capable model name (default `gpt-4o-mini`). |

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
- direct "who pays whom" pairwise transfers;
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
| `POST` | `/api/groups/[id]/repayments` | Create an open or equal-share repayment target. |
| `POST` | `/api/groups/[id]/recurring-bills` | Schedule a monthly bill. |
| `POST` | `/api/groups/[id]/settlements` | Record a payment claim or received payment. |
| `POST` | `/api/pools/[id]/pledges` | Add a capped open contribution to a pool. |
| `POST` | `/api/repayments/[id]/contributions` | Contribute, or record creator cash handed back, capped at the target. |
| `POST` | `/api/recurring-bills/[id]` | Pause or resume a monthly schedule (creator only). |
| `POST` | `/api/settlements/[id]` | Recipient confirms or rejects a claim. |
| `POST` | `/api/settlements/[id]/verify` | Vision AI check of the payment screenshot (recipient only). |
| `POST` | `/api/receipts/scan` | Vision LLM receipt OCR → clean JSON. |
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

22 unit tests cover the domain logic:

- `src/lib/pairwise.test.ts` (6) — chains stay direct, owed − paid netting per pair, completed vs pending settlements, overpayment reversal, one transfer per pair, square ledgers.
- `src/lib/monthly.test.ts` (3) — next monthly run in this/next month and day clamping.
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
│       ├── monthly.ts          # pure monthly-date helpers
│       ├── notify.ts           # notification fan-out
│       ├── pairwise.ts         # direct 1-to-1 owed − paid transfers
│       ├── queries.ts          # typed data access
│       ├── recurring.ts        # lazy monthly bill posting
│       ├── seed.ts             # demo workspace
│       ├── session.ts          # signed demo sessions
│       ├── split.ts            # split engine
│       ├── validation.ts       # input normalisation
│       ├── vision.ts           # Vision LLM receipt OCR + screenshot check
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
- **Pairwise over graph simplification** — one net figure per pair is easier to trust and explain than a multi-person min-cash-flow graph, even though it can produce more transfers. This is a deliberate V1 trade-off.
- **One Vision LLM call instead of custom OCR rules** — less parsing code and better handling of messy receipts, but it depends on an external API key and needs a manual fallback. Receipt scanning therefore never blocks saving an expense.
- **Lazy scheduled bills** — checking `next_run_at` when a group is read avoids cron infrastructure. A worker would be the production choice for guaranteed timing.

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
- [ ] Move receipt/screenshot processing behind a job queue, add per-user rate limits, and define image retention for the Vision provider.
- [ ] Add V2 email auto-forward through a signed inbound webhook (e.g. Postmark) that feeds the same AI parser.
- [ ] Replace lazy monthly-bill sweeps with a scheduled worker for guaranteed posting times.
- [ ] Add real-time updates or polling so both parties see confirmations promptly.
- [ ] Add group administration (invite links, member removal, group deletion) and an audit log.
- [ ] Add observability (structured logs, error tracking, delivery metrics).
- [ ] Revisit FX: live rates, rounding policy and historical-rate display.
- [ ] Legal review of the non-custodial/e-money position, terms and privacy policy.

---

## Legacy prototype

An earlier static prototype (`index.html`, `style.css`, `app.js`) lived in this repository before the Vantage MVP. It has been moved unchanged to [`legacy-prototype/`](legacy-prototype/) for reference and is not part of the running application.
