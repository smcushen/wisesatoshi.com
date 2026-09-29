// mstr-options-activity: daily MSTR LEAPS call volume + open interest tracker,
// plus keeper of the app's picker file (data/mstr-options-chain.json)
const TICKER = "MSTR";
const DATA_DIR = "data/options-activity";
const CHAIN_PATH = "data/mstr-options-chain.json";
const TOP_N = 20;
const DEFAULT_MIN_DAYS = 210;   // override with the MIN_DAYS variable in Cloudflare
const MIN_OPEN_INTEREST = 25;   // picker lists strikes with call OI above this

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      run(env, { write: true })
        .then(r => console.log(JSON.stringify(r)))
        .catch(e => console.error("Run failed:", String(e)))
    );
  },
  // Manual test: ?key=RUN_KEY (dry run) or ?key=RUN_KEY&write=1 (real write)
  // Backfill:    ?key=RUN_KEY&backfill_from=YYYY-MM-DD&backfill_to=YYYY-MM-DD (add &write=1 to save)
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.RUN_KEY || url.searchParams.get("key") !== env.RUN_KEY) {
      return new Response("Not found", { status: 404 });
    }
    const write = url.searchParams.get("write") === "1";
    try {
      const from = url.searchParams.get("backfill_from");
      const to = url.searchParams.get("backfill_to");
      const result = (from || to)
        ? await runBackfill(env, { from, to, write })
        : await run(env, { write });
      return json(result);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};

async function run(env, { write }) {
  // No bid/ask/mid/last columns = billed as a single request
  const apiUrl = `https://api.marketdata.app/v1/options/chain/${TICKER}/?expiration=all&columns=optionSymbol,volume,openInterest,updated`;
  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${env.MARKETDATA_API_KEY}`, Accept: "application/json" },
  });
  const creditsConsumed = res.headers.get("X-Api-Ratelimit-Consumed");
  const creditsRemaining = res.headers.get("X-Api-Ratelimit-Remaining");
  if (!res.ok) throw new Error(`MarketData ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const d = await res.json();
  const syms = d.optionSymbol;
  if (!Array.isArray(syms) || syms.length === 0) throw new Error("MarketData returned no contracts");

  // Trading date = newest quote timestamp, in Eastern time (handles holidays)
  const stamps = (d.updated || []).map(Number).filter(Number.isFinite);
  const tradeDate = etDate(stamps.length ? Math.max(...stamps) * 1000 : Date.now());
  const month = tradeDate.slice(0, 7);
  const path = `${DATA_DIR}/${month}.json`;

  // LEAPS rule: calls expiring at least MIN_DAYS after the trade date
  const minDays = Number(env.MIN_DAYS) || DEFAULT_MIN_DAYS;
  const cutoff = addDays(tradeDate, minDays);
  const isLeapsCall = p => p && p.side === "call" && p.expiration >= cutoff;

  const summary = {
    mode: write ? "WRITE" : "DRY RUN", tradeDate, minDays, cutoff,
    contractsReturned: syms.length, creditsConsumed, creditsRemaining, wrote: false,
  };

  // Part 1: keep the app's expiration/strike picker file current
  summary.pickerChain = await updatePickerChain(env, d, minDays, write);

  // Part 2: monthly activity lists
  const { sha, data: existing } = await ghGet(env, path);
  const file = existing || { ticker: TICKER, month, tradeDates: [], contracts: {} };
  if (file.tradeDates.includes(tradeDate)) {
    summary.skipped = `Activity already recorded for ${tradeDate}`;
    return summary;
  }

  // contracts[symbol] = [monthVolumeTotal, latestOpenInterest]
  const expirationsToday = new Set();
  let kept = 0;
  for (let i = 0; i < syms.length; i++) {
    const p = parseOcc(syms[i]);
    if (!isLeapsCall(p)) continue;
    expirationsToday.add(p.expiration);
    const vol = Number(d.volume?.[i]) || 0;
    const oi = Number(d.openInterest?.[i]) || 0;
    const prev = file.contracts[syms[i]];
    if (!prev && vol === 0 && oi === 0) continue;
    file.contracts[syms[i]] = [(prev ? prev[0] : 0) + vol, oi];
    kept++;
  }
  file.tradeDates.push(tradeDate);
  file.tradeDates.sort();

  const out = buildMonthOutput(file, month, minDays, tradeDate);

  if (write) {
    await ghPut(env, path, serialize(out), sha, `Options activity: ${TICKER} LEAPS ${tradeDate}`);
    summary.wrote = true;
  }
  summary.leapsContractsKept = kept;
  summary.expirationsIncluded = [...expirationsToday].sort();
  summary.topVolumePreview = out.topVolume.slice(0, 5);
  summary.topOpenInterestPreview = out.topOpenInterest.slice(0, 5);
  return summary;
}

// One-time historical fill for trading days missed before tracking started.
// Uses MarketData's end-of-day historical chains (date=...). Skips weekends,
// holidays (no data returned), and any date already in the month file.
// Open interest is only overwritten by dates newer than anything already
// recorded, so older backfilled days never replace a fresher OI snapshot.
async function runBackfill(env, { from, to, write }) {
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  if (!isDate(from) || !isDate(to) || from > to) {
    throw new Error("Use backfill_from and backfill_to as YYYY-MM-DD, with from <= to");
  }
  if (from.slice(0, 7) !== to.slice(0, 7)) throw new Error("Backfill one calendar month per request");

  const month = from.slice(0, 7);
  const path = `${DATA_DIR}/${month}.json`;
  const minDays = Number(env.MIN_DAYS) || DEFAULT_MIN_DAYS;

  const { sha, data: existing } = await ghGet(env, path);
  const file = existing || { ticker: TICKER, month, tradeDates: [], contracts: {} };
  const latestRecorded = file.tradeDates.length ? file.tradeDates[file.tradeDates.length - 1] : "";

  const summary = { mode: write ? "WRITE (backfill)" : "DRY RUN (backfill)", from, to, days: [], wrote: false };
  let added = 0;

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (file.tradeDates.includes(day)) {
      summary.days.push({ date: day, skipped: "already recorded" });
      continue;
    }

    const apiUrl = `https://api.marketdata.app/v1/options/chain/${TICKER}/?date=${day}&expiration=all&columns=optionSymbol,volume,openInterest`;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${env.MARKETDATA_API_KEY}`, Accept: "application/json" },
    });
    const credits = res.headers.get("X-Api-Ratelimit-Consumed");
    summary.creditsRemaining = res.headers.get("X-Api-Ratelimit-Remaining");
    if (res.status === 204 || res.status === 404) {
      summary.days.push({ date: day, skipped: "no data (market holiday?)", credits });
      continue;
    }
    if (!res.ok) throw new Error(`MarketData ${res.status} for ${day}: ${(await res.text()).slice(0, 300)}`);
    const d = await res.json();
    const syms = d.optionSymbol;
    if (d.s === "no_data" || !Array.isArray(syms) || syms.length === 0) {
      summary.days.push({ date: day, skipped: "no data (market holiday?)", credits });
      continue;
    }

    const cutoff = addDays(day, minDays);
    const newerThanRecorded = day > latestRecorded;
    let kept = 0, dayVolume = 0;
    for (let i = 0; i < syms.length; i++) {
      const p = parseOcc(syms[i]);
      if (!p || p.side !== "call" || p.expiration < cutoff) continue;
      const vol = Number(d.volume?.[i]) || 0;
      const oi = Number(d.openInterest?.[i]) || 0;
      const prev = file.contracts[syms[i]];
      if (!prev && vol === 0 && oi === 0) continue;
      const newOi = !prev || newerThanRecorded ? oi : prev[1];
      file.contracts[syms[i]] = [(prev ? prev[0] : 0) + vol, newOi];
      kept++;
      dayVolume += vol;
    }
    file.tradeDates.push(day);
    added++;
    summary.days.push({ date: day, contractsReturned: syms.length, leapsKept: kept, leapsVolume: dayVolume, credits });
  }

  file.tradeDates.sort();
  const asOf = file.tradeDates[file.tradeDates.length - 1] || to;
  const out = buildMonthOutput(file, month, minDays, asOf);

  if (write && added > 0) {
    await ghPut(env, path, serialize(out), sha, `Options activity: ${TICKER} LEAPS backfill ${from} to ${to}`);
    summary.wrote = true;
  }
  summary.daysAdded = added;
  summary.tradeDatesNow = file.tradeDates;
  summary.topVolumePreview = out.topVolume.slice(0, 5);
  return summary;
}

// Builds the month file: both top-20 lists (only contracts that still
// qualify as of `asOf`) followed by the raw per-contract data.
function buildMonthOutput(file, month, minDays, asOf) {
  const cutoff = addDays(asOf, minDays);
  const rows = Object.entries(file.contracts)
    .map(([symbol, [volume, openInterest]]) => ({ symbol, ...parseOcc(symbol), volume, openInterest }))
    .filter(r => r.side === "call" && r.expiration >= cutoff);
  return {
    ticker: TICKER,
    month,
    filter: { side: "call", minDaysToExpiration: minDays, asOf, earliestIncluded: cutoff },
    tradeDates: file.tradeDates,
    lastUpdated: new Date().toISOString(),
    topVolume: [...rows].sort((a, b) => b.volume - a.volume).slice(0, TOP_N),
    topOpenInterest: [...rows].sort((a, b) => b.openInterest - a.openInterest).slice(0, TOP_N),
    contracts: file.contracts,
  };
}

// Rebuilds data/mstr-options-chain.json in the same format the app and IV worker already read.
// New expirations join once MIN_DAYS+ out; each stays until it expires.
// Strikes: call OI above MIN_OPEN_INTEREST, plus any already-listed strike still trading.
async function updatePickerChain(env, d, minDays, write) {
  const today = etDate(Date.now());
  const joinCutoff = addDays(today, minDays);

  const live = {};
  for (let i = 0; i < d.optionSymbol.length; i++) {
    const p = parseOcc(d.optionSymbol[i]);
    if (!p || p.side !== "call" || p.expiration < today) continue;
    (live[p.expiration] ||= new Map()).set(p.strike, Number(d.openInterest?.[i]) || 0);
  }

  const { sha, data: old } = await ghGet(env, CHAIN_PATH);
  const oldByDate = new Map((old?.expirations || []).map(e => [e.date, e.strikes]));

  const expirations = [];
  const added = [];
  const allDates = new Set([...Object.keys(live), ...oldByDate.keys()]);
  for (const date of [...allDates].sort()) {
    if (date < today) continue;
    const wasListed = oldByDate.has(date);
    if (!wasListed && date < joinCutoff) continue;
    const oldStrikes = oldByDate.get(date) || [];
    const liveStrikes = live[date];
    if (!liveStrikes) {
      expirations.push({ date, strikes: oldStrikes });
      continue;
    }
    const keep = new Set();
    for (const [strike, oi] of liveStrikes) if (oi > MIN_OPEN_INTEREST) keep.add(strike);
    for (const strike of oldStrikes) if (liveStrikes.has(strike)) keep.add(strike);
    if (keep.size === 0) continue;
    if (!wasListed) added.push(date);
    expirations.push({ date, strikes: [...keep].sort((a, b) => a - b) });
  }

  const removed = [...oldByDate.keys()].filter(dt => !expirations.some(e => e.date === dt));
  const strikeCounts = Object.fromEntries(
    expirations.map(e => [e.date, `${(oldByDate.get(e.date) || []).length} -> ${e.strikes.length}`])
  );
  const changed = JSON.stringify(old?.expirations || []) !== JSON.stringify(expirations);
  const result = { changed, wrote: false, added, removed, strikeCounts };

  if (write && changed && expirations.length > 0) {
    const out = {
      lastUpdated: today,
      activityFilter: `Strikes with call open interest <= ${MIN_OPEN_INTEREST} excluded (already-listed strikes kept while still trading)`,
      cutoffMonths: Math.round(minDays / 30),
      joinRule: `New expirations added once ${minDays}+ days out; each stays until it expires`,
      updateCadence: "daily (commits only when something changes)",
      expirations,
    };
    await ghPut(env, CHAIN_PATH, JSON.stringify(out, null, 2) + "\n", sha, `Update options chain (${today})`);
    result.wrote = true;
  }
  return result;
}

// OCC symbol, e.g. MSTR281215C00275000
function parseOcc(sym) {
  const m = sym.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const [, , ymd, cp, k] = m;
  return {
    expiration: `20${ymd.slice(0, 2)}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`,
    side: cp === "C" ? "call" : "put",
    strike: Number(k) / 1000,
  };
}

function addDays(ymd, n) {
  const dt = new Date(`${ymd}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function etDate(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));
}

// Readable top lists, compact one-line-per-contract data
function serialize(out) {
  const { contracts, ...head } = out;
  const h = JSON.stringify(head, null, 2);
  const c = Object.entries(contracts).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  return h.replace(/\n}$/, `,\n  "contracts": {\n${c}\n  }\n}\n`);
}

function ghUrl(env, path) {
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
}
function ghHeaders(env, accept = "application/vnd.github+json") {
  return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "mstr-options-activity", Accept: accept };
}

async function ghGet(env, path) {
  const meta = await fetch(ghUrl(env, path), { headers: ghHeaders(env) });
  if (meta.status === 404) return { sha: null, data: null };
  if (!meta.ok) throw new Error(`GitHub GET ${meta.status}: ${(await meta.text()).slice(0, 300)}`);
  const { sha } = await meta.json();
  const raw = await fetch(ghUrl(env, path), { headers: ghHeaders(env, "application/vnd.github.raw") });
  return { sha, data: JSON.parse(await raw.text()) };
}

async function ghPut(env, path, text, sha, message) {
  const body = { message, content: btoa(text) };
  if (sha) body.sha = sha;
  const r = await fetch(ghUrl(env, path), { method: "PUT", headers: ghHeaders(env), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json" } });
}
