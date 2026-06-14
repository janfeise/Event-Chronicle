# Event Chronicle — SillyTavern 插件设计文档

> 本文档描述 Event Chronicle 作为 SillyTavern 扩展插件时的完整功能设计、配置项与实现细节。

---

## 目录

1. [概述](#1-概述)
2. [插件架构](#2-插件架构)
3. [对话更改（Chat Changes）](#3-对话更改chat-changes)
4. [配置项详解](#4-配置项详解)
5. [Event 数据管理](#5-event-数据管理)
6. [一键生成（批量处理历史数据）](#6-一键生成批量处理历史数据)
7. [maxToken 覆盖机制](#7-maxtoken-覆盖机制)
8. [注意事项](#8-注意事项)
9. [技术实现参考](#9-技术实现参考)

---

## 1. 概述

Event Chronicle 是一个 SillyTavern 扩展插件，用于从 AI 角色扮演对话中自动提取**结构化事件**，构建**事件编年史（Chronicle）**，并将其作为**长期记忆**注入 LLM 上下文。

```
聊天数据 (Chat Messages)
      │
      ▼
 事件提取 (Extract)      ← LLM 从对话中提取事件
      │
      ▼
 事件编年史 (Chronicle)  ← 按时间组织的客观事件序列
      │
      ▼
 长期记忆 (Memory)       ← 注入 LLM 上下文的可靠历史
```

### 1.1 核心价值

| 痛点 | 解决方案 |
|------|----------|
| 长对话中 AI 遗忘早期情节 | Memory 注入让 LLM 始终知晓历史 |
| 角色关系/状态变化难以追踪 | Event 结构化记录，可查询可回看 |
| 记忆数量膨胀、重复冗余 | 自动合并去重（Merge），保持编年史精简 |
| 每次都要手动整理剧情 | 全自动提取 + 增量合并，零手动操作 |

### 1.2 与 SillyTavern 的集成方式

Event Chronicle 以 **Extension** 形式集成到 SillyTavern 中：

- **插件类型**：SillyTavern Extension（前端 + 服务端）
- **运行方式**：随 SillyTavern 启动自动加载
- **LLM 调用**：复用 SillyTavern 已配置的模型，也可独立指定
- **数据存储**：所有 Event 数据存储在插件自有目录中（JSON 文件）

---

## 2. 插件架构

### 2.1 模块组成

```
st-extension/                        ← SillyTavern 扩展插件目录
│
├── manifest.json                    ← ST 扩展清单（名称、版本、入口）
├── index.js                         ← 扩展主入口（注册生命周期钩子）
│
├── settings/                        ← 配置 UI
│   ├── settings.html                ← ST 设置面板 HTML
│   └── settings.js                  ← 设置面板逻辑
│
├── event-ui/                        ← Event 数据浏览与管理 UI
│   ├── timeline.html                ← 时间线展示页面
│   ├── timeline.js                  ← 时间线交互逻辑
│   └── editor.js                    ← Event 编辑/删除逻辑
│
└── lib/                             ← 核心逻辑（引用 event-chronicle SDK）
    └── ec-bridge.js                 ← 封装 SDK 调用，桥接 ST API
```

### 2.2 数据流

```
SillyTavern 聊天消息
        │
        ▼
┌─────────────────┐
│  ec-bridge.js    │  ← 监听 ST 消息事件，调用 SDK
│  (ST 适配层)     │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│  event-chronicle │  ← npm 包（SDK 形式）
│  SDK             │
│  · extractEvents │
│  · mergeEvents   │
│  · exportMemory  │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│  data/*.json     │  ← 本地文件存储
└─────────────────┘
```

### 2.3 生命周期钩子

插件通过以下 ST Extension 钩子与 SillyTavern 交互：

| 钩子 | 触发时机 | 插件行为 |
|------|----------|----------|
| `onChatChanged` | 每次用户发送消息 / AI 回复后 | 累加消息计数，判断是否触发事件提取 |
| `onGenerate` | LLM 生成回复前 | 注入 Memory（从编年史导出的长期记忆） |
| `onSettingsLoaded` | 插件设置加载完成 | 初始化 SDK（startup），预热提示词缓存 |

---

## 3. 对话更改（Chat Changes）

### 3.1 事件提取（Extract）

**触发条件**：当聊天消息数累计达到 **N 条**（可配置）后自动触发。

**执行流程**：

```
聊天消息累积 → 计数达到阈值？
                      │
                      ▼ 是
            ┌──────────────────┐
            │  extractEvents()  │  ← 调用 SDK
            │  (取最近消息)     │
            └──────┬───────────┘
                   │
                   ▼
            ┌──────────────────┐
            │  追加存储         │  ← appendEvents()
            │  data/{id}.json  │
            └──────┬───────────┘
                   │
                   ▼
            ┌──────────────────┐
            │  检查合并阈值     │  ← newEventCount >= M ?
            │  达到 → 自动合并  │
            └──────────────────┘
```

### 3.2 Memory 注入（Inject）

**触发时机**：每次 LLM 生成回复前（`onGenerate` 钩子）。

**注入内容**：从编年史导出的 Markdown 格式长期记忆，被包裹在 Prompt 模板中。

**注入格式示例**：

```markdown
# Event Chronicle Memory

## Summary
15 events · importance range 3–9

## By Location
### Tavern (5 events)
- **初遇神秘商人** (★7): 冒险者在酒馆遇到一位兜售古地图的商人 — _战士, 法师, 盗贼_ @ Tavern
- ...

## Key Events (importance ≥ 7)
### 发现古神庙入口 (★9)
冒险者根据地图在密林中找到了被藤蔓覆盖的神庙入口。
Participants: 战士, 法师, 盗贼 | Location: Ancient Forest | Tags: discovery, exploration

## Timeline
| # | Event | ★ | Participants | Location |
|---|-------|---|-------------|----------|
| 1 | 接受委托 | 5 | 战士, 法师, 盗贼 | Guild Hall |
| 2 | 初遇神秘商人 | 7 | 战士, 法师, 盗贼 | Tavern |
| ... |
```

**注入位置**：作为 System Message 或追加到对话开头（可配置）。

---

## 4. 配置项详解

插件在 SillyTavern 的扩展设置面板中提供以下配置项：

### 4.1 对话次数（Extract Trigger Threshold）

- **配置名**：`extractTriggerCount`
- **默认值**：10
- **说明**：当聊天 message 累计达到 N 条后，自动触发事件提取 API。
- **行为**：达到阈值 → 取最近的消息切片 → 调用 `extractEvents()` → 重置计数器。

> **设计考量**：
> - 值太小（如 3）：频繁触发 LLM 调用，token 消耗大
> - 值太大（如 50）：事件提取不及时，可能遗漏关键转折
> - 推荐值：10–20

### 4.2 整理阈值（Merge Trigger Threshold）

- **配置名**：`mergeTriggerCount`
- **默认值**：5
- **说明**：当新增事件的条数达到 M 条时，自动触发事件整理/合并。
- **行为**：达到阈值 → 加载全量已有事件 → 调用 `mergeEvents()` → 全量保存。

> **合并逻辑（四种指令）**：
>
> | Action | 作用 |
> |---|---|
> | `update` | 修改已有事件（升级/补充信息） |
> | `delete` | 删除冗余事件（去重） |
> | `add` | 追加全新事件 |
> | `keep` | 无操作（隐式兜底） |

### 4.3 模型设置（LLM Configuration）

- **配置名**：`llmOverride`
- **默认值**：空（使用 SillyTavern 全局配置）
- **说明**：SillyTavern 中已经配置了模型，但 Event 插件仍提供独立的模型配置项，允许为事件提取指定不同的模型。

| 字段 | 说明 | 默认值 |
|------|------|--------|
| Provider | LLM 提供商 | 继承 ST 全局 |
| Model | 模型名称 | 继承 ST 全局 |
| API Key | API 密钥 | 继承 ST 全局 |
| Base URL | API 地址 | 继承 ST 全局 |
| Temperature | 生成温度 | 0（确保提取结果稳定） |
| Max Tokens | 最大输出 token | 2048 |

> **使用场景**：
> - 用廉价模型做事件提取（如 GPT-4o-mini）
> - 用高质量模型保留给角色扮演（如 Claude Opus）
> - 事件提取对模型能力要求较低，分开配置可大幅节省成本

### 4.4 Event 数据浏览

- **入口**：ST 扩展面板内嵌的 Timeline 页面
- **展示方式**：以**时间线顺序**展示所有 Event 数据
- **排序**：按事件 ID 中的时间戳排序（旧→新）

### 4.5 Event 修改和删除

- **入口**：Timeline 页面中每个 Event 卡片的右下角
- **功能**：
  - **编辑**：打开编辑弹窗，修改 title / summary / importance / tags / participants / location
  - **删除**：确认后从编年史中移除该事件，自动保存
- **持久化**：修改/删除操作直接写入 `data/{eventId}.json`

### 4.6 Event UI 模板

每个 Event 卡片在 Timeline 中的展示布局：

```
┌─────────────────────────────────────────┐
│  📅 2024-03-15 14:30                     │
│  ═══════════════════════════════════     │
│                                          │
│  初遇神秘商人                  ★★★★★★★☆☆☆ │
│  ───────────────────────────────────     │
│  冒险者在酒馆遇到一位兜售古地图的神秘商人，  │
│  商人声称地图指向一座被遗忘的古神庙……      │
│                                          │
│  🏷️ discovery · merchant · quest          │
│                                          │
│                          [ ✏️ 编辑 ] [ 🗑️ 删除 ] │
└─────────────────────────────────────────┘
```

**布局说明**：

| 位置 | 内容 | 说明 |
|------|------|------|
| 上方（左） | 时间戳 | 事件发生时间 |
| 上方（右） | title + 重要度星标 | `★` 数量表示 importance (1–10) |
| 中间 | summary | 事件简述（2–3 句话） |
| 下方 | tags | 文字标签列表（以 `·` 分隔） |
| 最下方（右下角） | 编辑 / 删除按钮 | 点击触发对应操作 |

### 4.7 maxToken 覆盖

- **配置名**：`overrideMaxTokens`
- **默认值**：2048
- **说明**：SillyTavern 默认的最大 token 数通常较少（如 256 或 512），插件在触发 LLM 调用时以插件配置的 maxToken 覆盖该值。

详见 [第 7 节](#7-maxtoken-覆盖机制)。

---

## 5. Event 数据管理

### 5.1 数据存储结构

```
data/
├── {eventId}.json                  ← 编年史主数据（Event[]）
├── {eventId}_state.json            ← 合并状态（计数器）
└── logs/                           ← 运行日志
    └── YYYY-MM-DD.log
```

**Event 数据结构**：

```ts
interface Event {
  id: string;           // evt_{timestamp}_{random6hex}，程序自动生成
  title: string;        // 事件标题（LLM 生成）
  summary: string;      // 事件简述（LLM 生成）
  importance: number;   // 重要度 1–10（LLM 评定）
  participants: string[]; // 参与者列表
  location: string;     // 发生地点
  tags: string[];       // 分类标签
}
```

**Merge State 数据结构**：

```ts
interface MergeState {
  newEventCount: number;    // 自上次合并以来累计的新事件数
  lastMergeAt: string | null; // 上次合并时间（ISO 字符串）
}
```

### 5.2 存储策略

| 策略 | 说明 |
|------|------|
| **追加模式** | 新事件通过 `appendEvents()` 追加到已有文件 |
| **eventId 降级** | 插件指定 eventId → 全局默认 eventId → 时间戳自动生成 |
| **崩溃安全** | 计数器先于事件数据写入，确保崩溃时不会丢失合并触发 |

### 5.3 合并去重机制

通过 LLM 对比已有事件和新事件，输出**指令**驱动数据变更：

```
existingEvents + newEvents → applyWindow → formatEvents → prompt → LLM
  → parseInstructions → applyInstructions → Event[]
```

- **窗口约束**：合并时仅取最近 M 条（默认 20）已有事件发给 LLM，减少 token 消耗
- **指令执行**：纯函数操作，不依赖 LLM 做数据修改，安全可靠

---

## 6. 一键生成（批量处理历史数据）

### 6.1 功能概述

对于 SillyTavern 中已有的长对话历史，提供**一键增量生成 Event** 的功能。

### 6.2 设计思路

一次全部生成历史对话的所有 Event 可能超出 LLM 上下文限制，因此采用**切片增量生成**策略：

```
历史消息
  ├── 切片 1 (5条消息) → extractEvents() → appendEvents()
  ├── 切片 2 (5条消息) → extractEvents() → appendEvents()
  ├── 切片 3 (5条消息) → extractEvents() → appendEvents()
  │     ...
  └── 切片 N           → extractEvents() → appendEvents()
                                       │
                                       ▼
                              [全部完成后触发合并]
```

### 6.3 配置项

#### 切片数量（Slice Size）

- **配置名**：`batchSliceSize`
- **默认值**：5
- **说明**：每次发送多少条 message 给 LLM 用于生成 event。
- **权衡**：
  - 值小 → 单次 token 消耗少，但总调用次数多
  - 值大 → 单次提取更完整，但可能超过上下文限制
  - 推荐：5–10

#### 增量生成进度追踪

- **配置名**：`batchProgress`
- **存储位置**：`data/{eventId}_batch_progress.json`
- **说明**：记录历史 event 生成的进度，避免每次都从头开始，开销巨大。

```ts
interface BatchProgress {
  eventId: string;           // 目标编年史 ID
  lastProcessedIndex: number; // 上次处理到的消息索引
  totalMessages: number;      // 总消息数
  completed: boolean;         // 是否已完成全量生成
  startedAt: string;          // 开始时间
  completedAt?: string;       // 完成时间
}
```

### 6.4 生成流程

```
1. 用户点击「一键生成」按钮
        │
        ▼
2. 读取聊天历史（从 ST 获取全部消息）
        │
        ▼
3. 读取 BatchProgress（确定从哪开始）
        │
        ▼
4. 切片循环：
   while (lastProcessedIndex < totalMessages) {
     const slice = messages.slice(i, i + batchSliceSize);
     const events = await extractEvents(slice, existingEventsJson);
     await appendEvents(events, eventId);
     更新 BatchProgress;
     i += batchSliceSize;
   }
        │
        ▼
5. 全部切片完成后，触发一次全量合并
        │
        ▼
6. 标记 completed = true
```

### 6.5 注意事项

**批次生成期间合并阈值增高**：
- 正常对话时合并阈值为 M（默认 5）
- 批量生成期间合并阈值**暂时提高**（如 20），避免每生成一个切片就触发一次合并
- 批量生成全部完成后，执行一次最终的全量合并
- 此阈值暂时不可由用户配置（后续版本考虑开放）

---

## 7. maxToken 覆盖机制

### 7.1 问题背景

SillyTavern 默认的 `maxTokens`（通常为 256 或 512）对于事件提取这种结构化 JSON 输出来说**严重不足**。

### 7.2 覆盖策略

**触发时机**：插件每次调用 Event API（提取 / 合并）前。

**覆盖方式**：

```
1. 插件调用 LLM 前
       │
       ▼
2. 读取插件配置的 overrideMaxTokens（默认 2048）
       │
       ▼
3. 临时覆盖 ST 全局 maxTokens → 插件配置值
       │
       ▼
4. 发起 LLM 请求（事件提取 / 合并）
       │
       ▼
5. 请求完成后恢复 ST 原始 maxTokens
```

### 7.3 配置建议

| 场景 | 推荐 maxToken | 说明 |
|------|--------------|------|
| 短对话事件提取 | 1024 | 3–5 个事件的 JSON |
| 长对话事件提取 | 2048 | 5–10 个事件的 JSON |
| 事件合并 | 4096 | 含已有事件 + 指令输出 |

---

## 8. 注意事项

### 8.1 Token 消耗警告

**对历史数据一键生成大量 Event 时，必须提醒用户**：

> ⚠️ **注意**：此操作将对历史聊天记录进行批量事件提取，预计将调用 LLM API 约 **X 次**，消耗约 **Y tokens**，请确认 API 账户余额充足。

弹窗示例信息：
- 总消息数：500 条
- 切片大小：10 条/次
- 预计 LLM 调用次数：50 次
- 预计 Token 消耗（输入+输出）：约 100K tokens
- 预计耗时：约 3–5 分钟

### 8.2 maxToken 限制导致 API 失效

SillyTavern 自身有 `maxTokens` 限制，如果不覆盖可能导致：

- LLM 返回被截断的 JSON → 解析失败
- 事件提取不完整 → 遗漏关键事件
- 合并指令被截断 → 部分指令丢失，数据损坏

**解决方案**：插件必须确保在每次调用 LLM 前覆盖 maxToken。

### 8.3 数据安全性

- **操作前自动备份**：一键生成前自动备份当前编年史数据（`data/{eventId}_backup_{timestamp}.json`）
- **可回滚**：如果批量生成结果不满意，可从备份恢复
- **日志追踪**：所有 LLM 调用记录在 `data/logs/` 中，便于排查问题

### 8.4 性能考量

| 场景 | 建议 |
|------|------|
| 正常聊天 | 提取阈值 10–20，合并阈值 5 |
| 高速对话 | 适当提高提取阈值，降低 LLM 调用频率 |
| 批量生成 | 切片 5–10 条，合并阈值临时提高到 20+ |
| 超长编年史（>100 events） | 考虑分片存储或归档旧事件 |

---

## 9. 技术实现参考

### 9.1 SDK 调用示例（ec-bridge.js）

```js
import { startup, processMessages, exportMemory, loadChronicle } from "event-chronicle";

// 初始化（使用 ST 的 LLM 配置）
const llmConfig = {
  provider: getSTSetting("apiProvider") || "openai",
  baseUrl: getSTSetting("apiUrl") || "https://api.openai.com/v1",
  apiKey: getSTSetting("apiKey"),
  model: getSTSetting("modelName") || "gpt-4o-mini",
  maxTokens: pluginSettings.overrideMaxTokens || 2048,
};

await startup({
  llmConfig,
  dataDir: "./extensions/event-chronicle/data",
});

// 监听消息并提取事件
let messageCount = 0;
const extractThreshold = pluginSettings.extractTriggerCount || 10;

onChatChanged((messages) => {
  messageCount += 1;
  if (messageCount >= extractThreshold) {
    const result = await processMessages(messages, {
      eventId: getCurrentChatId(),
      autoMerge: true,
    });
    messageCount = 0;
  }
});

// 注入 Memory
onGenerate((context) => {
  const memory = exportMemory(getCurrentChatId(), {
    highlightThreshold: 6,
    groupBy: "location",
  });
  // 将 memory 追加到 system prompt
  context.systemPrompt = memory + "\n\n" + context.systemPrompt;
});
```

### 9.2 SillyTavern Extension 清单（manifest.json）

```json
{
  "name": "Event Chronicle",
  "version": "1.0.0",
  "description": "从 AI 角色扮演对话中自动提取事件，构建可视编年史，形成长期记忆",
  "author": "Tilex",
  "entry": "index.js",
  "settings": "settings/settings.html",
  "requires": ["event-chronicle"]
}
```

### 9.3 关键依赖

| 依赖 | 用途 |
|------|------|
| `event-chronicle` (npm) | 核心 SDK：事件提取 / 合并 / 导出 |
| SillyTavern Extension API | 插件注册、生命周期钩子、设置面板 |
| SillyTavern Chat API | 读取聊天消息、获取当前对话 ID |

---

## 附录 A：配置项速查表

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `extractTriggerCount` | number | 10 | 触发事件提取的消息数阈值 |
| `mergeTriggerCount` | number | 5 | 触发自动合并的新增事件数阈值 |
| `mergeWindowSize` | number | 20 | 合并时发送给 LLM 的已有事件窗口大小 |
| `overrideMaxTokens` | number | 2048 | 覆盖 ST 默认的最大 token 数 |
| `batchSliceSize` | number | 10 | 一键生成时每次发送的消息数 |
| `llmOverride.provider` | string | — | 覆盖 LLM 提供商 |
| `llmOverride.model` | string | — | 覆盖模型名称 |
| `llmOverride.apiKey` | string | — | 覆盖 API Key |
| `llmOverride.baseUrl` | string | — | 覆盖 API 地址 |
| `llmOverride.temperature` | number | 0 | 事件提取温度（建议 0，确保稳定） |

## 附录 B：环境变量（SDK 层）

这些环境变量由 event-chronicle SDK 层使用，在 ST 插件中由设置面板管理，写入 `.env` 或通过 `startup({ llmConfig })` 直接传入：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CHRONICLE_EVENT_ID` | 默认编年史 ID | — |
| `CHRONICLE_MERGE_WINDOW` | 合并窗口大小 | 20 |
| `CHRONICLE_MERGE_TRIGGER` | 合并触发阈值 | 5 |
| `LLM_PROVIDER` | LLM 提供商 | `openai` |
| `LLM_API_KEY` | API 密钥 | —（必填） |
| `LLM_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `LLM_MODEL` | 模型名称 | `gpt-4o` |
| `LLM_MAX_TOKENS` | 最大输出 token | 2048 |
| `LLM_TEMPERATURE` | 生成温度 | 0 |
| `LOG_LEVEL` | 日志级别 | `info` |
| `LOG_TO_FILE` | 是否写入日志文件 | `true` |

---

> **Event Chronicle SDK 文档**：参见 [SDK 封装指南](./sdk-guide.md)  
> **开发文档**：参见 [开发文档](./development.md)
