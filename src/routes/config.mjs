import { sendJSON, readBody } from '../http.mjs';

export function createConfigRoute(config) {
  return function handleConfig(req, res) {
    const { cfg, API_KEY, MODEL, MOCK, BASE_URL, REASONING, SYSTEM } = config;
    if (req.method === 'GET') {
      return sendJSON(res, 200, {
        baseUrl: BASE_URL,
        model: MODEL,
        /* system 返回「存的值」，空串就是空串；systemEffective 才是实际生效的提示词 */
        system: cfg.system || '',
        systemEffective: SYSTEM,
        reasoningEffort: REASONING,
        hasKey: Boolean(API_KEY),
        mock: MOCK,
      });
    }

    if (req.method === 'POST') {
      (async () => {
        let body;
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJSON(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' });
        }

        const next = Object.assign({}, cfg);
        if (typeof body.apiKey === 'string' && body.apiKey.trim()) next.apiKey = body.apiKey.trim();
        if (body.clearKey === true) next.apiKey = '';
        if (typeof body.model === 'string') next.model = body.model.trim();
        if (typeof body.baseUrl === 'string') {
          next.baseUrl = body.baseUrl.trim() || 'https://ark.cn-beijing.volces.com/api/v3';
        }
        if (typeof body.system === 'string') next.system = body.system;
        if (typeof body.reasoningEffort === 'string') next.reasoningEffort = body.reasoningEffort;
        delete next.mock;

        try {
          config.saveConfig(next);
        } catch (e) {
          return sendJSON(res, 500, { error: 'write_failed', message: String(e && e.message ? e.message : e) });
        }


        return sendJSON(res, 200, {
          ok: true,
          hasKey: Boolean(config.API_KEY),
          model: config.MODEL,
          baseUrl: config.BASE_URL,
          mock: config.MOCK,
        });
      })();
      return;
    }
    return sendJSON(res, 405, { error: 'method_not_allowed' });
  };
}
