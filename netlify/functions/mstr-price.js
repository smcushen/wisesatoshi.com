// netlify/functions/mstr-price.js
//
// Secure proxy for MSTR's live stock price. The Finnhub API key lives only
// here, as a Netlify environment variable -- never exposed to the browser.
// The site's JavaScript calls this function instead of calling Finnhub directly.

exports.handler = async function (event, context) {
  const allowedOrigin = 'https://wisesatoshi.com';

  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Browsers send a preflight OPTIONS request before the real GET -- handle it.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server not configured -- missing API key.' }),
    };
  }

  try {
    const resp = await fetch(`https://finnhub.io/api/v1/quote?symbol=MSTR&token=${apiKey}`);
    if (!resp.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Upstream price provider error.' }) };
    }
    const data = await resp.json();
    // Finnhub's quote response uses "c" for current price.
    if (!data || typeof data.c !== 'number' || data.c <= 0) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No valid price returned.' }) };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ price: data.c, timestamp: data.t }),
    };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Fetch failed.' }) };
  }
};
