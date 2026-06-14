// =============================================================================
// Event Chronicle — CLI 入口
//
// 运行方式：
//   npx tsx cli.ts        （开发模式）
//   node cli.js            （编译后）
// =============================================================================

import { startup } from "./index";
import { logger } from "./core/logger";

const PREFIX = "[Event Chronicle]";

const isMain =
  process.argv[1] &&
  (process.argv[1].replace(/\\/g, "/").endsWith("/cli.ts") ||
    process.argv[1].replace(/\\/g, "/").endsWith("/cli.js"));

if (isMain) {
  startup().catch((err) => {
    console.error(
      `${PREFIX} ❌ 启动失败:`,
      err instanceof Error ? err.message : err,
    );
    logger.error(
      "startup",
      "fatal startup error",
      { error: err instanceof Error ? err.message : String(err) },
    );
    process.exit(1);
  });
}
