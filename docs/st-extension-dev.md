# Event Chronicle — ST 扩展插件开发文档

`st-extension/` 是 SillyTavern 适配层，将 event-chronicle SDK 桥接到 ST 的扩展系统。

> 用户文档见 [st-extension/README.md](../st-extension/README.md) · 设计文档见 [st-plugin-guide.md](./st-plugin-guide.md)

---

## 架构总览

```
SillyTavern (Node.js 服务)
    │
    ├── manifest.json 扫描 → require("index.js")
    │
    ├── generate_interceptor  → ecGenerateInterceptor()  ← 每次生成前注入记忆
    ├── eventSource.on(CHAT_CHANGED) → triggerExtraction() ← 消息计数达阈值提取
    └── settings.html (内联) → ST 自动持久化表单值
```

---

## 目录结构

```
st-extension/
├── manifest.json              ← ST 扩展注册（js/generate_interceptor/i18n）
├── index.js                   ← 主入口：生命周期钩子 + ST API 桥接 + API 暴露
├── install.js                 ← SDK 版本更新辅助（dev-only，从 dist/ 复制 → vendor/）
├── README.md                  ← 面向 ST 用户的安装/功能说明
│
├── settings/                  ← 设置面板（ST 内联注入）
│   ├── settings.html          ← 10 个配置项表单 + 批量生成进度 UI
│   └── settings.js            ← 批量生成触发、状态轮询、表单变更监听
│
├── event-ui/                  ← 时间线浏览器（独立页面，iframe 加载）
│   ├── timeline.html          ← 筛选器 + Event 卡片容器 + 编辑弹窗
│   ├── timeline.js            ← 数据加载、渲染、分组、搜索、过滤
│   └── editor.js              ← Event 编辑保存、删除确认
│
├── lib/
│   └── ec-bridge.js           ← SDK 桥接层：封装 20 个 SDK API + 批量生成 + 备份
│
├── vendor/
│   └── event-chronicle/       ← SDK CJS 构建产物（已提交，包含 openai/dotenv 依赖）
│       ├── index.js           ← CJS 入口，require() 加载
│       └── prompts/*.md       ← 3 个提示词模板
│
├── data/                      ← 运行时数据（.gitignore，不提交）
└── .gitignore
```

---

## 关键设计决策

### 1. Vendored SDK（不依赖 npm）

ST 的 Git URL 安装只执行 `git clone`，不运行 `npm install`。因此将 SDK 的 CJS 构建产物（`dist/index.js`，已包含 `openai` + `dotenv` 依赖）直接提交到 `vendor/event-chronicle/`。

```
用户 clone → ST 找到 manifest.json → require("./lib/ec-bridge.js")
  → require("../vendor/event-chronicle/index.js") → SDK 可用 ✅
```

### 2. CJS 全链路

ST 扩展加载器使用 `require()`，因此所有 JS 文件使用 CommonJS（`require` / `module.exports`）。不能使用 ESM `import/export`。

### 3. 双钩子注入

| 机制 | 触发时机 | 用途 |
|------|----------|------|
| `generate_interceptor` | LLM 生成前 | 注入编年史记忆到 messages 数组 |
| `eventSource.on(CHAT_CHANGED)` | 聊天消息更新 | 累加计数，达阈值触发事件提取 |

`generate_interceptor` 通过 manifest 的 `generate_interceptor` 字段声明，ST 自动调用全局函数 `ecGenerateInterceptor()`。同时保留 `eventSource` 钩子作为旧版 ST 的 fallback。

### 4. 存储命名

SDK 默认用 `event_{timestamp}.json` 命名文件。ST 扩展改用 ST 的 chatId 命名 `{chatId}.json`，确保每个聊天的编年史独立存储。CRUD 操作 (`updateEvent`/`deleteEvent`) 绕过 `saveChronicle()` 直接写目标文件，维持命名约定。

### 5. 批量生成进度

批量生成使用切片增量模式，进度持久化到 `data/{chatId}_batch_progress.json`，支持中断恢复。切片处理期间不触发自动合并（`autoMerge: false`），全部完成后再做一次全量合并。

---

## 文件职责矩阵

| 文件 | 行数 | 核心职责 | 关键导出/函数 |
|------|------|----------|---------------|
| `manifest.json` | 14 | ST 注册 | `js`, `generate_interceptor`, `i18n` |
| `index.js` | ~380 | 生命周期 + 全局 API | `ecGenerateInterceptor()`, `window.EventChronicle` |
| `lib/ec-bridge.js` | ~310 | SDK 适配 | `init()`, `processMessages()`, `startBatchGeneration()` |
| `settings/settings.html` | ~180 | 设置 UI | ST 自动持久化表单 |
| `settings/settings.js` | ~200 | 设置交互 | `handleBatchStart()`, `updateStatus()` |
| `event-ui/timeline.html` | ~170 | 时间线 UI | 筛选器 + 卡片容器 + 编辑弹窗 |
| `event-ui/timeline.js` | ~220 | 时间线逻辑 | `refreshTimeline()`, `applyFilters()`, `exportMemory()` |
| `event-ui/editor.js` | ~130 | 编辑删除 | `openEditModal()`, `saveEdit()`, `confirmDelete()` |
| `install.js` | ~70 | SDK 更新 | 复制 `dist/` → `vendor/` |

---

## 开发工作流

```
┌─ SDK 开发 ─────────────────────────────────────┐
│ 1. 修改 core/ types/ prompts/ 等源码            │
│ 2. npm run build          # tsup → dist/       │
│ 3. cd st-extension && node install.js           │
│    # 更新 vendor/event-chronicle/               │
└────────────────────────────────────────────────┘
        │
        ▼
┌─ 提交 & 同步 ──────────────────────────────────┐
│ git add -A && git commit -m "..."               │
│ git push origin main                            │
│ git subtree push --prefix=st-extension          │
│   origin st-extension                           │
└────────────────────────────────────────────────┘
```

---

## 测试方法

由于 ST 扩展运行在 SillyTavern 环境中，本地无法完全模拟。测试分两层：

### SDK 层（脱离 ST）

```bash
# 验证 vendored SDK 可被 CJS require
node -e "const sdk = require('./vendor/event-chronicle/index.js'); console.log(Object.keys(sdk))"

# 验证 ec-bridge 可加载
node -e "const b = require('./lib/ec-bridge'); console.log(Object.keys(b))"
```

### ST 集成（手动，在 SillyTavern 中）

| 测试项 | 验证方法 |
|--------|----------|
| 安装加载 | 扩展管理页面出现 "Event Chronicle"，状态指示灯变绿 |
| 事件提取 | 发送 10 条消息，时间线中出现事件 |
| 记忆注入 | 继续对话，AI 能引用早期事件 |
| 设置修改 | 改提取阈值为 5，确认生效 |
| 批量生成 | 点击按钮，观察进度条 + 确认事件生成 |
| 编辑删除 | 时间线中编辑/删除事件，确认持久化 |
