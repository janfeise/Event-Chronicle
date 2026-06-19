# Event Chronicle — ST Extension Development Guide

`st-extension/` 是 SillyTavern 适配层，将 Event Chronicle SDK 桥接到 ST 的扩展系统。

> 用户文档见 [st-extension/README.md](../st-extension/README.md)

---

## 架构总览

```
ST 聊天消息
    │
    ▼ CHARACTER_MESSAGE_RENDERED 事件
index.js (ST 集成层, ~760 行)
    │ llmCall() → POST /api/backends/chat-completions/generate
    ▼
ec-bridge.js (适配层, ~740 行)
    │ extractEvents() → mergeEvents() → processMessages()
    ▼
lib/ec-sdk.mjs (SDK 浏览器 bundle, ~470 行, 由 npm run sync:st 生成)
    parseEvents / formatMessages / applyInstructions / ...
    extractPrompt / mergePrompt / memoryPrompt
```

### 存储分离架构

```
┌─────────────────────────────┬─────────────────────────────────────┐
│  extension_settings         │  metadata (chat_metadata)           │
│  → settings.json            │  → {chat}.jsonl                     │
│  全局配置 (用户偏好)          │  per-chat 业务数据                   │
│                             │                                     │
│  autoExtractionEnabled      │  _events: Event[]                   │
│  extractTriggerCount        │  _merge: { newEventCount,           │
│  mergeTriggerCount          │           lastMergeAt }             │
│  extractionCooldown         │  _batch: { lastProcessedIndex,      │
│  overrideMaxTokens          │           totalMessages, completed } │
│  batchSliceSize             │                                     │
│  highlightThreshold         │                                     │
│  llmOverride { ... }        │                                     │
│                             │                                     │
│  持久化: saveSettingsDebounced│ 持久化: saveMetadataDebounced       │
└─────────────────────────────┴─────────────────────────────────────┘
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
| `eventSource.on(CHAT_CHANGED)` | 切换对话 | 重置追踪状态 + 重新注入 metadata |
| `eventSource.on(MESSAGE_DELETED)` | 消息删除 | 重置追踪标记 |
| `eventSource.on(MESSAGE_UPDATED)` | 消息更新 | 重置追踪标记 |

### 4. 存储分离: extension_settings + metadata

插件采用双存储后端，职责分离：

**extension_settings — 全局配置** (`settings.json`)
```
extension_settings['event-chronicle']
  ├── autoExtractionEnabled, extractTriggerCount, ...
  └── llmOverride { chat_completion_source, model, ... }
```
通过 `saveSettingsDebounced()` 持久化。配置变更时写入。

**metadata — per-chat 业务数据** (`{chat}.jsonl`)
```
getContext().metadata['event-chronicle']
  ├── _events    → Event[]
  ├── _merge     → { newEventCount, lastMergeAt }
  └── _batch     → { lastProcessedIndex, totalMessages, completed }
```
通过 `saveMetadataDebounced()` (从 `extensions.js` 导入) 持久化。切换聊天时自动加载对应 metadata。

**注入机制：**
```js
// index.js init()
ecBridge.setExtSettings(extension_settings);       // 全局配置引用
ecBridge.setMetadata(ctx.chatMetadata, saveFn);    // per-chat metadata 引用

// index.js onChatChanged()
injectMetadata();  // 切换聊天时重新注入新聊天的 metadata
```

**数据迁移：** `init()` 中 `migrateToMetadata()` 将旧版 extension_settings 中的业务数据一次性迁移到 metadata。

### 5. 设置 UI 双轨制
- **inline**: `injectSettingsUI()` 动态注入到 ST 扩展设置面板 (主页面 DOM)
- **template**: `settings.html` 通过 ST 的 `renderExtensionTemplateAsync` 在 iframe 中加载

### 6. 增量批量生成
采用增量模式：只处理 `lastProcessedIndex` 之后的新消息，不重复处理历史内容。

```
聊天消息数组
[0 ........ 119][120 ........ 新消息]
      已处理          待处理
                    ↓
              提取新增 Event
                    ↓
            更新 lastProcessedIndex
```

- 每批调用 `processMessages(chunk, { autoMerge: false })` 跳过合并
- 全部完成后做一次全局合并
- `lastProcessedIndex` 持久化到 metadata `_batch`，跨会话保留
- 如果 `lastProcessedIndex >= chat.length`，自动重置为 0 允许重新全量生成
- UI 显示增量状态：`已处理: 120 / 150 · 待处理: 30 条`

### 7. 事件时间戳：来自消息发送时间
Event 的 `timestamp` 取自 ST 消息的 `send_date`（消息实际发送时间），而非提取时间。

```js
// ec-bridge.js extractEvents()
const lastMsg = messages[messages.length - 1];
const ts = lastMsg?.send_date
  ? Math.floor(new Date(lastMsg.send_date).getTime() / 1000)  // 消息发送时间
  : nowTimestamp();  // fallback: 提取时间
```

**设计原因**：ST 每条消息都有 `send_date`（ISO 字符串），记录消息创建时间。Event 作为对话时间线，时间应反映对话发生时刻，而非 LLM 提取时刻。取最后一条消息的时间，因为一批消息 = 一个时间段。

---

## 文件职责

| 文件 | 行数 | 核心职责 |
|------|------|----------|
| `manifest.json` | 9 | ST 注册: `display_name`, `version`, `js`, `css`, `hooks.activate` |
| `index.js` | ~760 | ST 生命周期, `llmCall`, 设置 UI, Wand 菜单, `window.EventChronicle` API, metadata 注入/迁移 |
| `ec-bridge.js` | ~740 | SDK 适配, `extractEvents`, `mergeEvents`, `processMessages`, 增量 `startBatchGeneration`, CRUD, 双存储适配 |
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
| 增量生成 | 首次全量处理 → 发送新消息 → 再次点击只处理新增部分 |
| 无新消息 | `lastProcessedIndex === chat.length` 时提示"暂无新消息" |
| 进度显示 | UI 显示 `已处理: X / Y · 待处理: Z 条` |
| 记忆注入 | AI 能引用历史事件 |
| 编辑删除 | 时间线中编辑/删除事件, 刷新后确认持久化 |
| 存储分离 | `settings.json` 不含 `_events/_merge/_batch`；`{chat}.jsonl` 的 metadata 包含业务数据 |
| 聊天切换 | 切换聊天后事件自动隔离, metadata 重新注入 |
