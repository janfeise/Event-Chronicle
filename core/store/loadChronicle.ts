import * as fs from "fs";
import * as path from "path";
import type { Event } from "../../types";

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
export function loadChronicle(existingEventId?: string): Event[] {
  if (!existingEventId) {
    return [];
  }

  const dataDir = resolveDataDir();
  const filePath = path.join(dataDir, `${existingEventId}.json`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed as Event[];
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

/** data/ 目录的绝对路径 */
function resolveDataDir(): string {
  return path.resolve(process.cwd(), "data");
}

/** 供同模块其他文件使用 */
export { resolveDataDir };
