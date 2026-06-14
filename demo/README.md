# Event Chronicle Demo

一个完整的端到端示例，展示 Event Chronicle SDK 的核心流程：

```
多轮对话 → 事件提取 → 自动合并 → 记忆导出 → 注入 LLM 上下文
```

## 场景

三位冒险者（战士、法师、盗贼）探索一座古老神庙。每轮对话后提取事件，事件积累到阈值后自动合并去重，最终导出为可直接注入 LLM 的长期记忆。

## 运行

```bash
# 1. 配置 API Key
cp demo/.env.example demo/.env
# 编辑 demo/.env 填入你的 LLM_API_KEY

# 2. 构建 SDK
npm run build

# 3. 运行 Demo
npx tsx demo/run-demo.ts
```

## 预期输出

- 每个对话轮次提取出的事件
- 合并触发时的合并结果
- 最终导出的 Memory Prompt（可直接作为 LLM system message）
