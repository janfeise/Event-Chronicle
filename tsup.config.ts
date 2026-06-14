import { defineConfig } from "tsup";
import * as fs from "fs";
import * as path from "path";

export default defineConfig({
  // 入口：SDK 统一入口文件
  entry: ["sdk/index.ts"],

  // 双格式输出
  format: ["esm", "cjs"],

  // 生成 .d.ts 类型声明
  dts: true,

  // 生成 source map（调试时映射回 TS 源码）
  sourcemap: true,

  // 构建前清理 dist/
  clean: true,

  // 不打包的依赖（仅保留 Node.js 内置模块）
  // dotenv / openai 必须打包——ST 扩展环境没有 node_modules/
  external: [
    "fs",
    "path",
  ],

  // 强制打包这些包（即使被自动检测为 external）
  noExternal: [/openai/, /dotenv/],

  // 输出目录
  outDir: "dist",

  // 不分包（单一入口无需 code splitting）
  splitting: false,

  // 注入 CJS/ESM 兼容 shim（__dirname / __filename）
  shims: true,

  // 构建成功后：将 .md 提示词文件复制到 dist/prompts/
  // 解决 PromptManager 编译后找不到提示词文件的问题
  async onSuccess() {
    const srcDir = path.resolve("prompts");
    const destDir = path.resolve("dist", "prompts");

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const copied: string[] = [];
    for (const file of fs.readdirSync(srcDir)) {
      if (file.endsWith(".md")) {
        fs.copyFileSync(
          path.join(srcDir, file),
          path.join(destDir, file),
        );
        copied.push(file);
      }
    }

    console.log("[tsup] 提示词文件已复制到 dist/prompts/:",
      copied.join(", "));
  },
});
