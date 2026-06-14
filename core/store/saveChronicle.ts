import * as fs from "fs";
import * as path from "path";
import { getDataDir } from "./runtimeContext";
import type { Event } from "../../types";

/**
 * 全量保存事件到新文件（覆盖写入）。
 *
 * 文件命名：`event_{时间戳}.json`，每次调用生成一个新文件，
 * 不会覆盖已有文件。
 *
 * @param events - 要保存的事件数组
 * @returns 生成的文件名
 */
export function saveChronicle(events: Event[]): string {
  const dataDir = getDataDir();
  ensureDir(dataDir);

  const filename = `event_${Date.now()}.json`;
  const filePath = path.join(dataDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), "utf-8");

  return filename;
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export { ensureDir };
