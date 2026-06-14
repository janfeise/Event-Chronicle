# Event Chronicle — 开发文档

面向贡献者和深度使用者的项目架构说明。

---

## 项目思路

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

---

## 项目架构

```
event-chronicle/
│
├── sdk/
│   └── index.ts                 ← SDK 统一入口（唯一对外窗口）
│
├── index.ts                     ← 启动入口（startup 函数）
├── cli.ts                       ← CLI 命令入口
│
├── config/
│   └── index.ts                 ← 环境变量加载与配置导出（惰性 getter）
│
├── types/
│   └── index.ts                 ← 全局类型定义（Event, ChatMessage, MergeInstruction, ...）
│
├── prompts/                     ← 提示词模板（.md 文件，支持 {{变量}} 替换）
│   ├── manager.ts               ← PromptManager：提示词加载 / 缓存 / 变量替换
│   ├── extract-event.md         ← 事件提取 Prompt
│   ├── merge-event.md           ← 事件合并 Prompt（指令驱动输出）
│   └── memory-prompt.md         ← Memory Export Prompt 模板
│
├── core/                        ← 核心逻辑
│   ├── index.ts                 ← 管道编排：processMessages（extract → store → auto-merge）
│   ├── llm/                     ← LLM 客户端封装
│   │   ├── index.ts             ← initLLM / complete
│   │   └── openai-client.ts    ← OpenAI SDK 封装
│   ├── extractor/               ← 事件提取模块
│   │   ├── index.ts             ← extractEvents（编排 + ID 注入）
│   │   ├── formatter.ts         ← 消息格式化
│   │   └── parser.ts            ← LLM 响应解析
│   ├── merge/                   ← 事件合并模块
│   │   ├── index.ts             ← mergeEvents + applyInstructions
│   │   ├── formatter.ts         ← 事件格式化 + 窗口截取
│   │   └── parser.ts            ← 合并指令解析
│   ├── store/                   ← 数据持久化
│   │   ├── index.ts             ← 统一导出
│   │   ├── runtimeContext.ts    ← 运行时数据目录管理
│   │   ├── loadChronicle.ts     ← 按 eventId 加载
│   │   ├── saveChronicle.ts     ← 全量保存（时间戳命名）
│   │   ├── appendEvents.ts      ← 追加模式（三级 eventId 降级）
│   │   └── mergeState.ts        ← 合并状态追踪（计数器持久化）
│   ├── exporter/                ← 导出模块
│   │   ├── index.ts             ← 统一导出
│   │   ├── raw-exporter.ts      ← 结构化 JSON 导出
│   │   └── memory-exporter.ts   ← AI 记忆 Markdown + Prompt 包裹
│   └── logger/                  ← 日志模块
│       └── index.ts             ← console + 文件双输出
│
├── demo/                        ← Demo 示例
├── test/                        ← 测试
├── data/                        ← 运行时数据（.gitignore）
│
├── tsconfig.json                ← TypeScript 配置
├── tsup.config.ts               ← 构建配置（ESM + CJS 双输出）
└── package.json
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

### Merge（事件合并）

通过 LLM 分析已有事件和新事件，输出**指令**驱动数据变更（而非输出全量事件 JSON）。

```
existingEvents + newEvents → applyWindow → formatEvents → prompt → LLM
  → parseInstructions → applyInstructions → Event[]
```

**四种指令**：

| Action | 作用 |
|---|---|
| `update` | 修改已有事件（升级/补充信息） |
| `delete` | 删除冗余事件（去重） |
| `add` | 追加全新事件 |
| `keep` | 无操作（隐式兜底） |

**触发策略**：累计新增 N 条事件后自动触发（`CHRONICLE_MERGE_TRIGGER`，默认 5）。

### Storage（数据持久化）

以 JSON 文件存储于 `data/` 目录。

| 函数 | 说明 |
|---|---|
| `loadChronicle(eventId?)` | 按 eventId 加载 `data/{eventId}.json` |
| `saveChronicle(events)` | 全量保存到 `data/event_{timestamp}.json` |
| `appendEvents(events, eventId?)` | 追加模式，三级 eventId 降级 |
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

// 底层：传 Event[]（纯函数）
exportRawFromEvents(events);
exportMemoryFromEvents(events, { groupBy: "tags" });
```

### Logger（日志）

结构化日志模块，console + 文件双输出。

- 四级日志：`debug` / `info` / `warn` / `error`
- 敏感数据脱敏（apiKey 等自动截断）
- 按日期滚动日志文件：`data/logs/YYYY-MM-DD.log`
- 环境变量控制：`LOG_LEVEL`（默认 info）、`LOG_TO_FILE`（默认 true）

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

## 相关文档

| 文档 | 说明 |
|------|------|
| [ST 扩展插件开发文档](./st-extension-dev.md) | SillyTavern 适配层架构、设计决策、开发工作流 |
| [ST 插件设计文档](./st-plugin-guide.md) | 插件功能设计与配置项详解 |
| [SDK 封装指南](./sdk-guide.md) | 从零封装 SDK 的新手教程 |
