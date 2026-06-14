# Event Chronicle Web Demo

浏览器交互式 Demo，展示 Event Chronicle SDK 的完整功能。

## 架构

```
浏览器 (GitHub Pages)  ←─ fetch() ─→  本地终端 (Node.js)
  index.html                           server.ts
  styles.css                           import "event-chronicle"
  app.js
```

前端零依赖，后端使用 `event-chronicle` SDK。

## 运行

### 1. 启动后端

```bash
cd demo-web
npm install
cp .env.example .env    # 编辑 .env 填入你的 LLM_API_KEY
npm run dev
```

### 2. 打开前端

直接在浏览器中打开 `index.html`，或通过后端地址访问：

```
http://localhost:3456
```

状态栏指示灯：
- 🟢 绿色：后端已连接，LLM 已配置
- 🟡 黄色：后端已连接但未配置 API Key
- ⚪ 灰色：后端未连接，使用沙盒模式

## 功能

- **对话交互**：输入消息，AI 自动回复
- **事件提取**：每次对话后自动提取结构化事件
- **时间线展示**：右侧面板按时间顺序展示事件卡片
- **手动编辑**：增、删、改事件
- **沙盒模式**：后端不可用时自动切换本地关键词提取
- **还原预设**：一键恢复示例数据
