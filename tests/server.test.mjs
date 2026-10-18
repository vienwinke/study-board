import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../src/app.mjs';
import { createDataStore } from '../src/data-store.mjs';
import { hhmm, esc, markdownOf } from '../public/js/utils.js';
import { PRESETS, presetIdByBase, effortLabel } from '../public/js/providers.js';

const project = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t, config = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'study-board-test-'));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify(config));
  fs.copyFileSync(path.join(project, 'index.html'), path.join(root, 'index.html'));
  fs.cpSync(path.join(project, 'public'), path.join(root, 'public'), { recursive: true });
  const app = createApplication(root);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { ...app, root, base, request: (url, method = 'GET', body) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  }) };
}

test('页面和所有拆分资源可加载，模块路径及类型正确', async t => {
  const f = await fixture(t);
  const html = await f.request('/').then(r => r.text());
  assert.match(html, /<title>学习看板<\/title>/);
  assert.doesNotMatch(html, /<style>|<script>/);
  for (const url of ['/index.html', '/styles/base.css', '/styles/cards.css', '/styles/chat.css', '/styles/settings.css', '/js/app.js', '/js/settings.js', '/js/icons.js', '/js/providers.js', '/js/utils.js', '/js/interactions.js']) {
    const response = await f.request(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('content-type'), url.endsWith('.css') ? /text\/css/ : url.endsWith('.js') ? /javascript/ : /text\/html/);
  }
  assert.equal((await f.request('/missing')).status, 404);
  for (const name of ['config.json', 'data.json', 'server.mjs']) assert.equal((await f.request('/' + name)).status, 404);
});

test('配置保存与热重载保留原来的默认值、推理等级和密钥隐藏规则', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/status').then(r => r.json())).mock, true);
  const response = await f.request('/api/config', 'POST', { apiKey: 'test-key', model: 'test-model', baseUrl: 'http://127.0.0.1:1/v1/', reasoningEffort: 'high', system: '回答简洁' });
  const saved = await response.json();
  assert.equal(saved.model, 'test-model'); assert.equal(saved.hasKey, true); assert.equal(saved.mock, false);
  const config = await f.request('/api/config').then(r => r.json());
  assert.equal(config.reasoningEffort, 'high'); assert.equal(config.systemEffective, '回答简洁'); assert.equal(config.apiKey, undefined);
  fs.writeFileSync(path.join(f.root, 'config.json'), JSON.stringify({ model: 'changed-model', mock: true }));
  const next = new Date(Date.now() + 2000); fs.utimesSync(path.join(f.root, 'config.json'), next, next);
  assert.equal((await f.request('/api/status').then(r => r.json())).model, 'changed-model');
  assert.equal((await f.request('/api/config', 'POST', '{')).status, 400);
});

test('多会话、卡片附件、消息反馈保存并在重启后恢复，原子保存仍生成备份', async t => {
  const f = await fixture(t);
  const data = { version: 2, activeId: 'c2', conversations: [
    { id: 'c1', title: '第一条', cards: [], messages: [] },
    { id: 'c2', title: '第二条', cards: [{ id: 1, title: '知识点', html: '<b>内容</b>', t: 1, weight: 2, h: 200 }], messages: [{ role: 'user', content: '附件内容和问题', display: '问题', attachments: [{ title: '知识点', text: '内容' }], ts: 1 }, { role: 'assistant', content: '回答', vote: 'up', ts: 2 }] }
  ] };
  for (const method of ['PUT', 'POST']) assert.equal((await f.request('/api/data', method, data)).status, 200);
  const saved = await f.request('/api/data').then(r => r.json());
  assert.equal(saved.activeId, 'c2'); assert.equal(saved.conversations[1].cards[0].h, 200);
  assert.equal(saved.conversations[1].messages[0].attachments[0].text, '内容');
  assert.equal(saved.conversations[1].messages[1].vote, 'up');
  assert.ok(fs.existsSync(path.join(f.root, 'data.bak.json')));
  assert.deepEqual(createDataStore(f.root).data, saved);
  assert.equal((await f.request('/api/data', 'PUT', '{')).status, 400);
});

test('旧版数据迁移和旧版卡片接口仍可使用', async t => {
  const f = await fixture(t);
  await f.request('/api/data', 'PUT', { cards: [{ id: 3, title: '旧卡片' }], messages: [{ role: 'user', content: '旧消息' }] });
  const migrated = await f.request('/api/data').then(r => r.json());
  assert.equal(migrated.version, 2); assert.equal(migrated.activeId, 'c1'); assert.equal(migrated.conversations[0].cards[0].id, 3);
  assert.equal((await f.request('/api/cards', 'POST', { cards: [{ id: 9 }] })).status, 200);
  assert.equal((await f.request('/api/cards').then(r => r.json())).cards[0].id, 9);
  assert.equal((await f.request('/api/cards', 'POST', {})).status, 400);
  assert.equal((await f.request('/api/cards', 'DELETE')).status, 405);
});

test('演示模式保留 SSE 格式与结束标记', async t => {
  const f = await fixture(t, { mock: true });
  const response = await f.request('/api/chat', 'POST', { messages: [{ role: 'user', content: '回归检查' }] });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const body = await response.text();
  assert.match(body, /data: \[DONE\]/);
  const text = body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)).choices[0].delta.content).join('');
  assert.match(text, /演示模式/); assert.match(text, /回归检查/);
});

test('模型列表和真实代理流程使用模拟上游验证，不调用付费服务', async t => {
  let received;
  const upstream = http.createServer(async (req, res) => {
    if (req.url === '/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }] })); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    received = { body: JSON.parse(body), authorization: req.headers.authorization };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {"choices":[{"delta":{"content":"回答正常"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => upstream.close(resolve)));
  const f = await fixture(t, { apiKey: 'test-key', model: 'model-a', baseUrl: `http://127.0.0.1:${upstream.address().port}`, system: '原提示词', reasoningEffort: 'high' });
  assert.deepEqual((await f.request('/api/models').then(r => r.json())).models, ['model-a', 'model-b']);
  const reply = await f.request('/api/chat', 'POST', { messages: [{ role: 'user', content: '测试问题' }] });
  assert.equal(reply.status, 200); assert.match(await reply.text(), /回答正常/);
  assert.equal(received.authorization, 'Bearer test-key'); assert.equal(received.body.model, 'model-a');
  assert.equal(received.body.messages[0].content, '原提示词'); assert.equal(received.body.reasoning_effort, 'high');
  assert.equal((await f.request('/api/chat', 'POST', { messages: [] })).status, 400);
});

test('拆分后的路由不会在多个应用实例之间共享配置或会话', async t => {
  const first = await fixture(t, { model: 'first-model' });
  const second = await fixture(t, { model: 'second-model' });
  await first.request('/api/config', 'POST', { model: 'changed-first' });
  await first.request('/api/data', 'PUT', { activeId: 'only-first', conversations: [{ id: 'only-first', cards: [], messages: [] }] });
  assert.equal((await second.request('/api/status').then(r => r.json())).model, 'second-model');
  assert.deepEqual((await second.request('/api/data').then(r => r.json())).conversations, []);
  assert.equal((await first.request('/api/data').then(r => r.json())).activeId, 'only-first');
  assert.equal((await first.request('/api/data', 'DELETE')).status, 405);
  assert.equal((await first.request('/api/config', 'PUT', {})).status, 405);
});

test('提取出的显示工具、供应商识别和推理等级保持原值', () => {
  assert.equal(esc('<a>&'), '&lt;a&gt;&amp;'); assert.equal(hhmm(0), '');
  assert.equal(markdownOf({ content: '答案' }, '问题'), '**问：** 问题\n\n**答：**\n\n答案\n');
  assert.equal(presetIdByBase(PRESETS.commandcode.base + '/'), 'commandcode');
  assert.equal(presetIdByBase('https://example.test/v1'), 'custom');
  assert.equal(effortLabel('high'), '高');
});
