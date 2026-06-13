# Event Chronicle

A timeline-based memory engine for AI conversations.

基础思路：

```txt
聊天记录
    ↓
每 n 条消息
    ↓
调用LLM（注意上下文长度，若过长需截断）
    ↓
提取事件
    ↓
存JSON（JSON需保存来源：哪 n 条消息，不一定保存原始消息数据，可以是索引，后续通过索引访问信息？还是直接存储消息比较好，应该避免修改，直接存消息作为快照，避免后续更改后出现数据错误）
```

## 架构说明

```txt
             Adapter
                │
                ▼
         ┌────────────┐
         │    Core    │
         └────────────┘
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
 Prompts     Storage   Timeline

                │
                ▼
              Data
```

架构：

```txt
event-chronicle/

├─ core/
│  ├─ extractor/	# 提取：从data（如：聊天数据）中提取事件
│  ├─ storage/		# 存储，事件存储，删除，更新，读取等相关操作
│  ├─ retrieval/	# 检索
│  └─ timeline/		# 时间线
│
├─ prompts/
│  ├─ extract-event.md	# 提取事件的提示词
│  ├─ merge--event.md	# 整理 事件编年史 数据
│
├─ adapters/
│  ├─ sillytavern/	# 酒馆插件适配器
│
├─ data/			# 数据与配置
│  ├─ events.json
│  └─ config.json
│
└─ src/
```



