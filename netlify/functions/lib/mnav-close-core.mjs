// Shared logic for capturing the MSTR closing price + mNAV snapshot.
// Both capture-mnav-close-scheduled.mjs (runs on a schedule) and
// capture-mnav-close-check.mjs (runs when the site calls it after a visit)
// call captureIfNeeded() below — this is the one place the actual work
// happens, so the two trigger paths can never drift out of sync.

const REPO_OWNER = 'smcushen';
const REPO_NAME = 'wisesatoshi.com';
const REPO_BRANCH = 'main';
const SNAPSHOT_PATH = 'data/mnav-close-snapshot.json';
const FUNDAMENTALS_PATH = 'data/strategy-fundamentals.json';

// Same NYSE holiday list as the GitHub Actions workflow it replaces.
// Needs a fresh set of dates appended once a year — NYSE typically
// publishes ~13 months out, so check back whenever this list runs short.
const HOLIDAYS = new Set([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31',
  '2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
]);

function easternDateString(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

// True once it's 4:00pm ET or later on the given date — guards against
// ever writing an intraday price as if it were the close, which matters
// most for the on-visit path since a visit could land at any time of day.
function isAfterCloseET(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return hour > 16 || (hour === 16 && minute >= 0);
}

function isWeekday(date) {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short'
  }).format(date);
  return !['Sat', 'Sun'].includes(day);
}

// Returns the Eastern-calendar date string of the most recently completed
// trading day as of `now` — the day whose close price is actually correct
// to report, regardless of what the current wall-clock date is. This is
// what protects marketDate from ever getting mislabeled when a force=true
// capture runs outside the normal post-close window (e.g. 1am ET, or a
// weekend), which would otherwise stamp "today" onto what is really still
// the last completed trading day's frozen closing price.
function mostRecentTradingDay(now) {
  let d = isAfterCloseET(now) ? new Date(now) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let dateStr = easternDateString(d);
  while (!isWeekday(d) || HOLIDAYS.has(dateStr)) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    dateStr = easternDateString(d);
  }
  return dateStr;
}

// Identical formula to index.html's calcNetValuePerShare() and the GitHub
// Actions version it replaces — kept in sync by hand across all three,
// since none of them can literally import from one another.
function calcNetValuePerShare(btcHeld, btcPrice, debtB, preferredB, usdReserveB, usdCashB, sharesM) {
  const shares = sharesM * 1e6;
  const debt = debtB * 1e9;
  const preferred = preferredB * 1e9;
  const usdReserve = usdReserveB * 1e9;
  const usdCash = usdCashB * 1e9;
  const debtBtc = debt / btcPrice;
  const preferredBtc = preferred / btcPrice;
  const reserveBtc = usdReserve / btcPrice;
  const cashBtc = usdCash / btcPrice;
  const netBtc = btcHeld - debtBtc - preferredBtc + reserveBtc + cashBtc;
  return (netBtc / shares) * btcPrice;
}

async function githubGetFile(path) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${REPO_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const decoded = Buffer.from(data.content, 'base64').toString('utf8');
  return { content: JSON.parse(decoded), sha: data.sha };
}

async function githubPutFile(path, jsonObj, sha, message) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(jsonObj, null, 2) + '\n').toString('base64'),
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
}

async function fetchMstrPrice() {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=MSTR&token=${process.env.FINNHUB_API_KEY}`);
  const data = await res.json();
  const price = data && data.c;
  if (!price || price === 0) throw new Error('Failed to fetch a valid MSTR price from Finnhub');
  return price;
}

async function fetchBtcPrice() {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  const data = await res.json();
  const price = data && data.bitcoin && data.bitcoin.usd;
  if (!price || price === 0) throw new Error('Failed to fetch a valid BTC price from CoinGecko');
  return price;
}

// The one function both trigger files call. Returns an object describing
// what happened — never throws for the "nothing to do" cases (holiday,
// already captured, before close), only for genuine failures.
//
// The weekend/holiday/before-close guards below only apply to the normal
// scheduled/on-visit path (force=false). A forced backfill's job is to
// correctly label whatever the last real close was, regardless of what
// day or time it's actually called — so it skips these guards entirely
// and relies on mostRecentTradingDay() to find the right target date.
export async function captureIfNeeded({ force = false } = {}) {
  const now = new Date();
  const todayET = easternDateString(now);
  const marketDate = mostRecentTradingDay(now);

  if (!force) {
    if (HOLIDAYS.has(todayET)) {
      return { skipped: true, reason: 'holiday', marketDate };
    }
    if (!isWeekday(now)) {
      return { skipped: true, reason: 'weekend', marketDate };
    }
    if (!isAfterCloseET(now)) {
      return { skipped: true, reason: 'before_close', marketDate };
    }
  }

  const existing = await githubGetFile(SNAPSHOT_PATH);
  if (!force && existing.content && existing.content.marketDate === marketDate) {
    return { skipped: true, reason: 'already_captured', marketDate };
  }

  const mstrPrice = await fetchMstrPrice();
  const btcPrice = await fetchBtcPrice();

  const fundamentalsFile = await githubGetFile(FUNDAMENTALS_PATH);
  const fundamentals = fundamentalsFile.content;
  if (!fundamentals) throw new Error('strategy-fundamentals.json not found in repo');

  const netValuePerShare = calcNetValuePerShare(
    fundamentals.btcHeld,
    btcPrice,
    fundamentals.convertibleDebtBillions,
    fundamentals.preferredStockBillions,
    fundamentals.usdReserveBillions,
    fundamentals.usdCashBillions || 0,
    fundamentals.fdsoMillions || fundamentals.sharesOutstandingMillions
  );
  const mnav = mstrPrice / netValuePerShare;

  const snapshot = {
    mstrClosePrice: mstrPrice,
    btcPriceAtClose: btcPrice,
    netValuePerShareAtClose: netValuePerShare,
    mnav,
    marketDate,
    capturedAt: now.toISOString(),
  };

  await githubPutFile(SNAPSHOT_PATH, snapshot, existing.sha, 'Capture mNAV at market close (via Netlify)');

  return { captured: true, snapshot };
}
