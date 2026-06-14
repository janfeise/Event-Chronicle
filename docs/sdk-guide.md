# Event Chronicle SDK 封装指南

> 以新手视角，从零开始将本项目封装为一个可被外部引用的 SDK。

---

## 目录

1. [前置知识：什么是 SDK 封装](#1-前置知识什么是-sdk-封装)
2. [现状分析：我们的项目缺什么](#2-现状分析我们的项目缺什么)
3. [第一步：设计公共 API 边界](#3-第一步设计公共-api-边界)
4. [第二步：创建 TypeScript 构建配置](#4-第二步创建-typescript-构建配置)
5. [第三步：配置 package.json](#5-第三步配置-packagejson)
6. [第四步：创建 SDK 统一入口](#6-第四步创建-sdk-统一入口)
7. [第五步：构建与本地验证](#7-第五步构建与本地验证)
8. [第六步：消费测试——假装自己是使用者](#8-第六步消费测试假装自己是使用者)
9. [进阶：CJS/ESM 双格式输出](#9-进阶cjs--esm-双格式输出)
10. [检查清单](#10-检查清单)

---

## 1. 前置知识：什么是 SDK 封装

### 1.1 你现在能怎么用这个项目？

打开终端，在项目目录下运行：

```bash
npx tsx index.ts
```

这能跑，但**仅限于本项目内部**。如果你想在另一个项目里使用 Event Chronicle，你只能：

- 把整个项目文件夹复制过去
- 或者用相对路径 `import` 一堆内部文件

这两种方式都不优雅，而且暴露了所有内部实现细节。

### 1.2 封装后的理想状态

封装成 SDK 后，使用者在自己的项目中只需：

```bash
npm install event-chronicle
```

然后：

```ts
import { startup, processMessages, exportMemory } from "event-chronicle";
```

三行代码，就能用。不需要知道内部有几个文件夹、每个模块叫什么名字。

### 1.3 封装到底做了什么？

通俗地说，SDK 封装就是给项目**装一扇门**：

| 封装前 | 封装后 |
|---|---|
| 房子没有门，谁都能从窗户翻进去 | 装了一扇正门，只有门能进出 |
| 使用者能看到所有内部房间 | 使用者只能看到你允许的客厅 |
| 内部改了布局，使用者代码跟着崩 | 内部随便改，只要门不变就行 |

技术上，封装做了三件事：

1. **定义公共 API**：决定哪些函数/类型对外暴露
2. **配置构建**：把 TypeScript 编译成 JavaScript（`dist/` 目录）
3. **声明入口**：在 `package.json` 里告诉 Node.js "入口文件在 `dist/index.js`"

---

## 2. 现状分析：我们的项目缺什么

### 2.1 当前 package.json

```json
{
  "dependencies": {
    "dotenv": "^17.4.2",
    "openai": "^6.42.0",
    "sharp": "^0.35.1"
  },
  "devDependencies": {
    "@types/node": "^25.9.3"
  }
}
```

### 2.2 缺失清单

对照一个标准 npm 包，我们缺这些东西：

| 字段 | 作用 | 当前状态 |
|---|---|---|
| `name` | 包名，`npm install` 用的名字 | ❌ 缺失 |
| `version` | 版本号，遵循语义化版本 | ❌ 缺失 |
| `main` | CJS 入口，`require()` 时找的文件 | ❌ 缺失 |
| `module` | ESM 入口，`import` 时找的文件 | ❌ 缺失 |
| `types` | TypeScript 类型声明入口 | ❌ 缺失 |
| `exports` | 现代出口映射（Node.js 12.7+） | ❌ 缺失 |
| `files` | `npm publish` 时包含哪些文件 | ❌ 缺失 |
| `scripts.build` | 构建命令 | ❌ 缺失 |
| `tsconfig.json` | TypeScript 编译配置 | ❌ 缺失 |

### 2.3 目录结构的问题

```
当前结构：
event-chronicle/
├── index.ts          ← 启动入口（含 startup()、直接运行逻辑）
├── core/             ← 核心逻辑
│   ├── index.ts      ← processMessages()
│   ├── extractor/
│   ├── merge/
│   ├── store/
│   ├── exporter/
│   └── llm/
├── config/
├── types/
└── prompts/
```

存在的问题：

- **根目录 `index.ts` 既是库入口又是 CLI 入口**，混合了 `startup()` 导出和 `if (isMain) startup()` 直接运行逻辑，作为 SDK 入口不干净
- **内部模块互相引用用的是深层相对路径**（如 `../../types`），外部根本没法 import
- **`prompts/` 目录里的 `.md` 文件**在构建后需要能被运行时找到（路径问题）

---

## 3. 第一步：设计公共 API 边界

### 3.1 原则

> 只暴露使用者需要的东西，隐藏所有内部实现。

一个好的公共 API 满足：

- **少**：API 数量越少，使用者学习成本越低
- **稳定**：一旦发布 1.0，API 就不能随便改
- **自解释**：函数名和参数名就能说明用途

### 3.2 分析现有代码：哪些该暴露？

我们把每个模块过一遍：

#### 必须暴露（使用者直接调用）

| 函数/类 | 来源文件 | 用途 |
|---|---|---|
| `startup(options?)` | `index.ts` | 初始化配置 + LLM + 预热提示词 |
| `processMessages(messages, options?)` | `core/index.ts` | 核心管道：提取 → 存储 → 自动合并 |
| `exportMemory(eventId, options?)` | `core/exporter/` | 导出为 LLM 上下文 |
| `exportRaw(eventId)` | `core/exporter/` | 导出原始 JSON |

#### 建议暴露（高级用户可能需要）

| 函数 | 用途 |
|---|---|
| `initLLM(config)` | 手动初始化 LLM 客户端 |
| `extractEvents(messages, existingEvents?)` | 只提取事件，不持久化 |
| `mergeEvents(existing, newEvents)` | 只合并，不自动触发 |
| `loadChronicle(eventId?)` | 读取已存储的事件 |
| `saveChronicle(events)` | 全量保存事件 |

#### 不暴露（内部实现）

| 模块 | 原因 |
|---|---|
| `core/llm/openai-client.ts` | 实现细节，通过 `initLLM` 间接使用 |
| `core/extractor/formatter.ts` | 内部格式化逻辑 |
| `core/extractor/parser.ts` | 内部解析逻辑 |
| `core/merge/formatter.ts` | 内部格式化逻辑 |
| `core/merge/parser.ts` | 内部解析逻辑 |
| `core/store/appendEvents.ts` | 内部持久化细节 |
| `core/store/mergeState.ts` | 内部计数器逻辑 |
| `prompts/manager.ts` 的 `PromptManager` 类 | 通过 `startup()` 自动初始化 |
| `config/index.ts` | 通过 `startup()` 自动加载 |

#### 类型：只暴露公共 API 用到的

```ts
// 暴露
Event, ChatMessage, ProcessOptions, ProcessResult,
MemoryExportOptions, LLMConfig, StartupOptions

// 不暴露
MergeInstruction, LLMOptions  // 只在内部使用
```

### 3.3 画出 API 边界图

```
┌─────────────────────────────────────────────────────┐
│                   公共 API（SDK 入口）                 │
│                                                     │
│  startup()         processMessages()                │
│  exportMemory()    exportRaw()                      │
│  extractEvents()   mergeEvents()                    │
│  initLLM()         loadChronicle()   saveChronicle()│
│                                                     │
│  + 类型: Event, ChatMessage, ProcessOptions, ...    │
├─────────────────────────────────────────────────────┤
│                   内部实现（不暴露）                    │
│                                                     │
│  OpenAIClient    formatMessages    parseEvents      │
│  formatEvents    parseInstructions applyWindow      │
│  appendEvents    mergeState        PromptManager    │
└─────────────────────────────────────────────────────┘
```

---

## 4. 第二步：创建 TypeScript 构建配置

### 4.1 选择构建工具

对于 TypeScript 库，最常见的方案：

| 工具 | 特点 | 适合场景 |
|---|---|---|
| `tsc` | TypeScript 官方编译器，只编译不打包 | 简单库 |
| `tsup` | 基于 esbuild，快，支持打包 | 中大型库 |
| `rollup` + 插件 | 最灵活，配置复杂 | 需要精细控制 |

**本项目的推荐：`tsup`**

原因：
- 项目不大，不需要复杂配置
- 内置支持 CJS + ESM 双输出
- 内置类型生成（`dts: true`）
- 构建速度极快（esbuild）

```bash
npm install -D tsup
```

### 4.2 创建 tsconfig.json

在项目根目录创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    // ---- 目标 ----
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",

    // ---- 输出 ----
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // ---- 严格 ----
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // ---- 路径 ----
    "rootDir": ".",
    "baseUrl": "."
  },

  // 只编译这些文件
  "include": [
    "index.ts",
    "core/**/*.ts",
    "config/**/*.ts",
    "types/**/*.ts",
    "prompts/**/*.ts"
  ],

  // 排除测试和构建产物
  "exclude": [
    "node_modules",
    "dist",
    "test",
    "data"
  ]
}
```

**逐行解释（写给新手）：**

| 选项 | 白话解释 |
|---|---|
| `target: "ES2022"` | 编译到 ES2022 语法（Node.js 18+ 都支持） |
| `module: "ESNext"` | 保留 `import/export` 语法，让打包工具处理 |
| `moduleResolution: "bundler"` | 告诉 TS 你后面会用打包工具（tsup），按打包工具的方式解析模块 |
| `declaration: true` | 生成 `.d.ts` 类型声明文件——这样使用者的 IDE 才有自动补全 |
| `declarationMap: true` | 生成 `.d.ts.map`——让使用者在 IDE 里能跳转到源码 |
| `sourceMap: true` | 生成 `.js.map`——调试时能映射回 TS 源码 |
| `strict: true` | 开启所有严格检查，不放过任何潜在 bug |
| `rootDir: "."` | 源码根目录是项目根目录 |
| `include` | 白名单：只编译这些路径 |
| `exclude` | 黑名单：跳过这些路径 |

### 4.3 手动创建 tsconfig.json

```bash
# 在项目根目录执行
touch tsconfig.json
```

然后把上面的内容粘贴进去。

> **为什么不用 `npx tsc --init`？**
>
> 自动生成的 `tsconfig.json` 带 80 多行注释掉的选项，对新手来说噪声太大。手动创建更干净，每个选项都是你主动选的。

---

## 5. 第三步：配置 package.json

### 5.1 完整配置

```json
{
  "name": "event-chronicle",
  "version": "0.1.0",
  "description": "从 AI 对话中提取事件，构建可视编年史，形成长期记忆",
  "license": "MIT",
  "author": "Tilex",
  "keywords": ["ai", "memory", "chronicle", "llm", "chat", "events"],
  "repository": {
    "type": "git",
    "url": "<你的仓库地址>"
  },

  // ====== 入口声明（最重要！）======

  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",

  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },

  // ====== 发布控制 ======

  "files": [
    "dist",
    "prompts",
    "README.md",
    "LICENSE"
  ],

  // ====== 脚本 ======

  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "prepublishOnly": "npm run build"
  },

  // ====== 依赖（保持不变）======

  "dependencies": {
    "dotenv": "^17.4.2",
    "openai": "^6.42.0"
  },
  "devDependencies": {
    "@types/node": "^25.9.3",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0"
  },

  // ====== 环境要求 ======

  "engines": {
    "node": ">=18"
  },
  "type": "module"
}
```

### 5.2 逐字段解释

#### 入口声明：`main` / `module` / `types` / `exports`

这是整个封装**最关键的部分**。它们告诉 Node.js 和 TypeScript："当有人 import 这个包时，应该加载哪个文件"。

```
使用者写:                          Node.js 实际加载:
import { startup }               → dist/index.js    (module 字段)
  from "event-chronicle"

const { startup } =              → dist/index.cjs   (main 字段)
  require("event-chronicle")

类型补全:                          → dist/index.d.ts  (types 字段)
```

**`exports` 字段**（Node.js 12.7+）是最精确的入口控制：

```json
"exports": {
  ".": {                           // import "event-chronicle"
    "import": "./dist/index.js",   // ESM 用户用这个
    "require": "./dist/index.cjs", // CJS 用户用这个
    "types": "./dist/index.d.ts"   // TS 类型用这个
  }
}
```

如果你想支持子路径导入（如 `event-chronicle/exporter`），可以加：

```json
"exports": {
  ".": { ... },
  "./exporter": {
    "import": "./dist/exporter.js",
    "require": "./dist/exporter.cjs",
    "types": "./dist/exporter.d.ts"
  }
}
```

**对本项目，建议先从最简单的单入口开始。** 后续根据需要再加子路径。

#### `files` — 发布白名单

`npm publish` 默认会把整个项目上传。`files` 是白名单——只上传这些：

```
files: ["dist", "prompts", "README.md", "LICENSE"]
```

为什么 `prompts/` 要包含在内？
- `.md` 提示词文件在运行时被 `PromptManager` 从文件系统读取
- 如果 `prompts/` 不在发布包里，使用者的 `node_modules/event-chronicle/prompts/` 目录就是空的
- 后续可以考虑把 `.md` 内容编译进 JS bundle，但现在最简单的方式就是直接附带文件

#### `scripts`

| 命令 | 作用 |
|---|---|
| `npm run build` | 执行 tsup 构建 |
| `npm run dev` | 开发模式，文件变化自动重新构建 |
| `prepublishOnly` | `npm publish` 之前自动执行，确保发布的一定是最新构建产物 |

#### `type: "module"`

告诉 Node.js：这个包里的 `.js` 文件默认按 ESM（`import/export`）语法解析。

> **新手常见坑**：如果设置 `"type": "module"`，项目中所有 `.js` 文件都按 ESM 处理。如果某个文件需要用 `require()`，必须把扩展名改成 `.cjs`。

### 5.3 创建 tsup 配置

在项目根目录创建 `tsup.config.ts`：

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  // 入口文件
  entry: ["sdk/index.ts"],

  // 输出格式
  format: ["esm", "cjs"],

  // 生成类型声明
  dts: true,

  // 生成 source map
  sourcemap: true,

  // 清理上次构建产物
  clean: true,

  // 外部依赖（不打包进 bundle，保持为 import）
  external: [
    "dotenv",
    "openai",
    "fs",
    "path",
  ],

  // 输出目录
  outDir: "dist",

  // 分包（每个入口拆成独立 chunk）
  splitting: false,
});
```

**逐行解释：**

| 选项 | 白话解释 |
|---|---|
| `entry: ["sdk/index.ts"]` | 从这个文件开始打包（后面会创建） |
| `format: ["esm", "cjs"]` | 同时输出 ESM（`.js`）和 CJS（`.cjs`），覆盖所有使用者 |
| `dts: true` | 自动生成 `.d.ts` 类型文件 |
| `clean: true` | 每次构建前清空 `dist/` |
| `external: [...]` | 这些包不打包进去——让使用者自己安装。`dotenv` 和 `openai` 是 npm 依赖，`fs` 和 `path` 是 Node.js 内置模块 |

---

## 6. 第四步：创建 SDK 统一入口

### 6.1 为什么需要一个新入口

当前根目录的 `index.ts` 有两个问题：

1. **混合了 CLI 和库逻辑**：`if (isMain) startup()` 这段只在直接运行时才需要
2. **导入路径是深层相对路径**：构建后这些路径会乱掉

**解决方案**：新建 `sdk/index.ts` 作为 SDK 入口，它只做一件事——把公共 API 整齐地重新导出。

### 6.2 创建 `sdk/index.ts`

```ts
// ============================================================================
// Event Chronicle SDK — 统一公共入口
//
// 这是整个 SDK 唯一的入口文件。
// 使用者的所有导入都从这里来：
//   import { startup, processMessages } from "event-chronicle";
// ============================================================================

// ---------------------------------------------------------------------------
// 核心管道
// ---------------------------------------------------------------------------
export { processMessages } from "../core";
export type { ProcessOptions, ProcessResult } from "../core";

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------
export { startup } from "../index";
export type { StartupOptions } from "../index";

// ---------------------------------------------------------------------------
// 事件提取（高级 API）
// ---------------------------------------------------------------------------
export { extractEvents } from "../core/extractor";

// ---------------------------------------------------------------------------
// 事件合并（高级 API）
// ---------------------------------------------------------------------------
export { mergeEvents, applyInstructions } from "../core/merge";

// ---------------------------------------------------------------------------
// 持久化（高级 API）
// ---------------------------------------------------------------------------
export {
  loadChronicle,
  saveChronicle,
  appendEvents,
} from "../core/store";

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------
export { exportRaw, exportRawFromEvents, exportMemory, exportMemoryFromEvents } from "../core/exporter";
export type { MemoryExportOptions } from "../types";

// ---------------------------------------------------------------------------
// LLM 客户端（高级 API）
// ---------------------------------------------------------------------------
export { initLLM } from "../core/llm";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
export type { Event, ChatMessage, LLMConfig } from "../types";
```

### 6.3 设计思路："三层 API"

最终的 SDK 形成了清晰的三层：

```
第一层：一站式 API（大多数用户只需这两个）
  startup()            — 一行初始化
  processMessages()    — 一行处理

第二层：流程 API（需要自定义流程的高级用户）
  extractEvents()      — 只提取
  mergeEvents()        — 只合并
  exportMemory()       — 只导出

第三层：底层 API（需要完全控制的高级用户）
  initLLM()            — 手动初始化 LLM
  loadChronicle()      — 手动读数据
  saveChronicle()      — 手动写数据
```

**对使用者的心理模型：**

- "我就想用" → 看第一层
- "我想定制流程" → 看第二层
- "我要完全掌控" → 看第三层

---

## 7. 第五步：构建与本地验证

### 7.1 安装依赖

```bash
npm install
```

### 7.2 首次构建

```bash
    npx tsup
```

如果一切顺利，你会看到：

```
dist/
├── index.js          ← ESM 格式
├── index.cjs         ← CJS 格式
├── index.d.ts        ← TypeScript 类型声明
├── index.d.ts.map
├── index.js.map
└── index.cjs.map
```

### 7.3 检查构建产物

打开 `dist/index.d.ts`，确认类型导出正确：

```ts
// 应该能看到类似的声明
export declare function startup(options?: StartupOptions): Promise<LLMConfig>;
export declare function processMessages(messages: ChatMessage[], options?: ProcessOptions): Promise<ProcessResult>;
```

打开 `dist/index.js`，确认没有奇怪的导入路径残留。

### 7.4 常见构建问题排查

| 问题 | 原因 | 解决 |
|---|---|---|
| `Cannot find module '../core'` | `rootDir` 配置不对 | 确保 `tsconfig.json` 中 `rootDir: "."` |
| `dist/` 为空 | `entry` 路径写错 | 检查 `tsup.config.ts` 中 `entry: ["sdk/index.ts"]` |
| `.d.ts` 没有生成 | `dts` 没开 | 确保 `tsup.config.ts` 中 `dts: true` |
| 类型中的相对路径乱掉 | tsup 打包时类型路径未处理 | 加 `"declarationMap": true` 到 tsconfig |
| `fs` 被 polyfill | tsup 默认处理 Node 内置模块 | 确保 `external: ["fs", "path"]` |

---

## 8. 第六步：消费测试——假装自己是使用者

这是**最关键的一步**：在真正发布之前，先在本地模拟使用者安装和使用的全过程。

### 8.1 创建本地测试项目

```bash
# 在项目外部创建一个测试目录
mkdir ../ec-sdk-test
cd ../ec-sdk-test
npm init -y
```

### 8.2 安装本地 SDK

```bash
# 用相对路径安装本地包（npm link 也可以，但相对路径更直观）
npm install ../event-chronicle
```

安装后，检查 `node_modules/event-chronicle/` 下是否只有 `files` 白名单中的内容：

```bash
ls node_modules/event-chronicle/
# 应该看到: dist/  prompts/  README.md  package.json
# 不应该看到: core/  config/  types/  test/  sdk/  src/
```

### 8.3 编写消费测试

创建 `test-sdk.ts`：

```ts
// 测试 1: 导入公共 API
import {
  startup,
  processMessages,
  exportMemory,
  exportRaw,
} from "event-chronicle";

// 测试 2: 导入类型
import type {
  Event,
  ChatMessage,
  ProcessResult,
  MemoryExportOptions,
} from "event-chronicle";

// 测试 3: IDE 自动补全是否正常
async function test() {
  // 输入 startup( 时，IDE 应该提示 StartupOptions
  await startup({ healthCheck: false });

  // 输入 processMessages( 时，IDE 应该提示 ChatMessage[]
  const result: ProcessResult = await processMessages(
    [
      { role: "小明", content: "周末去爬山吧！" },
      { role: "小红", content: "好啊！" },
    ],
    { eventId: "test-story", autoMerge: false },
  );

  console.log("提取事件:", result.events.length, "条");
  console.log("存储文件:", result.storedFile);

  // 测试导出
  const memory = exportMemory("test-story");
  console.log("记忆导出长度:", memory.length, "字符");
}

test().catch(console.error);
```

### 8.4 运行

```bash
# 需要先配置 .env（LLM_API_KEY 等）
cp ../event-chronicle/.env.example .env
# 编辑 .env 填入真实 API Key

npx tsx test-sdk.ts
```

### 8.5 检查清单

- [ ] `import` 语句不报错
- [ ] IDE 对函数参数有自动补全
- [ ] IDE 对返回值类型有提示
- [ ] Ctrl+Click 函数名能跳转到类型声明
- [ ] 实际调用能正常运行
- [ ] `node_modules/event-chronicle/` 没有泄露内部文件

---

## 9. 进阶：CJS / ESM 双格式输出

### 9.1 为什么要双格式

| 使用者场景 | 需要的格式 |
|---|---|
| 现代前端项目 (Vite / Next.js / Nuxt) | ESM (`import`) |
| 传统 Node.js 项目 | CJS (`require`) |
| TypeScript 项目 | 不在乎，但需要 `.d.ts` |
| SillyTavern（基于 Node.js） | 取决于其运行时 |

ESM 和 CJS 双输出意味着**所有人都能用**。

### 9.2 tsup 自动处理

`tsup.config.ts` 中的 `format: ["esm", "cjs"]` 会自动生成：

```
dist/
├── index.js      ← ESM（import/export 语法）
└── index.cjs     ← CJS（require/module.exports 语法）
```

`package.json` 中的 `exports` 条件映射确保 Node.js 运行时选择正确的文件：

```json
"exports": {
  ".": {
    "import": "./dist/index.js",    // ESM 环境用这个
    "require": "./dist/index.cjs"   // CJS 环境用这个
  }
}
```

### 9.3 特别注意：`type: "module"`

`package.json` 中的 `"type": "module"` 声明了这个包属于 ESM 生态。这会影响：

- `.js` 文件默认被当作 ESM 解析
- 如果某个第三方包是纯 CJS 且用了 `require()`，可能导致兼容问题

对于本项目：
- `dotenv` — 支持 ESM ✅
- `openai` — 支持 ESM ✅
- 所以设置 `"type": "module"` 没有问题

---

## 10. 检查清单

完成以下所有项，SDK 封装才算完成：

### 文件创建

- [ ] `tsconfig.json`（TypeScript 配置）
- [ ] `tsup.config.ts`（构建配置）
- [ ] `sdk/index.ts`（SDK 统一入口）

### package.json 配置

- [ ] `name` — 包名
- [ ] `version` — 版本号
- [ ] `main` — CJS 入口
- [ ] `module` — ESM 入口
- [ ] `types` — 类型入口
- [ ] `exports` — 出口映射
- [ ] `files` — 发布白名单
- [ ] `scripts.build` — 构建命令
- [ ] `scripts.dev` — 开发模式（可选）

### 构建验证

- [ ] `npm run build` 成功执行
- [ ] `dist/` 目录包含 `.js` / `.cjs` / `.d.ts`
- [ ] `dist/` 不包含测试文件
- [ ] `dist/` 不包含内部实现细节

### 消费测试

- [ ] 本地测试项目能 `import` SDK
- [ ] 所有公共 API 函数可调用
- [ ] 类型自动补全正常
- [ ] 运行时行为正确

### 文档

- [ ] README 中的示例代码与 SDK 入口一致
- [ ] 架构图对应最终 API 结构

---

## 附录 A：最终目录结构预览

封装完成后的项目结构：

```
event-chronicle/
│
├── sdk/
│   └── index.ts                 ← SDK 统一入口（唯一对外窗口）
│
├── dist/                        ← 构建产物（.gitignore）
│   ├── index.js                 ← ESM
│   ├── index.cjs                ← CJS
│   └── index.d.ts               ← 类型声明
│
├── core/                        ← 核心逻辑（内部，不发布）
├── config/                      ← 配置（内部）
├── types/                       ← 类型定义（内部）
├── prompts/                     ← 提示词模板（随包发布）
├── test/                        ← 测试（不发布）
├── data/                        ← 运行时数据（不发布）
│
├── tsconfig.json                ← TS 配置
├── tsup.config.ts               ← 构建配置
├── package.json                 ← 包配置
└── README.md
```

## 附录 B：从封装到发布的操作流程

```bash
# 1. 开发完成后
npm run build

# 2. 本地验证
cd ../ec-sdk-test
npm install ../event-chronicle   # 模拟使用者安装
npx tsx test-sdk.ts              # 验证运行

# 3. 版本管理
cd ../event-chronicle
npm version patch                # 0.1.0 → 0.1.1（修 bug）
npm version minor                # 0.1.0 → 0.2.0（加功能）
npm version major                # 0.1.0 → 1.0.0（破坏性变更）

# 4. 发布（如果发布到 npm）
npm publish                      # 公开包
npm publish --access public      # 如果包名有 scope（@yourname/xxx）
```

---

> **记住核心原则：公共 API 是你的承诺，内部实现是你的自由。**
>
> 门装好了，屋里怎么装修都不会影响走过门口的人。
