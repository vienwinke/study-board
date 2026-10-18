import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(file);
  }
}
for (const dir of ['public/js', 'src', 'scripts', 'tests']) collect(path.join(root, dir));
files.push(path.join(root, 'server.mjs'));
const errors = [];
const graph = new Map();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) errors.push(result.stderr || result.error?.message || `${file}: 语法检查失败`);
  const source = fs.readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:import\s+(?:[^;'"\n]*?\s+from\s+)?|export\s+[^;'"\n]*?\s+from\s+)["'](\.[^"']+)["']/g)];
  const dependencies = imports.map(match => path.resolve(path.dirname(file), match[1]));
  graph.set(file, dependencies);
  for (const target of dependencies) {
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) errors.push(`模块引用不存在：${path.relative(root, file)} → ${path.relative(root, target)}`);
  }
}
const visiting = new Set(), visited = new Set();
function visit(file, stack = []) {
  if (visiting.has(file)) { errors.push(`循环依赖：${[...stack, file].map(f => path.relative(root, f)).join(' → ')}`); return; }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dep of graph.get(file) || []) visit(dep, [...stack, file]);
  visiting.delete(file); visited.add(file);
}
for (const file of files) visit(file);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="(\/(?:js|styles)\/[^"?#]+)"/g)) {
  if (!fs.existsSync(path.join(root, 'public', url))) errors.push(`页面资源不存在：${url}`);
}
for (const file of ['package.json', 'config.example.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch { errors.push(`JSON 文件无效：${file}`); }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`结构检查通过：${files.length} 个脚本语法正确，模块引用、依赖方向、页面资源与示例配置有效。`);
