const https = require('https');

// Hard caps — prevent runaway cost from malformed or malicious requests
const MAX_TOKENS_HARD_CAP = 2000;
const ALLOWED_MODEL_PREFIX = 'claude-';
const MAX_BODY_MESSAGES = 10;
const MAX_STRING_LENGTH = 60000; // per system/content field

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(404).end('Not found'); return; }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not configured' } }); return; }

  // ── Request validation ────────────────────────────────────────────────────
  const raw = req.body;
  if (!raw || typeof raw !== 'object') {
    return res.status(400).json({ error: { message: 'Request body must be a JSON object' } });
  }

  const { model, max_tokens, system, messages, tools } = raw;

  // Model guard — must be a claude-* model string
  if (!model || typeof model !== 'string' || !model.startsWith(ALLOWED_MODEL_PREFIX)) {
    return res.status(400).json({ error: { message: 'Invalid or missing model' } });
  }

  // Messages guard — must be a non-empty array
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Missing or empty messages array' } });
  }

  // ── Build sanitized body ──────────────────────────────────────────────────
  // Only forward expected fields; cap all scalar sizes; validate roles.
  const safeBody = {
    model: String(model).slice(0, 100),
    max_tokens: Math.min(Math.max(1, Number(max_tokens) || 1500), MAX_TOKENS_HARD_CAP),
    messages: messages
      .slice(0, MAX_BODY_MESSAGES)
      .map(m => ({
        role: (m.role === 'assistant') ? 'assistant' : 'user',
        content: typeof m.content === 'string'
          ? m.content.slice(0, MAX_STRING_LENGTH)
          : String(m.content ?? '').slice(0, MAX_STRING_LENGTH),
      })),
  };

  if (typeof system === 'string') {
    safeBody.system = system.slice(0, MAX_STRING_LENGTH);
  }

  // Tools — only forward web_search tool type; strip unknown tool types
  if (Array.isArray(tools) && tools.length > 0) {
    const safeTools = tools
      .filter(t => t && typeof t === 'object' && typeof t.type === 'string' && t.type.startsWith('web_search'))
      .slice(0, 2);
    if (safeTools.length > 0) safeBody.tools = safeTools;
  }

  const body = JSON.stringify(safeBody);

  try {
    console.log(`  → model: ${safeBody.model}  max_tokens: ${safeBody.max_tokens}  web_search: ${!!(safeBody.tools?.length)}`);
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
