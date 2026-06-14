import * as fs from "fs";
import * as path from "path";
import { getDataDir } from "./runtimeContext";
import { ensureDir } from "./saveChronicle";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface MergeState {
  /** 自上次合并以来累计的新事件数 */
  newEventCount: number;
  /** 上次合并时间（ISO 字符串） */
  lastMergeAt: string | null;
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 读取指定 chronicle 的合并状态。
 * 若 eventId 不存在或状态文件缺失，返回初始状态。
 */
export function loadMergeState(eventId: string): MergeState {
  const filePath = stateFilePath(eventId);

  if (!fs.existsSync(filePath)) {
    return { newEventCount: 0, lastMergeAt: null };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as MergeState;
  } catch {
    return { newEventCount: 0, lastMergeAt: null };
  }
}

/**
 * 保存合并状态。
 */
export function saveMergeState(eventId: string, state: MergeState): void {
  const filePath = stateFilePath(eventId);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * 记录新增事件（累加 newEventCount）。
 * @returns 更新后的状态
 */
export function recordNewEvents(
  eventId: string,
  count: number,
): MergeState {
  const state = loadMergeState(eventId);
  state.newEventCount += count;
  saveMergeState(eventId, state);
  return state;
}

/**
 * 重置合并计数器（合并完成后调用）。
 */
export function resetMergeCounter(eventId: string): MergeState {
  const state: MergeState = {
    newEventCount: 0,
    lastMergeAt: new Date().toISOString(),
  };
  saveMergeState(eventId, state);
  return state;
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function stateFilePath(eventId: string): string {
  return path.join(getDataDir(), `${eventId}_state.json`);
}
