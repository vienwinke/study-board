# 代码结构与维护边界

本项目保持原生网页和 Node.js 本地服务，不需要前端构建或第三方运行依赖。功能、界面与会话数据格式沿用原版。

## 完整目录

```text
study-board/
├── .editorconfig               两空格缩进、UTF-8 与换行约定
├── .gitignore                  排除本机密钥、数据及验收输出
├── package.json                启动、检查与测试命令
├── README.md                   使用入口和运行说明
├── config.example.json         可分发的空配置示例，不含真实密钥
├── config.json                 本机模型配置（不纳入版本管理）
├── data.json                   当前会话与卡片
├── data.bak.json               上次保存备份
├── data.json.before-clean.json 历史备份，保持原位置
├── data.json.v1-backup          旧版备份，保持原位置
├── cards.json                  仅调用旧版卡片接口时生成
├── server.mjs                  读取端口并启动服务
├── index.html                  页面结构和资源入口
├── public/
│   ├── styles/
│   │   ├── base.css            全局样式、整体布局
│   │   ├── cards.css           卡片、工具栏、拖拽和选择删除
│   │   ├── chat.css            聊天、附件和模型菜单
│   │   └── settings.css        设置弹窗样式
│   └── js/
│       ├── app.js              卡片、对话、会话与自动保存的页面协调器
│       ├── settings.js         设置、模型菜单、推理等级及连接状态
│       ├── providers.js        供应商预设与推理等级定义
│       ├── icons.js            SVG 图标
│       ├── utils.js            时间、文本转义和 Markdown 格式
│       └── interactions.js     复制、朗读、消息操作菜单
├── src/
│   ├── app.mjs                 创建配置和数据实例，组装 HTTP 服务
│   ├── router.mjs              API 路由注册与分发
│   ├── routes/
│   │   ├── status.mjs          模型连接状态
│   │   ├── config.mjs          模型配置读取与更新
│   │   ├── models.mjs          上游模型列表
│   │   ├── data.mjs            多会话及卡片读写
│   │   └── cards.mjs           旧版卡片接口
│   ├── config.mjs              配置读取、保存和热重载
│   ├── data-store.mjs          数据校验、迁移与原子写入
│   ├── legacy-cards.mjs        旧版 cards.json 读写
│   ├── chat.mjs                模型调用和 SSE 流转发
│   ├── mock-chat.mjs           演示模式回复
│   ├── http.mjs                JSON 响应与请求体读取
│   └── static.mjs              index.html 和 public/ 静态资源
├── scripts/
│   ├── check.mjs               语法、引用、循环依赖及资源检查
│   └── browser-check.cjs       可选浏览器验收，依赖 Playwright 与 Edge
├── tests/
│   └── server.test.mjs         API、数据保存、迁移和流式代理回归测试
├── docs/
│   └── architecture.md        本文档
└── test-results/               自动生成的验收截图，不属于源代码
```

## 调用关系

```text
index.html → styles/*.css
           → js/app.js → settings.js → providers.js
                       → icons.js / utils.js / interactions.js
                       → /api/*

server.mjs → src/app.mjs → router.mjs → routes/*.mjs
                                    → chat.mjs → mock-chat.mjs
                        → config.mjs / data-store.mjs / legacy-cards.mjs
                        → static.mjs
```

后端实例通过参数传递到路由，路由不反向引用应用入口。路由负责 HTTP 参数与响应，存储模块负责文件，聊天模块负责上游模型。测试可传入临时目录，避免读取或修改真实配置和数据。

设置控制器只接收提示函数、显示元素和打开前的回调；不直接持有卡片选中状态。卡片、聊天和会话仍由 `app.js` 协调：它们共用当前会话、撤销状态与保存时机，暂未为了缩短文件而拆成互相依赖的全局脚本。

## 数据与兼容性

- 配置、会话和旧版备份仍位于项目根目录，没有搬迁或改名。
- 多会话数据仍使用 `version: 2`，保留活动会话、卡片大小、消息反馈与卡片附件。
- `/api/cards` 和旧版单会话数据迁移继续保留。
- 静态资源仅从页面入口和 `public/` 提供，后端源码、真实密钥、数据和测试文件不属于公开资源。
- 模型密钥只由后端使用；配置 API 向页面返回 `hasKey`，不返回密钥值。

## 维护时放在哪里

| 修改内容 | 对应位置 |
| --- | --- |
| 卡片或聊天的交互 | `public/js/app.js` |
| 设置弹窗与模型菜单 | `public/js/settings.js` |
| 增加供应商预设 | `public/js/providers.js` |
| 页面外观 | `public/styles/` |
| 新增 API | `src/routes/`，并在 `src/router.mjs` 注册 |
| 数据格式与迁移 | `src/data-store.mjs`，补充回归测试 |
| 模型请求与流式转发 | `src/chat.mjs` |

## 检查命令

`npm run check` 检查脚本语法、相对模块引用、循环依赖、页面引用和示例 JSON。

`npm test` 在临时目录中验证接口、配置、数据保存与恢复、旧版迁移、演示流和模拟上游，不调用真实付费模型。

`npm run test:browser` 检查浏览器中的核心操作；需要可选的 Playwright 和已安装的 Microsoft Edge。可以设置 `STUDY_PLAYWRIGHT` 指向已有 Playwright 包。截图写入 `test-results/`。
