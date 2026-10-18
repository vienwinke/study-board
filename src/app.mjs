import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createConfigStore } from './config.mjs';
import { createDataStore } from './data-store.mjs';
import { createLegacyCardStore } from './legacy-cards.mjs';
import { createStaticHandler } from './static.mjs';
import { createApiRouter } from './router.mjs';
import { sendJSON } from './http.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Each application owns its configuration and data; tests can supply a temporary root. */
export function createApplication(rootDir = PROJECT_ROOT) {
  const config = createConfigStore(rootDir);
  const store = createDataStore(rootDir);
  const legacy = createLegacyCardStore(rootDir);
  const routeApi = createApiRouter({ config, store, legacy });
  const serveStatic = createStaticHandler(rootDir);

  const server = http.createServer((req, res) => {
    config.reloadConfigIfChanged();
    const url = (req.url || '').split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }
    if (routeApi(req, res, url)) return;
    if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method_not_allowed' });
    serveStatic(req, res);
  });
  return { server, config };
}
