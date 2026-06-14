# Event Chronicle

![img](./img/Event-Chronicle%20logo.png)

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node"></a>
</p>

---

> 让对话不只是对话，而是一部持续书写的可视编年史

Event Chronicle 从 AI 对话中提取事件，以编年史的方式记录关键经历、决策与重要变化，按时间顺序构建可视化事件时间线。这些事件被长期保存，可在未来对话中注入模型上下文——使 AI 基于历史事实而非压缩摘要进行推理。

**记忆不是摘要**：摘要告诉你聊了什么；编年史告诉你在这些对话中**发生了什么**。

---

## Demo

假设有以下聊天信息

![img](./img/demo-02.png)

Event Chronicle 不会保存整段聊天，只会从中提取事件

```json
[
  {
    "date": "2026-06-14",
    "event": "用户开始饲养一只三个月大的橘猫，取名为奶糖"
  },
  {
    "date": "2026-06-14",
    "event": "奶糖昨天进行了体检，结果正常"
  }
]
```

这些事件会被保存到编年史中。后续再次对话时，Event Chronicle 将完整编年史注入模型上下文：

```text
Event Chronicle

2026-06
├─ 用户开始饲养一只三个月大的橘猫，取名为奶糖
├─ 奶糖昨天进行了体检，结果正常
```

AI 基于这些历史事件组织回复——它们构成了 AI 的长期记忆。

> 要理解现在，必须追溯过去

---

## Installation

```bash
npm install event-chronicle
```

**环境要求**：Node.js ≥ 18。

---

## Quick Start

在项目中安装依赖 `event-chronicle`：

```bash
npm install event-chronicle
npm install -D tsx          # TypeScript 运行器，也可用 node + .js
```

配置 API Key：创建 `.env` 文件，填入你的 LLM API Key：

> 支持的 LLM 提供商：OpenAI、DeepSeek、以及任何兼容 OpenAI API 格式的服务

```env
LLM_API_KEY=sk-your-api-key-here
```

创建 `chronicle.ts`：

```ts
import { startup, processMessages, exportMemory } from "event-chronicle";

async function main() {
  // 1. 初始化（自动加载 .env → 初始化 LLM → 预热提示词 → 健康检查）
  await startup();

  // 2. 处理对话 —— 提取事件、自动持久化、达到阈值自动合并
  const result = await processMessages(
    [
      { role: "小明", content: "周末去爬西山吧！" },
      { role: "小红", content: "好啊，叫上小刚一起。" },
    ],
    { eventId: "my-story" },
  );

  console.log("提取事件:", result.events.length, "条");
  console.log("存储文件:", result.storedFile);
  console.log("触发合并:", result.merged);

  // 3. 导出为 LLM 上下文（可直接作为 system prompt 注入下次对话）
  const memory = exportMemory("my-story");
  console.log(memory);
}

main();
```

运行：

```bash
npx tsx chronicle.ts
```

预期输出：生成的数据将保存在项目 `data/`  目录下

```
╔══════════════════════════════════════════╗
║          Event Chronicle 启动…           ║
╚══════════════════════════════════════════╝
[Event Chronicle] ✓  LLM 健康检查通过
[Event Chronicle] 🚀 启动完成

提取事件: 1 条
存储文件: my-story.json
触发合并: false

# Event Chronicle Memory
## Summary
1 events · importance range 6–6
...
```

> 💡 完整 Demo（6 轮 RPG 对话、自动合并触发）见 [`demo/`](./demo/)。

---

## API Reference

### 第一层：一站式 API

大多数场景只需这两个函数。

| 函数 | 说明 |
|---|---|
| `startup(options?)` | 加载 .env → 初始化 LLM → 预热提示词 → 健康检查 |
| `processMessages(messages, options?)` | 完整管道：提取事件 → 持久化 → 自动合并检测 |

```ts
const result = await processMessages(messages, {
  eventId: "my-story",    // 数据文件名
  autoMerge: true,        // 累计事件达阈值自动合并（默认 true）
  existingEventId: "old", // 加载已有事件供 LLM 参考去重
});
// → { events: Event[], storedFile: string, merged: boolean }
```

| 导出函数 | 说明 | 输出 |
|---|---|---|
| `exportMemory(eventId, options?)` | Memory Export | Markdown + Prompt 包裹，可直接注入 LLM system prompt |
| `exportRaw(eventId)` | Raw Export | 完整 JSON 数组（数据迁移 / 调试） |

### 第二层：流程级 API

需要自定义流程时使用。

| 函数 | 说明 |
|---|---|
| `extractEvents(messages, existingEvents?)` | 仅提取事件，不持久化 |
| `mergeEvents(existing, newEvents)` | 仅合并事件，不自动触发 |
| `applyInstructions(existing, newEvents, instructions)` | 纯函数：执行合并指令 |
| `loadChronicle(eventId?)` | 读取已存储的事件 |
| `saveChronicle(events)` | 全量保存到新文件 |
| `appendEvents(events, eventId?)` | 追加事件到已有文件 |

### 第三层：底层 API

需要完全控制时使用。

| 函数 | 说明 |
|---|---|
| `initLLM(config)` | 手动初始化 LLM 客户端 |
| `loadMergeState(eventId)` | 读取合并计数器状态 |
| `resetMergeCounter(eventId)` | 重置合并计数器 |
| `getDataDir()` / `setDataDir(dir)` | 获取/覆盖数据目录 |
| `loadEnv()` | 手动加载 .env 到 process.env |
| `exportRawFromEvents(events)` | 纯函数版 Raw Export |
| `exportMemoryFromEvents(events, options?)` | 纯函数版 Memory Export |
| `PromptManager` | 提示词管理器类（创建自定义实例） |

### 类型

```ts
import type {
  Event,              // { id, title, summary, importance, participants, location, tags }
  ChatMessage,        // { role: string, content: string }
  LLMConfig,          // { provider, baseUrl, apiKey, model, ... }
  ProcessOptions,     // processMessages 的选项类型
  ProcessResult,      // processMessages 的返回值类型
  MemoryExportOptions,// exportMemory 的选项类型
  StartupOptions,     // startup 的选项类型
} from "event-chronicle";
```

---

## Configuration

### 方式一：.env 文件（推荐）

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `LLM_API_KEY` | ✓ | — | LLM API Key |
| `LLM_PROVIDER` | | `openai` | LLM 提供商 |
| `LLM_BASE_URL` | | `https://api.openai.com/v1` | API 地址 |
| `LLM_MODEL` | | `gpt-4o` | 模型名称 |
| `CHRONICLE_EVENT_ID` | | — | 默认数据文件名 |
| `CHRONICLE_MERGE_TRIGGER` | | `5` | 自动合并触发阈值 |
| `CHRONICLE_MERGE_WINDOW` | | `20` | 合并时发送给 LLM 的已有事件数 |

### 方式二：代码传参

```ts
// 完全绕过 .env，纯代码配置
await startup({
  healthCheck: false,
  llmConfig: {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-xxx",
    model: "gpt-4o",
  },
  dataDir: "./my-data",           // 自定义数据目录
  promptsDir: "./my-prompts",     // 自定义提示词目录
});
```

---

## 系统流程

```
                     ┌──────────────┐
                     │ Chat Messages│
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Extractor   │  ← LLM 从对话中提取事件
                     │  事件提取      │
                     └──────┬───────┘
                            │ Event[]
                            ▼
                     ┌──────────────┐
                     │    Storage    │  ← JSON 文件持久化
                     │   事件存储     │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       [counter < N]  [counter ≥ N]    Export
              │             │             │
              │             ▼             │
              │      ┌──────────┐         │
              │      │   Merge   │  ← LLM 去重/整理
              │      │  事件合并  │         │
              │      └────┬─────┘         │
              │           │               │
              │           ▼               │
              │      ┌──────────┐         │
              │      │  Storage  │        │
              │      │  保存结果  │        │
              │      └──────────┘         │
              │                           │
              ▼                           ▼
       ┌──────────┐              ┌──────────────┐
       │ Continue │              │   Exporter    │
       │  继续积累 │              │ Raw / Memory  │
       └──────────┘              └──────┬───────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │    LLM API   │  ← 注入记忆
                               │   下次对话     │
                               └──────────────┘
```

**核心原则**：

1. **事件是历史事实** — 只记录已经发生、明确决定、明确推进的事情
2. **时间线是记忆结构** — 按时间组织的事件序列，保持因果关系
3. **记忆不是摘要** — 摘要告诉你聊了什么；记忆告诉你在这些对话中发生了什么

> 史官，不创造事实，不推测事实，不补全事实。Event Chronicle 只记录聊天中明确发生、明确决定、明确推进的事件。

---

## 副作用

1. 每轮对话的 token 增加（记忆会注入到 LLM API 中）
2. token 逐步递增：事件不断累积，记忆愈加厚重
3. LLM API 请求次数增多：每 N 次对话触发一次提取，每 M 个事件触发一次合并（N、M 可配置）

---

## 更多资源

| 资源 | 说明 |
|---|---|
| [Web Demo](./demo-web/) | 浏览器交互式 Demo，分裂面板 UI，支持真实 SDK 调用 |
| [CLI Demo](./demo/) | 6 轮 RPG 对话的完整端到端示例 |
| [SDK 封装指南](./docs/sdk-guide.md) | 从零封装 SDK 的新手教程 |
| [开发文档](./docs/development.md) | 项目架构、模块说明、Prompt 系统 |

---

## 扩展

若导入 TA 的"历史"，AI 是否是 TA 的一种延续呢？

---

## License

MIT
