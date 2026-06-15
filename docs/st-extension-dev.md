# Event Chronicle — ST Extension Development Guide

`st-extension/` 是 SillyTavern 适配层，将 Event Chronicle SDK 桥接到 ST 的扩展系统。

> 用户文档见 [st-extension/README.md](../st-extension/README.md)

---

## 架构总览

```
ST 聊天消息
    │
    ▼ CHARACTER_MESSAGE_RENDERED 事件
index.js (ST 集成层, ~700 行)
    │ llmCall() → POST /api/backends/chat-completions/generate
    ▼
ec-bridge.js (适配层, ~720 行)
    │ extractEvents() → mergeEvents() → processMessages()
    ▼
lib/ec-sdk.mjs (SDK 浏览器 bundle, ~470 行, 由 npm run sync:st 生成)
    parseEvents / formatMessages / applyInstructions / ...
    extractPrompt / mergePrompt / memoryPrompt
```

---

## 目录结构

```
st-extension/
├── manifest.json          # ST 扩展声明 (hooks.activate: "init", js: "index.js")
├── index.js               # 主入口：生命周期, LLM 桥接, 设置 UI 注入, Wand 菜单
├── ec-bridge.js           # SDK 适配层：提取/合并/批量生成/CRUD/存储
├── lib/ec-sdk.mjs         # SDK 浏览器 bundle (构建产物, 勿手动编辑)
├── timeline.html          # 独立时间线浏览器页面
├── timeline.js            # 时间线渲染: 筛选, 排序, 分组显示
├── editor.js              # 事件编辑/删除弹窗
├── settings.html          # 设置面板模板 (ST iframe 加载)
├── style.css              # 扩展 UI 样式
├── README.md              # 用户安装/功能文档
└── manifest.json          # ST 扩展注册
```

---

## 关键设计决策

### 1. 依赖注入: LLM 通道
SDK 无 LLM 客户端。`ec-bridge.js` 定义空槽位 `_generateRaw = null`，由 `index.js` 在 `init()` 时注入：

```js
// index.js init()
ecBridge.setGenerateRaw(llmCall);
```

### 2. API 配置三层回退
```js
// llmCall() 读取顺序:
1. cachedOaiSettings      // init() 时 POST /api/settings/get 拉取
2. window.oai_settings    // ST 全局变量 (兼容旧版)
3. llmOverride 设置        // Event Chronicle 设置面板手动配置
4. 都没有 → 抛出明确错误
```

### 3. 事件钩子 (ES Module, 非拦截器)

| 机制 | 触发时机 | 用途 |
|------|----------|------|
| `eventSource.on(CHARACTER_MESSAGE_RENDERED)` | 角色回复后 | 累计未处理消息达阈值 → 自动提取 |
| `eventSource.on(CHAT_CHANGED)` | 切换对话 | 重置追踪状态 |
| `eventSource.on(MESSAGE_DELETED)` | 消息删除 | 重置追踪标记 |
| `eventSource.on(MESSAGE_UPDATED)` | 消息更新 | 重置追踪标记 |

### 4. 存储: extension_settings
```
extension_settings['event-chronicle']
  ├── _events["chatId"]    → Event[]
  ├── _merge["chatId"]     → { newEventCount, lastMergeAt }
  └── _batch["chatId"]     → { lastProcessedIndex, completed }
```
数据随 ST 的 `data/default-user/settings.json` 自动持久化。无独立数据文件。

### 5. 设置 UI 双轨制
- **inline**: `injectSettingsUI()` 动态注入到 ST 扩展设置面板 (主页面 DOM)
- **template**: `settings.html` 通过 ST 的 `renderExtensionTemplateAsync` 在 iframe 中加载

### 6. 批量生成进度
每批调用 `processMessages(chunk, { autoMerge: false })` 跳过合并。全部完成后做一次全局合并。进度持久化到 `_batch`，**每次新生成强制重置**。

---

## 文件职责

| 文件 | 行数 | 核心职责 |
|------|------|----------|
| `manifest.json` | 9 | ST 注册: `display_name`, `version`, `js`, `css`, `hooks.activate` |
| `index.js` | ~700 | ST 生命周期, `llmCall`, 设置 UI, Wand 菜单, `window.EventChronicle` API |
| `ec-bridge.js` | ~720 | SDK 适配, `extractEvents`, `mergeEvents`, `processMessages`, `startBatchGeneration`, CRUD |
| `lib/ec-sdk.mjs` | ~470 | SDK 纯函数 bundle (构建产物) |
| `timeline.html` | ~75 | 独立时间线窗口, 筛选器 + 事件卡片 + 编辑弹窗 |
| `timeline.js` | ~80 | 时间线渲染: `refresh()`, `apply()`, `render()`, `doExport()` |
| `editor.js` | ~59 | 事件编辑: `edit()`, `saveEdit()`, `del()`, `closeModal()` |
| `settings.html` | ~115 | 设置面板 iframe 模板 + 批量生成按钮逻辑 |

---

## 开发工作流

```bash
# 1. 修改 SDK 源码
vim ../sdk/browser/prompts.ts

# 2. 构建浏览器 SDK + 同步到 ST 扩展
cd .. && npm run sync:st

# 3. 刷新 ST 页面测试
```

---

## 测试

### SDK 纯函数 (脱离 ST)
```bash
# Headless 浏览器测试 (需要 Playwright)
cd .. && node test/browser/run-tests.mjs

# 手动测试
cd .. && npm run test:browser
# → http://localhost:8765/test/browser/test-runner.html
```

### SDK bundle 加载验证
```bash
# ES Module 加载
node -e "import('./lib/ec-sdk.mjs').then(m => console.log(Object.keys(m)))"
```

### ST 集成 (手动)
| 测试项 | 验证方法 |
|--------|----------|
| 安装加载 | ST 扩展管理出现 "Event Chronicle" |
| 事件提取 | 发送消息后时间线中出现事件 |
| 批量生成 | 点击按钮, 观察进度条 + 确认事件生成 |
| 记忆注入 | AI 能引用历史事件 |
| 编辑删除 | 时间线中编辑/删除事件, 刷新后确认持久化 |
