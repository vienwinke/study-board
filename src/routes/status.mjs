import { sendJSON } from '../http.mjs';

export function createStatusRoute(config) {
  return function handleStatus(req, res) {
    const { API_KEY, MODEL, MOCK, BASE_URL, REASONING } = config;
    return sendJSON(res, 200, {
      configured: Boolean(API_KEY && MODEL),
      mock: MOCK,
      hasKey: Boolean(API_KEY),
      model: MODEL || null,
      baseUrl: BASE_URL,
      reasoningEffort: REASONING,
    });
  };
}
