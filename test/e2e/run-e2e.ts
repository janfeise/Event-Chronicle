/**
 * Event Chronicle — 端到端集成测试
 *
 * 完整流程：
 *   messages (3 batches) → processMessages (×3)
 *     → extract → store → [threshold trigger] → auto-merge
 *     → export (raw + memory)
 *
 * 运行方式：
 *   npx tsx test/e2e/run-e2e.ts
 */

import * as fs from "fs";
import * as path from "path";
import { startup } from "../../index";
import { processMessages } from "../../core";
import { loadChronicle, loadMergeState, resetMergeCounter } from "../../core/store";
import { exportRaw, exportMemory, exportRawFromEvents, exportMemoryFromEvents } from "../../core/exporter";
import type { ChatMessage, Event } from "../../types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface E2EInput {
  description: string;
  eventId: string;
  batches: Array<{
    name: string;
    description: string;
    messages: ChatMessage[];
  }>;
}

interface BatchResult {
  name: string;
  description: string;
  eventsExtracted: number;
  storedFile: string;
  merged: boolean;
  mergedFile?: string;
  mergeState: { newEventCount: number; lastMergeAt: string | null };
  chronicleSize: number;
}

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

function loadInput(): E2EInput {
  const filePath = path.resolve(__dirname, "e2e-input.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as E2EInput;
}

function divider(title: string): void {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(50)}`);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  Event Chronicle — E2E 集成测试");
  console.log("═══════════════════════════════════════════");

  // 0. 启动
  await startup({ healthCheck: false });

  const input = loadInput();
  const eventId = input.eventId;

  // 清理旧测试状态
  resetMergeCounter(eventId);
  console.log(`\n测试场景: ${input.description}`);
  console.log(`eventId: ${eventId}`);
  console.log(`批次数量: ${input.batches.length}`);
  console.log(`合并阈值: ${require("../../config").config.mergeTriggerThreshold}`);

  // 1. 逐批执行
  const batchResults: BatchResult[] = [];
  let totalExtracted = 0;

  for (let i = 0; i < input.batches.length; i++) {
    const batch = input.batches[i];
    divider(`Batch ${i + 1}: ${batch.name}`);
    console.log(`  ${batch.description}`);
    console.log(`  Messages: ${batch.messages.length}`);

    // 调用管道
    const result = await processMessages(batch.messages, {
      eventId,
      existingEventId: eventId,
      autoMerge: true,
    });

    totalExtracted += result.events.length;
    const state = loadMergeState(eventId);
    const chronicle = loadChronicle(eventId);

    console.log(`  提取事件: ${result.events.length}`);
    for (const e of result.events) {
      console.log(`    - [${e.id.slice(-12)}] ${e.title} (★${e.importance})`);
    }

    if (result.merged) {
      console.log(`  🔀 自动合并触发! → ${result.mergedFile}`);
      console.log(`     合并后 ${result.mergedEvents?.length ?? "?"} 条事件`);
    } else {
      console.log(`  📊 计数器: ${state.newEventCount} (阈值: ${require("../../config").config.mergeTriggerThreshold})`);
    }

    batchResults.push({
      name: batch.name,
      description: batch.description,
      eventsExtracted: result.events.length,
      storedFile: result.storedFile,
      merged: result.merged,
      mergedFile: result.mergedFile,
      mergeState: state,
      chronicleSize: chronicle.length,
    });
  }

  // 2. 汇总
  divider("管道汇总");
  console.log("");
  for (const r of batchResults) {
    const mergeIcon = r.merged ? "🔀" : "  ";
    console.log(
      `  ${mergeIcon} ${r.name}: +${r.eventsExtracted} events → chronicle ${r.chronicleSize} 条` +
        (r.merged ? ` (merged → ${r.mergedFile})` : ` (counter: ${r.mergeState.newEventCount})`),
    );
  }
  console.log(`\n  总计提取: ${totalExtracted} events`);

  // 3. 导出验证
  divider("导出验证");

  const finalEvents = loadChronicle(eventId);
  console.log(`  最终 chronicle: ${finalEvents.length} 条事件`);

  // Raw export
  const raw = exportRaw(eventId);
  const rawParsed = JSON.parse(raw) as Event[];
  console.log(`  exportRaw: ${rawParsed.length} 条事件, ${raw.length} chars`);

  // Memory export (纯函数)
  const memoryMarkdown = exportMemoryFromEvents(finalEvents, {
    title: "北方雪山冒险",
    highlightThreshold: 5,
  });
  const memLines = memoryMarkdown.split("\n").length;
  console.log(`  exportMemory: ${memLines} lines`);

  // 保存导出结果
  const outDir = path.resolve(process.cwd(), "data", "test-e2e");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, "export-raw.json"), raw, "utf-8");
  fs.writeFileSync(path.join(outDir, "export-memory.md"), memoryMarkdown, "utf-8");

  // 保存测试摘要
  const summary = {
    description: input.description,
    eventId,
    batches: batchResults,
    totalExtracted,
    finalChronicleSize: finalEvents.length,
    finalEvents,
  };
  fs.writeFileSync(
    path.join(outDir, "_summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8",
  );

  console.log(`\n  导出文件: data/test-e2e/export-raw.json`);
  console.log(`  导出文件: data/test-e2e/export-memory.md`);
  console.log(`  测试摘要: data/test-e2e/_summary.json`);

  // 4. 断言验证
  divider("验证结果");
  const checks: Array<{ label: string; pass: boolean }> = [];

  checks.push({
    label: "至少执行了 3 个批次",
    pass: batchResults.length === 3,
  });

  checks.push({
    label: "每个批次都有事件提取",
    pass: batchResults.every((r) => r.eventsExtracted > 0),
  });

  checks.push({
    label: "至少有一个批次触发了自动合并",
    pass: batchResults.some((r) => r.merged),
  });

  checks.push({
    label: "chronicle 中有事件（持久化成功）",
    pass: finalEvents.length > 0,
  });

  checks.push({
    label: "raw export 与 chronicle 事件数一致",
    pass: rawParsed.length === finalEvents.length,
  });

  checks.push({
    label: "memory export 包含完整的 prompt 结构",
    pass:
      memoryMarkdown.includes("# Role") &&
      memoryMarkdown.includes("# Memory Context") &&
      memoryMarkdown.includes("# Rules") &&
      memoryMarkdown.includes("# Instruction") &&
      memoryMarkdown.includes("北方雪山冒险"),
  });

  checks.push({
    label: "所有事件 id 均为程序注入格式 (evt_*)",
    pass: finalEvents.every((e) => e.id && e.id.startsWith("evt_")),
  });

  for (const c of checks) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}`);
  }

  const allPassed = checks.every((c) => c.pass);
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ${allPassed ? "✓ E2E 测试通过" : "✗ E2E 测试失败"}`);
  console.log(`═══════════════════════════════════════════\n`);

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error("E2E 测试运行失败:", err instanceof Error ? err.message : err);
  process.exit(1);
});
