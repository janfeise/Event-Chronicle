# Event Chronicle

> A timeline-based long-term memory engine for AI conversations.  
> 基于时间线的 AI 对话长期记忆引擎。

![img](./img/Event-Chronicle logo.png)


<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node"></a>
</p>

---

## 项目简介

> 让对话不只是对话，而是可追溯的历史

### 为什么需要 Event Chronicle

现有的 AI 聊天系统在处理长期记忆时普遍面临三个问题：

1. **摘要 ≠ 记忆**。聊天摘要是压缩后的文本，丢失了时间顺序、因果关系和状态变化链。摘要告诉你"聊了什么"，但不告诉你"发生了什么"。
2. **上下文窗口有限**。每次对话只能携带最近的聊天记录，过去的经历随着上下文滚动而丢失。
3. **记忆碎片化**。多轮对话之间的关联被截断，AI 无法形成连贯的用户认知。

### Event Chronicle 是什么

Event Chronicle 从 AI 对话中**提取事件**（而非摘要），以**编年史**（想法来自于史书记录）的形式长期保存，在未来的对话中将这些历史事件重新注入 LLM 上下文，实现持续一致的长期记忆。

### 适用场景

| 场景 | 说明 |
|---|---|
| **AI Companion** | 让 AI Companion记住与用户的历史互动，形成持续的人物认知 |
| **Roleplay** | 长篇角色扮演中维护完整故事线和人物关系变化 |
| **Agent** | AI Agent 的任务记忆、决策历史和上下文保持 |
| **SillyTavern** | 酒馆插件中的角色记忆持久化 |
| **OpenWebUI** | 对话历史的事件化整理与长期回溯 |
| **MCP Server** | 作为 Model Context Protocol 的记忆后端 |

---

## 核心理念

```
聊天记录 (Chat Messages)
      │
      ▼
 事件提取 (Extract)      ← LLM 从对话中识别状态变化
      │
      ▼
 事件编年史 (Chronicle)  ← 按时间组织的客观事件序列
      │
      ▼
 长期记忆 (Memory)       ← 注入 LLM 上下文的可靠历史
```

**核心**：

1. **事件是历史事实** — 只记录已经发生、明确决定、明确推进的事情
2. **时间线是记忆结构** — 按时间组织的事件序列，保持因果关系
3. **记忆不是摘要** — 摘要告诉你聊了什么；记忆告诉你在这些对话中发生了什么

> 史官，不创造事实，不推测事实，不补全事实。只记录聊天中明确发生、明确决定、明确推进的事件

---

## 系统流程图

```
                     ┌──────────────┐
                     │ Chat Messages│
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Extractor   │  ← extract-event.md prompt
                     │  提取事件      │     LLM 识别状态变化
                     └──────┬───────┘
                            │ Event[]
                            ▼
                     ┌──────────────┐
                     │    Storage    │  ← JSON 文件持久化
                     │   事件存储     │     三级 eventId 降级
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
       [counter < N]  [counter ≥ N]    Export
              │             │             │
              │             ▼             │
              │      ┌──────────┐         │
              │      │   Merge   │  ← merge-event.md
              │      │  事件合并  │     LLM 去重/整理
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
                                │    LLM API   │  ← 注入 system prompt
                                │   下次对话     │
                                └──────────────┘
```

---

## 项目目录结构

```
event-chronicle/
│
├── index.ts                    ← 统一启动入口（startup 函数）
├── .env.example                ← 环境变量配置参考
├── package.json
│
├── config/
│   └── index.ts                ← 环境变量加载与配置导出
│
├── types/
│   └── index.ts                ← 全局类型定义（Event, ChatMessage, MergeInstruction, ...）
│
├── prompts/                    ← 提示词模板（.md 文件，支持 {{变量}} 替换）
│   ├── manager.ts              ← PromptManager：处理提示词加载 / 缓存 / 变量替换
│   ├── extract-event.md        ← 事件提取 Prompt
│   ├── merge-event.md          ← 事件合并 Prompt（指令驱动输出）
│   └── memory-prompt.md        ← Memory Export Prompt 模板
│
├── core/                       ← 核心逻辑
│   ├── index.ts                ← 管道编排：processMessages（extract → store → auto-merge）
│   ├── llm/                    ← LLM 客户端封装
│   │   ├── index.ts            ← initLLM / complete
│   │   └── openai-client.ts   ← OpenAI SDK 封装
│   ├── extractor/              ← 事件提取模块
│   │   ├── index.ts            ← extractEvents（编排 + ID 注入）
│   │   ├── formatter.ts        ← 消息格式化
│   │   └── parser.ts           ← LLM 响应解析
│   ├── merge/                  ← 事件合并模块
│   │   ├── index.ts            ← mergeEvents + applyInstructions
│   │   ├── formatter.ts        ← 事件格式化 + 窗口截取
│   │   └── parser.ts           ← 合并指令解析
│   ├── store/                  ← 数据持久化
│   │   ├── index.ts            ← 统一导出
│   │   ├── loadChronicle.ts    ← 按 eventId 加载
│   │   ├── saveChronicle.ts    ← 全量保存（时间戳命名）
│   │   ├── appendEvents.ts     ← 追加模式（三级 eventId 降级）
│   │   └── mergeState.ts       ← 合并状态追踪（计数器持久化）
│   └── exporter/               ← 导出模块
│       ├── index.ts            ← 统一导出
│       ├── raw-exporter.ts     ← 结构化 JSON 导出
│       └── memory-exporter.ts  ← AI 记忆 Markdown + Prompt 包裹
│
├── test/                       ← 测试
│   ├── phase 1/                ← Phase 1 测试：extract-event 用例
│   │   ├── run-phase1.ts       ← LLM 集成测试
│   │   ├── test-cases-input.json
│   │   └── test-cases-expected.json
│   ├── phase-2/                ← Phase 2 测试：merge 纯函数 + 集成
│   │   ├── run-phase2.ts       ← 纯函数测试（28 用例，无需 LLM）
│   │   ├── run-phase2-integration.ts ← LLM 集成测试
│   │   └── fixtures/           ← 独立 merge 测试用例
│   ├── export/                 ← Exporter 测试
│   │   └── run-exporter.ts     ← 44 项断言
│   ├── e2e/                    ← 端到端测试
│   │   ├── run-e2e.ts
│   │   └── e2e-input.json
│   └── analysis/               ← 测试结果分析报告
│
└── data/                       ← 运行时数据（.gitignore）
    ├── test-01/                ← Phase 1 测试输出
    ├── test-02/                ← Phase 2 测试输出
    └── test-e2e/               ← E2E 测试输出
```

---

## 核心模块说明

### Extractor（事件提取）

从聊天记录中提取状态变化事件。

```
ChatMessage[] → formatMessages → prompt → LLM → parseEvents → injectIds → Event[]
```

| 步骤 | 说明 |
|---|---|
| `formatMessages` | 将 `{role, content}` 数组转为 `角色名:\n内容` 格式 |
| Prompt | `extract-event.md`，通过 `PromptManager.getWithVars` 注入变量 |
| LLM | 调用 `complete()` 获取 JSON 事件数组 |
| `parseEvents` | 解析 LLM 响应，剥离代码块，JSON.parse |
| `injectIds` | 程序侧注入 `evt_{timestamp}_{random6hex}` 唯一 ID |

```ts
import { extractEvents } from "./core/extractor";

const events = await extractEvents(messages, JSON.stringify(existingEvents));
// [{ id: "evt_1718000000_a1b2c3", title: "进入古老图书馆", ... }, ...]
```

### Merge（事件合并）

> 整理编年史

通过 LLM 分析已有事件和新事件，输出**指令**驱动数据变更（而非输出全量事件 JSON）。

```
existingEvents + newEvents → applyWindow → formatEvents → prompt → LLM
  → parseInstructions → applyInstructions → Event[]
```

**四种指令**：

| Action | 作用 | 示例 |
|---|---|---|
| `update` | 修改已有事件（升级/补充信息） | `{ action: "update", id: "evt_x", changes: { title: "新标题" } }` |
| `delete` | 删除冗余事件（去重） | `{ action: "delete", id: "evt_x" }` |
| `add` | 追加全新事件 | `{ action: "add", event: { ... } }` |
| `keep` | 无操作（隐式兜底） | `{ action: "keep" }` |

**为什么需要事件合并**：连续提取可能产生描述同一状态变化的不同版本。合并确保编年史中不重复、不矛盾、信息完整。

**触发策略**：累计新增 N 条事件后自动触发（`CHRONICLE_MERGE_TRIGGER`，默认 5）。合并不随每次提取触发，控制 LLM 调用频率。

### Storage（数据持久化）

以 JSON 文件存储于 `data/` 目录。

| 函数 | 说明 |
|---|---|
| `loadChronicle(eventId?)` | 按 eventId 加载 `data/{eventId}.json` 数据 |
| `saveChronicle(events)` | 全量保存到 `data/event_{timestamp}.json` |
| `appendEvents(events, eventId?)` | 追加模式，三级 eventId 降级（显式 → env → 时间戳） |
| `mergeState` | 合并计数器持久化，程序重启不丢失 |

### Exporter（事件导出）

纯表达层模块，不修改事件数据。

| 导出模式 | 函数 | 输出 |
|---|---|---|
| **Raw Export** | `exportRaw(eventId)` | 完整 JSON 数组（数据迁移/调试） |
| **Memory Export** | `exportMemory(eventId)` | Markdown + Prompt 包裹（直接注入 LLM） |

两层 API：

```ts
// 上层：传 eventId（内部自动加载）
exportRaw("my-story");
exportMemory("my-story", { highlightThreshold: 6 });

// 底层：传 Event[]（纯函数，供测试）
exportRawFromEvents(events);
exportMemoryFromEvents(events, { groupBy: "tags" });
```

---

## Prompt System

所有 LLM 交互通过独立的 `.md` 模板文件管理，与代码解耦。

```
prompts/
├── manager.ts           ← PromptManager 单例
├── extract-event.md     ← 事件提取（{{existingEvents}}, {{recentMessages}}）
├── merge-event.md       ← 事件合并（{{existingEvents}}, {{newEvents}}）
└── memory-prompt.md     ← Memory 导出（{{memoryTimeline}}）
```

### 设计优势

- **可独立迭代**：修改 Prompt 无需改代码
- **可缓存**：首次加载后常驻内存
- **可测试**：Prompt 修改可单独评估效果
- **模板变量**：`{{variableName}}` 语法，运行时替换

### Prompt 加载流程

```
promptManager.get("extract-event")
  → 首次调用 → fs.readFileSync → 写入内存缓存
  → 后续调用 → 直接从缓存返回

promptManager.getWithVars("extract-event", { recentMessages: "..." })
  → 获取缓存内容 → 替换 {{recentMessages}} → 返回
```

---

## 项目 type 定义

### Event

```json
{
  "id": "evt_1718000000_a1b2c3",
  "title": "进入古老图书馆",
  "summary": "用户进入古老图书馆",
  "importance": 4,
  "participants": ["用户"],
  "location": "古老图书馆",
  "tags": ["地点变化", "探索"]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，程序注入，格式 `evt_{timestamp}_{random6hex}` |
| `title` | `string` | 事件标题，简洁概括（≤15 字） |
| `summary` | `string` | 事件摘要，仅描述状态变化结果 |
| `importance` | `number` | 重要性 1–10（1–3 日常 / 4–6 显著 / 7–8 重大 / 9–10 定义级） |
| `participants` | `string[]` | 参与者列表（原始角色名） |
| `location` | `string` | 发生地点，未知为空 |
| `tags` | `string[]` | 分类标签 |

### MergeInstruction

```ts
interface MergeInstruction {
  action: "update" | "delete" | "add" | "keep";
  id?: string;
  changes?: Partial<Event>;   // update 时
  event?: Event;              // add 时
}
```

---

## Memory Export

Memory Export 不只是将事件转为 Markdown，而是输出一个**可直接注入 LLM system prompt 的完整上下文**。

### 输出结构

```
# Role
你是一名具备长期记忆能力的AI助手。

# Memory Context（用户历史事件）
{{memoryTimeline}}          ← 渲染后的 Markdown 事件数据

# Rules
1. 必须基于历史事件理解用户背景
2. 不允许忽略 Memory Context
3. 不允许修改 Memory Context
4. 优先使用 Memory Context 进行推理
5. 当前对话必须与历史事件保持一致

# Instruction
请基于以上长期记忆与当前对话进行回答。
```

### Memory Timeline 内容

- **Summary**：事件总数 + 重要性范围
- **By Location/Tag**：按地点/标签分组
- **Key Events**：重要性 ≥ 阈值的事件详情
- **Timeline**：时间线表格

### 注入 LLM 的方式

```ts
const systemPrompt = exportMemory("user-story");
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },  // ← 直接注入
    { role: "user", content: "今天发生了什么？" },
  ],
});
```

---

## 开发指南

### 环境要求

- Node.js ≥ 18
- OpenAI 兼容的 API Key

### 安装

```bash
git clone <repo-url>
cd event-chronicle
npm install
cp .env.example .env
# 编辑 .env 填入 LLM_API_KEY
```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `LLM_API_KEY` | ✓ | — | LLM API Key |
| `LLM_PROVIDER` | | `openai` | LLM 提供商 |
| `LLM_BASE_URL` | | `https://api.openai.com/v1` | API 地址 |
| `LLM_MODEL` | | `gpt-4o` | 模型名称 |
| `CHRONICLE_EVENT_ID` | | — | 默认 eventId |
| `CHRONICLE_MERGE_TRIGGER` | | `5` | 自动合并触发阈值 |
| `CHRONICLE_MERGE_WINDOW` | | `20` | 合并时发送给 LLM 的已有事件数 |

### 运行

```bash
# 启动（配置检查 + LLM 初始化 + 提示词预热）
npx tsx index.ts

# 纯函数测试（无需 LLM）
npx tsx test/phase-2/run-phase2.ts

# Exporter 测试
npx tsx test/export/run-exporter.ts

# LLM 集成测试
npx tsx test/phase-2/run-phase2-integration.ts

# E2E 测试（完整管道）
npx tsx test/e2e/run-e2e.ts
```

### 使用示例

```ts
import { startup } from "./index";
import { processMessages } from "./core";
import { exportMemory } from "./core/exporter";

// 1. 启动
await startup({ healthCheck: false });

// 2. 提取事件（自动持久化 + 达到阈值自动合并）
const result = await processMessages(
  [
    { role: "小明", content: "周末去爬西山吧！" },
    { role: "小红", content: "好啊，叫上小刚一起。" },
  ],
  { eventId: "my-story", autoMerge: true },
);
// → { events: [...], storedFile: "my-story.json", merged: false }

// 3. 导出为 LLM 上下文
const memoryPrompt = exportMemory("my-story");
```

---

## 创建新 Prompt

1. 在 `prompts/` 目录创建 `.md` 文件
2. 使用 `{{variableName}}` 语法声明模板变量
3. 通过 `promptManager.getWithVars("name", vars)` 调用

```markdown
# prompts/my-prompt.md

## Data
{{inputData}}

## Output
JSON only.
```

```ts
const result = promptManager.getWithVars("my-prompt", {
  inputData: JSON.stringify(data),
});
```

无需注册 — `PromptManager` 自动扫描 `.md` 文件。

---

## 创建新 Exporter

```ts
// core/exporter/my-exporter.ts
import { loadChronicle } from "../store";
import type { Event } from "../../types";

// 上层 API
export function exportMyFormat(eventId: string): string {
  return exportMyFormatFromEvents(loadChronicle(eventId));
}

// 底层纯函数
export function exportMyFormatFromEvents(events: Event[]): string {
  // ... 格式转换逻辑 ...
}
```

然后在 `core/exporter/index.ts` 添加导出即可。

---

## 路线图

| 版本 | 内容 |
|---|---|
| **V0.1** ✓ | extractor + merge + store + exporter 核心管道 |
| **V0.2** | Adapter 层（SillyTavern / OpenWebUI 插件） |
| **V0.3** | CLI 工具（`npx event-chronicle extract "..."`） |
| **V1.0** | MCP Server 模式，支持其他 AI 应用通过标准协议接入 |
| **V1.5** | 向量检索 — 支持语义搜索历史事件 |
| **V2.0** | Graph Export — 人物关系图、事件关联图 |
| **V3.0** | 多用户 / 多会话隔离，Web Dashboard |

---

## FAQ

### 为什么不用聊天摘要？

摘要告诉你"聊了什么"，但丢失了时间顺序、因果关系和状态变化链。摘要说"用户和小明讨论了爬山计划"——但编年史告诉你：

> 1. 小明提议周末去西山（计划建立）  
> 2. 小红同意并联系了小刚（计划扩展）  
> 3. 三人约定周六 7:00 校门口集合（计划确定）

这些是**可作为事实推理的长期记忆**，而非模糊的印象。

### 为什么不用向量数据库？

向量数据库擅长语义搜索，但不擅长保持**时间线结构**和**因果关系**。两者的关系是互补的：Chronicle 提供结构化记忆，向量检索提供语义访问——并非二选一。V1.5 将引入向量检索作为 Chronicle 的补充查询方式。

### 为什么需要事件合并？

连续提取可能对同一状态变化产生不同版本（如"开始学习 Vue"和"开始系统学习 Vue 前端框架开发"）。如果不合并，编年史中将积累大量冗余事件，降低记忆质量。

### ID 是 LLM 生成的吗？

不是。ID 由程序侧注入（`evt_{timestamp}_{random6hex}`），不依赖 LLM。这样确保唯一性、减少 prompt token 消耗，且避免了 LLM 生成不可靠 ID 的风险。

---

## Contributing

### 目录规范

- 核心逻辑 → `core/` 下对应的子模块
- 全局类型 → `types/index.ts`
- 提示词模板 → `prompts/*.md`
- 测试 → `test/<feature>/`
- 配置文件 → `config/`

### Prompt 编写规范

1. 使用 `# Section` 结构化
2. 包含**正例**和**反例**（好例子 / 坏例子）
3. 规则前置：约束放在数据之前，确保 LLM 先读规则后读数据
4. 使用 `{{variableName}}` 模板变量，与 `PromptManager` 兼容

### 提交规范

- `feat:` 新功能
- `fix:` 修复
- `prompt:` Prompt 调整
- `test:` 测试
- `docs:` 文档

---

## License

MIT

---

## Acknowledgements

- 灵感来源：史书，是人类记忆与历史的交织，短短一行字便能道尽一件事的始末。这让我思考：这种积淀千年、并被无数前人验证过的记录智慧，是否也能注入到当今的 AI 之中？
