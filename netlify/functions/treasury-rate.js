let cache = { rate: null, date: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Serve from cache if fresh
  if (cache.rate && (Date.now() - cache.timestamp) < CACHE_TTL) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ rate: cache.rate, date: cache.date, timestamp: Math.floor(cache.timestamp / 1000), cached: true })
    };
  }

  try {
    const url = 'https://yieldwatch.io/api/rates/latest';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch error: ${response.status}`);
    const data = await response.json();
    if (!data.success || !data.data || !data.data.rates) throw new Error('no data');
    const tenYear = data.data.rates.find(r => r.maturity === '10YR');
    if (!tenYear) throw new Error('10YR not found');

    const rate = parseFloat(tenYear.rate.toFixed(2));
    cache = { rate, date: data.data.date, timestamp: Date.now() };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ rate, date: data.data.date, timestamp: Math.floor(Date.now() / 1000) })
    };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
