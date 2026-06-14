/**
 * 提示词管理器
 *
 * 职责：
 * - 扫描 prompts/ 目录下的 .md 文件，自动发现并注册提示词
 * - 提供统一的获取接口，按文件名（不含扩展名）访问提示词内容
 * - 内置内存缓存层：首次从文件系统读取，后续调用直接从缓存返回
 * - 支持 `{{变量名}}` 模板语法，调用时动态替换占位符
 *
 * 使用示例：
 *   import pm from "./prompts/manager";
 *   const raw = pm.get("extract-event");
 *   const filled = pm.getWithVars("extract-event", {
 *     existingEvents: "...",
 *     recentMessages: "...",
 *   });
 */
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// 自动检测提示词目录
// ---------------------------------------------------------------------------

/**
 * 自动检测提示词 .md 文件所在目录。
 *
 * 开发环境：manager.ts 位于 prompts/ 目录，__dirname 即 prompts/。
 * npm 发布后：代码打包到 dist/index.js，__dirname 为 dist/，
 *            .md 文件在 dist/prompts/ 子目录中。
 *
 * 策略：优先检测 __dirname/prompts/（生产），否则回退到 __dirname（开发）。
 */
function detectPromptsDir(): string {
  // 生产环境：dist/prompts/ 存在且有 .md 文件
  const prodCandidate = path.resolve(__dirname, "prompts");
  if (fs.existsSync(prodCandidate)) {
    const hasMd = fs.readdirSync(prodCandidate).some((f) => f.endsWith(".md"));
    if (hasMd) return prodCandidate;
  }

  // 开发环境：__dirname 本身就是 prompts/ 目录
  return path.resolve(__dirname);
}

export class PromptManager {
  // 内存缓存：promptName → 文件原始内容
  private cache: Map<string, string> = new Map();

  // 提示词 .md 文件所在目录的绝对路径
  private promptsDir: string;

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir ?? detectPromptsDir();
  }

  // ---------------------------------------------------------------------------
  // 公开 API
  // ---------------------------------------------------------------------------

  /**
   * 获取指定名称的提示词原始内容（含模板占位符）。
   *
   * 首次调用时从文件系统读取并写入缓存；后续调用直接从内存返回。
   *
   * @param name - 提示词文件名（不含 .md 扩展名），如 "extract-event"
   * @returns 提示词文件的完整文本内容
   * @throws 若对应 .md 文件不存在
   */
  get(name: string): string {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const filePath = this.resolvePath(name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    this.cache.set(name, content);
    return content;
  }

  /**
   * 获取提示词并用给定变量替换其中的 `{{变量名}}` 占位符。
   *
   * 变量名匹配大小写敏感；未在 vars 中提供的占位符将保留原文不替换。
   *
   * @param name   - 提示词文件名（不含 .md 扩展名）
   * @param vars   - 键值对，键为占位符名（不含花括号），值为替换文本
   * @returns 替换后的提示词文本
   */
  getWithVars(name: string, vars: Readonly<Record<string, string>>): string {
    let content = this.get(name);

    for (const [key, value] of Object.entries(vars)) {
      // 使用全局替换，支持同一变量出现多次
      const regex = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, "g");
      content = content.replace(regex, value);
    }

    return content;
  }

  /**
   * 预加载 prompts/ 目录下所有 .md 文件到缓存。
   *
   * 适合在应用启动时调用，避免首次请求时的 I/O 延迟。
   *
   * @returns 已加载的提示词名称列表
   */
  preload(): string[] {
    const names = this.discoverNames();
    for (const name of names) {
      if (!this.cache.has(name)) {
        this.get(name); // get() 自动读盘并写入缓存
      }
    }
    return names;
  }

  /**
   * 清除缓存。
   *
   * @param name - 可选，指定要清除的提示词名称；不传则清除全部缓存
   */
  clearCache(name?: string): void {
    if (name !== undefined) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 重新初始化：切换到新的提示词目录并清空缓存。
   *
   * 适用场景：
   *   - SDK 使用者通过 startup({ promptsDir }) 自定义提示词路径
   *   - 运行时动态切换提示词来源
   *
   * @param promptsDir - 新的提示词 .md 文件目录绝对路径
   */
  reinitialize(promptsDir: string): void {
    this.promptsDir = path.resolve(promptsDir);
    this.cache.clear();
  }

  /**
   * 列出 prompts/ 目录下所有可用的提示词名称。
   *
   * @returns 提示词名称数组（即 .md 文件名去掉扩展名）
   */
  list(): string[] {
    return this.discoverNames();
  }

  /**
   * 判断指定名称的提示词文件是否存在。
   */
  has(name: string): boolean {
    if (this.cache.has(name)) return true;
    return fs.existsSync(this.resolvePath(name));
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /**
   * 将提示词名称解析为 .md 文件的绝对路径。
   */
  private resolvePath(name: string): string {
    return path.join(this.promptsDir, `${name}.md`);
  }

  /**
   * 扫描 prompts/ 目录，返回所有 .md 文件名（去掉扩展名）。
   */
  private discoverNames(): string[] {
    if (!fs.existsSync(this.promptsDir)) {
      return [];
    }

    return fs
      .readdirSync(this.promptsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  }
}

// -----------------------------------------------------------------------------
// 辅助函数
// -----------------------------------------------------------------------------

/**
 * 转义正则表达式特殊字符，确保 `{{变量名}}` 中的字符被字面匹配。
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -----------------------------------------------------------------------------
// 默认单例
// -----------------------------------------------------------------------------

/** 基于 prompts/ 目录（manager.ts 所在目录）的默认管理器实例 */
const promptManager = new PromptManager();

export default promptManager;
