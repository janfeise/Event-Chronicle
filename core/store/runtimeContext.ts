/**
 * 运行时上下文 —— 管理全局可变状态。
 *
 * 所有 store 函数通过此模块获取数据目录路径，
 * 而非各自硬编码 `process.cwd() + "/data"`。
 *
 * 使用方式：
 *   import { setDataDir } from "./runtimeContext";
 *   setDataDir("/custom/path");
 *
 * 通常在 startup() 中调用一次即可，所有 store 函数自动感知。
 */
import * as path from "path";

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

let _dataDir: string = path.resolve(process.cwd(), "data");

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** 获取当前数据目录的绝对路径 */
export function getDataDir(): string {
  return _dataDir;
}

/**
 * 覆盖数据目录路径。
 * 应在任何 store 操作之前调用（通常在 startup() 中）。
 */
export function setDataDir(dir: string): void {
  _dataDir = path.resolve(dir);
}
