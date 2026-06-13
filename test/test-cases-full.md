# Event Chronicle — 完整测试用例（含输入与预期输出）

> **版本**: 1.0  
> **覆盖 Prompt**: `extract-event.md` / `merge-event.md`  
> **测试用例总数**: 48  
> **设计原则**: 每个用例标注所属模块、核心能力、验证点

---

## 测试用例索引

| 编号 | 模块 | 用例数 | Prompt |
|------|------|--------|--------|
| TC-1.x | 事件识别能力 | 8 | extract-event |
| TC-2.x | 事件过滤能力 | 6 | extract-event |
| TC-3.x | 时间线能力 | 5 | extract-event + merge-event |
| TC-4.x | 事实约束能力 | 5 | extract-event + merge-event |
| TC-5.x | 事件压缩能力 | 4 | extract-event |
| TC-6.x | 去重能力 | 5 | merge-event |
| TC-7.x | 重要性评分能力 | 5 | extract-event |
| TC-8.x | 输出格式能力 | 4 | extract-event + merge-event |
| TC-9.x | 边界条件能力 | 4 | extract-event + merge-event |
| TC-10.x | 长期运行能力 | 2 | extract-event |

---

# 模块一：事件识别能力（正确记录）

## TC-1.1：基本状态变化 — 角色身份变更

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[User]: 我决定辞去现在的工作，成为一名自由职业者。
[AI]: 这是一个重大的决定，你考虑清楚了吗？
[User]: 是的，我已经提交了辞职信。
```

### 预期输出

```json
[
  {
    "title": "辞去工作成为自由职业者",
    "summary": "用户决定辞去当前工作，已提交辞职信，转为自由职业者",
    "importance": 7,
    "participants": ["用户"],
    "location": "",
    "tags": ["职业变化", "身份转变"]
  }
]
```

### 验证点
- ✅ 角色身份/状态变化被正确识别
- ✅ 对话过程（AI 的确认询问）未被记录为独立事件
- ✅ 重要性评分符合重大事件（7-8）

---

## TC-1.2：地点变化 — 到达新场景

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[User]: 我推开沉重的橡木门，走进了古老的图书馆。
[AI]: 你看到馆内高耸的书架和昏黄的灯光。
[User]: 这里的气息很陈旧，空气中弥漫着纸张的味道。
```

### 预期输出

```json
[
  {
    "title": "进入古老图书馆",
    "summary": "用户推开橡木门，进入古老图书馆",
    "importance": 4,
    "participants": ["用户"],
    "location": "古老图书馆",
    "tags": ["地点变化", "探索"]
  }
]
```

### 验证点
- ✅ 地点变化被识别为事件
- ✅ 环境描写未被记录为独立事件
- ✅ location 字段正确填写

---

## TC-1.3：计划建立 — 多人约定

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[小明]: 周末有什么安排吗？
[小红]: 没有，在家闲着。
[小明]: 那我们去爬山吧，听说西山风景不错。
[小红]: 好啊，叫上小刚一起。
[小明]: 行，我负责准备食物，你联系小刚。
[小红]: 没问题，周六早上七点校门口集合。
[小明]: 就这么定了。
```

### 预期输出

```json
[
  {
    "title": "约定周末爬西山",
    "summary": "小明、小红和小刚约定周六早上七点在校门口集合，前往西山爬山，小明负责食物，小红联系小刚",
    "importance": 4,
    "participants": ["小明", "小红", "小刚"],
    "location": "校门口",
    "tags": ["计划", "户外活动"]
  }
]
```

### 验证点
- ✅ 计划约定的全过程被压缩为一个结果事件
- ✅ 所有参与者被正确识别
- ✅ 分工细节被包含在 summary 中
- ✅ 确认语句（"就这么定了"）未单独记录

---

## TC-1.4：任务推进 — 项目实质进展

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[开发者A]: 后端 API 已经全部完成并部署到测试环境了。
[开发者B]: 收到，我这边前端对接也做完了，登录和注册流程都调通了。
[开发者A]: 那我们今晚合并到主分支，明天开始集成测试。
[开发者B]: 同意，我先更新一下接口文档。
```

### 预期输出

```json
[
  {
    "title": "后端 API 完成并部署至测试环境",
    "summary": "开发者A完成后端 API 开发并部署至测试环境",
    "importance": 5,
    "participants": ["开发者A"],
    "location": "",
    "tags": ["项目推进", "后端"]
  },
  {
    "title": "前端登录注册流程对接完成",
    "summary": "开发者B完成前端登录和注册流程与后端 API 的对接",
    "importance": 5,
    "participants": ["开发者B"],
    "location": "",
    "tags": ["项目推进", "前端"]
  },
  {
    "title": "决定当晚合并主分支并开始集成测试",
    "summary": "开发者A和开发者B决定当晚合并代码至主分支，次日起开始集成测试；开发者B将更新接口文档",
    "importance": 5,
    "participants": ["开发者A", "开发者B"],
    "location": "",
    "tags": ["项目推进", "计划"]
  }
]
```

### 验证点
- ✅ 两个独立的任务推进分别记录
- ✅ 合并计划被记录为独立事件
- ✅ 不同人员的贡献分别归属

---

## TC-1.5：重要信息揭示

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[侦探]: 我检查了现场，发现了一个关键线索。
[助手]: 什么线索？
[侦探]: 窗户虽然锁着，但窗台上的灰尘有被移动过的痕迹，说明有人从这里进出过。
[助手]: 这么说，密室并不存在？
[侦探]: 没错，这不是密室杀人案，凶手是从窗户逃走的。
```

### 预期输出

```json
[
  {
    "title": "发现关键线索推翻密室假设",
    "summary": "侦探在窗台灰尘上发现移动痕迹，证明有人从窗户进出，推翻了密室杀人的假设",
    "importance": 8,
    "participants": ["侦探"],
    "location": "案发现场",
    "tags": ["线索发现", "案件转折"]
  }
]
```

### 验证点
- ✅ 重要信息揭示被记录为事件
- ✅ 对话过程（助手的追问）未被记录
- ✅ 重要性评分体现转折点（8）

---

## TC-1.6：物品获得

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[冒险者]: 我从宝箱中找到了一把发光的剑！
[同伴]: 让我看看……这上面刻着古代符文，应该是一把魔法武器。
[冒险者]: 太好了，正好可以在接下来的战斗中使用。
```

### 预期输出

```json
[
  {
    "title": "从宝箱中获得魔法剑",
    "summary": "冒险者从宝箱中获得一把刻有古代符文的发光魔法剑",
    "importance": 6,
    "participants": ["冒险者"],
    "location": "",
    "tags": ["物品获得", "装备"]
  }
]
```

### 验证点
- ✅ 物品获得被正确识别
- ✅ 物品描述（发光、古代符文）被包含
- ✅ 同伴的观察被融入事件描述但不作为独立参与者记录

---

## TC-1.7：关系变化

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[Alice]: 经过这段时间的相处，我觉得我们应该正式确定关系。
[Bob]: 我也是这么想的。你愿意做我的女朋友吗？
[Alice]: 我愿意。
[Bob]: 那我们以后就是恋人了。
```

### 预期输出

```json
[
  {
    "title": "Alice 和 Bob 确立恋爱关系",
    "summary": "Alice 和 Bob 经过相处后，正式确立恋爱关系",
    "importance": 7,
    "participants": ["Alice", "Bob"],
    "location": "",
    "tags": ["关系变化", "恋情"]
  }
]
```

### 验证点
- ✅ 关系变化被正确识别
- ✅ 反复确认的过程被压缩为结果
- ✅ 重要性评分体现关系里程碑（7）

---

## TC-1.8：多事件并发 — 同一对话中的多重状态变化

- **模块**: 事件识别能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[队长]: 我们到达了废弃工厂。大家分散搜索，保持通讯。
[队员A]: 我在二楼发现了一些文件。
[队员B]: 地下室有一辆被遗弃的货车，车牌被拆掉了。
[队长]: 很好，这都是重要发现。A 你继续搜查文件，B 你去检查货车，我联系总部汇报。
[队员A]: 等等，这些文件上提到了"红月计划"！
[队长]: 红月计划？这和我们一直在追查的案件有关。立刻把这些文件收好。
```

### 预期输出

```json
[
  {
    "title": "队伍到达废弃工厂",
    "summary": "队长带领队伍到达废弃工厂，下令分散搜索",
    "importance": 4,
    "participants": ["队长", "队员A", "队员B"],
    "location": "废弃工厂",
    "tags": ["地点变化", "任务"]
  },
  {
    "title": "在废弃工厂发现文件与货车",
    "summary": "队员A在二楼发现文件，队员B在地下室发现被遗弃且车牌被拆的货车",
    "importance": 5,
    "participants": ["队员A", "队员B"],
    "location": "废弃工厂",
    "tags": ["线索发现"]
  },
  {
    "title": "发现文件提及"红月计划"",
    "summary": "队员A发现的文件中提及"红月计划"，队长确认与追查案件相关，下令收好文件",
    "importance": 8,
    "participants": ["队长", "队员A"],
    "location": "废弃工厂",
    "tags": ["线索发现", "案件转折", "红月计划"]
  }
]
```

### 验证点
- ✅ 同一对话中的多处状态变化分别记录
- ✅ 地点变化始终被记录
- ✅ 信息揭示等级逐步提升被正确分层
- ✅ 任务分配未被重复记录

---

# 模块二：事件过滤能力（正确忽略）

## TC-2.1：问候与告别不应记录

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[User]: 你好！
[AI]: 你好！有什么可以帮你的吗？
[User]: 今天天气真好。
[AI]: 是啊，阳光明媚的。
[User]: 好的，那我先走了，拜拜！
[AI]: 再见，祝你有美好的一天！
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 打招呼不被记录
- ✅ 天气闲聊不被记录
- ✅ 告别不被记录
- ✅ AI 的祝福不被记录

---

## TC-2.2：情绪表达与无后果玩笑不应记录

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[角色A]: 哈哈哈，你讲的笑话太好笑了！
[角色B]: 谢谢夸奖，我也觉得我很有幽默感。
[角色A]: 笑得我肚子疼。
[角色B]: 那下次再给你讲一个更好笑的。
[角色A]: 哈哈哈哈好的好的。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 大笑/情绪表达不被记录
- ✅ 无后果玩笑不被记录
- ✅ 无实质承诺的"下次讲笑话"不被记录

---

## TC-2.3：对已知计划的简单认可不应记录

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "约定周末爬西山",
    "summary": "小明和小红约定周六爬西山",
    "importance": 4,
    "participants": ["小明", "小红"],
    "location": "西山",
    "tags": ["计划"]
  }
]
```

**recentMessages**:
```
[小红]: 周末爬山的事还记得吧？
[小明]: 嗯嗯，记得。
[小红]: 好的。
[小明]: 没问题。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 对已有计划的确认不被记录
- ✅ "嗯嗯""好的""没问题"等确认语不被记录
- ✅ 无新信息增加的对话不产生事件

---

## TC-2.4：闲聊讨论（无决策无结果）不应记录

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户A]: 你觉得哪种编程语言最好？
[用户B]: 我觉得 Python 挺好用的。
[用户A]: 但我更喜欢 JavaScript。
[用户B]: 各有优劣吧。
[用户A]: 确实，选什么语言主要看项目需求。
[用户B]: 是的，没有绝对的最好。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 观点交流不被记录
- ✅ 无决策的讨论不被记录
- ✅ 无状态变化的对话不产生事件

---

## TC-2.5：过去事件不应记录（Past Event Rule）

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我昨天去了市中心的新咖啡店。
[用户]: 那家店环境很好，咖啡也不错。
[用户]: 哦对了，我大学的时候还学过两年的咖啡制作。
[用户]: 所以我对咖啡还是有点了解的。
[AI]: 那你现在打算开咖啡店吗？
[用户]: 不，只是随便聊聊。我们开始做今天的任务吧。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 昨天去咖啡店（聊天前发生）不被记录
- ✅ 大学学咖啡制作（更早的过去）不被记录
- ✅ "开始做今天的任务"是模糊表述，无具体状态变化，不记录

---

## TC-2.6：讨论过程不应记录，仅记录结果

- **模块**: 事件过滤能力
- **能力**: 正确忽略
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[团队]: 我们需要决定下一季度的研发方向。
[成员A]: 我建议做 AI 语音助手。
[成员B]: 但那个赛道竞争太激烈了。
[成员A]: 我们可以做垂直领域，避开大厂。
[成员B]: 垂直领域市场太小。
[成员C]: 我觉得做智能家居控制中心更有前景。
[成员A]: 智能家居需要硬件团队，我们没有。
[成员B]: 那还是 AI 方向，但做图像识别。
[成员C]: 同意，图像识别我们有人才储备。
[团队]: 好，那就定 AI 图像识别方向。下周一前各小组提交详细方案。
```

### 预期输出

```json
[
  {
    "title": "确定下一季度研发方向为 AI 图像识别",
    "summary": "团队经讨论决定下一季度研发方向为 AI 图像识别，各小组需在周一前提交详细方案",
    "importance": 6,
    "participants": ["成员A", "成员B", "成员C"],
    "location": "",
    "tags": ["决策", "项目方向", "AI"]
  }
]
```

### 验证点
- ✅ 讨论过程（提议、反对、争辩）全被忽略
- ✅ 仅最终的决策结果被记录
- ✅ 截止时间要求被包含

---

# 模块三：时间线能力

## TC-3.1：顺序事件保持时间线

- **模块**: 时间线能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "进入古老图书馆",
    "summary": "用户进入古老图书馆",
    "importance": 4,
    "participants": ["用户"],
    "location": "古老图书馆",
    "tags": ["地点变化"]
  }
]
```

**recentMessages**:
```
[用户]: 我在图书馆找到了一本古书，封面写着《失落的咒语》。
[图书管理员]: 那本书已经失踪了两百年了！
[用户]: 我翻开书，里面掉出一张泛黄的地图。
[图书管理员]: 这张地图……标记的是禁林深处的某个地点！
[用户]: 我决定按照地图去禁林寻找真相。
[用户]: 我离开了图书馆，向禁林方向出发。
```

### 预期输出

```json
[
  {
    "title": "在图书馆发现《失落的咒语》及隐藏地图",
    "summary": "用户找到失踪两百年的古书《失落的咒语》，书中掉出标记禁林深处地点的泛黄地图",
    "importance": 7,
    "participants": ["用户"],
    "location": "古老图书馆",
    "tags": ["物品获得", "线索发现"]
  },
  {
    "title": "决定前往禁林寻找真相",
    "summary": "用户决定按照地图指示前往禁林深处寻找真相",
    "importance": 6,
    "participants": ["用户"],
    "location": "",
    "tags": ["计划", "探索"]
  },
  {
    "title": "离开图书馆前往禁林",
    "summary": "用户离开古老图书馆，向禁林方向出发",
    "importance": 4,
    "participants": ["用户"],
    "location": "禁林方向",
    "tags": ["地点变化"]
  }
]
```

### 验证点
- ✅ 事件按时间顺序输出
- ✅ 每个状态变化独立记录
- ✅ 离开地点被记录为独立事件

---

## TC-3.2：地点变化链

- **模块**: 时间线能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "从家中出发",
    "summary": "用户离开家",
    "importance": 3,
    "participants": ["用户"],
    "location": "家",
    "tags": ["地点变化"]
  }
]
```

**recentMessages**:
```
[用户]: 我先去了超市买了些食材。
[用户]: 然后乘地铁去了朋友家。
[用户]: 到达朋友家后，我们一起准备了晚餐。
[朋友]: 吃完饭后我们去附近的公园散步吧。
[用户]: 好啊，走吧。
```

### 预期输出

```json
[
  {
    "title": "在超市购买食材",
    "summary": "用户在超市购买食材",
    "importance": 2,
    "participants": ["用户"],
    "location": "超市",
    "tags": ["日常事务"]
  },
  {
    "title": "乘地铁到达朋友家",
    "summary": "用户乘地铁到达朋友家",
    "importance": 3,
    "participants": ["用户", "朋友"],
    "location": "朋友家",
    "tags": ["地点变化"]
  },
  {
    "title": "与朋友一起准备晚餐",
    "summary": "用户和朋友在朋友家一起准备晚餐",
    "importance": 3,
    "participants": ["用户", "朋友"],
    "location": "朋友家",
    "tags": ["日常事务"]
  },
  {
    "title": "与朋友前往公园散步",
    "summary": "用户和朋友决定饭后前往附近公园散步",
    "importance": 3,
    "participants": ["用户", "朋友"],
    "location": "公园",
    "tags": ["地点变化", "休闲"]
  }
]
```

### 验证点
- ✅ 每个地点变化都被记录
- ✅ 事件按时间顺序排列
- ✅ 日常事务保持低重要性评分

---

## TC-3.3：多阶段任务推进（不应错误合并）

- **模块**: 时间线能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "开始开发音乐系统",
    "summary": "开发者开始开发音乐播放系统",
    "importance": 5,
    "participants": ["开发者"],
    "location": "",
    "tags": ["项目推进", "开发"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "完成音乐系统登录模块",
    "summary": "开发者完成音乐播放系统的登录模块开发",
    "importance": 5,
    "participants": ["开发者"],
    "location": "",
    "tags": ["项目推进", "开发"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "开始开发音乐系统",
    "summary": "开发者开始开发音乐播放系统",
    "importance": 5,
    "participants": ["开发者"],
    "location": "",
    "tags": ["项目推进", "开发"]
  },
  {
    "title": "完成音乐系统登录模块",
    "summary": "开发者完成音乐播放系统的登录模块开发",
    "importance": 5,
    "participants": ["开发者"],
    "location": "",
    "tags": ["项目推进", "开发"]
  }
]
```

### 验证点
- ✅ 同一主线的不同阶段都保留
- ✅ 未被错误合并为一个事件
- ✅ 时间线连续性得到保持

---

## TC-3.4：冲突事件都保留（状态变化链）

- **模块**: 时间线能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "决定参加编程比赛",
    "summary": "用户决定参加下周的编程比赛",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["计划", "比赛"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "取消参加编程比赛",
    "summary": "用户因时间冲突取消参加编程比赛",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["计划取消", "比赛"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "决定参加编程比赛",
    "summary": "用户决定参加下周的编程比赛",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["计划", "比赛"]
  },
  {
    "title": "取消参加编程比赛",
    "summary": "用户因时间冲突取消参加编程比赛",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["计划取消", "比赛"]
  }
]
```

### 验证点
- ✅ 冲突事件两条都保留
- ✅ 取消事件被视为新的状态变化而非对旧事件的否定
- ✅ 时间线的完整性不被破坏

---

## TC-3.5：进入和离开都应保留

- **模块**: 时间线能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "进入图书馆",
    "summary": "用户进入图书馆查阅资料",
    "importance": 3,
    "participants": ["用户"],
    "location": "图书馆",
    "tags": ["地点变化"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "离开图书馆",
    "summary": "用户查阅完毕，离开图书馆",
    "importance": 3,
    "participants": ["用户"],
    "location": "图书馆",
    "tags": ["地点变化"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "进入图书馆",
    "summary": "用户进入图书馆查阅资料",
    "importance": 3,
    "participants": ["用户"],
    "location": "图书馆",
    "tags": ["地点变化"]
  },
  {
    "title": "离开图书馆",
    "summary": "用户查阅完毕，离开图书馆",
    "importance": 3,
    "participants": ["用户"],
    "location": "图书馆",
    "tags": ["地点变化"]
  }
]
```

### 验证点
- ✅ 进入和离开都保留
- ✅ 不会被错误合并
- ✅ 时间线变化完整

---

# 模块四：事实约束能力

## TC-4.1：不猜测未明确提及的地点

- **模块**: 事实约束能力
- **能力**: 正确约束
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我们到了，开始开会吧。
[同事A]: 好的，我先汇报一下上周的进展。
[同事B]: 我这边遇到了一些技术问题需要讨论。
[用户]: 好，问题记录下来，会后专项解决。
```

### 预期输出

```json
[
  {
    "title": "召开工作会议",
    "summary": "用户、同事A和同事B召开工作会议，同事A汇报进展，同事B提出技术问题，用户决定会后专项解决",
    "importance": 4,
    "participants": ["用户", "同事A", "同事B"],
    "location": "",
    "tags": ["会议", "工作"]
  }
]
```

### 验证点
- ✅ location 为空字符串（未明确提及会议地点）
- ✅ 不推断"办公室"或"会议室"
- ✅ 参与者和内容基于明确信息

---

## TC-4.2：不添加未明确出现的人物

- **模块**: 事实约束能力
- **能力**: 正确约束
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我找到了一封旧信，上面写着"亲爱的妹妹，我在北方前线一切安好"。
[用户]: 看来这封信的主人有一个在军队的哥哥。
[AI]: 这封信的年代看起来很久远了。
[用户]: 我要把这封信收好，也许以后有用。
```

### 预期输出

```json
[
  {
    "title": "发现一封来自北方前线的旧信并妥善保管",
    "summary": "用户发现一封旧信，信中内容为哥哥写给妹妹的报平安信，来自北方前线；用户将其收好",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["物品获得", "线索发现"]
  }
]
```

### 验证点
- ✅ 只记录实际参与的用户
- ✅ 信中的人物（哥哥、妹妹）不添加为 participants
- ✅ 信息内容在 summary 中描述但不混淆为参与者

---

## TC-4.3：不推断未确认的关系

- **模块**: 事实约束能力
- **能力**: 正确约束
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[角色A]: 你把文件放哪了？
[角色B]: 在桌子上。
[角色A]: 谢谢。
[角色B]: 不客气。
[角色A]: 对了，老板让我们明天早点到。
[角色B]: 知道了。
```

### 预期输出

```json
[
  {
    "title": "被告知明天提前上班",
    "summary": "角色A告知角色B老板要求明天提前到达",
    "importance": 2,
    "participants": ["角色A", "角色B"],
    "location": "",
    "tags": ["通知", "工作"]
  }
]
```

### 验证点
- ✅ 不推断角色A与角色B的关系（同事/朋友/上下级）
- ✅ 不将"老板"添加为 participant（未在对话中出现）
- ✅ 简单事务（放文件、道谢）不被记录

---

## TC-4.4：merge 时不创造不存在的事件

- **模块**: 事实约束能力
- **能力**: 正确约束
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "开始学习前端开发",
    "summary": "用户开始学习前端开发",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "完成 HTML 基础学习",
    "summary": "用户完成 HTML 基础知识的学习",
    "importance": 3,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "进度"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "开始学习前端开发",
    "summary": "用户开始学习前端开发",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  },
  {
    "title": "完成 HTML 基础学习",
    "summary": "用户完成 HTML 基础知识的学习",
    "importance": 3,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "进度"]
  }
]
```

### 验证点
- ✅ 不创造额外事件
- ✅ 不补充"用户接下来学了 CSS"之类的推测
- ✅ 不修改原有事件

---

## TC-4.5：不补充未出现的信息

- **模块**: 事实约束能力
- **能力**: 正确约束
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我收到了一个包裹。
[用户]: 不知道是谁寄来的。
[AI]: 包裹上有什么标记吗？
[用户]: 没有，只有一个地址。
```

### 预期输出

```json
[
  {
    "title": "收到来源不明的包裹",
    "summary": "用户收到一个来源不明的包裹，仅有一个地址标记",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["物品获得"]
  }
]
```

### 验证点
- ✅ 不推测包裹内容
- ✅ 不推测寄件人
- ✅ 仅记录明确信息（有地址、来源不明）

---

# 模块五：事件压缩能力（正确压缩）

## TC-5.1：相关提议-接受-商量应合并为结果

- **模块**: 事件压缩能力
- **能力**: 正确压缩
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[同学A]: 下课一起去吃饭吧？
[同学B]: 好啊好啊。
[同学A]: 去哪吃？
[同学B]: 去食堂二楼的新窗口吧，听说不错。
[同学A]: 可以，那下课铃响后在教室门口等。
[同学B]: 没问题。
```

### 预期输出

```json
[
  {
    "title": "约定下课后去食堂二楼新窗口吃饭",
    "summary": "同学A和同学B约定下课后在教室门口集合，前往食堂二楼新窗口吃饭",
    "importance": 3,
    "participants": ["同学A", "同学B"],
    "location": "教室门口",
    "tags": ["计划", "日常事务"]
  }
]
```

### 验证点
- ✅ 提议、接受、商量地点三步被合并为一个事件
- ✅ 合并后信息完整（时间、地点、人物、内容）
- ✅ 重要性评分为日常事务（1-3）

---

## TC-5.2：谈判过程压缩为协议结果

- **模块**: 事件压缩能力
- **能力**: 正确压缩
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[商人A]: 这批货我要价500金币。
[商人B]: 太贵了，最多300。
[商人A]: 400，不能再少了。
[商人B]: 350，现在就成交。
[商人A]: 375，这是我的底线。
[商人B]: 好，375成交。明天交货。
[商人A]: 一言为定。
```

### 预期输出

```json
[
  {
    "title": "以375金币达成交易协议",
    "summary": "商人A与商人B就以375金币交易货物达成协议，约定明天交货",
    "importance": 5,
    "participants": ["商人A", "商人B"],
    "location": "",
    "tags": ["交易", "协议"]
  }
]
```

### 验证点
- ✅ 讨价还价全过程被压缩为最终成交事件
- ✅ 最终价格和交货时间被记录
- ✅ 中间报价过程不保留

---

## TC-5.3：不应过度压缩不同结果的事件

- **模块**: 事件压缩能力
- **能力**: 正确压缩
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[冒险者]: 我击败了守门的石像鬼，进入了遗迹内部。
[冒险者]: 遗迹大厅里有一个古老的祭坛，上面放着一颗蓝色的宝石。
[冒险者]: 我拿起了宝石，突然整个遗迹开始震动！
[冒险者]: 我赶紧跑出了遗迹，遗迹在我身后坍塌了。
```

### 预期输出

```json
[
  {
    "title": "击败石像鬼进入遗迹",
    "summary": "冒险者击败守门石像鬼，进入遗迹内部",
    "importance": 5,
    "participants": ["冒险者"],
    "location": "遗迹内部",
    "tags": ["战斗", "地点变化"]
  },
  {
    "title": "从遗迹祭坛获得蓝色宝石",
    "summary": "冒险者在遗迹大厅的古老祭坛上发现并拿起蓝色宝石",
    "importance": 6,
    "participants": ["冒险者"],
    "location": "遗迹大厅",
    "tags": ["物品获得"]
  },
  {
    "title": "遗迹坍塌，冒险者逃脱",
    "summary": "冒险者拿起宝石触发遗迹坍塌，冒险者成功逃出，遗迹被摧毁",
    "importance": 7,
    "participants": ["冒险者"],
    "location": "遗迹",
    "tags": ["危险", "逃脱", "地点摧毁"]
  }
]
```

### 验证点
- ✅ 不同性质的状态变化分开记录
- ✅ 不将所有内容压缩为"探索遗迹"一个事件
- ✅ 每个事件有独立的重要性评分

---

## TC-5.4：合并同类连续动作

- **模块**: 事件压缩能力
- **能力**: 正确压缩
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[厨师]: 我先洗了菜。
[厨师]: 然后切了肉。
[厨师]: 热了锅，倒了油。
[厨师]: 把肉下锅炒到变色。
[厨师]: 加入蔬菜翻炒。
[厨师]: 最后加入调料，一盘青椒肉丝就做好了。
```

### 预期输出

```json
[
  {
    "title": "完成青椒肉丝的烹饪",
    "summary": "厨师经过洗菜、切肉、翻炒、调味等步骤，完成了青椒肉丝的制作",
    "importance": 2,
    "participants": ["厨师"],
    "location": "",
    "tags": ["日常事务", "烹饪"]
  }
]
```

### 验证点
- ✅ 连续烹饪动作合并为一个完成事件
- ✅ 过程细节在 summary 中简要提及
- ✅ 不拆分为洗菜、切肉、炒菜等多个事件

---

# 模块六：去重能力（merge-event）

## TC-6.1：信息完整度不同 — 保留更完整版本

- **模块**: 去重能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "开始学习Vue",
    "summary": "用户开始学习Vue",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "用户开始学习Vue",
    "summary": "用户开始学习Vue",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "用户开始学习Vue",
    "summary": "用户开始学习Vue",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  }
]
```

### 验证点
- ✅ 同一事件保留信息更完整的一条
- ✅ 不重复保留两条
- ✅ 删除信息较少的版本

---

## TC-6.2：相同结果不同表述 — 保留信息更全者

- **模块**: 去重能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "决定周末去露营",
    "summary": "决定周末去露营",
    "importance": 4,
    "participants": ["用户", "朋友"],
    "location": "",
    "tags": ["计划"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "双方约定周末露营",
    "summary": "用户和朋友双方约定周末去郊野公园露营，准备帐篷和食物",
    "importance": 4,
    "participants": ["用户", "朋友"],
    "location": "郊野公园",
    "tags": ["计划", "户外活动"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "双方约定周末露营",
    "summary": "用户和朋友双方约定周末去郊野公园露营，准备帐篷和食物",
    "importance": 4,
    "participants": ["用户", "朋友"],
    "location": "郊野公园",
    "tags": ["计划", "户外活动"]
  }
]
```

### 验证点
- ✅ 相同结果保留信息更完整的版本
- ✅ location 和准备事项被保留
- ✅ 旧版本被替换

---

## TC-6.3：同一主线不同阶段 — 都保留

- **模块**: 去重能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "开始学习Vue",
    "summary": "用户开始学习Vue前端框架",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  },
  {
    "title": "完成Vue基础课程",
    "summary": "用户完成Vue基础课程的学习",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "里程碑"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "开发第一个Vue项目",
    "summary": "用户开始开发第一个Vue实战项目",
    "importance": 6,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "项目实践"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "开始学习Vue",
    "summary": "用户开始学习Vue前端框架",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  },
  {
    "title": "完成Vue基础课程",
    "summary": "用户完成Vue基础课程的学习",
    "importance": 5,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "里程碑"]
  },
  {
    "title": "开发第一个Vue项目",
    "summary": "用户开始开发第一个Vue实战项目",
    "importance": 6,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "项目实践"]
  }
]
```

### 验证点
- ✅ 三个不同阶段的事件全部保留
- ✅ 未被错误合并为"用户学习Vue"
- ✅ 各阶段重要性逐渐提升体现进度

---

## TC-6.4：新事件是旧事件的更完整版本 — 升级替换

- **模块**: 去重能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "开始学习前端",
    "summary": "用户开始学习前端",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "开始学习Vue前端开发",
    "summary": "用户开始系统学习Vue前端框架开发",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "Vue"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "开始学习Vue前端开发",
    "summary": "用户开始系统学习Vue前端框架开发",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["学习", "Vue"]
  }
]
```

### 验证点
- ✅ 旧事件被更完整的新版本替换
- ✅ 不保留两条（"开始学习前端"和"开始学习Vue前端开发"）
- ✅ 升级而非重复

---

## TC-6.5：完全不相关的不同事件 — 都保留

- **模块**: 去重能力
- **能力**: 正确记录
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "进入咖啡店",
    "summary": "用户进入市中心咖啡店",
    "importance": 3,
    "participants": ["用户"],
    "location": "咖啡店",
    "tags": ["地点变化"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "接到紧急工作电话",
    "summary": "用户在咖啡店接到紧急工作电话，需要立即处理线上故障",
    "importance": 6,
    "participants": ["用户"],
    "location": "咖啡店",
    "tags": ["工作", "紧急"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "进入咖啡店",
    "summary": "用户进入市中心咖啡店",
    "importance": 3,
    "participants": ["用户"],
    "location": "咖啡店",
    "tags": ["地点变化"]
  },
  {
    "title": "接到紧急工作电话",
    "summary": "用户在咖啡店接到紧急工作电话，需要立即处理线上故障",
    "importance": 6,
    "participants": ["用户"],
    "location": "咖啡店",
    "tags": ["工作", "紧急"]
  }
]
```

### 验证点
- ✅ 两个不相关的事件都保留
- ✅ 不因同一地点而错误合并
- ✅ 各自的重要性独立

---

# 模块七：重要性评分能力

## TC-7.1：日常事务（1-3 分）

- **模块**: 重要性评分能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 早上起床后我刷了牙洗了脸。
[用户]: 然后做了早餐，吃了面包和牛奶。
[用户]: 出门前检查了一下门窗有没有关好。
```

### 预期输出

```json
[
  {
    "title": "完成早晨日常起居",
    "summary": "用户早上完成洗漱、早餐（面包和牛奶）及出门前检查门窗",
    "importance": 1,
    "participants": ["用户"],
    "location": "",
    "tags": ["日常事务"]
  }
]
```

### 验证点
- ✅ 日常事务重要性评分为 1-3
- ✅ 多个日常动作可合并
- ✅ tags 包含"日常事务"

---

## TC-7.2：值得注意（4-6 分）

- **模块**: 重要性评分能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[学生]: 期中考试成绩出来了，我数学考了全班第三。
[朋友]: 哇，进步好大啊！上次你还在第十名。
[学生]: 是啊，这段时间的努力没白费。
```

### 预期输出

```json
[
  {
    "title": "期中考试数学成绩进步至全班第三",
    "summary": "学生期中考试数学成绩从全班第十名进步至第三名",
    "importance": 4,
    "participants": ["学生"],
    "location": "",
    "tags": ["成绩", "进步"]
  }
]
```

### 验证点
- ✅ 值得注意的事件评分为 4-6
- ✅ 成绩进步是 notable 事件而非日常事务
- ✅ 朋友称赞不被独立记录

---

## TC-7.3：重大事件（7-8 分）

- **模块**: 重要性评分能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[主角]: 我终于找到了！这就是传说中的失落之城——亚特兰蒂斯！
[同伴]: 难以置信，我们花了三年时间，终于找到了。
[主角]: 这座城市的发现将改变人类对古代文明的认知。
[同伴]: 我们需要立刻联系考古协会，这将是本世纪最重要的考古发现。
```

### 预期输出

```json
[
  {
    "title": "发现传说中的失落之城亚特兰蒂斯",
    "summary": "主角和同伴历经三年探索，最终发现了传说中的失落之城亚特兰蒂斯，预计将改变人类对古代文明的认知",
    "importance": 8,
    "participants": ["主角", "同伴"],
    "location": "亚特兰蒂斯",
    "tags": ["重大发现", "考古", "里程碑"]
  }
]
```

### 验证点
- ✅ 重大发现评分为 7-8
- ✅ 三年努力的背景被包含
- ✅ 对未来影响被描述

---

## TC-7.4：故事定义级（9-10 分）

- **模块**: 重要性评分能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[英雄]: 我决定了，我要继承父亲遗志，成为守护这座城市的英雄。
[导师]: 这将是危险的道路，你可能会失去一切。
[英雄]: 我知道，但如果我不站出来，就没人能保护大家了。
[导师]: 那从今天起，我将把所有绝技传授给你。这就是命运的转折点。
[英雄]: 我接受。无论前路多么艰难，我绝不退缩。
```

### 预期输出

```json
[
  {
    "title": "英雄决定继承父志成为城市守护者",
    "summary": "英雄在导师见证下决定继承父亲遗志，成为守护城市的英雄，导师决定传授全部绝技，标志着命运的转折点",
    "importance": 9,
    "participants": ["英雄", "导师"],
    "location": "",
    "tags": ["命运转折", "角色觉醒", "故事定义级"]
  }
]
```

### 验证点
- ✅ 故事定义级事件评分为 9-10
- ✅ 命运转折点被最高等级标记
- ✅ 后续故事走向被此事件定义

---

## TC-7.5：重要性随上下文变化

- **模块**: 重要性评分能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "被任命为调查组组长",
    "summary": "用户被任命为连环案件特别调查组组长",
    "importance": 8,
    "participants": ["用户"],
    "location": "",
    "tags": ["职务变化"]
  }
]
```

**recentMessages**:
```
[助手]: 组长，刚收到一个线人消息，说在码头仓库有可疑活动。
[用户]: 知道了，立刻派人去查看。
[助手]: 是，我马上安排。
[用户]: 另外，把之前的案件卷宗再梳理一遍，看看有没有遗漏的线索。
```

### 预期输出

```json
[
  {
    "title": "收到码头仓库可疑活动线报",
    "summary": "调查组收到线人消息称码头仓库有可疑活动，组长下令派人查看",
    "importance": 5,
    "participants": ["用户", "助手"],
    "location": "码头仓库",
    "tags": ["线索", "调查"]
  },
  {
    "title": "下令梳理案件卷宗",
    "summary": "组长要求重新梳理案件卷宗以排查遗漏线索",
    "importance": 4,
    "participants": ["用户"],
    "location": "",
    "tags": ["调查推进"]
  }
]
```

### 验证点
- ✅ 同一对话中不同事件有不同重要性评分
- ✅ 与已有高分事件相比，日常调查任务评分适中
- ✅ 评分不是固定值而是基于事件本身

---

# 模块八：输出格式能力

## TC-8.1：仅返回 JSON 数组，无 Markdown 包裹

- **模块**: 输出格式能力
- **能力**: 正确输出
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我今天买了一本新书，《百年孤独》。
```

### 预期输出

```json
[
  {
    "title": "购买《百年孤独》",
    "summary": "用户购买了一本《百年孤独》",
    "importance": 2,
    "participants": ["用户"],
    "location": "",
    "tags": ["物品获得", "阅读"]
  }
]
```

### 验证点
- ✅ 输出为纯 JSON 数组
- ✅ 无 ```json 包裹
- ✅ 无 Markdown 解释文字
- ✅ 无额外说明

---

## TC-8.2：所有必填字段存在且类型正确

- **模块**: 输出格式能力
- **能力**: 正确输出
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我搬到新公寓了。
```

### 预期输出中每个事件对象必须包含的字段

| 字段 | 类型 | 可为空 |
|------|------|--------|
| `title` | string | 否 |
| `summary` | string | 否 |
| `importance` | number (1-10) | 否 |
| `participants` | array of strings | 是（可为空数组） |
| `location` | string | 是（可为空字符串） |
| `tags` | array of strings | 是（可为空数组） |

### 验证点
- ✅ 所有 6 个字段存在
- ✅ title 和 summary 非空
- ✅ importance 为 1-10 之间的整数
- ✅ participants 为字符串数组
- ✅ location 为字符串
- ✅ tags 为字符串数组

---

## TC-8.3：无事件时返回空数组

- **模块**: 输出格式能力
- **能力**: 正确输出
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 你好啊。
[AI]: 你好！
[用户]: 哈哈哈。
[AI]: 有什么好笑的？
[用户]: 没什么，随便笑笑。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 无实质事件时返回空数组 `[]`
- ✅ 不返回 null 或 undefined
- ✅ 不返回包含空对象的数组

---

## TC-8.4：merge 输出完整数组（包含所有事件）

- **模块**: 输出格式能力
- **能力**: 正确输出
- **Prompt**: merge-event

### 输入

**existingEvents**:
```json
[
  {
    "title": "到达火车站",
    "summary": "用户到达火车站",
    "importance": 3,
    "participants": ["用户"],
    "location": "火车站",
    "tags": ["地点变化"]
  }
]
```

**newEvents**:
```json
[
  {
    "title": "购买前往北京的火车票",
    "summary": "用户在火车站购买前往北京的火车票",
    "importance": 4,
    "participants": ["用户"],
    "location": "火车站",
    "tags": ["出行", "购票"]
  }
]
```

### 预期输出

```json
[
  {
    "title": "到达火车站",
    "summary": "用户到达火车站",
    "importance": 3,
    "participants": ["用户"],
    "location": "火车站",
    "tags": ["地点变化"]
  },
  {
    "title": "购买前往北京的火车票",
    "summary": "用户在火车站购买前往北京的火车票",
    "importance": 4,
    "participants": ["用户"],
    "location": "火车站",
    "tags": ["出行", "购票"]
  }
]
```

### 验证点
- ✅ 输出包含所有 existing + new 事件（无重复前提下）
- ✅ 格式与输入一致
- ✅ 纯 JSON 无额外内容

---

# 模块九：边界条件能力

## TC-9.1：空输入 — 无 existingEvents 无有意义消息

- **模块**: 边界条件能力
- **能力**: 正确约束
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
（无新消息）
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 空输入返回空数组
- ✅ 不崩溃不报错

---

## TC-9.2：混合语言的消息

- **模块**: 边界条件能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[User]: I finally finished my thesis!
[导师]: 恭喜！Congratulations! 这是你多年努力的成果。
[User]: 谢谢老师。接下来我打算申请MIT的博士后position。
[导师]: 我会帮你写recommendation letter。下周一之前给你。
[User]: Thank you so much! 我会准备好其他申请材料。
```

### 预期输出

```json
[
  {
    "title": "完成论文",
    "summary": "用户完成论文（thesis）",
    "importance": 7,
    "participants": ["用户"],
    "location": "",
    "tags": ["学术", "里程碑"]
  },
  {
    "title": "决定申请MIT博士后",
    "summary": "用户计划申请MIT博士后职位",
    "importance": 7,
    "participants": ["用户"],
    "location": "",
    "tags": ["学术", "计划"]
  },
  {
    "title": "导师同意撰写推荐信",
    "summary": "导师同意为用户撰写MIT博士后申请的推荐信，承诺周一前完成",
    "importance": 5,
    "participants": ["用户", "导师"],
    "location": "",
    "tags": ["学术", "推荐"]
  }
]
```

### 验证点
- ✅ 中英混合消息被正确处理
- ✅ 关键信息不因语言混用而遗漏
- ✅ 输出语言与对话一致（中文为主）

---

## TC-9.3：大量 existingEvents 时的处理

- **模块**: 边界条件能力
- **能力**: 正确记录
- **Prompt**: extract-event

### 输入

**existingEvents**: （25 条已有事件）

```json
[
  {"title": "事件1", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件2", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件3", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件4", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件5", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件6", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件7", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件8", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件9", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件10", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件11", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件12", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件13", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件14", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件15", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件16", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件17", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件18", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件19", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件20", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件21", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件22", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件23", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件24", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []},
  {"title": "事件25", "summary": "...", "importance": 3, "participants": ["用户"], "location": "", "tags": []}
]
```

**recentMessages**:
```
[用户]: 我决定了，从今天开始我要写一本小说。
[用户]: 题材是科幻冒险。
```

### 预期输出

```json
[
  {
    "title": "决定开始写科幻冒险小说",
    "summary": "用户决定从今天开始写一本科幻冒险题材的小说",
    "importance": 6,
    "participants": ["用户"],
    "location": "",
    "tags": ["创作", "计划"]
  }
]
```

### 验证点
- ✅ 大量已有事件不影响新事件提取
- ✅ 不会将已有事件的内容混入新事件
- ✅ 输出仅包含新事件

---

## TC-9.4：消息中包含特殊字符

- **模块**: 边界条件能力
- **能力**: 正确输出
- **Prompt**: extract-event

### 输入

**existingEvents**: `[]`

**recentMessages**:
```
[用户]: 我在代码里发现了一个严重的 bug：`rm -rf / --no-preserve-root` 被写进了清理脚本！
[开发]: 这是安全漏洞！我们需要立即修复。
[用户]: 已经修复了，改成了 `rm -rf "${TEMP_DIR}"/*`，并加了路径检查。
[开发]: CVE编号申请了吗？这个需要上报。
[用户]: 已经申请了，编号是 CVE-2024-12345。
```

### 预期输出

```json
[
  {
    "title": "发现并修复严重安全漏洞 CVE-2024-12345",
    "summary": "用户在清理脚本中发现危险命令 rm -rf / 的安全漏洞并已完成修复，申请了漏洞编号 CVE-2024-12345",
    "importance": 8,
    "participants": ["用户", "开发"],
    "location": "",
    "tags": ["安全", "漏洞修复", "CVE"]
  }
]
```

### 验证点
- ✅ 特殊字符（反引号、路径、CVE 编号）不影响解析
- ✅ 技术内容被正确理解和记录
- ✅ JSON 输出合法

---

# 模块十：长期运行能力

## TC-10.1：多轮提取保持一致性

- **模块**: 长期运行能力
- **能力**: 正确记录
- **Prompt**: extract-event（模拟第 3 轮提取）

### 输入

**existingEvents**:
```json
[
  {
    "title": "到达精灵森林入口",
    "summary": "冒险小队到达精灵森林入口",
    "importance": 4,
    "participants": ["战士", "法师", "游侠"],
    "location": "精灵森林入口",
    "tags": ["地点变化"]
  },
  {
    "title": "与精灵守卫交涉获得通行许可",
    "summary": "冒险小队与精灵守卫交涉后获得进入森林的许可",
    "importance": 5,
    "participants": ["战士", "法师", "精灵守卫"],
    "location": "精灵森林入口",
    "tags": ["交涉", "许可"]
  },
  {
    "title": "进入精灵森林",
    "summary": "冒险小队进入精灵森林内部",
    "importance": 4,
    "participants": ["战士", "法师", "游侠"],
    "location": "精灵森林",
    "tags": ["地点变化"]
  },
  {
    "title": "发现古老精灵遗迹",
    "summary": "冒险小队在森林深处发现古老精灵遗迹",
    "importance": 5,
    "participants": ["战士", "法师", "游侠"],
    "location": "精灵森林深处",
    "tags": ["发现", "探索"]
  },
  {
    "title": "游侠在遗迹中触发陷阱受轻伤",
    "summary": "游侠在探索遗迹时触发古老陷阱，受轻伤",
    "importance": 4,
    "participants": ["游侠"],
    "location": "精灵遗迹",
    "tags": ["陷阱", "受伤"]
  }
]
```

**recentMessages**:
```
[法师]: 我在遗迹的石碑上解读出了一些古代文字……这上面记载着一个关于森林之心的传说。
[战士]: 森林之心是什么？
[法师]: 据说是维系整个精灵森林生命力的神器。但碑文说它在千年前的大战中碎裂成了三块。
[游侠]: 三块碎片？这听起来像是一个任务。
[法师]: 没错，碑文还标记了其中一块碎片的位置——在北方的暗影沼泽。
[战士]: 那我们还等什么？目标暗影沼泽，出发！
[游侠]: 等等，我的伤包扎好了。现在可以走了。
[法师]: 好，我制作了一张简单的路线图，可以减少迷路的风险。
```

### 预期输出

```json
[
  {
    "title": "解读碑文获知森林之心传说",
    "summary": "法师解读遗迹石碑上的古代文字，获知精灵森林之心神器的传说及其碎裂为三块碎片的历史",
    "importance": 7,
    "participants": ["法师"],
    "location": "精灵遗迹",
    "tags": ["信息揭示", "传说", "森林之心"]
  },
  {
    "title": "决定前往暗影沼泽寻找第一块碎片",
    "summary": "冒险小队根据碑文线索决定前往北方暗影沼泽寻找森林之心的第一块碎片",
    "importance": 6,
    "participants": ["战士", "法师", "游侠"],
    "location": "",
    "tags": ["计划", "任务", "暗影沼泽"]
  },
  {
    "title": "游侠伤势处理完毕",
    "summary": "游侠在精灵遗迹中的陷阱伤势已处理完毕，恢复行动能力",
    "importance": 3,
    "participants": ["游侠"],
    "location": "精灵遗迹",
    "tags": ["恢复", "状态变化"]
  },
  {
    "title": "法师制作前往暗影沼泽的路线图",
    "summary": "法师制作了前往暗影沼泽的路线图以减少迷路风险",
    "importance": 4,
    "participants": ["法师"],
    "location": "",
    "tags": ["准备", "物品获得"]
  }
]
```

### 验证点
- ✅ 与已有事件时间线一致（不重复记录已有的进入森林等）
- ✅ 新事件正确引用已有事件上下文（遗迹、伤势）
- ✅ 重要性评分与事件在故事中的位置匹配
- ✅ 信息揭示（传说）与行动计划分开记录

---

## TC-10.2：长期运行中不产生重复事件

- **模块**: 长期运行能力
- **能力**: 正确约束
- **Prompt**: extract-event（模拟运行多轮后对含重复信息的对话的提取）

### 输入

**existingEvents**:
```json
[
  {
    "title": "约定周末去海边",
    "summary": "小明和小红约定周末去海边度假",
    "importance": 4,
    "participants": ["小明", "小红"],
    "location": "海边",
    "tags": ["计划", "旅行"]
  },
  {
    "title": "购买海滩用品",
    "summary": "小明购买海滩度假所需用品（泳衣、防晒霜）",
    "importance": 2,
    "participants": ["小明"],
    "location": "",
    "tags": ["准备", "购物"]
  },
  {
    "title": "确认酒店预订",
    "summary": "小红确认了海边酒店的预订",
    "importance": 3,
    "participants": ["小红"],
    "location": "",
    "tags": ["准备", "预订"]
  },
  {
    "title": "出发前往海边",
    "summary": "小明和小红出发前往海边度假",
    "importance": 4,
    "participants": ["小明", "小红"],
    "location": "海边方向",
    "tags": ["地点变化", "旅行"]
  }
]
```

**recentMessages**:
```
[小红]: 我们已经出发了对吧？
[小明]: 对，已经在路上了。酒店订好了吧？
[小红]: 订好了，之前就确认过的。海滩用品我也带了。
[小明]: 太好了，就等着到海边好好玩了。
[小红]: 别忘了我们约的是周末哦。
[小明]: 当然记得，现在就是周末呀。
```

### 预期输出

```json
[]
```

### 验证点
- ✅ 对已有事件的回顾不产生新事件
- ✅ 确认已发生事件不重复记录
- ✅ 闲聊内容被正确忽略
- ✅ 长期运行中时间线不产生冗余

---

## 附录 A：五大核心能力覆盖矩阵

| 核心能力 | TC-1.x | TC-2.x | TC-3.x | TC-4.x | TC-5.x | TC-6.x | TC-7.x | TC-8.x | TC-9.x | TC-10.x |
|---------|--------|--------|--------|--------|--------|--------|--------|--------|--------|---------|
| 正确记录 | ✅ 全部 | - | ✅ 全部 | - | - | ✅ 全部 | ✅ 全部 | - | ✅ 9.2 | ✅ 全部 |
| 正确忽略 | - | ✅ 全部 | - | - | - | - | - | - | - | ✅ 10.2 |
| 正确压缩 | - | - | - | - | ✅ 全部 | - | - | - | - | - |
| 正确约束 | - | - | - | ✅ 全部 | - | - | - | - | ✅ 9.1, 9.3 | ✅ 10.2 |
| 正确输出 | - | - | - | - | - | - | - | ✅ 全部 | ✅ 9.4 | - |

## 附录 B：十模块覆盖矩阵

| 模块 | Prompt | 测试用例 |
|------|--------|---------|
| 1. 事件识别能力 | extract-event | TC-1.1 ~ TC-1.8 |
| 2. 事件过滤能力 | extract-event | TC-2.1 ~ TC-2.6 |
| 3. 时间线能力 | extract + merge | TC-3.1 ~ TC-3.5 |
| 4. 事实约束能力 | extract + merge | TC-4.1 ~ TC-4.5 |
| 5. 事件压缩能力 | extract-event | TC-5.1 ~ TC-5.4 |
| 6. 去重能力 | merge-event | TC-6.1 ~ TC-6.5 |
| 7. 重要性评分能力 | extract-event | TC-7.1 ~ TC-7.5 |
| 8. 输出格式能力 | extract + merge | TC-8.1 ~ TC-8.4 |
| 9. 边界条件能力 | extract + merge | TC-9.1 ~ TC-9.4 |
| 10. 长期运行能力 | extract-event | TC-10.1 ~ TC-10.2 |

## 附录 C：统计摘要

| 指标 | 数值 |
|------|------|
| 总测试用例数 | 48 |
| extract-event 用例 | 37 |
| merge-event 用例 | 11 |
| 覆盖核心能力 | 5 / 5 ✅ |
| 覆盖测试模块 | 10 / 10 ✅ |
| valid JSON 预期输出 | 100% |
