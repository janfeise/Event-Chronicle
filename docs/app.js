// ============================================================================
// Event Chronicle Web Demo — 前端逻辑
// 零外部依赖，原生 JavaScript
// ============================================================================

// ===========================================================================
// 1. 常量与 Mock 数据
// ===========================================================================

const BACKEND_URL = "http://localhost:3456";

const MOCK_MESSAGES = [
  {
    id: "m1",
    role: "user",
    content: "你好！最近我养了一只小橘猫，取名叫奶糖，特别粘人。",
    time: "09:31",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "哇，奶糖这名字好可爱！小橘猫确实很亲人。它多大了？有什么特别有趣的习惯吗？",
    time: "09:32",
  },
  {
    id: "m3",
    role: "user",
    content: "它才三个月大，精力旺盛得很，每天在家里到处跑酷。",
    time: "09:34",
  },
  {
    id: "m4",
    role: "assistant",
    content:
      "三个月正是活泼好动的时候呢。这个阶段的小猫对什么都好奇，也是最容易建立信任的时期。对了，带它去检查过了吗？",
    time: "09:35",
  },
  {
    id: "m5",
    role: "user",
    content: "昨天带它去体检了，医生说一切正常，我总算放心了。",
    time: "09:37",
  },
  {
    id: "m6",
    role: "assistant",
    content:
      "那太好了！体检正常是最让人安心的事情。小猫的健康基础打好了，以后也会少很多麻烦。",
    time: "09:38",
  },
  {
    id: "m7",
    role: "user",
    content: "对了，关于小猫的营养方面，你有什么建议吗？我怕自己喂得不对。",
    time: "09:40",
  },
  {
    id: "m8",
    role: "assistant",
    content:
      "当然可以！三个月的小猫正是长身体的关键期。建议选择高蛋白的幼猫粮，每天分3-4次喂食。可以适当添加湿粮保证水分摄入，但暂时不要喂太多零食，以免挑食。",
    time: "09:41",
  },
];

const MOCK_EVENTS = [
  {
    id: "e1",
    title: "养了一只橘猫",
    description: "用户最近养了一只橘猫，名叫奶糖，特别粘人。",
    tag: "宠物",
    time: "昨天",
  },
  {
    id: "e2",
    title: "橘猫奶糖三个月大",
    description: "这只名为奶糖的橘猫三个月大，精力旺盛，喜欢在家里跑酷。",
    tag: "宠物",
    time: "09:34",
  },
  {
    id: "e3",
    title: "带奶糖去做体检",
    description: "用户昨天带奶糖去做了体检。",
    tag: "健康",
    time: "昨天",
  },
  {
    id: "e4",
    title: "体检结果正常",
    description: "奶糖的体检结果显示一切正常，用户对此感到放心。",
    tag: "健康",
    time: "昨天",
  },
  {
    id: "e5",
    title: "用户对奶糖感到放心",
    description: "在得知体检结果正常后，用户对奶糖的健康状况感到十分放心。",
    tag: "情感",
    time: "09:37",
  },
  {
    id: "e6",
    title: "关注小猫营养问题",
    description: "用户就三个月大小猫的营养问题向AI寻求建议。",
    tag: "建议",
    time: "09:40",
  },
];

const SANDBOX_KEYWORDS = [
  {
    keywords: [
      "体检",
      "健康",
      "医院",
      "生病",
      "医生",
      "看病",
      "不舒服",
      "症状",
      "药",
    ],
    tag: "健康",
  },
  {
    keywords: ["猫", "狗", "宠物", "养", "动物", "猫咪", "名字", "鱼"],
    tag: "宠物",
  },
  {
    keywords: ["开心", "难过", "担心", "放心", "焦虑", "幸福", "感动", "情绪"],
    tag: "情感",
  },
  {
    keywords: [
      "建议",
      "推荐",
      "怎么办",
      "如何",
      "怎么",
      "方法",
      "营养",
      "饮食",
    ],
    tag: "建议",
  },
  {
    keywords: [
      "今天",
      "昨天",
      "早上",
      "下午",
      "晚上",
      "起床",
      "吃饭",
      "工作",
      "出门",
      "回家",
    ],
    tag: "日常",
  },
];

// ===========================================================================
// 2. 状态
// ===========================================================================

const state = {
  messages: [...MOCK_MESSAGES],
  events: [...MOCK_EVENTS],
  isLoading: false,
  backendOk: false,
  backendConfigured: false,
  backendProvider: "",
  backendModel: "",
  errorMessage: "",
};

// ===========================================================================
// 3. DOM 引用
// ===========================================================================

const dom = {};

function cacheDom() {
  dom.statusDot = document.getElementById("status-dot");
  dom.statusText = document.getElementById("status-text");
  dom.devHint = document.getElementById("dev-hint");
  dom.messagesBox = document.getElementById("messages-box");
  dom.loadingArea = document.getElementById("loading-area");
  dom.loadingText = document.getElementById("loading-text");
  dom.errorArea = document.getElementById("error-area");
  dom.errorText = document.getElementById("error-text");
  dom.messageInput = document.getElementById("message-input");
  dom.btnSend = document.getElementById("btn-send");
  dom.composer = document.getElementById("composer");
  dom.eventCountBadge = document.getElementById("event-count-badge");
  dom.timelineCards = document.getElementById("timeline-cards");
  dom.emptyState = document.getElementById("empty-state");
  dom.settingsOverlay = document.getElementById("settings-overlay");
  dom.settingsApiKey = document.getElementById("settings-api-key");
  dom.settingsBaseUrl = document.getElementById("settings-base-url");
  dom.settingsModel = document.getElementById("settings-model");
  dom.timelineAxisWrap = document.getElementById("timeline-axis-wrap");
  dom.connectOverlay = document.getElementById("connect-overlay");
  dom.btnCopyAll = document.getElementById("btn-copy-all");
}

// ===========================================================================
// 4. 渲染函数
// ===========================================================================

function now() {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

function genId() {
  return "id_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMessages() {
  let html = "";
  for (const m of state.messages) {
    const label = m.role === "user" ? "你" : "AI 助手";
    html += '<div class="msg-row ' + m.role + '">';
    html += '<span class="msg-label">' + esc(label) + "</span>";
    html += '<div class="msg-bubble">' + esc(m.content) + "</div>";
    html += '<span class="msg-time">' + esc(m.time) + "</span>";
    html += "</div>";
  }
  dom.messagesBox.innerHTML = html;
  dom.messagesBox.scrollTop = dom.messagesBox.scrollHeight;
}

function renderTimeline() {
  const hasEvents = state.events.length > 0;
  dom.emptyState.classList.toggle("hidden", hasEvents);
  dom.timelineAxisWrap.classList.toggle("hidden", !hasEvents);
  dom.eventCountBadge.textContent = state.events.length + " 个事件";

  let html = "";
  for (const evt of state.events) {
    html += '<div class="evt-card">';
    html += '<div class="evt-card-top">';
    html += '<span class="evt-card-title">' + esc(evt.title) + "</span>";
    html += '<span class="evt-card-time">' + esc(evt.time) + "</span>";
    html += "</div>";
    html += '<div class="evt-card-desc">' + esc(evt.description) + "</div>";
    html +=
      '<span class="evt-card-tag tag-' +
      tagClass(evt.tag) +
      '">' +
      esc(evt.tag) +
      "</span>";
    html += "</div>";
  }
  dom.timelineCards.innerHTML = html;
}

function escAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

function tagClass(tag) {
  const map = {
    宠物: "pet",
    健康: "health",
    情感: "emotion",
    建议: "advice",
    日常: "daily",
    其他: "other",
  };
  return map[tag] || "other";
}

let firstCheckDone = false;

function renderStatus(ok, configured, provider, model) {
  dom.statusDot.classList.remove("ok", "warn");
  if (configured) {
    dom.statusDot.classList.add("ok");
    dom.statusText.textContent = "后端已连接 · " + provider + " / " + model;
    dom.devHint.classList.add("hidden");
    dom.connectOverlay.classList.add("hidden");
  } else if (ok) {
    dom.statusDot.classList.add("warn");
    dom.statusText.textContent = "后端已连接 · 未配置 API Key";
    dom.devHint.classList.remove("hidden");
  } else {
    dom.statusText.textContent = "后端未连接 · 使用沙盒模式";
    dom.devHint.classList.remove("hidden");
    // 首次检测后端未连接时，弹出引导
    if (!firstCheckDone) {
      dom.connectOverlay.classList.remove("hidden");
    }
  }
  firstCheckDone = true;
  state.backendOk = ok;
  state.backendConfigured = configured;
}

// ===========================================================================
// 5. API 调用
// ===========================================================================

async function checkStatus() {
  try {
    const res = await fetch(BACKEND_URL + "/api/status", {
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    renderStatus(data.ok, data.configured, data.provider, data.model);
  } catch {
    renderStatus(false, false, "", "");
  }
}

async function processWithBackend(messages) {
  const apiKey = sessionStorage.getItem("ec_api_key");
  const baseUrl = sessionStorage.getItem("ec_base_url");
  const model = sessionStorage.getItem("ec_model");
  const body = { messages };
  if (apiKey) body.apiKey = apiKey;
  if (baseUrl) body.baseUrl = baseUrl;
  if (model) body.model = model;

  const res = await fetch(BACKEND_URL + "/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "服务器错误 (" + res.status + ")");
  }

  return res.json();
}

// ===========================================================================
// 6. 沙盒模式
// ===========================================================================

function sandboxReply(userText) {
  if (
    userText.includes("？") ||
    userText.includes("?") ||
    userText.includes("建议") ||
    userText.includes("怎么")
  ) {
    return "这是个好问题！让我想想……基于之前的了解，我觉得可以从几个方面来看。如果你有具体的想法，也欢迎分享哦~";
  }
  if (userText.length < 10) {
    return "嗯嗯，我在听。能再多说一些吗？";
  }
  const feels = ["开心", "放心", "期待"];
  const pick = feels[Math.floor(Math.random() * feels.length)];
  return "听你这么说，我也感到很" + pick + "！这就是生活中值得记住的时刻。";
}

function sandboxExtractEvent(userText) {
  const time = now();
  for (const rule of SANDBOX_KEYWORDS) {
    for (const kw of rule.keywords) {
      if (userText.includes(kw)) {
        return {
          id: genId(),
          title: rule.tag + "相关事件",
          description: userText.slice(0, 80),
          tag: rule.tag,
          time: time,
        };
      }
    }
  }
  return null;
}

// ===========================================================================
// 7. 事件处理
// ===========================================================================

async function onSend(e) {
  if (e) e.preventDefault();
  const text = dom.messageInput.value.trim();
  if (!text || state.isLoading) return;

  dom.messageInput.value = "";
  setLoading(true);

  const userMsg = { id: genId(), role: "user", content: text, time: now() };
  state.messages.push(userMsg);
  state.errorMessage = "";
  renderMessages();
  renderError();

  try {
    let reply, newEvents;

    if (state.backendConfigured) {
      const result = await processWithBackend(state.messages);
      reply = result.reply;
      newEvents = result.events;
    } else {
      // 沙盒模式
      reply =
        sandboxReply(text) + "（静态，沙盒模拟回复，非真实 llm api 调用）";
      const evt = sandboxExtractEvent(text);
      newEvents = evt ? [evt] : [];
    }

    // 添加 AI 回复
    state.messages.push({
      id: genId(),
      role: "assistant",
      content: reply,
      time: now(),
    });

    // 合并事件（后端已去重，沙盒直接追加）
    if (newEvents.length > 0) {
      if (state.backendConfigured) {
        // 后端返回的是全量事件，直接替换
        const backendIds = new Set(
          newEvents.map(function (e) {
            return e.id;
          }),
        );
        const manualEvents = state.events.filter(function (e) {
          return !e.id || !backendIds.has(e.id);
        });
        state.events = [...newEvents, ...manualEvents];
      } else {
        state.events = [...state.events, ...newEvents];
      }
    }

    renderMessages();
    renderTimeline();
  } catch (err) {
    state.errorMessage = err.message || "请求失败，请检查后端是否正常运行。";
    renderError();
  } finally {
    setLoading(false);
  }
}

function setLoading(v) {
  state.isLoading = v;
  dom.loadingArea.classList.toggle("hidden", !v);
  dom.btnSend.disabled = v;
  dom.messageInput.disabled = v;
  if (v) {
    dom.loadingText.textContent = state.backendConfigured
      ? "正在提取事件并更新编年史..."
      : "沙盒模式 — 正在分析…";
  }
}

function renderError() {
  if (state.errorMessage) {
    dom.errorArea.classList.remove("hidden");
    dom.errorText.textContent = state.errorMessage;
  } else {
    dom.errorArea.classList.add("hidden");
  }
}

function onClear() {
  state.messages = [];
  state.events = [];
  state.errorMessage = "";
  renderMessages();
  renderTimeline();
  renderError();
}

function onReset() {
  state.messages = [...MOCK_MESSAGES];
  state.events = [...MOCK_EVENTS];
  state.errorMessage = "";
  renderMessages();
  renderTimeline();
  renderError();
}

// ---- API Key 设置弹窗 ----

function onOpenSettings() {
  dom.settingsApiKey.value = sessionStorage.getItem("ec_api_key") || "";
  dom.settingsBaseUrl.value = sessionStorage.getItem("ec_base_url") || "";
  dom.settingsModel.value = sessionStorage.getItem("ec_model") || "";
  dom.settingsOverlay.classList.remove("hidden");
}

function onCloseSettings() {
  dom.settingsOverlay.classList.add("hidden");
}

function onSaveSettings() {
  const key = dom.settingsApiKey.value.trim();
  const baseUrl = dom.settingsBaseUrl.value.trim();
  const model = dom.settingsModel.value.trim();
  if (key) sessionStorage.setItem("ec_api_key", key);
  else sessionStorage.removeItem("ec_api_key");
  if (baseUrl) sessionStorage.setItem("ec_base_url", baseUrl);
  else sessionStorage.removeItem("ec_base_url");
  if (model) sessionStorage.setItem("ec_model", model);
  else sessionStorage.removeItem("ec_model");
  dom.settingsOverlay.classList.add("hidden");
  checkStatus();
}

function onEnter() {
  document.getElementById("hero").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  checkStatus();
  setInterval(checkStatus, 3000);
}

function onCloseConnect() {
  dom.connectOverlay.classList.add("hidden");
}

function onOpenConnect() {
  dom.connectOverlay.classList.remove("hidden");
}

function onCopyAll() {
  const commands = [
    "git clone https://github.com/janfeise/Event-Chronicle.git",
    "cd Event-Chronicle/docs",
    "npm install",
    "cp .env.example .env",
    "# 编辑 .env 填入 LLM_API_KEY",
    "npm run dev",
  ].join("\n");

  navigator.clipboard
    .writeText(commands)
    .then(function () {
      dom.btnCopyAll.textContent = "✓ 已复制";
      dom.btnCopyAll.classList.add("copied");
      setTimeout(function () {
        dom.btnCopyAll.textContent = "📋 一键复制";
        dom.btnCopyAll.classList.remove("copied");
      }, 2000);
    })
    .catch(function () {
      dom.btnCopyAll.textContent = "复制失败";
      setTimeout(function () {
        dom.btnCopyAll.textContent = "📋 一键复制";
      }, 1500);
    });
}

// ===========================================================================
// 8. HTML 工具函数
// ===========================================================================

// (esc, escAttr, genId, now, tagClass — 已在上面定义)

// ===========================================================================
// 9. 初始化
// ===========================================================================

function init() {
  cacheDom();

  // 绑定事件
  dom.composer.addEventListener("submit", onSend);
  dom.btnSend.addEventListener("click", onSend);
  document.getElementById("btn-clear").addEventListener("click", onClear);
  document.getElementById("btn-reset").addEventListener("click", onReset);
  document
    .getElementById("btn-settings")
    .addEventListener("click", onOpenSettings);
  document
    .getElementById("btn-settings-cancel")
    .addEventListener("click", onCloseSettings);
  document
    .getElementById("btn-settings-save")
    .addEventListener("click", onSaveSettings);
  document
    .getElementById("settings-overlay")
    .addEventListener("click", function (e) {
      if (e.target === this) onCloseSettings();
    });
  document
    .getElementById("btn-deploy")
    .addEventListener("click", onOpenConnect);
  document
    .getElementById("btn-connect-close")
    .addEventListener("click", onCloseConnect);
  document
    .getElementById("connect-overlay")
    .addEventListener("click", function (e) {
      if (e.target === this) onCloseConnect();
    });
  dom.btnCopyAll.addEventListener("click", onCopyAll);

  // 绑定首屏按钮
  document.getElementById("btn-enter").addEventListener("click", onEnter);

  // 初始渲染（消息 / 时间线在后台就绪，点击"开始体验"后可见）
  // 注意：不调 renderStatus() 以免触发 connect-overlay 弹窗
  dom.statusText.textContent = "点击「开始体验」后检测后端…";
  renderMessages();
  renderTimeline();
}

document.addEventListener("DOMContentLoaded", init);
