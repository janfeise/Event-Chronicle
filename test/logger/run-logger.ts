/**
 * Logger 模块测试
 *
 * 运行方式：
 *   npx tsx test/logger/run-logger.ts
 */

import { logger } from "../../core/logger";
import * as fs from "fs";
import * as path from "path";

// =========================================================================
// 清理
// =========================================================================

const logDir = path.resolve(process.cwd(), "data", "logs");
if (fs.existsSync(logDir)) {
  fs.rmSync(logDir, { recursive: true });
}

// =========================================================================
// 测试
// =========================================================================

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log("═══ Logger 功能测试 ═══\n");

// 1. 四个级别
console.log("── 1. 四级日志 ──");
logger.debug("test", "debug message");
logger.info("test", "info message");
logger.warn("test", "warn message");
logger.error("test", "error message");

// 2. 结构化数据
console.log("\n── 2. 结构化数据 ──");
logger.info("extract", "events extracted", { count: 5, durationMs: 1234 });
logger.info("merge", "merge completed", { before: 10, after: 8, delta: -2 });

// 3. 敏感数据脱敏
console.log("\n── 3. 敏感数据脱敏 ──");
logger.info("startup", "llm initialized", {
  provider: "openai",
  model: "gpt-4o",
  apiKey: "sk-1234567890abcdef",
  normalField: "visible",
});

// 4. 文件持久化
console.log("\n── 4. 文件持久化 ──");
const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logDir, `${today}.log`);
const fileExists = fs.existsSync(logFile);
check(fileExists, "日志文件已生成");

if (fileExists) {
  const content = fs.readFileSync(logFile, "utf-8");
  const lines = content.trim().split("\n");
  // 测试 1-4 共产生 info×3 + warn×1 + error×1 = 6 行（debug 被过滤）
  check(lines.length === 6, `日志行数 6（实际 ${lines.length}）`);

  // 验证日志格式：[HH:MM:SS] [LEVEL] [module] message {JSON}
  const sample = lines[0];
  check(
    /^\[\d{2}:\d{2}:\d{2}\]/.test(sample),
    "文件格式：[时间戳] [级别] [模块] 消息",
  );
  check(sample.includes("[INFO]"), "含级别标记");

  // 验证结构化数据行含 JSON
  const extractLine = lines.find((l) => l.includes("events extracted"));
  if (extractLine) {
    const jsonPart = extractLine.slice(extractLine.indexOf("{"));
    const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
    check(parsed.count === 5, "结构化数据: count=5");
    check(parsed.durationMs === 1234, "结构化数据: durationMs=1234");
  }

  // 验证脱敏
  const llmLog = lines.find((l) => l.includes("llm initialized"));
  if (llmLog) {
    check(
      llmLog.includes("sk-12345***"),
      "apiKey 已脱敏（截断为前8位+***）",
    );
    check(llmLog.includes("visible"), "非敏感字段完整保留");
  }
}

// 5. 级别过滤（debug 在 info 级别下不输出）
console.log("\n── 5. 级别过滤 ──");
const prevLines = fileExists
  ? fs.readFileSync(logFile, "utf-8").trim().split("\n").length
  : 0;
logger.debug("test", "debug should be filtered");
const afterLines = fileExists
  ? fs.readFileSync(logFile, "utf-8").trim().split("\n").length
  : 0;
check(
  afterLines === prevLines,
  `debug 在 info 级别下被过滤（prev=${prevLines}, after=${afterLines}）`,
);

// 6. warn 和 error 使用正确的 console 方法
console.log("\n── 6. 级别对应 console 方法 ──");
const originalWarn = console.warn;
const originalError = console.error;
let warnCalled = false;
let errorCalled = false;
(console as unknown as Record<string, unknown>).warn = (..._a: unknown[]) => {
  warnCalled = true;
};
(console as unknown as Record<string, unknown>).error = (..._a: unknown[]) => {
  errorCalled = true;
};

logger.warn("test", "warn check");
logger.error("test", "error check");
check(warnCalled, "warn 级别使用 console.warn");
check(errorCalled, "error 级别使用 console.error");

console.warn = originalWarn;
console.error = originalError;

// 7. 无数据参数（不追加 JSON）
console.log("\n── 7. 无数据参数 ──");
logger.info("test", "no data attached");
const finalLines = fileExists
  ? fs.readFileSync(logFile, "utf-8").trim().split("\n")
  : [];
check(
  finalLines.some((l) => l.endsWith("no data attached")),
  "无数据参数: 不追加 {} 空 JSON",
);

// =========================================================================
// 汇总
// =========================================================================

console.log(`\n═══ 通过: ${passed} | 失败: ${failed} ═══`);

// 保留日志文件供检查
console.log(`\n日志文件: ${logFile}\n`);

if (failed > 0) process.exit(1);
