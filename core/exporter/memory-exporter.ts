import { loadChronicle } from "../store";
import promptManager from "../../prompts/manager";
import type { Event, MemoryExportOptions } from "../../types";

// ---------------------------------------------------------------------------
// 上层 API（接收 file name）
// ---------------------------------------------------------------------------

/**
 * AI 记忆导出 —— 从 data/{file name}.json 加载事件，渲染为 Markdown，
 * 并用 memory-prompt 模板包裹为可直接注入 LLM system message 的完整 Prompt。
 */
export function exportMemory(
  fileName: string,
  options?: MemoryExportOptions,
): string {
  const events = loadChronicle(fileName);
  return exportMemoryFromEvents(events, options);
}

// ---------------------------------------------------------------------------
// 底层 API（纯函数，接收 Event[]）
// ---------------------------------------------------------------------------

/**
 * 纯函数版本：Event[] → Markdown 渲染 → Prompt 包裹。
 */
export function exportMemoryFromEvents(
  events: Event[],
  options?: MemoryExportOptions,
): string {
  const markdown = renderMemoryMarkdown(events, options);
  return promptManager.getWithVars("memory-prompt", {
    memoryTimeline: markdown,
  });
}

// ---------------------------------------------------------------------------
// Markdown 渲染（内部）
// ---------------------------------------------------------------------------

function renderMemoryMarkdown(
  events: Event[],
  options?: MemoryExportOptions,
): string {
  const title = options?.title ?? "Event Chronicle Memory";
  const threshold = options?.highlightThreshold ?? 7;
  const includeTimeline = options?.includeTimeline ?? true;
  const groupBy = options?.groupBy ?? "location";

  if (events.length === 0) {
    return `# ${title}\n\n_No events recorded yet._`;
  }

  const importanceMin = Math.min(...events.map((e) => e.importance));
  const importanceMax = Math.max(...events.map((e) => e.importance));

  const lines: string[] = [];

  // ---- 标题 + 摘要 ----
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(
    `${events.length} events · importance range ${importanceMin}–${importanceMax}`,
  );
  lines.push("");

  // ---- 分组 ----
  if (groupBy !== "none") {
    const groups = groupEvents(events, groupBy);

    lines.push(`## By ${groupBy === "location" ? "Location" : "Tag"}`);
    lines.push("");

    for (const [name, group] of groups) {
      lines.push(`### ${name || "Unspecified"} (${group.length} events)`);
      lines.push("");
      for (const e of group) {
        lines.push(
          `- **${e.title}** (★${e.importance}): ${e.summary}` +
            ` — _${e.participants.join(", ") || "none"}_` +
            (e.location ? ` @ ${e.location}` : ""),
        );
      }
      lines.push("");
    }
  }

  // ---- 关键事件 ----
  const keyEvents = events.filter((e) => e.importance >= threshold);
  if (keyEvents.length > 0) {
    lines.push(`## Key Events (importance ≥ ${threshold})`);
    lines.push("");
    for (const e of keyEvents) {
      lines.push(`### ${e.title} (★${e.importance})`);
      lines.push(e.summary);
      lines.push("");
      const meta: string[] = [];
      if (e.participants.length > 0)
        meta.push(`Participants: ${e.participants.join(", ")}`);
      if (e.location) meta.push(`Location: ${e.location}`);
      if (e.tags.length > 0) meta.push(`Tags: ${e.tags.join(", ")}`);
      if (meta.length > 0) {
        lines.push(meta.join(" | "));
        lines.push("");
      }
    }
  }

  // ---- 时间线表格 ----
  if (includeTimeline) {
    lines.push("## Timeline");
    lines.push("");
    lines.push("| # | Event | ★ | Participants | Location |");
    lines.push("|---|-------|---|-------------|----------|");
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      lines.push(
        `| ${i + 1} | ${e.title} | ${e.importance} | ` +
          `${e.participants.join(", ") || "—"} | ${e.location || "—"} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 分组逻辑
// ---------------------------------------------------------------------------

function groupEvents(
  events: Event[],
  by: "location" | "tags",
): Map<string, Event[]> {
  const map = new Map<string, Event[]>();

  for (const e of events) {
    const keys =
      by === "location"
        ? [e.location || ""]
        : e.tags.length > 0
          ? [e.tags[0]]
          : [""];

    for (const key of keys) {
      const existing = map.get(key);
      if (existing) {
        existing.push(e);
      } else {
        map.set(key, [e]);
      }
    }
  }

  return map;
}
