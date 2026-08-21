exports.handler = async function(event, context) {
  const apiKey = process.env.FINNHUB_API_KEY;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=^TNX&token=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Finnhub error: ${response.status}`);
    const data = await response.json();
    if (!data.c || data.c === 0) throw new Error('no price returned');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        rate: parseFloat(data.c.toFixed(2)),
        timestamp: Math.floor(Date.now() / 1000)
      })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
