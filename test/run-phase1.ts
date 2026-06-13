/**
 * 第一阶段集成测试：processMessages 管道调用。
 *
 * 从 test-cases-input.json 中筛选 extract-event 用例，
 * 解析 recentMessages → 调用 processMessages → 输出到 data/test-01/
 *
 * 运行方式：
 *   npx tsx test/run-phase1.ts
 */

import * as fs from "fs";
import * as path from "path";
import { startup } from "../index";
import { processMessages } from "../core";
import type { Event, ChatMessage } from "../types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface TestCase {
  id: string;
  module: string;
  capability: string;
  prompt: string;
  description: string;
  input: {
    existingEvents: Event[];
    recentMessages: string;
  };
}

interface TestResult {
  id: string;
  description: string;
  status: "ok" | "skip" | "error";
  existingCount: number;
  extractedCount: number;
  storedFile: string;
  events: Event[];
  error?: string;
}

// ---------------------------------------------------------------------------
// 消息解析
// ---------------------------------------------------------------------------

/**
 * 将测试输入中的 `[Role]: content` 格式文本解析为 ChatMessage[]。
 *
 * 输入示例：
 *   "[小明]: 周末有什么安排吗？\n[小红]: 没有，在家闲着。"
 *
 * 输出示例：
 *   [{ role: "小明", content: "周末有什么安排吗？" },
 *    { role: "小红", content: "没有，在家闲着。" }]
 *
 * 角色名直接保留原始值（如 "小明"、"侦探"），不再映射为通用 "user"，
 * 确保 LLM 能够识别不同说话者。
 */
function parseTestMessages(raw: string): ChatMessage[] {
  const lines = raw.split("\n");
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+?)\]:\s*(.*)$/);
    if (!match) continue;

    const [, rawRole, content] = match;

    messages.push({
      role: rawRole,
      content,
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

function loadTestCases(): TestCase[] {
  const filePath = path.resolve(__dirname, "test-cases-input.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TestCase[];
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveExistingEvents(caseId: string, events: Event[]): string {
  const dir = path.resolve(process.cwd(), "data", "test-01");
  ensureDir(dir);

  const filePath = path.join(dir, `${caseId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  Event Chronicle — Phase 1 集成测试");
  console.log("═══════════════════════════════════════════\n");

  // 1. 启动（跳过健康检查以加速）
  await startup({ healthCheck: false });

  // 2. 加载测试用例，仅保留 extract-event 场景
  const allCases = loadTestCases();
  const extractCases = allCases.filter(
    (tc) => tc.id === "TC-9.3" && tc.prompt === "extract-event",
  );

  console.log(
    `加载 ${allCases.length} 个测试用例，筛选出 ${extractCases.length} 个 extract-event 用例\n`,
  );

  // 3. 逐个执行
  const results: TestResult[] = [];

  for (let i = 0; i < extractCases.length; i++) {
    const tc = extractCases[i];
    const progress = `[${i + 1}/${extractCases.length}]`;

    console.log(`${progress} ${tc.id}: ${tc.description}`);

    try {
      // 预存 existingEvents
      saveExistingEvents(tc.id, tc.input.existingEvents);

      // 解析消息
      const messages = parseTestMessages(tc.input.recentMessages);

      if (messages.length === 0) {
        console.log(`  ⚠ 无可解析消息，跳过`);
        results.push({
          id: tc.id,
          description: tc.description,
          status: "skip",
          existingCount: tc.input.existingEvents.length,
          extractedCount: 0,
          storedFile: "",
          events: [],
        });
        continue;
      }

      // 调用管道
      const eventId = `test-01/${tc.id}`;
      const result = await processMessages(messages, {
        existingEventId: eventId,
        eventId,
      });

      console.log(
        `  ✓ existing: ${tc.input.existingEvents.length} | ` +
          `extracted: ${result.events.length} | ` +
          `→ ${result.storedFile}`,
      );

      results.push({
        id: tc.id,
        description: tc.description,
        status: "ok",
        existingCount: tc.input.existingEvents.length,
        extractedCount: result.events.length,
        storedFile: result.storedFile,
        events: result.events,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ 错误: ${message}`);
      results.push({
        id: tc.id,
        description: tc.description,
        status: "error",
        existingCount: tc.input.existingEvents.length,
        extractedCount: 0,
        storedFile: "",
        events: [],
        error: message,
      });
    }
  }

  // 4. 输出汇总
  const ok = results.filter((r) => r.status === "ok").length;
  const skip = results.filter((r) => r.status === "skip").length;
  const err = results.filter((r) => r.status === "error").length;
  const totalExtracted = results.reduce((sum, r) => sum + r.extractedCount, 0);

  console.log("\n═══════════════════════════════════════════");
  console.log(`  结果汇总`);
  console.log("═══════════════════════════════════════════");
  console.log(`  成功: ${ok}  |  跳过: ${skip}  |  错误: ${err}`);
  console.log(`  共提取事件: ${totalExtracted}`);
  console.log(`  数据目录: data/test-01/\n`);

  // 5. 保存结果摘要
  const summaryPath = path.resolve(
    process.cwd(),
    "data",
    "test-01",
    "_summary.json",
  );
  ensureDir(path.dirname(summaryPath));
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`  摘要已保存至: ${summaryPath}\n`);
}

main().catch((err) => {
  console.error("测试运行失败:", err instanceof Error ? err.message : err);
  process.exit(1);
});
