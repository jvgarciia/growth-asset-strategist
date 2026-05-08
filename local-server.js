require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env file');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 1. Log every request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) { res.writeHead(500); res.end('Could not read index.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/claude') {
    res.writeHead(404); res.end('Not found'); return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // 2. Log the model and key request params
    try {
      const parsed = JSON.parse(body);
      console.log(`  → model: ${parsed.model}  max_tokens: ${parsed.max_tokens}  web_search: ${!!(parsed.tools?.length)}`);
    } catch {}

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proxyReq = https.request(options, proxyRes => {
      // 3. Collect full response body so we can inspect it before forwarding
      let responseBody = '';
      proxyRes.on('data', chunk => responseBody += chunk);
      proxyRes.on('end', () => {
        // 4. Log errors with full body; log success with byte count
        if (proxyRes.statusCode !== 200) {
          console.error(`  ✗ Anthropic API ${proxyRes.statusCode}:`);
          console.error(`    ${responseBody}`);
        } else {
          console.log(`  ✓ ${proxyRes.statusCode} OK (${responseBody.length} bytes)`);
        }
        // 5. Forward the full response (error or success) to the frontend
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', err => {
      console.error(`  ✗ Proxy network error: ${err.message}`);
      res.writeHead(500); res.end(JSON.stringify({ error: { message: err.message } }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ SEO Agent server running at http://localhost:${PORT}`);
  console.log(`   Open index.html in your browser to start\n`);
});
