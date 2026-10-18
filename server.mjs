/** 学习看板入口。运行：node server.mjs，访问 http://127.0.0.1:8787 */
import { createApplication } from './src/app.mjs';

const PORT = Number(process.env.PORT || 8787);
const { server, config } = createApplication();

server.listen(PORT, '127.0.0.1', () => {
  const { API_KEY, MODEL } = config;
  console.log('');
  console.log('  学习看板已启动');
  console.log('  ─────────────────────────────────────');
  console.log(`  地址   http://127.0.0.1:${PORT}`);
  console.log(`  模型   ${MODEL || '（未配置）'}`);
  console.log(`  Key    ${API_KEY ? '已配置（' + API_KEY.slice(0, 6) + '…）' : '未配置'}`);
  console.log('  ─────────────────────────────────────');
  if (!API_KEY || !MODEL) {
    console.log('  ⚠  还没配好，页面里会提示。编辑本目录下的 config.json 后重启即可。');
  }
  console.log('  按 Ctrl+C 停止');
  console.log('');
});
