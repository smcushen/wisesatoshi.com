# wisesatoshi.com / MSTR MODLer — Recovery Runbook

*Last updated: September 28, 2026. Anything marked **[FILL IN]** or **[CONFIRM]** still needs your input.*

This document describes every piece of the system, how the pieces connect, and the order to rebuild them in. It deliberately contains **no secret values**. Secrets live only in your password manager (see "Secrets inventory"). This repo is **public**, so keep it that way.

---

## 1. Architecture at a glance

```
Visitor's browser ──> index.html / learn.html (front end)
      │
      ├── reads data/*.json (from the repo / raw.githubusercontent.com)
      │       ▲
      │       ├── GitHub Actions (prices, Treasury rate, mNAV close, reminders, billing housekeeping)
      │       └── Cloudflare Workers (live IV, options activity + picker chain)
      │                 └── MarketData.app API
      │
      ├── Supabase Auth (login/signup) + profiles table (Pro access)
      │       └── Edge Functions ── Stripe (checkout, portal, webhook)
      │                          ── Mailtrap SMTP (emails)
      │                          ── Kit (tags / automations)
      │
      └── Contact form ──> Supabase Edge Function ──> Mailtrap ──> help@ (ImprovMX) ──> Gmail
```

**Rebuild order** (each step depends on the ones before it):
1. Domain + DNS (Namecheap)
2. GitHub repo + front-end hosting
3. Supabase (database, auth, SMTP, Edge Functions)
4. Stripe (products, prices, webhook → Supabase)
5. Kit, Mailtrap, ImprovMX
6. MarketData.app, then the Cloudflare Workers
7. GitHub Actions secrets, then re-enable workflows
8. End-to-end tests (section 11)

---

## 2. Domain, DNS, and email routing

| Item | Service | Notes |
|---|---|---|
| Domain `wisesatoshi.com` | Namecheap | DNS is managed at Namecheap |
| Site records (A / CNAME) | Namecheap | **[FILL IN]** exact records pointing to the front-end host |
| MX records | Namecheap → ImprovMX | Inbound mail forwarding |
| Mailtrap domain verification | Namecheap | **[FILL IN]** the SPF / DKIM / verification records Mailtrap asked for |
| `help@wisesatoshi.com` (and wildcard) | ImprovMX | Forwards to `wisesatoshiapp@gmail.com` |

**To rebuild:** recreate the records in Namecheap, then re-verify the domain in Mailtrap and ImprovMX.

---

## 3. Front end and hosting

- **Repo:** `github.com/smcushen/wisesatoshi.com` (public, branch `main`)
- **Hosting:** **GitHub Pages**, served from the repo's top level, with the custom domain set by the `CNAME` file and HTTPS on. Anything in the repo can therefore be reached as a web address (`wisesatoshi.com/<path>`), so never commit secrets.
- **Netlify (functions only; the site itself is on GitHub Pages):** `netlify/functions/` holds serverless functions. An ignore command in `netlify.toml` limits Netlify deploys to changes in that folder, and **Auto Publishing is locked**, so after editing any function you must **publish the new deploy manually** in Netlify. Time-sensitive data is read from `raw.githubusercontent.com` rather than any published build.

| Function | What it does |
|---|---|
| `lib/mnav-close-core.mjs` | Shared closing-mNAV capture logic (`captureIfNeeded()`): most-recent-trading-day math, holiday/weekend/before-4pm guards, MSTR price from Finnhub, BTC price from CoinGecko, commits `data/mnav-close-snapshot.json` via the GitHub API. Holds its own **NYSE holiday list** (`HOLIDAYS`, covers 2026-2027). |
| `capture-mnav-close-scheduled.mjs` | Runs the capture on a schedule after the close **[FILL IN schedule]** |
| `capture-mnav-close-check.mjs` | Runs the same capture when the site calls it after a visit (backup path; also the manual fix, since visiting the site after 4pm ET triggers it) |
| `historical-mnav.mjs` | Likely produces `data/historical-mnav.json` **[CONFIRM]** |
| `mstr-price.js`, `treasury-rate.js` | Fallbacks for the MSTR price and Treasury rate |

- **Netlify environment variables:** `GITHUB_TOKEN` (used to commit the snapshot; **[CONFIRM type + expiration]**) and `FINNHUB_API_KEY`. Set in Netlify → Site configuration → Environment variables.
- **Docs:** `docs/strategy-historical-fundamentals.md` (historical Strategy fundamentals reference)
- **Pages:**
  - `index.html`: the calculator plus all Pro features (login modal, Saved Positions, picker, share card, zoom toggle)
  - `learn.html`: the Options Primer
  - `pro.html`: private test sandbox only, not part of the user flow
- **Assets:** `og-image.png` (1200×630 social card), mascot/wordmark files **[FILL IN paths]**, OBS assets (orange ring PNG, rainbow HTML animation) **[FILL IN paths, or note if stored outside the repo]**

### Data files the site reads (`data/`)

| File | Written by | Purpose |
|---|---|---|
| `mstr-options-chain.json` | Cloudflare `mstr-options-activity` (daily) | Pro picker: expirations + strikes |
| `mstr-options-iv.json` | Cloudflare `mstr-option-iv` (every 30 min, market hours) | Live IV per contract |
| `options-activity/YYYY-MM.json` | Cloudflare `mstr-options-activity` | Monthly top-20 LEAPS by volume and by open interest (Morning MODL source) |
| `strategy-fundamentals.json` | **You, by hand**, each week (see section 4, "Weekly Strategy update") | BTC held, shares, FDSO, convertible debt, preferred, USD Reserve, USD Cash, cost of capital |
| `btc-holdings-history.json` | `update-btc-holdings-pine.yml` | Every disclosed BTC holdings change since Aug 2020; source for the TradingView holdings indicator |
| `treasury-rate.json` | `capture-treasury-rate.yml` | Risk-free rate (Treasury XML feed) |
| `mnav-close-snapshot.json` | Netlify `capture-mnav-close-scheduled` / `capture-mnav-close-check` (logic in `lib/mnav-close-core.mjs`) | Prior-close MSTR price + mNAV, used after hours |
| `mstr-price.json` | `capture-mstr-live.yml` | Live MSTR price (Finnhub) |
| `historical-mnav.json` | Likely Netlify `historical-mnav.mjs` **[CONFIRM]** | Historical mNAV series |
| **[FILL IN]** fallback defaults file | `sync-fallback-defaults.yml` | Fallback values if live fetches fail |

**Access logic, for reference** (in `onLoggedIn()` in `index.html`):
`hasAccess = comp_access === true OR subscription_status === 'active' OR now < trial_ends_at OR (status === 'past_due' AND now < grace_period_ends_at)`.
If the profile row can't be loaded, the code deliberately denies access (fails safe).

---

## 4. GitHub Actions (`.github/workflows/`)

| Workflow | What it does | Schedule |
|---|---|---|
| `capture-mstr-live.yml` | Fetches the MSTR price from Finnhub, commits it | Every ~5 min **[CONFIRM]** |
| `capture-treasury-rate.yml` | Fetches the Treasury par yield XML, commits `treasury-rate.json` | 4× daily |
| `check-mnav-close-captured.yml` | Files a `data-freshness` issue if today's closing snapshot is missing (skips NYSE holidays; has its own `HOLIDAYS_<year>` lists) | `0 22 * * 1-5` = 6 PM ET during EDT (5 PM ET in winter; still after the close) |
| `expire-past-due.yml` | Ends Pro for `past_due` accounts after the grace period | **[FILL IN]** |
| `fetch-options-iv.yml` | **Disabled.** Replaced by the Cloudflare `mstr-option-iv` worker; kept for reference | — |
| `sync-fallback-defaults.yml` | Keeps fallback defaults current | **[FILL IN]** |
| `trial-followup-check.yml` | Sends the "Still thinking about Pro?" email after the trial ends | **[FILL IN]** |
| `update-btc-holdings-pine.yml` ("Update TradingView Indicators") | When `strategy-fundamentals.json` changes: appends to `btc-holdings-history.json` if holdings moved, and regenerates both TradingView scripts (section 5c) | On push of that file; also manual |
| `weekly-strategy-check.yml` | Opens the weekly fundamentals reminder issue (labels `maintenance`, `data-update`) and checks that next year's NYSE holiday list exists | `0 4 * * 2` = Tuesday 04:00 UTC (Monday ~midnight ET) |

- **Closing-mNAV capture** runs on **Netlify**, not GitHub Actions (see section 3). The old `capture-mnav-close.yml` workflow was retired.
- **Race-condition fix:** every workflow that commits runs `git pull --rebase origin main` before `git push`. Keep this in any new workflow.
- **Weekly Strategy update:** done manually on purpose, for reliability (decided Sept 2026). There is **no issue form**. The routine:
  1. The reminder issue opens; check strategy.com/shares, the investor briefing, and the latest 8-K.
  2. Ask Claude for the week's updated JSON and paste it into `data/strategy-fundamentals.json`, with `lastUpdated` set to the **8-K's date** (the TradingView holdings chart uses it as the step date).
  3. Wait ~1 minute for `update-btc-holdings-pine.yml`, then paste both `tradingview/*.pine` files into TradingView (section 5c).
  4. Close the reminder issue.
- **Holiday lists live in two places,** and both need next year's NYSE dates each year: `check-mnav-close-captured.yml` (`HOLIDAYS_<year>`) and `netlify/functions/lib/mnav-close-core.mjs` (`HOLIDAYS`). The weekly reminder checks the first and warns when next year is missing (fixed Sept 2026).
- **Retired (Sept 2026):** the Daily Breakdown X bot (`daily-breakdown.yml`, `update-content-from-issue.yml`, the `daily-content` issue form, `post_daily_breakdown.py`, `parse_issue_to_content.py`, `daily_content.txt`) and its X API secrets were deleted. They remain in git history if ever needed.
- **Repository secrets:** see section 10.

---

## 5. Cloudflare Workers

Account subdomain: `shawncushen.workers.dev`. Free plan, which allows only 5 cron triggers per account.

> ⚠️ Cloudflare cron numbers days differently from standard cron (1 = Sunday). Use day names: `MON-FRI`.

### 5a. `mstr-option-iv`
- **Does:** reads `data/mstr-options-chain.json`, fetches call IV per expiration from MarketData.app, and writes `data/mstr-options-iv.json`.
- **Cron:** every 30 min **[CONFIRM exact expression]**. The code itself skips runs outside NYSE hours (timezone-aware). It was slowed from 15 to 30 min to stay under the 10,000-credit daily cap.
- **Secrets:** `GITHUB_TOKEN`, `MARKETDATA_API_KEY` (type **Secret**, not Variable)
- **Hard-coded:** owner `smcushen`, repo `wisesatoshi.com`
- **Code backup:** `rebuild/cloudflare/mstr-option-iv.js` **[copy from the Cloudflare editor]**
- **Known TODOs:**
  - Its URL has no key, so anyone visiting it during market hours triggers a run. Add a `RUN_KEY` check.
  - Credit trim: request only the columns it needs (no bid/ask/mid/last) to cut usage from thousands to about 1 credit per request.

### 5b. `mstr-options-activity`
- **Does, daily after the close:**
  1. Pulls the full MSTR chain (1 credit, no price columns).
  2. Updates the monthly LEAPS activity file (`data/options-activity/YYYY-MM.json`) with two top-20 lists: `topVolume` (monthly total volume) and `topOpenInterest` (latest snapshot).
  3. Rebuilds `data/mstr-options-chain.json`. New expirations join once they're `MIN_DAYS`+ out and stay until they expire. Strikes are those with call open interest above 25, plus already-listed strikes while they still trade. It only commits when something changes.
- **Cron:** `30 21 * * MON-FRI` (5:30 PM EDT / 4:30 PM EST)
- **Secrets:** `GITHUB_TOKEN`, `MARKETDATA_API_KEY`, `RUN_KEY`
- **Variables:** `GITHUB_OWNER=smcushen`, `GITHUB_REPO=wisesatoshi.com`, `MIN_DAYS=210`
- **Manual test:** `https://mstr-options-activity.shawncushen.workers.dev/?key=<RUN_KEY>` (dry run); add `&write=1` to save.
- **GitHub token:** fine-grained, scoped to this repo only, Contents read/write. **Expires ~Sept 2027. Calendar reminder set? [CONFIRM]**
- **Notes:**
  - MarketData's volume and OI data lags about one trading day. The worker dates each run by the data's own timestamp, so nothing is double-counted.
  - Historical chains (for backfills) cost 1 credit per 1,000 symbols.
- **Code backup:** `rebuild/cloudflare/mstr-options-activity.js` **[copy from the Cloudflare editor]**

---

### 5c. TradingView indicators (not Cloudflare, but related tooling)
Two Pine Script v5 indicators, both **generated** by `update-btc-holdings-pine.yml` via `scripts/update_btc_holdings_pine.py`:

| Indicator | Generated file | Data source |
|---|---|---|
| MSTR BTC Holdings (WiseSatoshi) | `tradingview/mstr-btc-holdings.pine` | `data/btc-holdings-history.json` (stairstep, green after buys, red after sales) |
| MSTR mNAV (WiseSatoshi) | `tradingview/mstr-mnav.pine` | this week's `strategy-fundamentals.json` + live `BTCUSD` / `NASDAQ:MSTR` prices; same formula as the site's `calcNetValuePerShare()` |

> The net-value-per-share formula exists in **four** places that must be kept in sync by hand: `index.html` (`calcNetValuePerShare()`), `netlify/functions/lib/mnav-close-core.mjs`, `scripts/update_btc_holdings_pine.py` (mNAV Pine template), and the published TradingView script.

- **To update TradingView:** open each `.pine` file in GitHub → copy → Pine Editor → select all → paste → **Save** (and **Update** if published). TradingView can't pull outside data or be updated by an API, so this paste is the one manual step.
- **Never hand-edit the `.pine` files;** edit `btc-holdings-history.json` or `strategy-fundamentals.json` instead.
- **Known limitation:** the mNAV indicator applies current fundamentals to the whole chart, so older history is approximate. `docs/strategy-historical-fundamentals.md` could later make it historically accurate.

---

## 6. MarketData.app

- **Plan:** Starter, $12/mo, 15-minute delayed options data
- **Limit:** 10,000 credits/day, resetting at **9:30 AM ET** (not midnight)
- **Billing rule:** a request is charged per contract **only** if it includes bid/ask/mid/last columns. Otherwise it costs 1 credit.
- **Typical daily use:** about 6,700–7,900 credits (IV worker, 7 expirations) plus 1 (activity worker)

---

## 7. Supabase

- **Project:** "Wise Satoshi", ref `oqtjogdgisbwsvgcmfos`, **Free plan**, branch `main`
- **Auth:**
  - Email + password, with email confirmation and password recovery
  - Custom SMTP through **Mailtrap** (avoids Supabase's default 2 emails/hour cap)
  - **[FILL IN]** the site URL and redirect URLs set under Auth → URL Configuration

### Tables
**`profiles`**, one row per user, created automatically at signup by a Postgres trigger and never written by the browser:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | = auth user id |
| `email`, `normalized_email` | text | ⚠️ inconsistently filled across rows; match on `coalesce(email, normalized_email)` |
| `trial_ends_at` | timestamptz | 7-day trial end |
| `stripe_customer_id` | text | set by the webhook |
| `subscription_status` | text | `trialing` / `active` / `past_due` / `canceled` |
| `cancel_at_period_end` | bool | |
| `current_period_end` | timestamptz | |
| `payment_failed_at`, `grace_period_ends_at` | timestamptz | failed-payment grace logic |
| `subscription_event_at` | timestamptz | last Stripe event |
| `trial_followup_sent_at` | timestamptz | prevents duplicate follow-up emails |
| `comp_access` | bool, default false | free permanent Pro |
| `created_at` | timestamptz | |

**`saved_contracts`**: saved positions/scenarios per user:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | default `gen_random_uuid()` |
| `user_id` | uuid | default `auth.uid()` |
| `strike` | numeric | required |
| `expiration_date` | date | required |
| `notes` | text | optional |
| `contract_data` | jsonb | optional; full saved scenario |
| `created_at` | timestamptz | default `now()` |

**`disposable_email_domains`**: a list of throwaway-email domains used to block trial abuse (column `domain`). Back it up as `rebuild/supabase/disposable_email_domains.csv`; without it, the trial protection below stops working.

### Signup logic (`handle_new_user` trigger function)
On every new signup it:
1. normalizes the email (`normalize_email()`),
2. checks whether that normalized email has signed up before,
3. checks whether the email's domain is in `disposable_email_domains`,
4. inserts the `profiles` row with a **7-day** trial, or a **0-day** trial if either check hits.

It fills `normalized_email` but **not** `email`. That's why newer rows have `email` empty (older rows were created before this logic).

### Security
- **RLS is on for `profiles`.** It has exactly one policy, "Users can view their own profile" (SELECT). There are **no** UPDATE or INSERT policies, so users can't grant themselves access. Keep it that way.
- **`profiles` uses column-level grants** ("custom Data API permissions"). Any new column the browser needs requires `grant select (<column>) on public.profiles to authenticated;`
- **`saved_contracts`** has RLS so users see only their own rows. **[FILL IN policies]**
- **Session cap:** a trigger on `auth.sessions` runs `enforce_session_limit()`, which keeps each user's 2 newest sessions and deletes older ones.
- **`rls_auto_enable()`:** an event-trigger function that turns RLS on automatically for new tables.
- **Function code backups:** `rebuild/supabase/functions-sql/` holds `handle_new_user.sql`, `normalize_email.sql`, `enforce_session_limit.sql`, and `rls_auto_enable.sql`.

### Edge Functions (6)
| Function | Purpose |
|---|---|
| `create-checkout-session` | Starts Stripe Checkout |
| `create-portal-session` | Opens the Stripe billing portal ("Manage billing" / "Update payment method") |
| `stripe-webhook` | Receives Stripe events and updates `profiles` |
| `send-contact-email` | Footer contact form → Mailtrap → help@ |
| `send-trial-followup` | Post-trial email |
| `tag-kit-signup` | Tags new signups in Kit |

- **Function secrets:** see section 10.
- **Code backup:** `rebuild/supabase/functions/<name>/index.ts` **[CONFIRM whether this code is already in the repo; if not, download each one]**
- **Schema backup:** `rebuild/supabase/schema-snapshot.md` (tables, policies, triggers, column grants) plus the function files above.

### Comping an account (free permanent Pro)
```sql
update public.profiles
  set comp_access = true,
      trial_followup_sent_at = coalesce(trial_followup_sent_at, now())
  where lower(coalesce(email, normalized_email)) = '<email>';
```
The second line stops the trial follow-up email from being sent to a comped account.

**Current comp accounts:** `demo@wisesatoshi.com`. Personal account: set to comp **after** the Oct/Nov 2026 billing tests (see section 11).

---

## 8. Stripe

- **Account:** a separate Wise Satoshi Stripe account (individual / sole proprietor), **live mode**, with **Managed Payments** on (Stripe handles sales tax/VAT for an extra 3.5% per transaction)
- **Product / price:** MSTR MODLer Pro, monthly. **[FILL IN product ID, price ID, amount]** (First live charge: $16.19 including tax.)
- **Webhook endpoint:** points to the Supabase `stripe-webhook` function. **[FILL IN URL]** It listens to exactly these 5 events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- **Customer portal:** enabled (used by `create-portal-session`)
- **Revenue recovery settings:** retries, customer emails for failed payments, and the action after the final failure. **[FILL IN what's set]**
- **Branding:** applying Wise Satoshi colors to Stripe's hosted pages is still to do.

---

## 9. Kit (email marketing)

- **Account:** shared with Krypto Logos (cost decision). Confirm that WS emails use **Wise Satoshi** branding.
- **Forms:** WS Pro Waitlist **[FILL IN form ID]**
- **Tags:** `ws-pro-waitlist`, `ws-pro-active`, trial-started **[CONFIRM exact tag names]**
- **Automations:** "WS Pro Welcome" (triggered by `ws-pro-active`) **[FILL IN any others]**
- **Templates:** keep a copy of each hand-coded HTML email template in `rebuild/kit/`. **[FILL IN]**

---

## 10. Secrets inventory (names and locations only, never values)

Store the actual values in your password manager under matching names.

| Secret | Used by | Where it's set |
|---|---|---|
| `GITHUB_TOKEN` (fine-grained, repo-scoped) | Both Cloudflare workers | Cloudflare → each worker → Settings → Variables and Secrets |
| `MARKETDATA_API_KEY` | Both Cloudflare workers | Cloudflare |
| `RUN_KEY` | `mstr-options-activity` test link | Cloudflare |
| Stripe secret key (live) | Supabase Edge Functions | Supabase → Edge Functions → Secrets **[CONFIRM names]** |
| Stripe webhook signing secret | `stripe-webhook` | Supabase **[CONFIRM name]** |
| Kit API key | `tag-kit-signup` | Supabase Edge Function secrets **[CONFIRM name]** |
| Mailtrap SMTP credentials | Supabase Auth + email functions | Supabase Auth SMTP settings + function secrets |
| Supabase URL + anon key | `index.html` (public by design) | In the code |
| `GITHUB_TOKEN`, `FINNHUB_API_KEY` | Netlify closing-mNAV capture functions | Netlify → Site configuration → Environment variables |

**GitHub Actions repository secrets** (GitHub → Settings → Secrets and variables → Actions), confirmed Sept 28, 2026:

| Secret | Used by |
|---|---|
| `FINNHUB_API_KEY` | `capture-mstr-live.yml` |
| `KIT_API_KEY` | a workflow that talks to Kit **[CONFIRM which]** |
| `MARKETDATA_API_KEY` | `fetch-options-iv.yml` (disabled backup; the Cloudflare workers have their own copy) |
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | probably `sync-fallback-defaults.yml` **[CONFIRM]** |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | `expire-past-due.yml`, `trial-followup-check.yml` |
| `TRIAL_FOLLOWUP_CRON_SECRET` | `trial-followup-check.yml` → `send-trial-followup` Edge Function (must match the function's copy) |

GitHub also provides its own `GITHUB_TOKEN` automatically to every workflow run; there's nothing to store for it.

**Password-manager convention** (Apple Passwords): Website = `WS-<service>` (e.g. `WS-marketdata.app`, `WS-github.com-activity`), User = the exact variable name, Notes = where it's used + where to regenerate. Secrets that can't be viewed again are saved when next regenerated; unrecoverable ones are noted `LOST – regenerate if needed`.

**Account logins** (all to be consolidated onto `wisesatoshiapp@gmail.com`): GitHub, Cloudflare, Supabase, Stripe, Kit, Mailtrap, ImprovMX, Namecheap, MarketData.app, Finnhub, Netlify, TradingView. How you sign in to each (Google, GitHub, or password) is listed in a locked Apple Note, "WS Accounts Index".

---

## 11. Verification checklist (after any rebuild)

- [ ] Site loads over HTTPS at `wisesatoshi.com`; BTC price, MSTR price, and mNAV are live
- [ ] Live IV shows green "Live IV… as of" during market hours on a curated contract
- [ ] After hours: mNAV is frozen at the close, while Derived Price tracks live BTC
- [ ] Signup → confirmation email → 7-day trial banner appears
- [ ] Checkout → webhook sets `active`; "Manage billing" opens the portal
- [ ] Comp account shows Pro with no banner
- [ ] Contact form email arrives in Gmail
- [ ] Pro picker lists the current expirations (including the newest LEAPS)
- [ ] Activity worker dry run shows `creditsConsumed: 1`
- [ ] Committing `strategy-fundamentals.json` triggers "Update TradingView Indicators" and both `.pine` files regenerate

**Scheduled live billing tests (2026):**
- **Oct 5, ~7:34 PM CDT:** renewal charge. Confirm the webhook deliveries in Stripe, and that `current_period_end` moves to about Nov 5.
- **Before Nov 5:** remove the card. Confirm `past_due`, the grace banner, Stripe's emails, and then expiration. Keep `comp_access` **false** on the personal account until this finishes.

---

## 12. Capturing the database schema

Run each query in **Supabase → SQL Editor**. For the first three and the last, use **Export → Copy as Markdown** and paste under its own heading in `rebuild/supabase/schema-snapshot.md`. For the function query, open each function's cell, copy its code from the details panel, and save it as `rebuild/supabase/functions-sql/<function_name>.sql`.

```sql
-- Tables and columns
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- RLS policies
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public';

-- Triggers (public + auth)
select event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth');

-- Function definitions used by triggers
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- Column-level grants on profiles
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles';
```

---

## 13. Routine maintenance

| When | Task |
|---|---|
| Weekly (Monday, or Tuesday after a holiday) | Update `strategy-fundamentals.json` (`lastUpdated` = 8-K date), then paste both `tradingview/*.pine` files into TradingView |
| Monthly | Export `profiles` + `saved_contracts` to CSV and store them **outside** GitHub (they contain customer emails) |
| After any Cloudflare code change | Copy the worker code into `rebuild/cloudflare/` |
| After any Supabase change | Re-run section 12 and update `schema-snapshot.md` / `functions-sql/` |
| Occasionally | Re-export `disposable_email_domains` to CSV if you've added domains |
| ~Aug 2027 | Renew the Cloudflare workers' GitHub token (expires ~Sept 2027) |
| Each December | Add next year's NYSE holidays to **both** `check-mnav-close-captured.yml` and `netlify/functions/lib/mnav-close-core.mjs`, then **publish the Netlify deploy** (Auto Publishing is locked) |
| Yearly | Review this runbook top to bottom |
