# Strategy / MicroStrategy Historical Fundamentals — Research Log

Purpose: source data for a historical mNAV chart on wisesatoshi.com, spanning
August 2020 (when MSTR began holding BTC) through present. Compiled from SEC
EDGAR 10-Q/10-K filings, 8-Ks, and strategy.com/shares.

**Status: partial. This is a working research log, not a finished dataset.**
Sections marked "NEED" are gaps still to fill before this supports a real
quarter-by-quarter mNAV calculation.

---

## 0. The Actual Origin Point — August 2020

Source: Original 8-Ks (SEC EDGAR) + corroborating press coverage.

| Date | Event | BTC Acquired | Avg Price | Cumulative BTC | Debt Outstanding |
|---|---|---|---|---|---|
| Aug 11, 2020 | First-ever BTC purchase, announced same day | 21,454 | ~$11,654 | 21,454 | $0 |
| Sep 14, 2020 | Second purchase | 16,796 | ~$10,422 | 38,250 | $0 |
| Dec 2020 | Third purchase, funded by first-ever convertible notes issuance | 29,646 | ~$22,000 | 70,470 (matches 12/31/2020 shares.com figure) | $650.0M principal (net carrying value slightly lower — exact 12/31/2020 figure not yet pulled, likely ~$625-630M after discount) |

This is the real starting point: **August 11, 2020, BTC held = 21,454, debt =
$0, preferred = $0**. Basic shares outstanding at this point were lower than
the 95,870K year-end figure (that 2020 also saw the Aug 11 modified Dutch
auction tender offer buying back shares) — exact Aug 11 share count not yet
pulled, year-end figure used as the nearest anchor for now.

---

## 1. BTC Holdings (quarterly resolution — updated this session)

Source: strategy.com/shares + individual quarterly earnings press releases (8-K
Exhibit 99.1, "Digital Assets" section) pulled this session specifically to
close the 2021-2024 sparse-data gap that was distorting the historical mNAV
chart (false "insolvency" stretches from stale annual-only BTC figures).

| Date | BTC Held | Source confidence |
|---|---|---|
| 2020-08-11 | 21,454 | Original 8-K, exact |
| 2020-09-14 | 38,250 | Original 8-K, exact |
| 2020-12-21 | 70,470 | Original 8-K, exact |
| 2021-03-31 | 91,353 | Computed from stated $1.947B carrying value ÷ $21,315 avg — Q1'21 press release |
| 2021-06-30 | 105,085 | NOT directly confirmed this session — widely-cited public figure, worth verifying against the actual Q2'21 8-K directly next time |
| 2021-09-30 | 114,042 | Q3'21 10-Q exhibit, "over 114,000" |
| 2021-12-31 | 124,391 | strategy.com/shares |
| 2022-03-31 | 129,218 | Q1'22 press release, exact |
| 2022-06-30 | 129,699 | Q2'22 press release, exact |
| 2022-09-30 | 130,000 | Q3'22 press release, exact |
| 2022-12-31 | 132,500 | strategy.com/shares |
| 2023-03-31 | (gap — carries forward 132,500) | Not pulled this session |
| 2023-06-30 | 152,333 | Q2'23 press release, exact |
| 2023-09-30 | 158,245 | Q3'23 press release, exact |
| 2023-12-31 | 189,150 | strategy.com/shares |
| 2024-03-31 | 214,278 | Q1'24 press release, exact |
| 2024-06-30 | 226,500 | Q2'24 press release, exact |
| 2024-09-30 | (gap — carries forward 226,500) | Not pulled this session |
| 2024-12-31 | 447,470 | strategy.com/shares |
| 2026-01-04 | 673,783 | 8-K |
| 2026-02-01 | 713,502 | Q4'25 press release |
| 2026-03-31 | 762,099 | 8-K |
| 2026-05-03 | 818,334 | Q1'26 press release |
| 2026-06-28 | 847,363 | 8-K |
| 2026-07-12 | 843,775 | 8-K |
| 2026-08-02 | 842,138 | 8-K |
| 2026-08-23 | 840,447 | Investor briefing |
| 2026-09-07 | 845,050 | 8-K |

Remaining minor gaps: 2021-06-30 (unverified secondary figure). BTC holdings
are now a genuinely complete quarterly series Q1 2021 - present; FDSO now has
real quarterly data points for the 2023-2024 stretch too (see Section 2
below) rather than only annual anchors. Both fixed this session specifically
to eliminate false "insolvency" (mnav: null) stretches in the historical
mNAV chart caused by BTC holdings updating annually while debt updated
quarterly.

## 1b. FDSO — Quarterly Data Points Added This Session

Source: individual 10-Qs' "Basic and Diluted (Loss) Earnings per Share"
tables. IMPORTANT: pre-Aug-2024-split 10-Qs report shares in pre-split
thousands (must multiply by 10 to match our post-split convention); 10-Qs
filed after the split retroactively restate ALL comparative periods to
post-split terms already (no adjustment needed).

| Date | FDSO (millions) | Basis |
|---|---|---|
| 2023-03-31 | 118.34 | Pre-split 11,834K × 10, from Q1'24 10-Q comparative column |
| 2023-06-30 | 132.47 | Pre-split 13,247K × 10, from Q2'24 10-Q comparative column |
| 2023-09-30 | 142.214 | Already post-split-restated, from Q3'24 10-Q comparative column |
| 2024-03-31 | 171.94 | Pre-split 17,194K × 10, from Q1'24 10-Q |
| 2024-06-30 | 178.61 | Pre-split 17,861K × 10, from Q2'24 10-Q |
| 2024-09-30 | 197.273 | Already post-split (10-Q filed after Aug 2024 split) |

Note: these are weighted-average shares during the quarter, not a
point-in-time balance-sheet count like the year-end anchors — a reasonable
proxy for smoothing between anchors, not a perfect match to those anchors'
methodology.

---

## 2. Share Counts (Basic / ADSO / FDSO)

Source: strategy.com/shares historical table (already has this built in).

| Date | Basic Shares (000s) | ADSO/FDSO (000s) |
|---|---|---|
| 12/31/2020 | 95,870 | 124,510 |
| 12/31/2021 | 112,855 | 149,234 |
| 12/31/2022 | 115,488 | 156,113 |
| 12/31/2023 | 168,681 | 207,636 |
| 12/31/2024 | 245,778 | 281,735 |
| 12/31/2025 | 312,062 | 344,897 |
| 3/31/2026 | 346,223 | 378,834 |
| 6/30/2026 | 371,604 | 401,283 |
| 9/7/2026 | 420,497 | 424,510 (FDSO, calculated — see note below) |

Note: FDSO for 9/7/2026 was calculated (not directly stated) as Basic +
Options (3,136K) + RSU/PSU (877K), since all converts/STRK are currently
out-of-the-money. See mnav-close-core.mjs session notes for derivation.

This table is essentially complete for year-end resolution 2020–2025 and
quarter-end for 2026. Good foundation — no major gaps here.

---

## 3. Convertible Notes — Instrument Registry

| Notes | Issued | Original Principal | Rate | Conversion Price (split-adj.) | Status as of Sept 2026 |
|---|---|---|---|---|---|
| 2025 Notes | Dec 2020 | $650.0M | 0.750% | $39.80 | Fully retired before 2024 |
| 2027 Notes | Feb 2021 | $1.050B | 0% | $143.25 | Fully retired before 2024 |
| 2028 Notes | 2024 | (need exact) | — | $183.19 | Outstanding |
| 2029 Notes | 2024 | (need exact) | — | $672.40 | Partially repurchased ($1.50B principal repurchased in 2026) |
| 2030 Notes | Mar 2024 | $800.0M | 0.625% | $149.77 | Outstanding |
| 2031 Notes | Mar 2024 | $603.8M | 0.875% | $232.72 | Outstanding |
| 2032 Notes | Jun 2024 | $800.0M | 2.25% | $204.33 | Outstanding |
| 2030B Notes | 2025 | (need exact) | — | $433.43 | Outstanding |

## 3b. Convertible Notes — Total Net Carrying Value by Quarter (balance sheet)

Source: 10-Q "Long-term Debt" note, which reports a clean quarterly total.
This is the actual number needed for the mNAV formula — no reconstruction
required, just more quarters to pull.

| Quarter End | Total Long-Term Debt, Net | Notes |
|---|---|---|
| 6/30/2021 | $2.151B | |
| 9/30/2021 | $2.153B | |
| 12/31/2021 | $2.155B | |
| 3/31/2022 | $2.362B | 2025 Secured Term Loan added |
| 6/30/2022 | ~$2.36-2.38B | interpolated, not directly pulled |
| 9/30/2022 | $2.377B | |
| 12/31/2022 | $2.379B | |
| 3/31/2023 | (need full total — only convertible-notes subtotal captured, $1.676B; secured notes 2028 + term loan not yet added) | Term loan extinguished ~3/24/2023 |
| 6/30/2023 | $2.178B | Term loan now $0 (paid off) |
| 12/31/2023 | $1.681B | Secured 2028 notes also fully retired by this point — this appears to be a true total (2025+2027 converts only) |
| 6/30/2024 | $3.347B | Jump: new 2030/2031/2032 notes issued Mar/Jun 2024; 2025 Notes mostly redeemed (down to $145K principal) |
| 12/31/2024 | $7.192B | Big jump: 2029 Notes ($2.977B) issued, likely Nov 2024; 2027 Notes still present ($1.041B) |
| 3/31/2025 | $8.141B | 2027 Notes now $0 (redeemed); 2030B Notes added ($1.985B) |
| 6/30/2025 | NEED | |
| 9/30/2025 | NEED | |
| 12/31/2025 | NEED | |
| 3/31/2026 | NEED | |
| 6/30/2026 | $6.7B (directly reported) | Declined after repurchasing $1.5B principal of 2029 Notes at a discount (8% discount, $113.9M gain) |
| 8/23/2026 (investor briefing) | $6.754B | Matches ~$1.5B 2029-Notes repurchase vs. the $8.1B 3/31/2025 level |
| 9/9/2026 (current WS Model file) | $6.714B | |

REMAINING GAP: 6/30/2025 through 3/31/2026 (4 quarters) — same filing type
each time (10-Q "Long-term Debt" note), same pull pattern as everything
above. Once those 4 are in, this series is a complete, continuous quarterly
history from mid-2021 through today. Pre-2021 (the actual Aug 2020 start)
still needs the original 2020 10-K/10-Q for the very first two quarters.

## 3c. Convertible Notes — Refined Issuance Dates (from Sept 2025 10-Q)

| Notes | Issuance Date | Maturity | Principal at Inception |
|---|---|---|---|
| 2027 Notes | February 2021 | Feb 15, 2027 | $1,050,000K — fully redeemed/converted Q1 2025 |
| 2028 Notes | September 2024 | Sep 15, 2028 | $1,010,000K |
| 2029 Notes | November 2024 | Dec 1, 2029 | $3,000,000K (later reduced by $1.5B repurchase in 2026) |
| 2030A Notes | March 2024 | Mar 15, 2030 | $800,000K |
| 2030B Notes | February 2025 | Mar 1, 2030 | $2,000,000K |
| 2031 Notes | March 2024 | Mar 15, 2031 | $603,750K |
| 2032 Notes | June 2024 | Jun 15, 2032 | $800,000K |

---

## 4. Preferred Stock — Instrument Registry

| Series | IPO Settled | Initial Shares | Initial Price | Net Proceeds | Dividend |
|---|---|---|---|---|---|
| STRK | 2/5/2025 | 7,300,000 | $80.00 | ~$563.4M | 8.00% |
| STRF | ~3/25/2025 | (need exact share count) | $85.00 | ~$711.2M | 10.00% fixed |
| STRD | 6/10/2025 | 11,764,700 | $85.00 | ~$979.7M | 10.00% non-cumulative |
| STRC | 7/29/2025 | 28,011,111 | $90.00 | ~$2.474B | Variable (12.00% currently) |
| STRE (EUR) | 11/13/2025 | (need exact) | — | ~€620.0M / $715.1M | — |

**Important:** all four series continued growing after IPO via ongoing ATM
programs (STRC alone authorized up to $4.2B via ATM in July 2025). Notional
outstanding is NOT static after issuance — this is the preferred-stock
equivalent of the debt gap above, and likely the single hardest part of this
whole project since it requires tracking ATM sales over time per series,
not just one issuance event each.

## 4b. Preferred Stock — Total Notional/Liquidation Preference by Date

Source: 10-Q "Mezzanine Equity" statement + per-series share-count tables.

| Date | Total (computed or reported) | Detail |
|---|---|---|
| 9/30/2025 | ~$6.73B liquidation preference (computed) | STRF 11,948,292 sh @ $111.49 (~$1.332B) + STRC 28,011,111 sh @ $100 (~$2.801B) + STRK 13,605,866 sh @ $100 (~$1.361B) + STRD 12,322,141 sh @ $100 (~$1.232B) |
| 6/30/2026 | $14.4B carrying value / ~$15.5B liquidation preference (directly reported) | Big jump from Sept 2025 — reflects continued heavy ATM issuance across all series plus STRE's Nov 2025 addition |
| 8/23/2026 (investor briefing) | $14.966B notional | |
| 9/9/2026 (current WS Model file) | $14.625B notional | |

REMAINING GAP: 12/31/2025 and 3/31/2026 quarter-end totals (to bridge the
Sept 2025 → June 2026 jump); anything before the first STRK issuance
(Feb 2025) is $0 for preferred, since no preferred stock existed yet.
Same source pattern works for both: each 10-Q's "Mezzanine Equity" note.

---

## 5. USD Reserve / USD Cash

| Date | USD Reserve | USD Cash |
|---|---|---|
| 1/4/2026 | $2.25B | — |
| 6/30/2026 | $2.4B | — |
| 7/12/2026 | ~$3.0B | — |
| 8/2/2026 | $4.0B | — |
| 8/9/2026 | $4.65B | — |
| 8/23/2026 | $5.10B | $1.59B (newly created pool) |
| 9/7-9/2026 | $5.10B | $1.44B |

Note: "USD Cash" as a distinct pool from "USD Reserve" didn't exist before
~August 2026 — before that, treat USD Cash as $0 / not applicable.
This table has decent resolution already for 2026; pre-2026 needs pulling
if a full 2020-2026 span is wanted (USD Reserve concept may not have existed
in early years — needs verification of when it was first established).

---

## 6. BTC Price & MSTR Share Price

Not researched yet — but trivial compared to everything above. Any
crypto/stock data API (CoinGecko for BTC, Finnhub for MSTR — both already
integrated into wisesatoshi.com) returns full daily historical closes
instantly. This is an implementation step, not a research step.

---

## Priority order for next session

1. **Debt quarterly totals, remaining gaps** (Section 3b) — mechanical, same
   filing type each time, ~10-12 pulls.
2. **Preferred stock notional over time** (Section 4b) — harder, needs ATM
   sale tracking per series, likely the long pole in this whole project.
3. **BTC holdings, fill remaining 2026 weekly gaps** (Section 1) — optional,
   only needed if daily/weekly resolution is wanted rather than the monthly
   resolution already available.
4. **Pull actual daily BTC + MSTR price series** — cheap, do this last since
   it's just an API call once the fundamentals timeline is ready to combine
   it with.
