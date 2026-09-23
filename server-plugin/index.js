'use strict';

const http = require('node:http');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 17463;
const MAX_BYTES = 2 * 1024 * 1024;

function bridgeRequest(method, path, body, pairingToken, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    if (payload && payload.length > MAX_BYTES) {
      reject(Object.assign(new Error('request-too-large'), { code: 'ETOOBIG' }));
      return;
    }
    const headers = { Accept: 'application/json', Connection: 'close' };
    if (pairingToken) headers['X-Moli-Pairing-Token'] = pairingToken;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    const request = http.request({ hostname: BRIDGE_HOST, port: BRIDGE_PORT, path: `/v1${path}`, method, headers }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) response.destroy(Object.assign(new Error('response-too-large'), { code: 'ETOOBIG' }));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch { reject(Object.assign(new Error('invalid-bridge-response'), { code: 'EBADMSG' })); }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(Object.assign(new Error('bridge-timeout'), { code: 'ETIMEDOUT' })));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function operationRequest(operation, body) {
  const scope = typeof body.scopeKey === 'string' ? body.scopeKey : '';
  const query = `?scopeKey=${encodeURIComponent(scope)}`;
  switch (operation) {
    case 'lease-get': return ['GET', `/lease${query}`];
    case 'lease-cas': return ['POST', '/lease/cas'];
    case 'wake-request-post': return ['POST', '/wake-request'];
    case 'wake-results-get': return ['GET', `/wake-results${query}`];
    case 'wake-results-ack': return ['POST', '/wake-results/ack'];
    case 'mcp-profile-post': return ['POST', '/mcp-profile'];
    default: return null;
  }
}

function bridgeFailure(response, error) {
  const timedOut = error?.code === 'ETIMEDOUT';
  response.status(timedOut ? 504 : 502).json({ error: timedOut ? 'bridge-timeout' : 'bridge-unavailable' });
}

async function init(router) {
  router.get('/health', async (_request, response) => {
    try {
      const result = await bridgeRequest('GET', '/health');
      response.status(result.status).json(result.body);
    } catch (error) { bridgeFailure(response, error); }
  });
  router.post('/call', async (request, response) => {
    const body = request.body?.body;
    const route = body && typeof body === 'object' && !Array.isArray(body)
      ? operationRequest(request.body?.operation, body) : null;
    if (!route) { response.status(400).json({ error: 'unsupported-operation' }); return; }
    const pairingToken = request.get('X-Moli-Pairing-Token');
    if (typeof pairingToken !== 'string' || !pairingToken || pairingToken.length > 256) {
      response.status(401).json({ error: 'pairing-required' }); return;
    }
    try {
      const result = await bridgeRequest(route[0], route[1], route[0] === 'POST' ? body : undefined, pairingToken);
      response.json(result);
    } catch (error) { bridgeFailure(response, error); }
  });
}

async function exit() {}

module.exports = {
  init,
  exit,
  info: { id: 'moli-companion', name: 'moli Companion Bridge', description: 'Same-origin access to the paired Android loopback bridge' },
};
