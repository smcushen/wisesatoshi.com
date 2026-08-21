exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Alpha Vantage Treasury yield — no key needed for this endpoint
    const url = 'https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=demo';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch error: ${response.status}`);
    const data = await response.json();
    
    // Data comes back as array of {date, value} — grab most recent
    const series = data?.data;
    if (!series || !series.length) throw new Error('no data');
    
    const latest = series[0];
    const rate = parseFloat(latest.value);
    if (!rate || isNaN(rate)) throw new Error('no price returned');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        rate: parseFloat(rate.toFixed(2)),
        date: latest.date,
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
