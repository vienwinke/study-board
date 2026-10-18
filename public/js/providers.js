/* ---------- 供应商预设 ---------- */
export const PRESETS = {
  commandcode: {
    name: 'CommandCode',
    base: 'https://api.commandcode.ai/provider/v1',
    modelPh: 'deepseek/deepseek-v4-flash',
    keyPh: 'user_…',
    tip: 'OpenAI 兼容接口 · 模型写成「厂商/模型」'
  },
  ark: {
    name: '火山方舟',
    base: 'https://ark.cn-beijing.volces.com/api/v3',
    modelPh: 'doubao-seed-1-6-250615 或 ep-xxxxxxxx',
    keyPh: '方舟 API Key',
    tip: '豆包 · 也可填推理接入点 ID（ep- 开头）'
  },
  deepseek: {
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    modelPh: 'deepseek-chat',
    keyPh: 'sk-…',
    tip: 'DeepSeek 开放平台'
  },
  openai: {
    name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    modelPh: 'gpt-4o-mini',
    keyPh: 'sk-…',
    tip: '需要能访问 OpenAI 的网络'
  },
  custom: {
    name: '自定义',
    base: '',
    modelPh: '模型 ID',
    keyPh: 'API Key',
    tip: '任何 OpenAI 兼容接口都可以'
  }
};

export function normBase(b) { return String(b || '').replace(/\/+$/, ''); }

export function presetIdByBase(base) {
  var b = normBase(base);
  for (var k in PRESETS) {
    if (Object.prototype.hasOwnProperty.call(PRESETS, k) && PRESETS[k].base && normBase(PRESETS[k].base) === b) return k;
  }
  return b ? 'custom' : 'commandcode';
}

export const EFFORTS = [
  { v: '', label: '默认' },
  { v: 'low', label: '低' },
  { v: 'medium', label: '中' },
  { v: 'high', label: '高' },
  { v: 'max', label: '最高' }
];
export function effortLabel(v) {
  for (var i = 0; i < EFFORTS.length; i++) if (EFFORTS[i].v === v) return EFFORTS[i].label;
  return v || '默认';
}
