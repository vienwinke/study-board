# 学习看板

原生 HTML、CSS 和 JavaScript 编写的本地学习工具。支持卡片编辑、拖拽排序、调整大小、卡片附件、多会话、流式 AI 对话以及模型设置。

## 启动

安装 Node.js 18 或以上版本，在项目目录运行：

```powershell
node server.mjs
```

浏览器打开 http://127.0.0.1:8787 。也可以运行 `npm start`。没有第三方运行依赖，不需要安装依赖或构建前端。设置 `PORT` 环境变量可以更换端口。

在页面设置中配置模型接口、模型 ID 和 API Key。也支持环境变量 `ARK_API_KEY`。未配置密钥或模型时使用原有演示模式。

首次下载的仓库不包含真实配置和学习记录。可以直接启动体验演示模式，或先复制配置示例：

```powershell
Copy-Item config.example.json config.json
```

已有 `config.json` 时请保留原文件，不要重复覆盖。真实配置、会话、卡片和历史备份均已加入 Git 忽略规则。应用只监听本机地址，适合个人本地使用。

## 文件职责

```text
study-board/
├── index.html               页面结构
├── server.mjs               服务启动入口
├── public/
│   ├── styles/
│   │   ├── base.css         全局样式、整体布局与上下分隔条
│   │   ├── cards.css        卡片、工具栏、拖拽与选择删除
│   │   ├── chat.css         对话、模型菜单、消息与附件
│   │   └── settings.css     设置弹窗
│   └── js/
│       ├── app.js           页面控制、卡片、对话、会话与自动保存
│       ├── settings.js      设置、模型菜单、推理等级与连接状态
│       ├── icons.js         SVG 图标
│       ├── providers.js     供应商预设与推理等级
│       ├── utils.js         时间、文本转义与 Markdown 复制格式
│       └── interactions.js  复制、朗读和消息操作菜单
├── src/
│   ├── app.mjs              创建依赖并组装服务
│   ├── router.mjs           注册与分发 API
│   ├── routes/              状态、配置、模型列表和数据接口
│   ├── config.mjs           配置读取、保存与热重载
│   ├── data-store.mjs       会话数据校验、迁移和原子保存
│   ├── legacy-cards.mjs     旧版 cards.json 接口兼容
│   ├── chat.mjs             模型请求与 SSE 流转发
│   ├── mock-chat.mjs        演示模式流式回复
│   ├── http.mjs             JSON 响应与请求体读取
│   └── static.mjs           页面与公开资源服务
├── tests/                   接口、数据与资源回归检查
├── scripts/browser-check.cjs 可选的浏览器操作验收
├── scripts/check.mjs        语法、模块与资源检查
├── docs/architecture.md     完整目录与模块依赖说明
├── config.example.json      不含密钥的配置示例
├── config.json              本机模型配置（可能包含密钥）
├── data.json                卡片与会话，仍使用原有 version 2 格式
└── data.bak.json             原有保存备份
```

前端使用浏览器原生 ES Modules。`app.js` 保留原有页面状态与事件初始化顺序；没有将耦合的卡片、会话逻辑拆成多个全局脚本。后端模块通过工厂函数组装，每个实例独立持有配置和数据，便于在临时目录中测试。

完整目录、模块调用关系、兼容边界与维护位置见 [代码结构说明](docs/architecture.md)。`.editorconfig` 统一两空格缩进、UTF-8 和换行格式。

根目录下的配置、数据与历史备份位置保持不变。静态资源从 `public/` 提供，`index.html` 仍可通过 `/` 或 `/index.html` 访问。

## API

| 路径 | 用途 |
| --- | --- |
| `/api/status` | 获取连接与模型状态 |
| `/api/config` | 读取、更新模型配置 |
| `/api/models` | 从当前供应商获取模型列表 |
| `/api/chat` | 流式模型对话 |
| `/api/data` | 读取、保存多会话与卡片 |
| `/api/cards` | 旧版卡片接口 |

## 验证

```powershell
npm run check
npm test
```

测试使用临时目录和模拟上游，不修改项目真实配置、卡片或会话，也不会调用付费模型服务。

另有 `node scripts/browser-check.cjs` 浏览器验收脚本，需要安装 Microsoft Edge 和可选的 Playwright。可通过 `STUDY_PLAYWRIGHT` 环境变量指定已有 Playwright 包的路径；不会增加应用的运行依赖。验收截图输出到 `test-results/`。

GitHub Actions 会在 Windows 和 Linux、Node.js 22 和 24 上执行结构检查与回归测试。浏览器验收由本地单独运行。
