/**
 * Phase 2 测试运行程序：事件合并（Event Merge）
 *
 * 测试范围：
 *   A. 纯函数测试（无 LLM）：
 *      applyInstructions / applyWindow / parseInstructions / formatEvents
 *   B. 集成测试（需 LLM）：
 *      mergeEvents 使用阶段一 test-cases-input.json 中 merge-event 用例
 *
 * 运行方式：
 *   npx tsx test/phase-2/run-phase2.ts              # 仅纯函数
 *   npx tsx test/phase-2/run-phase2.ts --integration # 含 LLM 集成
 *
 * 输出目录：data/test-02/
 */

import * as fs from "fs";
import * as path from "path";
import { applyInstructions, mergeEvents } from "../../core/merge";
import { applyWindow, formatEvents } from "../../core/merge/formatter";
import { parseInstructions } from "../../core/merge/parser";
import { startup } from "../../index";
import type { Event, MergeInstruction } from "../../types";

// =========================================================================
// 类型
// =========================================================================

interface TestCase {
  id: string;
  group: string;
  description: string;
  /** 仅用于 applyInstructions */
  existing?: Event[];
  newEvents?: Event[];
  instructions?: MergeInstruction[];
  /** 仅用于 applyWindow */
  events?: Event[];
  windowSize?: number;
  /** 仅用于 parseInstructions */
  input?: string;
  shouldThrow?: boolean;
  /** 仅用于 formatEvents */
  event?: Event | Event[];
  /** 通用 */
  expected?: unknown;
  /** 自定义断言 */
  assert?: (actual: unknown) => { pass: boolean; reason?: string };
}

interface TestResult {
  id: string;
  group: string;
  description: string;
  status: "pass" | "fail" | "skip" | "error";
  reason?: string;
}

interface IntegrationCase {
  id: string;
  description: string;
  existingEvents: Event[];
  newEvents: Event[];
}

// =========================================================================
// 辅助事件工厂
// =========================================================================

function evt(
  id: string,
  title: string,
  summary = "",
  importance = 5,
  participants: string[] = [],
  location = "",
  tags: string[] = [],
): Event {
  return { id, title, summary, importance, participants, location, tags };
}

// =========================================================================
// 纯函数测试用例
// =========================================================================

const pureTestCases: TestCase[] = [
  // -----------------------------------------------------------------------
  // applyInstructions
  // -----------------------------------------------------------------------
  {
    id: "A01",
    group: "applyInstructions",
    description: "空输入全部为空 → 返回 []",
    existing: [],
    newEvents: [],
    instructions: [],
    expected: [],
  },
  {
    id: "A02",
    group: "applyInstructions",
    description: "单条 add — 追加到空 existing",
    existing: [],
    newEvents: [],
    instructions: [
      {
        action: "add",
        event: evt("evt_1", "新事件", "摘要", 5, ["Alice"], "", ["tag"]),
      },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1 个事件，实际 ${arr.length}` };
      if (arr[0].id !== "evt_1") return { pass: false, reason: "id 不匹配" };
      if (arr[0].title !== "新事件")
        return { pass: false, reason: "title 不匹配" };
      return { pass: true };
    },
  },
  {
    id: "A03",
    group: "applyInstructions",
    description: "单条 update — 修改已有事件 title",
    existing: [evt("evt_a", "旧标题")],
    newEvents: [],
    instructions: [
      { action: "update", id: "evt_a", changes: { title: "新标题" } },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      if (arr[0].title !== "新标题")
        return { pass: false, reason: `title 未更新: ${arr[0].title}` };
      if (arr[0].id !== "evt_a")
        return { pass: false, reason: "id 被意外修改" };
      return { pass: true };
    },
  },
  {
    id: "A04",
    group: "applyInstructions",
    description: "单条 delete — 删除已有事件",
    existing: [evt("evt_a", "A"), evt("evt_b", "B")],
    newEvents: [],
    instructions: [{ action: "delete", id: "evt_a" }],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      if (arr[0].id !== "evt_b")
        return { pass: false, reason: "删除了错误的事件" };
      return { pass: true };
    },
  },
  {
    id: "A05",
    group: "applyInstructions",
    description: "update 不存在的 id → warn + skip，原数据不变",
    existing: [evt("evt_a", "A")],
    newEvents: [],
    instructions: [
      { action: "update", id: "evt_nonexist", changes: { title: "X" } },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      if (arr[0].title !== "A")
        return { pass: false, reason: "title 被意外修改" };
      return { pass: true };
    },
  },
  {
    id: "A06",
    group: "applyInstructions",
    description: "delete 不存在的 id → warn + skip，原数据不变",
    existing: [evt("evt_a", "A")],
    newEvents: [],
    instructions: [{ action: "delete", id: "evt_nonexist" }],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "A07",
    group: "applyInstructions",
    description: "add 的 event 缺 id → 自动生成 fallback",
    existing: [],
    newEvents: [],
    instructions: [
      {
        action: "add",
        event: {
          id: "",
          title: "无ID事件",
          summary: "",
          importance: 3,
          participants: [],
          location: "",
          tags: [],
        },
      },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      if (!arr[0].id || !arr[0].id.startsWith("evt_"))
        return { pass: false, reason: `fallback id 格式不正确: ${arr[0].id}` };
      if (arr[0].title !== "无ID事件")
        return { pass: false, reason: "title 丢失" };
      return { pass: true };
    },
  },
  {
    id: "A08",
    group: "applyInstructions",
    description: "add 重复 id → 第二条跳过",
    existing: [],
    newEvents: [],
    instructions: [
      { action: "add", event: evt("evt_dup", "第一个") },
      { action: "add", event: evt("evt_dup", "第二个(应被跳过)") },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return {
          pass: false,
          reason: `期望 1，实际 ${arr.length}（重复未跳过）`,
        };
      if (arr[0].title !== "第一个")
        return { pass: false, reason: "保留了错误的版本" };
      return { pass: true };
    },
  },
  {
    id: "A09",
    group: "applyInstructions",
    description: "混合指令 — 顺序执行 update + delete + add",
    existing: [evt("evt_a", "A"), evt("evt_b", "B"), evt("evt_c", "C")],
    newEvents: [],
    instructions: [
      { action: "update", id: "evt_a", changes: { title: "A-改" } },
      { action: "delete", id: "evt_b" },
      { action: "add", event: evt("evt_new", "新事件") },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 3)
        return { pass: false, reason: `期望 3，实际 ${arr.length}` };
      // evt_a 被更新，evt_b 被删除，evt_c 保留，evt_new 被追加
      const ids = arr.map((e) => e.id);
      const expectedIds = ["evt_a", "evt_c", "evt_new"];
      if (JSON.stringify(ids) !== JSON.stringify(expectedIds))
        return { pass: false, reason: `顺序: ${ids} != ${expectedIds}` };
      if (arr[0].title !== "A-改")
        return { pass: false, reason: "update 未生效" };
      if (arr[2].title !== "新事件")
        return { pass: false, reason: "add 未生效" };
      return { pass: true };
    },
  },
  {
    id: "A10",
    group: "applyInstructions",
    description: "keep 指令 → 无操作",
    existing: [evt("evt_a", "A")],
    newEvents: [],
    instructions: [{ action: "keep" }],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "A11",
    group: "applyInstructions",
    description: "update changes 含 id 字段 → id 不被修改",
    existing: [evt("evt_a", "A")],
    newEvents: [],
    instructions: [
      {
        action: "update",
        id: "evt_a",
        changes: { id: "evt_hacked" as any, title: "新标题" } as any,
      },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr[0].id !== "evt_a")
        return { pass: false, reason: "id 被 changes 覆盖" };
      if (arr[0].title !== "新标题")
        return { pass: false, reason: "合法变更未生效" };
      return { pass: true };
    },
  },
  {
    id: "A12",
    group: "applyInstructions",
    description: "existing 事件缺 id → 自动生成 fallback，正常处理后续指令",
    existing: [
      {
        id: "",
        title: "无ID",
        summary: "",
        importance: 3,
        participants: [],
        location: "",
        tags: [],
      },
    ],
    newEvents: [],
    instructions: [{ action: "add", event: evt("evt_x", "X") }],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 2)
        return { pass: false, reason: `期望 2，实际 ${arr.length}` };
      if (!arr[0].id.startsWith("evt_"))
        return { pass: false, reason: "fallback id 未生成" };
      if (arr[1].id !== "evt_x") return { pass: false, reason: "add 事件丢失" };
      return { pass: true };
    },
  },
  {
    id: "A13",
    group: "applyInstructions",
    description: "update 后 delete 同一 id → 最终删除",
    existing: [evt("evt_a", "A")],
    newEvents: [],
    instructions: [
      { action: "update", id: "evt_a", changes: { title: "改后" } },
      { action: "delete", id: "evt_a" },
    ],
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 0)
        return { pass: false, reason: `期望 0（删除后），实际 ${arr.length}` };
      return { pass: true };
    },
  },

  // -----------------------------------------------------------------------
  // applyWindow
  // -----------------------------------------------------------------------
  {
    id: "W01",
    group: "applyWindow",
    description: "数组小于窗口 → 返回完整数组",
    events: [evt("1", "a"), evt("2", "b"), evt("3", "c")],
    windowSize: 5,
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 3)
        return { pass: false, reason: `期望 3，实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "W02",
    group: "applyWindow",
    description: "数组大于窗口 → 返回尾部 N 条",
    events: [
      evt("1", "a"),
      evt("2", "b"),
      evt("3", "c"),
      evt("4", "d"),
      evt("5", "e"),
    ],
    windowSize: 2,
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 2)
        return { pass: false, reason: `期望 2，实际 ${arr.length}` };
      if (arr[0].id !== "4" || arr[1].id !== "5")
        return { pass: false, reason: `窗口内容错误: ${arr.map((e) => e.id)}` };
      return { pass: true };
    },
  },
  {
    id: "W03",
    group: "applyWindow",
    description: "空数组 → 返回空",
    events: [],
    windowSize: 5,
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 0)
        return { pass: false, reason: `期望 0，实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "W04",
    group: "applyWindow",
    description: "数组长度 = 窗口大小 → 返回完整数组",
    events: [evt("1", "a"), evt("2", "b")],
    windowSize: 2,
    assert: (actual) => {
      const arr = actual as Event[];
      if (arr.length !== 2)
        return { pass: false, reason: `期望 2，实际 ${arr.length}` };
      return { pass: true };
    },
  },

  // -----------------------------------------------------------------------
  // parseInstructions
  // -----------------------------------------------------------------------
  {
    id: "P01",
    group: "parseInstructions",
    description: "合法 JSON 指令数组 → 全部解析",
    input: `[
      { "action": "update", "id": "evt_a", "changes": { "title": "X" } },
      { "action": "delete", "id": "evt_b" },
      { "action": "add", "event": { "id": "evt_new", "title": "新", "summary": "", "importance": 5, "participants": [], "location": "", "tags": [] } },
      { "action": "keep" }
    ]`,
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 4)
        return { pass: false, reason: `期望 4，实际 ${arr.length}` };
      if (arr[0].action !== "update")
        return { pass: false, reason: "第 1 条 action 错误" };
      if (arr[1].action !== "delete")
        return { pass: false, reason: "第 2 条 action 错误" };
      if (arr[2].action !== "add")
        return { pass: false, reason: "第 3 条 action 错误" };
      if (arr[3].action !== "keep")
        return { pass: false, reason: "第 4 条 action 错误" };
      return { pass: true };
    },
  },
  {
    id: "P02",
    group: "parseInstructions",
    description: "Markdown 代码块包裹 → 剥离后解析",
    input: '```json\n[{ "action": "keep" }]\n```',
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 1)
        return { pass: false, reason: `期望 1，实际 ${arr.length}` };
      if (arr[0].action !== "keep")
        return { pass: false, reason: "未正确解析" };
      return { pass: true };
    },
  },
  {
    id: "P03",
    group: "parseInstructions",
    description: "非法 JSON → 抛出异常",
    input: "not json at all",
    shouldThrow: true,
  },
  {
    id: "P04",
    group: "parseInstructions",
    description: "JSON 非数组 → 抛出异常",
    input: '{"key": "value"}',
    shouldThrow: true,
  },
  {
    id: "P05",
    group: "parseInstructions",
    description: "数组中含无效条目 → 过滤跳过",
    input: `[
      { "action": "keep" },
      { "not": "an instruction" },
      { "action": "add", "event": { "id": "ok", "title": "OK", "summary": "", "importance": 3, "participants": [], "location": "", "tags": [] } }
    ]`,
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 2)
        return {
          pass: false,
          reason: `期望 2（过滤 1 条无效），实际 ${arr.length}`,
        };
      return { pass: true };
    },
  },
  {
    id: "P06",
    group: "parseInstructions",
    description: "未知 action → 过滤",
    input: '[{ "action": "invalid_action" }]',
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 0)
        return { pass: false, reason: `期望 0（全过滤），实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "P07",
    group: "parseInstructions",
    description: "update 缺 id → 过滤",
    input: '[{ "action": "update", "changes": { "title": "X" } }]',
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 0)
        return { pass: false, reason: `期望 0，实际 ${arr.length}` };
      return { pass: true };
    },
  },
  {
    id: "P08",
    group: "parseInstructions",
    description: "add 缺 event → 过滤",
    input: '[{ "action": "add" }]',
    assert: (actual) => {
      const arr = actual as MergeInstruction[];
      if (arr.length !== 0)
        return { pass: false, reason: `期望 0，实际 ${arr.length}` };
      return { pass: true };
    },
  },

  // -----------------------------------------------------------------------
  // formatEvents
  // -----------------------------------------------------------------------
  {
    id: "F01",
    group: "formatEvents",
    description: "单个事件 → 有效 JSON 字符串",
    event: evt("evt_1", "测试", "摘要", 5, ["Alice"], "图书馆", ["探索"]),
    assert: (actual) => {
      const s = actual as string;
      const parsed = JSON.parse(s);
      // 单个事件被包装为数组 [event]
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      if (first.id !== "evt_1")
        return { pass: false, reason: `id 不正确: ${first.id}` };
      if (first.title !== "测试")
        return { pass: false, reason: "title 不正确" };
      return { pass: true };
    },
  },
  {
    id: "F02",
    group: "formatEvents",
    description: "多个事件 → JSON 数组字符串",
    event: [evt("evt_1", "A"), evt("evt_2", "B")],
    assert: (actual) => {
      const s = actual as string;
      const parsed = JSON.parse(s);
      if (!Array.isArray(parsed)) return { pass: false, reason: "不是数组" };
      if (parsed.length !== 2)
        return { pass: false, reason: `期望 2，实际 ${parsed.length}` };
      return { pass: true };
    },
  },
  {
    id: "F03",
    group: "formatEvents",
    description: "空数组 → '[]'",
    event: [],
    assert: (actual) => {
      if (actual !== "[]")
        return { pass: false, reason: `期望 []，实际 ${actual}` };
      return { pass: true };
    },
  },
];

// =========================================================================
// 纯函数测试运行器
// =========================================================================

function runPureTests(): TestResult[] {
  const results: TestResult[] = [];

  for (const tc of pureTestCases) {
    const label = `[${tc.group}] ${tc.id}: ${tc.description}`;
    console.log(`  ${label}`);

    try {
      let actual: unknown;

      switch (tc.group) {
        case "applyInstructions":
          actual = applyInstructions(
            tc.existing ?? [],
            tc.newEvents ?? [],
            tc.instructions ?? [],
          );
          break;

        case "applyWindow":
          actual = applyWindow(tc.events ?? [], tc.windowSize ?? 20);
          break;

        case "parseInstructions":
          if (tc.shouldThrow) {
            let threw = false;
            try {
              parseInstructions(tc.input ?? "");
            } catch {
              threw = true;
            }
            results.push({
              id: tc.id,
              group: tc.group,
              description: tc.description,
              status: threw ? "pass" : "fail",
              reason: threw ? undefined : "期望抛出但未抛出",
            });
            console.log(`    ${threw ? "✓" : "✗"}`);
            continue;
          }
          actual = parseInstructions(tc.input ?? "");
          break;

        case "formatEvents": {
          const input = tc.event;
          if (Array.isArray(input)) {
            actual = formatEvents(input);
          } else if (input) {
            actual = formatEvents([input]);
          } else {
            actual = formatEvents([]);
          }
          break;
        }
      }

      // 断言
      if (tc.assert) {
        const { pass, reason } = tc.assert(actual);
        results.push({
          id: tc.id,
          group: tc.group,
          description: tc.description,
          status: pass ? "pass" : "fail",
          reason,
        });
        console.log(`    ${pass ? "✓" : "✗ " + reason}`);
      } else if (tc.expected !== undefined) {
        const pass = JSON.stringify(actual) === JSON.stringify(tc.expected);
        results.push({
          id: tc.id,
          group: tc.group,
          description: tc.description,
          status: pass ? "pass" : "fail",
          reason: pass
            ? undefined
            : `期望 ${JSON.stringify(tc.expected)}，实际 ${JSON.stringify(actual)}`,
        });
        console.log(`    ${pass ? "✓" : "✗"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: tc.id,
        group: tc.group,
        description: tc.description,
        status: "error",
        reason: msg,
      });
      console.log(`    ✗ 异常: ${msg}`);
    }
  }

  return results;
}

// =========================================================================
// 集成测试：mergeEvents (需 LLM)
// =========================================================================

function loadMergeTestCases(): IntegrationCase[] {
  const filePath = path.resolve(__dirname, "..", "test-cases-input.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const all = JSON.parse(raw) as Array<{
    id: string;
    prompt: string;
    description: string;
    input: { existingEvents: Event[]; newEvents?: Event[] };
  }>;

  return all
    .filter((tc) => tc.prompt === "merge-event")
    .map((tc) => ({
      id: tc.id,
      description: tc.description,
      existingEvents: tc.input.existingEvents,
      newEvents: tc.input.newEvents ?? [],
    }));
}

async function runIntegrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const cases = loadMergeTestCases();

  console.log(`\n  加载 ${cases.length} 个 merge-event 集成用例\n`);

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const label = `[${i + 1}/${cases.length}] ${tc.id}: ${tc.description}`;
    console.log(`  ${label}`);

    try {
      const merged = await mergeEvents(tc.existingEvents, tc.newEvents);
      results.push({
        id: tc.id,
        group: "mergeEvents",
        description: tc.description,
        status: "pass",
        reason: `合并后 ${merged.length} 条事件（原 ${tc.existingEvents.length} + 新 ${tc.newEvents.length}）`,
      });
      console.log(
        `    ✓ existing ${tc.existingEvents.length} + new ${tc.newEvents.length} → merged ${merged.length}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: tc.id,
        group: "mergeEvents",
        description: tc.description,
        status: "error",
        reason: msg,
      });
      console.log(`    ✗ ${msg}`);
    }
  }

  return results;
}

// =========================================================================
// 主入口
// =========================================================================

async function main(): Promise<void> {
  const runIntegration = process.argv.includes("--integration");

  console.log("═══════════════════════════════════════════");
  console.log("  Event Chronicle — Phase 2 测试");
  console.log(
    `  模式: ${runIntegration ? "纯函数 + 集成" : "纯函数（跳过 LLM）"}`,
  );
  console.log("═══════════════════════════════════════════\n");

  // ---- A. 纯函数测试 ----
  console.log("── A. 纯函数测试 ──\n");
  const pureResults = runPureTests();

  // ---- B. 集成测试（可选） ----
  let integrationResults: TestResult[] = [];
  if (runIntegration) {
    console.log("\n── B. 集成测试（LLM）──");
    await startup({ healthCheck: false });
    integrationResults = await runIntegrationTests();
  } else {
    console.log("\n── B. 集成测试 ── 跳过（需 --integration 参数）");
  }

  // ---- 汇总 ----
  const allResults = [...pureResults, ...integrationResults];
  const pass = allResults.filter((r) => r.status === "pass").length;
  const fail = allResults.filter((r) => r.status === "fail").length;
  const err = allResults.filter((r) => r.status === "error").length;
  const skip = allResults.filter((r) => r.status === "skip").length;

  console.log("\n═══════════════════════════════════════════");
  console.log("  结果汇总");
  console.log("═══════════════════════════════════════════");
  console.log(
    `  通过: ${pass}  |  失败: ${fail}  |  错误: ${err}  |  跳过: ${skip}`,
  );

  if (fail > 0 || err > 0) {
    console.log("\n── 失败/错误详情 ──");
    for (const r of allResults) {
      if (r.status === "fail" || r.status === "error") {
        console.log(`  [${r.group}] ${r.id}: ${r.description}`);
        if (r.reason) console.log(`    原因: ${r.reason}`);
      }
    }
  }

  // ---- 保存结果 ----
  const outDir = path.resolve(process.cwd(), "data", "test-02");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const summaryPath = path.join(outDir, "_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(allResults, null, 2), "utf-8");
  console.log(`\n  摘要已保存至: ${summaryPath}`);

  // 按组统计
  const groups = new Map<
    string,
    { pass: number; fail: number; error: number }
  >();
  for (const r of allResults) {
    if (!groups.has(r.group))
      groups.set(r.group, { pass: 0, fail: 0, error: 0 });
    const g = groups.get(r.group)!;
    if (r.status === "pass") g.pass++;
    else if (r.status === "fail") g.fail++;
    else if (r.status === "error") g.error++;
  }
  console.log("\n  按组统计:");
  for (const [name, stats] of groups) {
    const total = stats.pass + stats.fail + stats.error;
    console.log(`    ${name}: ${stats.pass}/${total} 通过`);
  }
  console.log();
}

main().catch((err) => {
  console.error("测试运行失败:", err instanceof Error ? err.message : err);
  process.exit(1);
});
