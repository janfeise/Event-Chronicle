/**
 * 第二阶段 LLM 集成测试：事件合并功能（独立测试用例）
 *
 * 从 test/phase-2/fixtures/ 加载独立测试用例，
 * 调用 mergeEvents → 保存结果到 data/test-02/
 *
 * 运行方式：
 *   npx tsx test/phase-2/run-phase2-integration.ts
 */

import * as fs from "fs";
import * as path from "path";
import { startup } from "../../index";
import { mergeEvents } from "../../core/merge";
import type { Event } from "../../types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface MergeFixture {
  description: string;
  rule: string;
  existingEvents: Event[];
  newEvents: Event[];
  expectedBehavior: string;
}

interface TestResult {
  file: string;
  description: string;
  rule: string;
  status: "ok" | "error";
  existingCount: number;
  newCount: number;
  mergedCount: number;
  added: number;
  removed: number;
  kept: number;
  expectedBehavior: string;
  /** mergeEvents 返回的完整结果 */
  events: Event[];
  /** LLM 返回的原始指令（如果可以解析） */
  error?: string;
}

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

function loadFixtures(): Array<{ file: string; data: MergeFixture }> {
  const fixturesDir = path.resolve(__dirname, "fixtures");
  if (!fs.existsSync(fixturesDir)) {
    console.error("fixtures 目录不存在:", fixturesDir);
    return [];
  }

  const files = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(fixturesDir, file), "utf-8");
    return { file, data: JSON.parse(raw) as MergeFixture };
  });
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveOutput(filename: string, data: unknown): string {
  const dir = path.resolve(process.cwd(), "data", "test-02");
  ensureDir(dir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  Event Chronicle — Phase 2 LLM 集成测试");
  console.log("═══════════════════════════════════════════\n");

  // 1. 启动
  await startup({ healthCheck: false });

  // 2. 加载独立测试用例
  const fixtures = loadFixtures();
  console.log(`加载 ${fixtures.length} 个独立 merge 测试用例\n`);

  // 3. 逐个执行
  const results: TestResult[] = [];

  for (let i = 0; i < fixtures.length; i++) {
    const { file, data: fx } = fixtures[i];
    const progress = `[${i + 1}/${fixtures.length}]`;

    console.log(`${progress} ${file}`);
    console.log(`  规则: ${fx.rule}`);
    console.log(`  描述: ${fx.description}`);

    try {
      // 保存输入快照
      saveOutput(`${file.replace(".json", "")}-input.json`, {
        description: fx.description,
        rule: fx.rule,
        expectedBehavior: fx.expectedBehavior,
        existingEvents: fx.existingEvents,
        newEvents: fx.newEvents,
      });

      // 调用合并管道
      const merged = await mergeEvents(fx.existingEvents, fx.newEvents);

      // 统计变更
      const existingIds = new Set(fx.existingEvents.map((e) => e.id));
      const newIds = new Set(fx.newEvents.map((e) => e.id));
      const mergedIds = new Set(merged.map((e) => e.id));

      const added = merged.filter((e) => !existingIds.has(e.id)).length;
      const removed = fx.existingEvents.length + fx.newEvents.length - merged.length - (added - fx.newEvents.length);
      const kept = merged.length - added;

      console.log(
        `  结果: existing ${fx.existingEvents.length} + new ${fx.newEvents.length} → merged ${merged.length}` +
          ` (add: ${added}, keep: ${kept}, del: ${Math.max(0, fx.existingEvents.length + fx.newEvents.length - merged.length)})`,
      );
      console.log(`  预期: ${fx.expectedBehavior}`);

      // 保存合并结果
      saveOutput(`${file.replace(".json", "")}-output.json`, merged);

      results.push({
        file,
        description: fx.description,
        rule: fx.rule,
        status: "ok",
        existingCount: fx.existingEvents.length,
        newCount: fx.newEvents.length,
        mergedCount: merged.length,
        added,
        removed,
        kept,
        expectedBehavior: fx.expectedBehavior,
        events: merged,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ 错误: ${message}`);
      results.push({
        file,
        description: fx.description,
        rule: fx.rule,
        status: "error",
        existingCount: fx.existingEvents.length,
        newCount: fx.newEvents.length,
        mergedCount: 0,
        added: 0,
        removed: 0,
        kept: 0,
        expectedBehavior: fx.expectedBehavior,
        events: [],
        error: message,
      });
    }
    console.log();
  }

  // 4. 汇总
  const ok = results.filter((r) => r.status === "ok").length;
  const err = results.filter((r) => r.status === "error").length;

  console.log("═══════════════════════════════════════════");
  console.log("  结果汇总");
  console.log("═══════════════════════════════════════════");

  // 按规则分组
  const ruleGroups = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!ruleGroups.has(r.rule)) ruleGroups.set(r.rule, []);
    ruleGroups.get(r.rule)!.push(r);
  }

  for (const [rule, cases] of ruleGroups) {
    const passed = cases.filter((c) => c.status === "ok").length;
    console.log(`  ${rule}: ${passed}/${cases.length} 通过`);
  }

  console.log(`\n  总通过: ${ok}  |  错误: ${err}`);
  console.log(`  数据目录: data/test-02/\n`);

  // 保存摘要
  const summaryPath = path.resolve(
    process.cwd(),
    "data",
    "test-02",
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
