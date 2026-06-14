/**
 * 单条聊天消息。
 *
 * role 放宽为 string 以容纳任意角色名（如 "小明"、"侦探"），
 * 不再限定为 OpenAI 标准角色枚举。实际调用 LLM API 时由调用方
 * 确保角色值合法。
 */
interface ChatMessage {
    role: string;
    content: string;
}
/** LLM 提供商配置 */
interface LLMConfig {
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}
/**
 * 从聊天中提取出的事件。
 *
 * id 由程序在提取后注入（非 LLM 生成），格式 `evt_{timestamp}_{random6hex}`。
 * 其余字段与 prompts/extract-event.md / prompts/merge-event.md 约定的 JSON 输出结构一致。
 */
interface Event {
    id: string;
    title: string;
    summary: string;
    importance: number;
    participants: string[];
    location: string;
    tags: string[];
}
/** 合并指令 —— LLM 输出的最小变更单元，程序据此批量修改已有数据 */
interface MergeInstruction {
    action: "update" | "delete" | "add" | "keep";
    /** update / delete 时必填 */
    id?: string;
    /** update 时填写变更字段（不含 id，id 不可变） */
    changes?: Partial<Event>;
    /** add 时填写完整新事件 */
    event?: Event;
}
/** Memory Export 的可选配置 */
interface MemoryExportOptions {
    /** 标题，默认 "Event Chronicle Memory" */
    title?: string;
    /** 重要事件高亮阈值（importance >= 该值的事件单独列出），默认 7 */
    highlightThreshold?: number;
    /** 是否包含时间线表格，默认 true */
    includeTimeline?: boolean;
    /** 分组依据，默认 "location" */
    groupBy?: "location" | "tags" | "none";
}

interface StartupOptions {
    /** 是否执行 LLM 健康检查，默认 true */
    healthCheck?: boolean;
    /**
     * 直接传入 LLM 配置（优先级高于 .env / process.env）。
     * 传入时完全跳过 env 读取，适合纯代码配置场景。
     */
    llmConfig?: LLMConfig;
    /**
     * 自定义数据存储目录。
     * 默认：process.cwd() + "/data"
     */
    dataDir?: string;
    /**
     * 自定义提示词 .md 文件目录。
     * 默认：自动检测（开发模式使用源码目录，构建后使用 dist/prompts/）
     */
    promptsDir?: string;
}
declare function startup(options?: StartupOptions): Promise<LLMConfig>;

/**
 * core 统一入口：extract → store → [auto-merge]
 *
 * 管道流程：
 *   messages → extractEvents → appendEvents
 *                                  │
 *                    [newEventCount >= threshold?]
 *                                  │ 是
 *                     loadChronicle → mergeEvents → saveChronicle
 */

interface ProcessOptions {
    /**
     * 指定要加载的已有事件文件（第一优先级）。
     * 传入时 → `data/{existingEventId}.json`
     * 未传入 → 降级到 config.defaultEventId；不存在则不加载。
     */
    existingEventId?: string;
    /**
     * 指定 append 存储时的目标文件（第一优先级）。
     * 传入时 → `data/{eventId}.json`
     * 未传入 → 降级到 config.defaultEventId；不存在则由 store 生成时间戳文件名。
     */
    eventId?: string;
    /**
     * 是否启用自动合并（默认 true）。
     *
     * 当累计新增事件数达到 config.mergeTriggerThreshold 时，
     * 自动触发 mergeEvents 并保存合并结果。
     *
     * 设为 false 可完全禁用自动合并。
     */
    autoMerge?: boolean;
}
interface ProcessResult {
    /** 本次提取出的事件 */
    events: Event[];
    /** 事件写入的文件名 */
    storedFile: string;
    /** 自动合并是否被触发 */
    merged: boolean;
    /** 合并结果（仅 merged=true 时有值） */
    mergedFile?: string;
    /** 合并后的事件数组（仅 merged=true 时有值） */
    mergedEvents?: Event[];
}
declare function processMessages(messages: ChatMessage[], options?: ProcessOptions): Promise<ProcessResult>;

/**
 * 结构化 JSON 导出 —— 从 data/{eventId}.json 加载并输出完整 JSON。
 *
 * 用于数据迁移、调试、机器处理。
 */
declare function exportRaw(eventId: string): string;
/**
 * 纯函数版本：将 Event[] 序列化为 JSON。
 */
declare function exportRawFromEvents(events: Event[]): string;

/**
 * AI 记忆导出 —— 从 data/{file name}.json 加载事件，渲染为 Markdown，
 * 并用 memory-prompt 模板包裹为可直接注入 LLM system message 的完整 Prompt。
 */
declare function exportMemory(fileName: string, options?: MemoryExportOptions): string;
/**
 * 纯函数版本：Event[] → Markdown 渲染 → Prompt 包裹。
 */
declare function exportMemoryFromEvents(events: Event[], options?: MemoryExportOptions): string;

/**
 * 加载 .env 文件到 process.env。
 *
 * 不再在模块加载时自动调用——改为由 startup() 或使用者显式调用。
 * 使用者也可以完全跳过此函数，通过 startup({ llmConfig: {...} }) 直接传配置。
 */
declare function loadEnv(): void;

/**
 * 事件提取器。
 *
 * 流程：
 *   ChatMessage[] → 格式化 → 获取 Prompt → 调用 LLM → 解析 JSON → Event[]
 *
 * 使用前需先初始化 LLM：
 *   import { initLLM } from "../llm";
 *   initLLM({ provider: "...", baseUrl: "...", apiKey: "...", model: "..." });
 *
 * 使用示例：
 *   const events = await extractEvents(recentMessages);
 */
declare function extractEvents(messages: ChatMessage[], existingEvents?: string): Promise<Event[]>;

/**
 * 将新事件合并到已有编年史中。
 *
 * 流程：
 *   applyWindow → formatEvents → get merge prompt → LLM → parseInstructions
 *   → applyInstructions → Event[]
 *
 * @param existingEvents - 全部已有事件（旧→新）
 * @param newEvents      - 待合并的新事件
 * @returns 合并后的事件数组（旧→新顺序）
 */
declare function mergeEvents(existingEvents: Event[], newEvents: Event[]): Promise<Event[]>;
/**
 * 根据合并指令构建最终事件数组。
 *
 * 处理顺序：
 *   1. 从 existingEvents 构建 Map<id, Event>（浅拷贝）
 *   2. 顺序执行指令：update → delete → add → keep
 *   3. 返回 Map.values()（保持插入顺序 = 旧→新）
 *
 * 容错：
 *   - update/delete 的 id 不匹配 → warn + skip
 *   - add 的 event 缺 id → 生成 fallback
 *   - add 的 id 重复 → warn + skip
 */
declare function applyInstructions(existingEvents: Event[], _newEvents: Event[], instructions: MergeInstruction[]): Event[];

/**
 * 按需加载指定 chronicle 数据文件中的事件。
 *
 * 不再扫描整个 `data/` 目录，而是根据调用方传入的 `existingEventId`
 * 定位并加载单个文件。
 *
 * @param existingEventId - 要加载的数据文件名（不含 .json 扩展名），
 *                          传入时加载 `{existingEventId}.json`，
 *                          未传入时返回空数组。
 * @returns 该文件中的事件数组；文件不存在或无法解析时返回空数组
 */
declare function loadChronicle(existingEventId?: string): Event[];

/**
 * 全量保存事件到新文件（覆盖写入）。
 *
 * 文件命名：`event_{时间戳}.json`，每次调用生成一个新文件，
 * 不会覆盖已有文件。
 *
 * @param events - 要保存的事件数组
 * @returns 生成的文件名
 */
declare function saveChronicle(events: Event[]): string;

/**
 * 追加模式：将 newEvents 追加写入 chronicle 数据文件。
 *
 * event_id 优先级（三级降级）：
 *   1. 调用方显式传入的 eventId 参数
 *   2. config.defaultEventId（env 中的 CHRONICLE_EVENT_ID）
 *   3. 以上均无 → 自动生成 `event_{时间戳}.json` 新文件
 *
 * —— 当存在有效的 event_id 时 ——
 * - 对应文件已存在 → 读取 → 合并 newEvents → 写回
 * - 对应文件不存在 → 新建文件，写入 newEvents
 *
 * —— 当无 event_id 时 ——
 * - 生成 `event_{时间戳}.json`，写入 newEvents
 *
 * @param newEvents - 要追加的事件数组
 * @param eventId   - 可选，调用方指定的 event_id（第一优先级）
 * @returns 实际写入的文件名
 */
declare function appendEvents(newEvents: Event[], eventId?: string): string;

interface MergeState {
    /** 自上次合并以来累计的新事件数 */
    newEventCount: number;
    /** 上次合并时间（ISO 字符串） */
    lastMergeAt: string | null;
}
/**
 * 读取指定 chronicle 的合并状态。
 * 若 eventId 不存在或状态文件缺失，返回初始状态。
 */
declare function loadMergeState(eventId: string): MergeState;
/**
 * 重置合并计数器（合并完成后调用）。
 */
declare function resetMergeCounter(eventId: string): MergeState;

/** 获取当前数据目录的绝对路径 */
declare function getDataDir(): string;
/**
 * 覆盖数据目录路径。
 * 应在任何 store 操作之前调用（通常在 startup() 中）。
 */
declare function setDataDir(dir: string): void;

declare function initLLM(config: LLMConfig): void;
declare function complete(options: {
    messages: ChatMessage[];
}): Promise<string>;

declare class PromptManager {
    private cache;
    private promptsDir;
    constructor(promptsDir?: string);
    /**
     * 获取指定名称的提示词原始内容（含模板占位符）。
     *
     * 首次调用时从文件系统读取并写入缓存；后续调用直接从内存返回。
     *
     * @param name - 提示词文件名（不含 .md 扩展名），如 "extract-event"
     * @returns 提示词文件的完整文本内容
     * @throws 若对应 .md 文件不存在
     */
    get(name: string): string;
    /**
     * 获取提示词并用给定变量替换其中的 `{{变量名}}` 占位符。
     *
     * 变量名匹配大小写敏感；未在 vars 中提供的占位符将保留原文不替换。
     *
     * @param name   - 提示词文件名（不含 .md 扩展名）
     * @param vars   - 键值对，键为占位符名（不含花括号），值为替换文本
     * @returns 替换后的提示词文本
     */
    getWithVars(name: string, vars: Readonly<Record<string, string>>): string;
    /**
     * 预加载 prompts/ 目录下所有 .md 文件到缓存。
     *
     * 适合在应用启动时调用，避免首次请求时的 I/O 延迟。
     *
     * @returns 已加载的提示词名称列表
     */
    preload(): string[];
    /**
     * 清除缓存。
     *
     * @param name - 可选，指定要清除的提示词名称；不传则清除全部缓存
     */
    clearCache(name?: string): void;
    /**
     * 重新初始化：切换到新的提示词目录并清空缓存。
     *
     * 适用场景：
     *   - SDK 使用者通过 startup({ promptsDir }) 自定义提示词路径
     *   - 运行时动态切换提示词来源
     *
     * @param promptsDir - 新的提示词 .md 文件目录绝对路径
     */
    reinitialize(promptsDir: string): void;
    /**
     * 列出 prompts/ 目录下所有可用的提示词名称。
     *
     * @returns 提示词名称数组（即 .md 文件名去掉扩展名）
     */
    list(): string[];
    /**
     * 判断指定名称的提示词文件是否存在。
     */
    has(name: string): boolean;
    /**
     * 将提示词名称解析为 .md 文件的绝对路径。
     */
    private resolvePath;
    /**
     * 扫描 prompts/ 目录，返回所有 .md 文件名（去掉扩展名）。
     */
    private discoverNames;
}

export { type ChatMessage, type Event, type LLMConfig, type MemoryExportOptions, type ProcessOptions, type ProcessResult, PromptManager, type StartupOptions, appendEvents, applyInstructions, complete, exportMemory, exportMemoryFromEvents, exportRaw, exportRawFromEvents, extractEvents, getDataDir, initLLM, loadChronicle, loadEnv, loadMergeState, mergeEvents, processMessages, resetMergeCounter, saveChronicle, setDataDir, startup };
