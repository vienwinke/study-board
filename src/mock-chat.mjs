import { readBody } from './http.mjs';

export async function streamMock(req, res) {
  let question = '';
  try {
    const payload = JSON.parse((await readBody(req)) || '{}');
    const msgs = Array.isArray(payload.messages) ? payload.messages : [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i] && msgs[i].role === 'user') { question = String(msgs[i].content || ''); break; }
    }
  } catch {}

  const reply =
    '（演示模式 · 未接入真实模型）\n\n' +
    '你问的是：「' + question.slice(0, 40) + '」\n\n' +
    '接上豆包之后，这里会是真实回答，而且是逐字冒出来的。\n\n' +
    '现在可以先试这几步：\n' +
    '1. 把鼠标移到这条消息上，点「存入卡片」\n' +
    '2. 看内容怎么出现在上方格子里（按时间自动占位）\n' +
    '3. 拖卡片标题栏到另一个格子 → 交换位置\n' +
    '4. 拖到下方红色区域 → 删除\n\n' +
    '格子满了之后，新的会覆盖最早那张。';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const pieces = reply.match(/[\s\S]{1,3}/g) || [];
  for (const p of pieces) {
    const chunk = 'data: ' + JSON.stringify({ choices: [{ delta: { content: p } }] }) + '\n\n';
    res.write(chunk);
    await new Promise((r) => setTimeout(r, 18));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}
