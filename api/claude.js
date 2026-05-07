const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(404).end('Not found'); return; }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not configured' } }); return; }

  const body = JSON.stringify(req.body);

  try {
    const parsed = req.body;
    console.log(`  → model: ${parsed.model}  max_tokens: ${parsed.max_tokens}  web_search: ${!!(parsed.tools?.length)}`);
  } catch {}

  await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const proxyReq = https.request(options, proxyRes => {
      let responseBody = '';
      proxyRes.on('data', chunk => responseBody += chunk);
      proxyRes.on('end', () => {
        if (proxyRes.statusCode !== 200) {
          console.error(`  ✗ Anthropic API ${proxyRes.statusCode}: ${responseBody}`);
        } else {
          console.log(`  ✓ ${proxyRes.statusCode} OK (${responseBody.length} bytes)`);
        }
        res.status(proxyRes.statusCode).setHeader('Content-Type', 'application/json').end(responseBody);
        resolve();
      });
    });

    proxyReq.on('error', err => {
      console.error(`  ✗ Proxy error: ${err.message}`);
      res.status(500).json({ error: { message: err.message } });
      resolve();
    });

    proxyReq.write(body);
    proxyReq.end();
  });
};
