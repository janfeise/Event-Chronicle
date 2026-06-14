import { defineConfig } from "tsup";

export default defineConfig({
  // 浏览器安全入口 — 仅导出纯函数 + Prompt 模板
  entry: ["sdk/browser.ts"],

  // 仅 ESM（浏览器环境）
  format: ["esm"],

  // 输出到 dist/browser/
  outDir: "dist/browser",

  // 输出文件扩展名 .mjs
  outExtension: () => ({ js: ".mjs" }),

  // 生成类型声明
  dts: true,

  // 生成 source map（调试用）
  sourcemap: true,

  // 构建前清理
  clean: true,

  // 关键：所有依赖打包进 bundle，不标记为 external
  // 包括内部模块和 TypeScript 类型
  noExternal: [/.*/],

  // 不拆分（单入口）
  splitting: false,

  // 平台：浏览器
  platform: "browser",

  // Target: 现代浏览器
  target: "es2020",

  // 不注入 Node.js shim（__dirname 等）
  shims: false,
});
