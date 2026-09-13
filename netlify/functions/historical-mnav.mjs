// netlify/functions/historical-mnav.mjs
//
// Reconstructs Strategy's daily mNAV back to August 11, 2020 -- the date of
// its first-ever Bitcoin purchase -- by combining:
//
//   1. Four independent, dated timelines of real fundamentals (BTC held,
//      debt, preferred stock, FDSO) sourced from SEC 8-Ks/10-Qs and
//      strategy.com/shares. See strategy-historical-fundamentals.md for
//      full citations on every number below. Each timeline only contains
//      genuinely sourced data points -- nothing here is interpolated or
//      invented. Between two real dates, the earlier value is carried
//      forward (fundamentals only change at real disclosure events, not
//      daily), which is why the resulting chart will show a "stepped"
//      shape in periods where our source data is sparse (e.g. gaps
//      between 10-Qs) and a smoother one where it's dense (2026 weekly
//      BTC-holdings updates).
//
//   2. Real daily closing prices for BTC and MSTR, pulled from Yahoo
//      Finance's free, unauthenticated chart API. Chosen over
//      CoinGecko/Finnhub because both have introduced free-tier limits on
//      multi-year historical ranges; Yahoo's endpoint needs no API key and
//      has no such restriction as of this writing -- worth re-verifying if
//      this ever starts failing, since undocumented free APIs can change
//      behavior without notice.
//
// IMPORTANT: MSTR executed a 10-for-1 stock split in August 2024. Every
// share-count figure in FDSO_HISTORY below is already stated on a
// post-split basis (confirmed by strategy.com/shares' own footnote to that
// effect). To stay consistent, this function uses Yahoo's *adjusted* close
// for MSTR (which back-adjusts historical prices for splits), not the raw
// close -- using raw close would make every pre-August-2024 mNAV value
// wrong by roughly a factor of 10.
//
// This is a large one-time computation (~1,500+ trading days). It's built
// to run on demand, not on a schedule: call it once, save the returned
// JSON as a static file in the repo (e.g. data/historical-mnav.json), and
// have the site read that static file going forward rather than
// re-running this every time someone loads the page.

// ---------- Fundamentals timelines (real, sourced data points only) ----------

// BTC held, in whole coins. Sources: original 2020 8-Ks, strategy.com/shares,
// 2026 weekly 8-Ks, investor briefings.
const BTC_HOLDINGS = [
  { date: '2020-08-11', value: 21454 },
  { date: '2020-09-14', value: 38250 },
  { date: '2020-12-21', value: 70470 },
  { date: '2021-12-31', value: 124391 },
  { date: '2022-12-31', value: 132500 },
  { date: '2023-12-31', value: 189150 },
  { date: '2024-12-31', value: 447470 },
  { date: '2025-12-31', value: 672500 },
  { date: '2026-01-04', value: 673783 },
  { date: '2026-02-01', value: 713502 },
  { date: '2026-03-31', value: 762099 },
  { date: '2026-05-03', value: 818334 },
  { date: '2026-06-28', value: 847363 },
  { date: '2026-07-12', value: 843775 },
  { date: '2026-08-02', value: 842138 },
  { date: '2026-08-23', value: 840447 },
  { date: '2026-09-07', value: 845050 },
];

// Long-term debt, net carrying value, in $B. Source: 10-Q "Long-term Debt"
// note each quarter -- a single reported total, no reconstruction needed.
const DEBT_HISTORY = [
  { date: '2020-12-21', value: 0.650 }, // face value of first-ever convertible notes; exact net carrying value at issuance not yet pulled (would be slightly below 0.650 after discount)
  { date: '2021-06-30', value: 2.151 },
  { date: '2021-09-30', value: 2.153 },
  { date: '2021-12-31', value: 2.155 },
  { date: '2022-03-31', value: 2.362 },
  { date: '2022-09-30', value: 2.377 },
  { date: '2022-12-31', value: 2.379 },
  { date: '2023-06-30', value: 2.178 },
  { date: '2023-12-31', value: 1.681 },
  { date: '2024-06-30', value: 3.347 },
  { date: '2024-12-31', value: 7.192 },
  { date: '2025-03-31', value: 8.141 },
  { date: '2026-06-30', value: 6.700 },
  { date: '2026-08-23', value: 6.754 },
  { date: '2026-09-07', value: 6.714 },
];

// Preferred stock, total notional/liquidation preference, in $B. $0 before
// the first-ever preferred issuance (STRK, Feb 2025) is correct, not a gap.
const PREFERRED_HISTORY = [
  { date: '2025-02-05', value: 0.563 }, // STRK initial net proceeds
  { date: '2025-03-25', value: 1.274 }, // + STRF initial (~0.711B)
  { date: '2025-06-10', value: 2.254 }, // + STRD initial (~0.980B)
  { date: '2025-07-29', value: 4.728 }, // + STRC initial (~2.474B)
  { date: '2025-09-30', value: 6.730 }, // computed from actual per-series share counts x liquidation preference
  { date: '2026-06-30', value: 14.400 }, // directly reported carrying value
  { date: '2026-08-23', value: 14.966 },
  { date: '2026-09-07', value: 14.625 },
];

// USD Reserve + USD Cash combined, in $B. $0 before the Digital Credit
// Capital Framework's USD Reserve concept existed.
const USD_ASSETS_HISTORY = [
  { date: '2026-01-04', value: 2.25 },
  { date: '2026-06-30', value: 2.40 },
  { date: '2026-07-12', value: 3.00 },
  { date: '2026-08-02', value: 4.00 },
  { date: '2026-08-09', value: 4.65 },
  { date: '2026-08-23', value: 6.69 }, // USD Reserve 5.10 + USD Cash 1.59 (USD Cash newly created this date)
  { date: '2026-09-07', value: 6.54 }, // USD Reserve 5.10 + USD Cash 1.44
];

// Fully Diluted Shares Outstanding, in millions. Source: strategy.com/shares
// historical table (already stated on a post-2024-split basis). 2020-08-11
// and 2020-09-14 use the 2020 year-end figure as the nearest available
// anchor -- exact share count on those specific dates not yet pulled.
const FDSO_HISTORY = [
  { date: '2020-08-11', value: 95.87 },
  { date: '2020-12-31', value: 95.87 },
  { date: '2021-12-31', value: 149.234 },
  { date: '2022-12-31', value: 156.113 },
  { date: '2023-12-31', value: 207.636 },
  { date: '2024-12-31', value: 281.735 },
  { date: '2025-12-31', value: 344.897 },
  { date: '2026-03-31', value: 378.834 },
  { date: '2026-06-30', value: 401.283 },
  { date: '2026-09-07', value: 424.51 },
];

// Returns the most recent value on or before targetDate from a sorted
// {date, value} series, or 0 if targetDate is before the series' first
// entry (correct for debt/preferred/USD-assets, which genuinely didn't
// exist yet; for BTC/FDSO this should never actually trigger, since the
// chart's date range starts at the first entry in BTC_HOLDINGS).
function lookupAsOf(series, targetDate) {
  let result = 0;
  for (const point of series) {
    if (point.date > targetDate) break;
    result = point.value;
  }
  return result;
}

// calcNetValuePerShare -- identical formula to the one already in
// mnav-close-core.mjs and index.html. Kept in sync by hand, same as those
// two, since none of these files can literally import from one another.
function calcNetValuePerShare(btcHeld, btcPrice, debtB, preferredB, usdAssetsB, fdsoM) {
  const shares = fdsoM * 1e6;
  const debt = debtB * 1e9;
  const preferred = preferredB * 1e9;
  const usdAssets = usdAssetsB * 1e9;
  const debtBtc = debt / btcPrice;
  const preferredBtc = preferred / btcPrice;
  const assetsBtc = usdAssets / btcPrice;
  const netBtc = btcHeld - debtBtc - preferredBtc + assetsBtc;
  return (netBtc / shares) * btcPrice;
}

// Yahoo Finance's free, unauthenticated chart endpoint. No API key needed.
async function fetchYahooDailyHistory(symbol, period1, period2) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed for ${symbol}: ${res.status}`);
  const data = await res.json();
  const result = data.chart.result[0];
  const timestamps = result.timestamp;
  // adjclose (not close) -- back-adjusted for MSTR's Aug 2024 10-for-1
  // split, so prices stay consistent with FDSO_HISTORY's post-split share
  // counts across the whole date range. For BTC this is a no-op (no
  // splits exist for a cryptocurrency), so using adjclose for both is safe.
  const adjcloses = result.indicators.adjclose[0].adjclose;
  const map = {};
  timestamps.forEach((t, i) => {
    if (adjcloses[i] == null) return;
    const dateStr = new Date(t * 1000).toISOString().slice(0, 10);
    map[dateStr] = adjcloses[i];
  });
  return map;
}

export async function handler() {
  try {
    const startDate = '2020-08-11';
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);

    const [btcPrices, mstrPrices] = await Promise.all([
      fetchYahooDailyHistory('BTC-USD', period1, period2),
      fetchYahooDailyHistory('MSTR', period1, period2),
    ]);

    // Drive the date grid off MSTR's actual trading days (it only trades
    // NYSE weekdays), since MSTR is the instrument actually being valued --
    // BTC trades 24/7 but there's no meaningful "MSTR mNAV" on a day MSTR
    // itself didn't trade.
    const series = [];
    for (const date of Object.keys(mstrPrices).sort()) {
      const mstrPrice = mstrPrices[date];
      const btcPrice = btcPrices[date];
      if (!btcPrice) continue; // skip if BTC data happens to be missing this exact date

      const btcHeld = lookupAsOf(BTC_HOLDINGS, date);
      const debtB = lookupAsOf(DEBT_HISTORY, date);
      const preferredB = lookupAsOf(PREFERRED_HISTORY, date);
      const usdAssetsB = lookupAsOf(USD_ASSETS_HISTORY, date);
      const fdsoM = lookupAsOf(FDSO_HISTORY, date);
      if (btcHeld === 0 || fdsoM === 0) continue; // before real data starts

      const netValuePerShare = calcNetValuePerShare(btcHeld, btcPrice, debtB, preferredB, usdAssetsB, fdsoM);
      const mnav = netValuePerShare > 0 ? mstrPrice / netValuePerShare : null;

      series.push({ date, btcPrice, mstrPrice, netValuePerShare, mnav });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generatedAt: new Date().toISOString(), series }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
