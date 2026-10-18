import { sendJSON } from '../http.mjs';

export function createModelsRoute(config) {
  return function handleModels(req, res) {
    const { API_KEY, BASE_URL, MODEL } = config;
    if (!API_KEY) {
      return sendJSON(res, 200, { ok: false, models: [], error: '还没配置 API Key' });
    }
    (async () => {
      try {
        const r = await fetch(`${BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          return sendJSON(res, 200, {
            ok: false,
            models: [],
            error: `HTTP ${r.status} ${t.slice(0, 300)}`,
          });
        }
        const j = await r.json();
        const arr = Array.isArray(j.data) ? j.data : (Array.isArray(j.models) ? j.models : []);
        const models = arr
          .map((m) => (typeof m === 'string' ? m : m && m.id))
          .filter((x) => typeof x === 'string' && x.length > 0);
        return sendJSON(res, 200, { ok: true, models: models, count: models.length, current: MODEL });
      } catch (e) {
        return sendJSON(res, 200, { ok: false, models: [], error: String(e && e.message ? e.message : e) });
      }
    })();
    return;
  };
}
