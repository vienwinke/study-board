import { sendJSON, readBody } from '../http.mjs';

export function createDataRoute(store) {
  return function handleData(req, res) {
    const { data, sanitizeData, writeDataAtomic } = store;
    if (req.method === 'GET') {
      return sendJSON(res, 200, data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      (async () => {
        let body;
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJSON(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' });
        }

        const safe = sanitizeData(body);
        try {
          writeDataAtomic(safe);
        } catch (e) {
          return sendJSON(res, 500, { error: 'write_failed', message: String(e && e.message ? e.message : e) });
        }

        store.data = safe;
        return sendJSON(res, 200, {
          ok: true,
          savedAt: safe.updatedAt,
          conversations: safe.conversations.length,
          activeId: safe.activeId,
        });
      })();
      return;
    }
    return sendJSON(res, 405, { error: 'method_not_allowed' });
  };
}
