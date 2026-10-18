import { sendJSON, readBody } from '../http.mjs';

export function createCardsRoute(legacy) {
  return function handleCards(req, res) {
    const { readCards, writeCards } = legacy;
    if (req.method === 'GET') {
      const data = readCards();
      return sendJSON(res, 200, data || { cards: [] });
    }
    if (req.method === 'POST') {
      return readBody(req)
        .then((body) => {
          let obj;
          try {
            obj = JSON.parse(body || '{}');
          } catch {
            return sendJSON(res, 400, { error: 'bad_json' });
          }
          if (!obj || !Array.isArray(obj.cards)) {
            return sendJSON(res, 400, { error: 'cards 必须是数组' });
          }
          const ok = writeCards(obj);
          return sendJSON(res, ok ? 200 : 500, { ok: ok, count: obj.cards.length });
        })
        .catch((e) => sendJSON(res, 500, { error: String(e && e.message ? e.message : e) }));
    }
    return sendJSON(res, 405, { error: 'method_not_allowed' });
  };
}
