// Fetches real implied volatility from MarketData.app for every strike/
// expiration already listed in mstr-options-chain.json, but ONLY during
// actual NYSE trading hours (9:30am-4:00pm ET, Mon-Fri). Outside those
// hours this script does nothing at all -- the last real IV values stay
// cached in place, since after-hours IV never changes anyway (there are
// no new trades to derive it from). Uses timezone-aware date math (not a
// fixed UTC offset) so it self-corrects for daylight saving automatically.

import { readFile, writeFile } from 'fs/promises';

const SYMBOL = 'MSTR';
const CHAIN_FILE = 'data/mstr-options-chain.json';
const OUTPUT_FILE = 'data/mstr-options-iv.json';

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
  const marketOpen = 9 * 60 + 30;   // 9:30am ET
  const marketClose = 16 * 60;      // 4:00pm ET
  return minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose;
  // Note: does not account for market holidays. On a holiday this will
  // attempt fetches that likely just return the prior close's data
  // unchanged -- harmless, just a few wasted API credits, not incorrect data.
}

async function fetchIvForExpiration(expirationDate, apiKey) {
  const url = `https://api.marketdata.app/v1/options/chain/${SYMBOL}/?expiration=${expirationDate}&side=call`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
  });

  // MarketData.app returns 203 (served from cache) as a valid success
  // response identical in shape to 200 -- both must be accepted.
  if (res.status !== 200 && res.status !== 203) {
    console.error(`Expiration ${expirationDate}: HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  if (data.s !== 'ok') {
    console.error(`Expiration ${expirationDate}: API returned status "${data.s}"`);
    return null;
  }

  const ivByStrike = {};
  for (let i = 0; i < data.strike.length; i++) {
    if (typeof data.iv[i] === 'number') {
      ivByStrike[data.strike[i]] = data.iv[i];
    }
  }
  return ivByStrike;
}

async function main() {
  const apiKey = process.env.MARKETDATA_API_KEY;
  if (!apiKey) {
    console.error('MARKETDATA_API_KEY not set -- skipping fetch.');
    return;
  }

  if (!isMarketOpenNow()) {
    console.log('Market closed -- skipping fetch, leaving cached IV data untouched.');
    return;
  }

  const chainRaw = await readFile(CHAIN_FILE, 'utf-8');
  const chain = JSON.parse(chainRaw);

  const resultExpirations = [];

  for (const exp of chain.expirations) {
    const ivByStrike = await fetchIvForExpiration(exp.date, apiKey);
    if (!ivByStrike) continue;

    const contracts = exp.strikes
      .filter(strike => strike in ivByStrike)
      .map(strike => ({ strike, iv: ivByStrike[strike] }));

    resultExpirations.push({ date: exp.date, contracts });
  }

  if (resultExpirations.length === 0) {
    console.error('No IV data fetched successfully -- not overwriting output file.');
    return;
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'MarketData.app (15-minute delayed)',
    expirations: resultExpirations
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote IV data for ${resultExpirations.length} expirations.`);
}

main().catch(err => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
