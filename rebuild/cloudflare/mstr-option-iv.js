export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runFetchIv(env));
  },
  async fetch(request, env, ctx) {
    // Lets you manually trigger a run by just visiting the Worker's URL --
    // handy for testing without waiting for the cron schedule.
    const result = await runFetchIv(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'content-type': 'application/json' }
    });
  }
};

const SYMBOL = 'MSTR';
const GITHUB_OWNER = 'smcushen';
const GITHUB_REPO = 'wisesatoshi.com';
const CHAIN_PATH = 'data/mstr-options-chain.json';
const OUTPUT_PATH = 'data/mstr-options-iv.json';

// Same timezone-aware market-hours check as the original Node script --
// no fixed UTC offset, so it self-corrects for daylight saving.
function isMarketOpenNow() {
  const now = new Date();
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(now);
  const get = (type) => etParts.find(p => p.type === type)?.value;
  const weekday = get('weekday');
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= (9 * 60 + 30) && minutesSinceMidnight < 16 * 60;
}

async function githubApiFetch(path, env, options = {}) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'mstr-modler-iv-worker',
      ...(options.headers || {})
    }
  });
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function base64Decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function fetchIvForExpiration(expirationDate, apiKey) {
  const url = `https://api.marketdata.app/v1/options/chain/${SYMBOL}/?expiration=${expirationDate}&side=call`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
  });
  if (res.status !== 200 && res.status !== 203) return null;
  const data = await res.json();
  if (data.s !== 'ok') return null;
  const ivByStrike = {};
  for (let i = 0; i < data.strike.length; i++) {
    if (typeof data.iv[i] === 'number') ivByStrike[data.strike[i]] = data.iv[i];
  }
  return ivByStrike;
}

async function runFetchIv(env) {
  if (!isMarketOpenNow()) {
    return { skipped: true, reason: 'market closed' };
  }

  const chainRes = await githubApiFetch(CHAIN_PATH, env);
  if (!chainRes.ok) {
    return { error: 'failed to read chain file', status: chainRes.status };
  }
  const chainJson = await chainRes.json();
  const chain = JSON.parse(base64Decode(chainJson.content));

  const resultExpirations = [];
  for (const exp of chain.expirations) {
    const ivByStrike = await fetchIvForExpiration(exp.date, env.MARKETDATA_API_KEY);
    if (!ivByStrike) continue;
    const contracts = exp.strikes
      .filter(strike => strike in ivByStrike)
      .map(strike => ({ strike, iv: ivByStrike[strike] }));
    resultExpirations.push({ date: exp.date, contracts });
  }

  if (resultExpirations.length === 0) {
    return { error: 'no IV data fetched successfully' };
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'MarketData.app (15-minute delayed, via Cloudflare Worker)',
    expirations: resultExpirations
  };
  const newContentB64 = base64Encode(JSON.stringify(output, null, 2) + '\n');

  const currentRes = await githubApiFetch(OUTPUT_PATH, env);
  const currentJson = currentRes.ok ? await currentRes.json() : null;
  const sha = currentJson ? currentJson.sha : undefined;

  const putRes = await githubApiFetch(OUTPUT_PATH, env, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update options IV data (Cloudflare Worker)',
      content: newContentB64,
      sha
    })
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    return { error: 'failed to write IV file', status: putRes.status, details: errText };
  }

  return { success: true, expirations: resultExpirations.length };
}
