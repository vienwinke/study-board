import { sendJSON, readBody } from './http.mjs';
import { streamMock } from './mock-chat.mjs';

export function createChatHandler(config) {
  return async function handleChat(req, res) {
    const { API_KEY, BASE_URL, MODEL, SYSTEM, MOCK, REASONING } = config;
    if (MOCK) return streamMock(req, res);

    if (!API_KEY) {
      return sendJSON(res, 400, {
        error: 'no_api_key',
        message: '还没配置 API Key。请在 config.json 里填入 apiKey，或用环境变量 ARK_API_KEY 启动。',
      });
    }
    if (!MODEL) {
      return sendJSON(res, 400, {
        error: 'no_model',
        message: '还没配置模型。请在 config.json 的 model 里填入豆包模型名或推理接入点 ID（ep-xxx）。',
      });
    }

    let payload;
    try {
      payload = JSON.parse((await readBody(req)) || '{}');
    } catch {
      return sendJSON(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' });
    }

    const history = Array.isArray(payload.messages) ? payload.messages : [];
    if (history.length === 0) {
      return sendJSON(res, 400, { error: 'empty_messages', message: 'messages 为空' });
    }

    const messages = SYSTEM ? [{ role: 'system', content: SYSTEM }, ...history] : history;

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const upstreamBody = {
      model: MODEL,
      messages,
      stream: true,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.6,
    };
    if (REASONING) upstreamBody.reasoning_effort = REASONING;

    let upstream;
    try {
      upstream = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });
    } catch (e) {
      return sendJSON(res, 502, { error: 'upstream_unreachable', message: String(e && e.message ? e.message : e) });
    }

    if (!upstream.ok || !upstream.body) {
      let text = '';
      try {
        text = await upstream.text();
      } catch {}
      return sendJSON(res, upstream.status || 502, {
        error: 'upstream_error',
        status: upstream.status,
        message: text.slice(0, 2000),
      });
    }

    // 原样转发 SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
    } catch (e) {
      // 客户端断开或上游中断，忽略
    } finally {
      res.end();
    }
  }


}
