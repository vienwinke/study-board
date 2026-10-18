import fs from 'node:fs';
import path from 'node:path';

export function createConfigStore(__dirname) {
  function loadConfig() {
    const p = path.join(__dirname, 'config.json');
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error('[config] config.json 解析失败：', e.message);
      return {};
    }
  }

  let cfg = loadConfig();

  let API_KEY, BASE_URL, MODEL, SYSTEM, MOCK, REASONING;

  function applyConfig() {
    API_KEY = cfg.apiKey || process.env.ARK_API_KEY || '';
    BASE_URL = (cfg.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
    MODEL = cfg.model || '';
    SYSTEM = cfg.system || '你是一个简洁的编程与计算机知识助手。回答尽量短、分点、给可运行的示例。';
    REASONING = cfg.reasoningEffort || '';

    /* 没配 Key 或没配模型时自动进入演示模式：本地伪造一段流式回复，用来预览界面 */
    MOCK = cfg.mock === true || !API_KEY || !MODEL;
  }
  applyConfig();

  /* ---------- 外部修改 config.json 时自动重载 ---------- */
  const CONFIG_PATH = path.join(__dirname, 'config.json');
  let cfgMtimeMs = 0;
  try { cfgMtimeMs = fs.statSync(CONFIG_PATH).mtimeMs; } catch {}

  function reloadConfigIfChanged() {
    let st;
    try {
      st = fs.statSync(CONFIG_PATH);
    } catch {
      return; /* 文件被删或不可读时保持当前配置 */
    }
    if (st.mtimeMs === cfgMtimeMs) return;
    cfgMtimeMs = st.mtimeMs;
    cfg = loadConfig();
    applyConfig();
    console.log('[config] 检测到 config.json 变更，已重新加载');
  }


  function saveConfig(next) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
    try { cfgMtimeMs = fs.statSync(CONFIG_PATH).mtimeMs; } catch {}
    cfg = next;
    applyConfig();
  }
  return { reloadConfigIfChanged, saveConfig,
    get cfg() { return cfg; }, get API_KEY() { return API_KEY; },
    get BASE_URL() { return BASE_URL; }, get MODEL() { return MODEL; },
    get SYSTEM() { return SYSTEM; }, get MOCK() { return MOCK; }, get REASONING() { return REASONING; }
  };
}
