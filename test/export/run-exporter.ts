/**
 * Exporter 模块测试
 *
 * 测试覆盖：
 *   - exportRawFromEvents / exportMemoryFromEvents（纯函数）
 *   - 各配置项组合（groupBy / threshold / includeTimeline）
 *   - 边界情况（空数组、单事件、全高重要性）
 *
 * 运行方式：
 *   npx tsx test/export/run-exporter.ts
 */

import {
  exportRawFromEvents,
  exportMemoryFromEvents,
} from "../../core/exporter";
import type { Event } from "../../types";

// =========================================================================
// 测试数据
// =========================================================================

const sampleEvents: Event[] = [
  {
    id: "evt_001",
    title: "进入古老图书馆",
    summary: "用户推开橡木门，进入古老图书馆。",
    importance: 4,
    participants: ["用户"],
    location: "古老图书馆",
    tags: ["地点变化", "探索"],
  },
  {
    id: "evt_002",
    title: "发现关键线索推翻密室假设",
    summary: "侦探在窗台灰尘上发现移动痕迹，证明有人从窗户进出，推翻了密室假设。",
    importance: 8,
    participants: ["侦探"],
    location: "案发现场",
    tags: ["线索发现", "案件转折"],
  },
  {
    id: "evt_003",
    title: "约定周末爬西山",
    summary: "小明、小红和小刚约定周六早上七点校门口集合前往西山。",
    importance: 4,
    participants: ["小明", "小红", "小刚"],
    location: "西山",
    tags: ["计划", "户外活动"],
  },
  {
    id: "evt_004",
    title: "收到匿名包裹",
    summary: "用户收到一个来源不明的包裹，仅有一个地址标记。",
    importance: 3,
    participants: ["用户"],
    location: "",
    tags: ["物品获得"],
  },
  {
    id: "evt_005",
    title: "完成早晨例行事务",
    summary: "用户完成洗漱、早餐及出门前检查门窗。",
    importance: 1,
    participants: ["用户"],
    location: "",
    tags: ["日常事务"],
  },
];

// =========================================================================
// 断言工具
// =========================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

function assertContains(haystack: string, needle: string, label: string): void {
  assert(haystack.includes(needle), `${label} — contains "${needle.slice(0, 50)}"`);
}

function assertNotContains(haystack: string, needle: string, label: string): void {
  assert(!haystack.includes(needle), `${label} — does NOT contain "${needle.slice(0, 50)}"`);
}

// =========================================================================
// exportRawFromEvents
// =========================================================================

function testRawExport(): void {
  console.log("\n── exportRaw ──");

  const output = exportRawFromEvents(sampleEvents);
  const parsed = JSON.parse(output);

  assert(Array.isArray(parsed), "output is a JSON array");
  assert(parsed.length === 5, "contains 5 events");

  // 所有字段存在
  const first = parsed[0];
  assert("id" in first, "has id field");
  assert("title" in first, "has title field");
  assert("summary" in first, "has summary field");
  assert("importance" in first, "has importance field");
  assert("participants" in first, "has participants field");
  assert("location" in first, "has location field");
  assert("tags" in first, "has tags field");

  // 空数组
  const empty = exportRawFromEvents([]);
  assert(JSON.parse(empty).length === 0, "empty input → empty JSON array");
}

// =========================================================================
// exportMemoryFromEvents — 默认配置
// =========================================================================

function testMemoryDefault(): void {
  console.log("\n── exportMemory (default) ──");

  const output = exportMemoryFromEvents(sampleEvents);

  assertContains(output, "# Event Chronicle Memory", "has title");
  assertContains(output, "## Summary", "has summary section");
  assertContains(output, "5 events", "event count");
  assertContains(output, "## By Location", "groups by location (default)");
  assertContains(output, "### 古老图书馆", "has location group");
  assertContains(output, "### 案发现场", "has location group");
  assertContains(output, "### Unspecified", "events without location grouped");
  assertContains(output, "## Key Events", "has key events section");
  assertContains(output, "importance ≥ 7", "threshold label");
  assertContains(output, "发现关键线索推翻密室假设", "high-importance event in Key Events");
  assertContains(output, "## Timeline", "has timeline table");
  assertContains(output, "| # | Event | ★ | Participants | Location |", "timeline header");

  // Prompt 包裹验证
  assertContains(output, "# Role", "wrapped in memory prompt");
  assertContains(output, "长期记忆能力的AI助手", "has role description");
  assertContains(output, "# Memory Context", "has memory context header");
  assertContains(output, "# Rules", "has rules section");
  assertContains(output, "不允许忽略 Memory Context", "has rule 2");
  assertContains(output, "# Instruction", "has instruction section");

  // 低重要性事件存在于输出中（分组/时间线），但不应出现在 Key Events 标题下
  const keyEventsSection = output.split("## Key Events")[1]?.split("## Timeline")[0] ?? "";
  assertNotContains(keyEventsSection, "完成早晨例行事务", "low-importance event NOT in Key Events section");
}

// =========================================================================
// exportMemoryFromEvents — 自定义配置
// =========================================================================

function testMemoryOptions(): void {
  console.log("\n── exportMemory (custom options) ──");

  // groupBy: tags
  const byTags = exportMemoryFromEvents(sampleEvents, { groupBy: "tags" });
  assertContains(byTags, "## By Tag", "groupBy: tags");
  assertContains(byTags, "### 地点变化", "tag group exists");

  // groupBy: none
  const noGroup = exportMemoryFromEvents(sampleEvents, { groupBy: "none" });
  assertNotContains(noGroup, "## By Location", "groupBy: none — no location grouping");
  assertNotContains(noGroup, "## By Tag", "groupBy: none — no tag grouping");

  // highlightThreshold: 3
  const lowThreshold = exportMemoryFromEvents(sampleEvents, { highlightThreshold: 3 });
  assertContains(lowThreshold, "importance ≥ 3", "custom threshold label");
  assertContains(lowThreshold, "进入古老图书馆", "importance 4 event appears in Key Events (threshold=3)");

  // includeTimeline: false
  const noTimeline = exportMemoryFromEvents(sampleEvents, { includeTimeline: false });
  assertNotContains(noTimeline, "## Timeline", "includeTimeline: false — no timeline");

  // custom title
  const customTitle = exportMemoryFromEvents(sampleEvents, { title: "My Story" });
  assertContains(customTitle, "# My Story", "custom title");
}

// =========================================================================
// exportMemoryFromEvents — 边界情况
// =========================================================================

function testMemoryEdgeCases(): void {
  console.log("\n── exportMemory (edge cases) ──");

  // 空事件
  const empty = exportMemoryFromEvents([]);
  assertContains(empty, "No events recorded yet", "empty events → placeholder message");

  // 单个事件
  const single = exportMemoryFromEvents([sampleEvents[0]]);
  assertContains(single, "1 events", "single event count");
  assertContains(single, "## Summary", "single event has summary");
  assertNotContains(single, "## Key Events", "single event (importance 4 < 7) no Key Events");
  assertContains(single, "## Timeline", "single event has timeline");

  // 全部高重要性
  const allHigh = sampleEvents.map((e) => ({ ...e, importance: 9 }));
  const highOutput = exportMemoryFromEvents(allHigh);
  assertContains(highOutput, "## Key Events", "all high importance → Key Events present");

  // 无地点事件
  const noLocation = sampleEvents.filter((e) => !e.location);
  const noLocOutput = exportMemoryFromEvents(noLocation);
  assertContains(noLocOutput, "### Unspecified", "all no-location → single Unspecified group");
}

// =========================================================================
// 主入口
// =========================================================================

function main(): void {
  console.log("═══════════════════════════════════════════");
  console.log("  Event Chronicle — Exporter 测试");
  console.log("═══════════════════════════════════════════");

  testRawExport();
  testMemoryDefault();
  testMemoryOptions();
  testMemoryEdgeCases();

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  通过: ${passed}  |  失败: ${failed}`);
  console.log(`═══════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

main();
