import { createStatusRoute } from './routes/status.mjs';
import { createCardsRoute } from './routes/cards.mjs';
import { createDataRoute } from './routes/data.mjs';
import { createModelsRoute } from './routes/models.mjs';
import { createConfigRoute } from './routes/config.mjs';
import { createChatHandler } from './chat.mjs';
import { sendJSON } from './http.mjs';

/** Returns true when an API route owns the response, including asynchronous work. */
export function createApiRouter({ config, store, legacy }) {
  const routes = new Map([
    ['/api/status', createStatusRoute(config)],
    ['/api/cards', createCardsRoute(legacy)],
    ['/api/data', createDataRoute(store)],
    ['/api/models', createModelsRoute(config)],
    ['/api/config', createConfigRoute(config)]
  ]);
  const handleChat = createChatHandler(config);

  return function routeApi(req, res, url) {
    const handler = routes.get(url);
    if (handler) {
      handler(req, res);
      return true;
    }
    if (url === '/api/chat' && req.method === 'POST') {
      handleChat(req, res).catch(error => {
        try {
          sendJSON(res, 500, { error: 'internal', message: String(error?.message || error) });
        } catch {}
      });
      return true;
    }
    return false;
  };
}
