let cache = { price: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Serve from cache if fresh
  if (cache.price && (Date.now() - cache.timestamp) < CACHE_TTL) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ price: cache.price, timestamp: Math.floor(cache.timestamp / 1000), cached: true })
    };
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=MSTR&token=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Finnhub error: ${response.status}`);
    const data = await response.json();
    if (!data.c || data.c === 0) throw new Error('no price returned');

    cache = { price: data.c, timestamp: Date.now() };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ price: data.c, timestamp: Math.floor(Date.now() / 1000) })
    };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
