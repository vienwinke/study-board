import fs from 'node:fs';
import path from 'node:path';

export function createDataStore(__dirname) {
  const DATA_PATH = path.join(__dirname, 'data.json');
  const DATA_BAK = path.join(__dirname, 'data.bak.json');

  function emptyData() {
    return { version: 2, activeId: null, conversations: [], updatedAt: 0 };
  }

  function sanitizeCard(c) {
    return {
      id: Number(c && c.id) || 0,
      title: String((c && c.title) || '').slice(0, 500),
      html: String((c && c.html) || '').slice(0, 200000),
      t: Number(c && c.t) || Date.now(),
      weight: Number(c && c.weight) || 1,
      h: Number(c && c.h) || 0,
    };
  }

  function sanitizeMessage(m) {
    const out = {
      role: m && m.role === 'assistant' ? 'assistant' : 'user',
      content: String((m && m.content) || '').slice(0, 100000),
      ts: Number(m && m.ts) || Date.now(),
      vote: m && (m.vote === 'up' || m.vote === 'down') ? m.vote : null,
    };

    /* 用户消息可能带「卡片附件」：显示文本 + 附件列表 */
    if (typeof (m && m.display) === 'string') out.display = m.display.slice(0, 50000);
    if (m && Array.isArray(m.attachments) && m.attachments.length) {
      out.attachments = m.attachments.slice(0, 5).map((a) => ({
        title: String((a && a.title) || '').slice(0, 200),
        text: String((a && a.text) || '').slice(0, 50000),
      }));
    }

    return out;
  }

  function sanitizeConversation(c) {
    const id = String((c && c.id) || '').slice(0, 60) || 'c' + Date.now();
    return {
      id: id,
      title: String((c && c.title) || '').slice(0, 100),
      createdAt: Number(c && c.createdAt) || Date.now(),
      updatedAt: Number(c && c.updatedAt) || Date.now(),
      cards: (Array.isArray(c && c.cards) ? c.cards : []).slice(0, 60).map(sanitizeCard),
      messages: (Array.isArray(c && c.messages) ? c.messages : []).slice(-300).map(sanitizeMessage),
    };
  }

  function sanitizeData(raw) {
    raw = raw || {};

    let convs;
    if (Array.isArray(raw.conversations)) {
      convs = raw.conversations.slice(0, 40).map(sanitizeConversation);
    } else if (Array.isArray(raw.cards) || Array.isArray(raw.messages)) {
      /* 旧版（单对话）自动迁移成一条会话 */
      convs = [sanitizeConversation({ id: 'c1', title: '', cards: raw.cards, messages: raw.messages })];
    } else {
      convs = [];
    }

    const ids = convs.map((c) => c.id);
    const activeId = ids.indexOf(raw.activeId) >= 0 ? raw.activeId : (convs[0] ? convs[0].id : null);

    return { version: 2, activeId: activeId, conversations: convs, updatedAt: Date.now() };
  }

  function loadData() {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      const safe = sanitizeData(raw);
      safe.updatedAt = raw.updatedAt || 0;
      return safe;
    } catch {
      return emptyData();
    }
  }

  function writeDataAtomic(obj) {
    const tmp = DATA_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    try {
      if (fs.existsSync(DATA_PATH)) fs.copyFileSync(DATA_PATH, DATA_BAK);
    } catch {}
    try {
      fs.renameSync(tmp, DATA_PATH);
    } catch {
      /* 某些平台 rename 覆盖会失败，退化为直接写 */
      fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
      try { fs.unlinkSync(tmp); } catch {}
    }
  }

  let data = loadData();


  return { sanitizeData, writeDataAtomic, get data() { return data; }, set data(value) { data = value; } };
}
