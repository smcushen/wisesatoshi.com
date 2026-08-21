exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const url = 'https://yieldwatch.io/api/rates/latest';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch error: ${response.status}`);
    const data = await response.json();

    if (!data.success || !data.data || !data.data.rates) throw new Error('no data');

    const tenYear = data.data.rates.find(r => r.maturity === '10YR');
    if (!tenYear) throw new Error('10YR not found');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        rate: parseFloat(tenYear.rate.toFixed(2)),
        date: data.data.date,
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
