// Optional browser acceptance check. Requires Playwright and Microsoft Edge.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.STUDY_PLAYWRIGHT || 'playwright');

(async () => {
  const { createApplication } = await import('../src/app.mjs');
  const root = path.resolve(__dirname, '..');
  const dirs = [], servers = [];
  let browser;
  const stamp = 1792317600000;
  const initialData = { version: 2, activeId: 'c1', updatedAt: stamp, conversations: [{ id: 'c1', title: '功能验收', createdAt: stamp, updatedAt: stamp, cards: [{ id: 1, title: '原有卡片', html: '原有笔记', t: stamp, weight: 1, h: 0 }], messages: [] }] };
  function makeDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-browser-')); dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ mock: true }));
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(initialData));
    return dir;
  }
  try {
    const current = makeDir();
    fs.copyFileSync(path.join(root, 'index.html'), path.join(current, 'index.html'));
    fs.cpSync(path.join(root, 'public'), path.join(current, 'public'), { recursive: true });
    const { server } = createApplication(current); servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const urls = [{ name: 'refactored', url: `http://127.0.0.1:${server.address().port}` }];
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const out = path.join(root, 'test-results'); fs.mkdirSync(out, { recursive: true });
    for (const { name, url } of urls) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
      await context.addInitScript(({ stamp }) => { const RealDate = Date; window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [stamp])); } static now() { return stamp; } }; }, { stamp });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url); await page.waitForSelector('#cards .card');
      await page.waitForFunction(() => document.querySelector('#who').textContent !== '豆包');
      await page.screenshot({ path: path.join(out, `${name}-initial.png`), animations: 'disabled' });
      await page.locator('#btnSettings').click(); await page.waitForSelector('#modal.on');
      assert.match(await page.locator('#modal .panel').innerText(), /API Key/);
      await page.locator('#modalCancel').click();
      await page.locator('#btnDelete').click();
      await page.locator('#btnSettings').click();
      assert.equal(await page.locator('#cards').evaluate(node => node.classList.contains('selecting')), false);
      await page.waitForFunction(() => document.querySelector('#modalMsg').textContent === '');
      await page.locator('#fSys').fill('测试设置保存');
      const configSaved = page.waitForResponse(response => response.url().endsWith('/api/config') && response.request().method() === 'POST');
      await page.locator('#modalSave').click();
      assert.equal((await configSaved).status(), 200);
      await page.waitForFunction(() => !document.querySelector('#modal').classList.contains('on'));
      await page.locator('#modelBox').click();
      await page.locator('.mm-row').filter({ hasText: '推理等级' }).click();
      const effortSaved = page.waitForResponse(response => response.url().endsWith('/api/config') && response.request().method() === 'POST');
      await page.locator('.mm-item').filter({ hasText: '(high)' }).click();
      assert.equal((await effortSaved).status(), 200);
      const savedSettings = await page.evaluate(() => fetch('/api/config').then(response => response.json()));
      assert.equal(savedSettings.system, '测试设置保存');
      assert.equal(savedSettings.reasoningEffort, 'high');
      await page.locator('#cards .title').fill('重构验证'); await page.locator('#cards .cbody').fill('卡片内容保持可编辑');
      await page.locator('#cards button[title="作为卡片附件插入对话"]').click();
      assert.match(await page.locator('#attach').innerText(), /重构验证/);
      await page.locator('#input').fill('解释这个知识点'); await page.locator('#sendBtn').click();
      await page.waitForFunction(() => document.querySelector('#sendBtn').disabled === false && document.querySelector('#msgs').textContent.includes('格子满了之后'));
      await page.locator('#msgs button[title="存入卡片"]').click();
      assert.equal(await page.locator('#cards .card').count(), 2);
      await page.locator('#btnAdd').click(); assert.equal(await page.locator('#cards .card').count(), 3);
      await page.locator('#cards .chead').last().dblclick(); assert.equal(await page.locator('#cards .card').count(), 2);
      await page.locator('#toast button').click(); assert.equal(await page.locator('#cards .card').count(), 3);
      await page.locator('#btnNewChat').click(); assert.equal(await page.locator('#cards .card').count(), 0);
      await page.locator('#convSel').selectOption('c1'); assert.equal(await page.locator('#cards .card').count(), 3);
      await page.waitForTimeout(900);
      const stored = await page.evaluate(() => fetch('/api/data').then(r => r.json()));
      assert.equal(stored.conversations[0].cards[0].title, '重构验证');
      assert.equal(stored.conversations[0].messages[0].attachments[0].text, '卡片内容保持可编辑');
      await page.reload(); await page.waitForSelector('#cards .card');
      assert.equal(await page.locator('#cards .card').count(), 3);
      assert.equal(await page.locator('#cards .title').first().inputValue(), '重构验证');
      await page.screenshot({ path: path.join(out, `${name}-after.png`), animations: 'disabled' });
      assert.deepEqual(errors, [], `${name}: 无页面脚本异常`);
      await context.close();
    }
    console.log('浏览器验收通过：设置保存、推理等级、退出选择模式、卡片编辑/附件、流式对话、回答存卡、删除/撤销、会话切换、刷新恢复。');
  } finally {
    if (browser) await browser.close();
    for (const server of servers) await new Promise(resolve => server.close(resolve));
    for (const dir of dirs) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
