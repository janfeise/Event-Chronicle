// ============================================================================
// Event Chronicle — 端到端 Demo
//
// 场景：三位冒险者探索古老神庙，6 轮对话逐步推进剧情。
// 流程：每轮对话 → 提取事件 → 自动合并（累计 ≥ 2 条触发）→ 导出记忆
//
// 运行：
//   cp demo/.env.example demo/.env   # 填入 LLM_API_KEY
//   npm run build
//   npx tsx demo/run-demo.ts
// ============================================================================

import * as dotenv from "dotenv";
import * as path from "path";

// ---------- SDK 公共 API ----------
import {
  startup,
  processMessages,
  exportMemory,
  exportRaw,
  loadChronicle,
} from "../sdk";
import type { ChatMessage } from "../types";

// =============================================================================
// 配置
// =============================================================================

// 加载 demo/.env（优先），降级到项目根 .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
if (!process.env.LLM_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

const EVENT_ID = "demo-adventure";
const DATA_DIR = path.resolve(__dirname, "..", "data", "demo");

// =============================================================================
// 场景数据：6 轮对话（三位冒险者探索古老神庙）
// =============================================================================

interface Round {
  title: string;
  messages: ChatMessage[];
}

const rounds: Round[] = [
  {
    title: "第一幕：神庙入口",
    messages: [
      { role: "战士·雷恩", content: "这座神庙至少有一千年了。看那些符文——它们在发光！" },
      { role: "法师·艾琳", content: "别碰它们！这是古代封印术，需要正确的咒语才能通过。" },
      { role: "盗贼·影", content: "等等，我发现地板上有压力机关。踩错一步就会触发陷阱。" },
    ],
  },
  {
    title: "第二幕：解开封印",
    messages: [
      { role: "法师·艾琳", content: "我解译了这些符文……它们提到了'月之泪'——一件被封印在深处的圣物。" },
      { role: "战士·雷恩", content: "所以这不仅仅是一座神庙，而是一座监狱？囚禁着什么？" },
      { role: "盗贼·影", content: "我已绕过三个陷阱。前面的走廊分叉了——左边有光，右边有风声。" },
    ],
  },
  {
    title: "第三幕：分岔路口",
    messages: [
      { role: "战士·雷恩", content: "走右边。风声意味着有出口，或者更大的空间——对我们有利。" },
      { role: "法师·艾琳", content: "不，左边的光是魔法光芒，可能是封印核心所在。我们就是为此而来的。" },
      { role: "盗贼·影", content: "我在右边通道发现了新鲜的脚印。有人——或者什么东西——最近来过这里。" },
    ],
  },
  {
    title: "第四幕：守护者",
    messages: [
      { role: "战士·雷恩", content: "是石像鬼！三只！影，掩护艾琳施法！" },
      { role: "法师·艾琳", content: "我需要三十秒吟唱——这道破魔咒可以瓦解它们的附魔核心！" },
      { role: "盗贼·影", content: "我用烟雾弹封锁它们的视线。雷恩，左翼那只交给我！" },
    ],
  },
  {
    title: "第五幕：月之泪",
    messages: [
      { role: "法师·艾琳", content: "就是它——月之泪。它不是武器，而是一个容器……里面封存着一位上古精灵的意识。" },
      { role: "盗贼·影", content: "封印上有裂痕。不是时间造成的——有人试图破坏它。最近的事。" },
      { role: "战士·雷恩", content: "所以脚印的主人想释放里面的东西？我们不能让它得逞。" },
    ],
  },
  {
    title: "第六幕：抉择",
    messages: [
      { role: "法师·艾琳", content: "我可以用修复咒加固封印，但需要消耗月之泪的大部分魔力。它将变得平凡。" },
      { role: "盗贼·影", content: "等等……精灵在说话。她说破坏封印的人正是她的后代——想让她解脱。" },
      { role: "战士·雷恩", content: "这不是我们能替她做的决定。让她自己选择：解脱，还是继续守护。" },
    ],
  },
];

// =============================================================================
// 主流程
// =============================================================================

async function main() {
  printBanner();

  // ---- 1. 初始化 ----
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ 未找到 LLM_API_KEY。\n" +
        "   请在 demo/.env 或项目根 .env 中配置。参考 demo/.env.example",
    );
    process.exit(1);
  }

  console.log("初始化 Event Chronicle...\n");
  await startup({
    healthCheck: true,
    dataDir: DATA_DIR,
    promptsDir: path.resolve(__dirname, "..", "prompts"),
  });
  console.log();

  // ---- 2. 逐轮处理对话 ----
  console.log("═".repeat(60));
  console.log("  冒险开始 —— 古老神庙的探索者");
  console.log("═".repeat(60));

  let totalEvents = 0;
  let totalMerges = 0;

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    printRoundHeader(i + 1, round.title);

    // 处理本轮对话
    const result = await processMessages(round.messages, {
      eventId: EVENT_ID,
      autoMerge: true, // 达到阈值自动触发合并
    });

    totalEvents += result.events.length;

    // 打印本轮提取的事件
    for (const event of result.events) {
      printEvent(event.title, event.summary, event.importance);
    }

    // 如果触发了合并
    if (result.merged) {
      totalMerges++;
      console.log(
        `\n  🔗 自动合并触发！（累计达到阈值）`,
      );
      console.log(
        `     合并前: ${(result.mergedEvents?.length ?? 0) + result.events.length} 条 → 合并后: ${result.mergedEvents?.length} 条`,
      );
    }

    console.log();
  }

  // ---- 3. 导出 ----
  console.log("═".repeat(60));
  console.log("  冒险结束 —— 导出长期记忆");
  console.log("═".repeat(60));

  // 3a. 查看原始数据
  const raw = exportRaw(EVENT_ID);
  const rawEvents = JSON.parse(raw) as unknown[];
  console.log(`\n📦 Raw Export: ${rawEvents.length} 条事件已持久化`);
  console.log(`   数据目录: ${DATA_DIR}`);

  // 3b. 导出 AI 记忆（可直接注入 LLM system prompt）
  console.log("\n" + "─".repeat(60));
  console.log("  Memory Export（注入 LLM 的完整上下文）");
  console.log("─".repeat(60));

  const memory = exportMemory(EVENT_ID, {
    title: "冒险者小队的编年史",
    highlightThreshold: 6,
  });

  // 只打印 Memory Timeline 部分（略去 Prompt 框架）
  const timelineStart = memory.indexOf("## Memory Context");
  const timelineEnd = memory.indexOf("# Rules");
  if (timelineStart !== -1 && timelineEnd !== -1) {
    console.log(memory.slice(timelineStart, timelineEnd));
  } else {
    console.log(memory);
  }

  // ---- 4. 统计 ----
  console.log("═".repeat(60));
  console.log("  Demo 统计");
  console.log("═".repeat(60));
  console.log(`  对话轮次:        ${rounds.length}`);
  console.log(`  累计提取事件:    ${totalEvents}`);
  console.log(`  触发合并次数:    ${totalMerges}`);
  console.log(`  最终事件数:      ${rawEvents.length}`);
  console.log(`  记忆导出长度:    ${memory.length} 字符`);
  console.log(`  数据持久化文件:  ${EVENT_ID}.json`);
  console.log();

  printUsageHint();
}

// =============================================================================
// 输出辅助
// =============================================================================

function printBanner(): void {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       Event Chronicle — SDK Demo                 ║");
  console.log("║       从对话中提取事件，构建可视编年史            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
}

function printRoundHeader(round: number, title: string): void {
  console.log(`┌─ Round ${round} ─────────────────────────────────────────┐`);
  console.log(`│  ${title}`);
  console.log(`└──────────────────────────────────────────────────┘`);
}

function printEvent(title: string, summary: string, importance: number): void {
  const stars = "★".repeat(importance) + "☆".repeat(10 - importance);
  console.log(`  📜 ${title}`);
  console.log(`     ${summary.slice(0, 80)}${summary.length > 80 ? "..." : ""}`);
  console.log(`     重要性: ${stars} (${importance}/10)`);
}

function printUsageHint(): void {
  console.log("─".repeat(60));
  console.log("💡 使用方式:");
  console.log();
  console.log("  import { startup, processMessages, exportMemory }");
  console.log('    from "event-chronicle";');
  console.log();
  console.log("  await startup({ healthCheck: false });");
  console.log("  const result = await processMessages(messages, {");
  console.log('    eventId: "my-story",');
  console.log("    autoMerge: true,");
  console.log("  });");
  console.log('  const memory = exportMemory("my-story");');
  console.log("  // → 将 memory 作为 LLM system prompt 注入");
  console.log();
}

// =============================================================================
// 入口
// =============================================================================

main().catch((err) => {
  console.error("\n❌ Demo 运行失败:", err instanceof Error ? err.message : err);
  process.exit(1);
});
