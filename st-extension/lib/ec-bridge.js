// ec-bridge.js — Browser-compatible Event Chronicle adapter
// =============================================================================
// Runs in the SillyTavern browser sandbox. No Node.js APIs.
// Uses fetch() for LLM calls, localStorage for data persistence.
// =============================================================================

// ---------------------------------------------------------------------------
// Prompt templates (inlined — no fs.readFileSync in browser)
// ---------------------------------------------------------------------------

const EXTRACT_PROMPT = `你是一位"史官"，负责从聊天记录中提取客观的**状态变化事件**。

## 角色
你只记录事实，不创造、不推测、不补全。

## 已有事件（供参考去重）
{{existingEvents}}

## 最近聊天记录
{{recentMessages}}

## 提取规则
1. 只提取聊天记录中**明确发生**的状态变化事件
2. 每个事件必须包含：title（简练标题）、summary（2-3句概述）、importance（1-10重要度）、participants（参与者列表）、location（发生地点）、tags（标签列表）
3. 不要生成 id 字段（程序会自动注入）
4. 不要提取计划、猜测、推测类内容
5. 如果聊天记录中没有新事件，返回空数组 []

## 输出格式
仅输出 JSON 数组，不要包含代码块标记或其他文字：
[{"title":"...","summary":"...","importance":5,"participants":["角色1"],"location":"地点","tags":["标签1"]}]`;

const MERGE_PROMPT = `你是"编年史整理官"，负责合并新旧事件。

## 已有事件
{{existingEvents}}

## 新事件
{{newEvents}}

## 合并规则
分析新旧事件的关系，输出合并指令数组。每条指令包含 action 字段：
- update：修改已有事件（需提供 id 和 changes）
- delete：删除冗余或已被覆盖的事件（需提供 id）
- add：添加全新事件（需提供完整 event 对象）
- keep：无需操作的事件无需输出

## 输出格式
仅输出 JSON 数组：
[{"action":"update","id":"evt_xxx","changes":{"importance":8}},{"action":"delete","id":"evt_yyy"},{"action":"add","event":{"title":"...","summary":"...","importance":5,"participants":[],"location":"","tags":[]}}]`;

const MEMORY_PROMPT_TEMPLATE = `你是一位 AI 助手，拥有长期记忆系统。
以下是用户与你之前对话中发生的事件编年史。请在回复时参考这些历史事件：

{{memoryTimeline}}

请基于以上历史事实组织你的回复，但不要在回复中直接复述这些内容，除非用户明确询问。`;

// ---------------------------------------------------------------------------
// Storage helpers (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'ec_';

function storageKey(eventId) {
  return STORAGE_PREFIX + (eventId || 'default');
}

function loadEvents(eventId) {
  try {
    const raw = localStorage.getItem(storageKey(eventId) + '_events');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEvents(eventId, events) {
  try {
    localStorage.setItem(storageKey(eventId) + '_events', JSON.stringify(events));
  } catch (e) {
    console.error('[EC Bridge] localStorage 写入失败:', e.message);
  }
}

function loadMergeState(eventId) {
  try {
    const raw = localStorage.getItem(storageKey(eventId) + '_state');
    return raw ? JSON.parse(raw) : { newEventCount: 0, lastMergeAt: null };
  } catch (e) {
    return { newEventCount: 0, lastMergeAt: null };
  }
}

function saveMergeState(eventId, state) {
  try {
    localStorage.setItem(storageKey(eventId) + '_state', JSON.stringify(state));
  } catch (e) {}
}

function loadBatchProgress(eventId) {
  try {
    const raw = localStorage.getItem(storageKey(eventId) + '_batch');
    return raw ? JSON.parse(raw) : { lastProcessedIndex: 0, totalMessages: 0, completed: false };
  } catch (e) {
    return { lastProcessedIndex: 0, totalMessages: 0, completed: false };
  }
}

function saveBatchProgress(eventId, progress) {
  try {
    localStorage.setItem(storageKey(eventId) + '_batch', JSON.stringify(progress));
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// LLM Call (fetch OpenAI-compatible API)
// ---------------------------------------------------------------------------

let llmConfig = null;

function setLLMConfig(config) {
  llmConfig = config;
}

async function callLLM(prompt) {
  if (!llmConfig || !llmConfig.apiKey) {
    throw new Error('API Key 未配置。请在扩展设置中配置 LLM。');
  }

  const baseUrl = (llmConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const endpoint = baseUrl + '/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + llmConfig.apiKey,
    },
    body: JSON.stringify({
      model: llmConfig.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: llmConfig.temperature ?? 0,
      max_tokens: llmConfig.maxTokens || 2048,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('LLM API 错误 ' + response.status + ': ' + text.slice(0, 200));
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatMessages(messages) {
  if (!messages || !Array.isArray(messages)) return '';
  return messages.map(m =>
    (m.name || m.role || 'unknown') + ':\n' + (m.mes || m.content || '')
  ).join('\n\n');
}

function parseJSONResponse(text) {
  if (!text || !text.trim()) return [];
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[EC Bridge] JSON 解析失败:', e.message, json.slice(0, 300));
    return [];
  }
}

function injectIds(events) {
  const ts = Date.now();
  return events.map(e => ({
    ...e,
    id: e.id || ('evt_' + ts + '_' + Math.random().toString(16).slice(2, 8)),
  }));
}

// ---------------------------------------------------------------------------
// Core: Event Extraction
// ---------------------------------------------------------------------------

async function extractEvents(messages, existingEventsJson) {
  const formatted = formatMessages(messages);
  const prompt = EXTRACT_PROMPT
    .replace('{{existingEvents}}', existingEventsJson || '')
    .replace('{{recentMessages}}', formatted);

  const response = await callLLM(prompt);
  const events = parseJSONResponse(response);
  return injectIds(events);
}

// ---------------------------------------------------------------------------
// Core: Event Merge
// ---------------------------------------------------------------------------

async function mergeEvents(existingEvents, newEvents, windowSize) {
  if (!newEvents || newEvents.length === 0) return existingEvents || [];

  const winSize = windowSize || 20;
  const windowed = (existingEvents || []).slice(-winSize);

  const prompt = MERGE_PROMPT
    .replace('{{existingEvents}}', JSON.stringify(windowed, null, 2))
    .replace('{{newEvents}}', JSON.stringify(newEvents, null, 2));

  const response = await callLLM(prompt);
  const instructions = parseJSONResponse(response);

  const map = new Map();
  for (const e of (existingEvents || [])) {
    map.set(e.id, { ...e });
  }

  for (const inst of (instructions || [])) {
    try {
      switch (inst.action) {
        case 'update':
          if (inst.id && map.has(inst.id) && inst.changes) {
            Object.assign(map.get(inst.id), inst.changes);
          }
          break;
        case 'delete':
          if (inst.id) map.delete(inst.id);
          break;
        case 'add':
          if (inst.event) {
            const ev = { ...inst.event };
            if (!ev.id) ev.id = 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
            map.set(ev.id, ev);
          }
          break;
      }
    } catch (e) {
      console.warn('[EC Bridge] 合并指令执行失败:', inst, e.message);
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Core: Memory Export (pure, no LLM call)
// ---------------------------------------------------------------------------

function renderStars(n) {
  let s = '';
  for (let i = 1; i <= 10; i++) s += i <= n ? '★' : '☆';
  return s;
}

function exportMemory(events, options) {
  const title = (options && options.title) || 'Event Chronicle Memory';
  const threshold = (options && options.highlightThreshold) || 7;
  const includeTimeline = (options && options.includeTimeline) !== false;

  if (!events || events.length === 0) {
    return '# ' + title + '\n\n_暂无事件记录。_';
  }

  const lines = [];
  lines.push('# ' + title);
  lines.push('');
  lines.push('## 概述');

  const imps = events.map(e => e.importance || 5);
  lines.push(events.length + ' 个事件 · 重要度范围 ' + Math.min(...imps) + '–' + Math.max(...imps));
  lines.push('');

  // Key events
  const keyEvents = events.filter(e => (e.importance || 5) >= threshold);
  if (keyEvents.length > 0) {
    lines.push('## 关键事件 (重要度 ≥ ' + threshold + ')');
    lines.push('');
    for (const e of keyEvents) {
      lines.push('### ' + (e.title || '未命名') + ' ' + renderStars(e.importance || 5));
      lines.push(e.summary || '');
      lines.push('');
      const meta = [];
      if (e.participants && e.participants.length) meta.push('参与者: ' + e.participants.join(', '));
      if (e.location) meta.push('地点: ' + e.location);
      if (e.tags && e.tags.length) meta.push('标签: ' + e.tags.join(', '));
      if (meta.length) lines.push(meta.join(' | '));
      lines.push('');
    }
  }

  // Timeline
  if (includeTimeline) {
    lines.push('## 时间线');
    lines.push('');
    lines.push('| # | 事件 | ★ | 参与者 | 地点 |');
    lines.push('|---|------|---|--------|------|');
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      lines.push(
        '| ' + (i + 1) + ' | ' + (e.title || '') + ' | ' + (e.importance || '') + ' | ' +
        ((e.participants && e.participants.join(', ')) || '—') + ' | ' + (e.location || '—') + ' |'
      );
    }
    lines.push('');
  }

  return MEMORY_PROMPT_TEMPLATE.replace('{{memoryTimeline}}', lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function processMessages(messages, options) {
  const ops = options || {};
  const eventId = ops.eventId || 'default';
  const autoMerge = ops.autoMerge !== false;
  const mergeThreshold = ops.mergeThreshold || 5;
  const mergeWindow = ops.mergeWindow || 20;

  const existingEvents = loadEvents(eventId);
  const newEvents = await extractEvents(messages, JSON.stringify(existingEvents));

  if (newEvents.length === 0) {
    return { events: [], storedFile: eventId, merged: false };
  }

  const state = loadMergeState(eventId);
  state.newEventCount += newEvents.length;

  let merged = false;
  let mergedEvents = null;

  if (autoMerge && state.newEventCount >= mergeThreshold) {
    mergedEvents = await mergeEvents(existingEvents, newEvents, mergeWindow);
    saveEvents(eventId, mergedEvents);
    state.newEventCount = 0;
    state.lastMergeAt = new Date().toISOString();
    merged = true;
  } else {
    const allEvents = existingEvents.concat(newEvents);
    saveEvents(eventId, allEvents);
  }

  saveMergeState(eventId, state);
  return { events: newEvents, storedFile: eventId, merged, mergedEvents };
}

function getEvents(eventId) {
  return loadEvents(eventId || 'default');
}

function getAllEvents() {
  const all = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && key.endsWith('_events')) {
        const eventId = key.slice(STORAGE_PREFIX.length, -7);
        const events = loadEvents(eventId);
        for (const e of events) e._chatId = eventId;
        all.push(...events);
      }
    }
  } catch (e) { /* localStorage inaccessible */ }
  return all;
}

function updateEvent(chatId, updatedEvent) {
  const events = loadEvents(chatId);
  const idx = events.findIndex(e => e.id === updatedEvent.id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...updatedEvent, _chatId: undefined };
  saveEvents(chatId, events);
  return events[idx];
}

function deleteEvent(chatId, eventId) {
  const events = loadEvents(chatId);
  const filtered = events.filter(e => e.id !== eventId);
  if (filtered.length === events.length) return false;
  saveEvents(chatId, filtered);
  return true;
}

function getMemory(eventId, options) {
  const events = loadEvents(eventId || 'default');
  return exportMemory(events, options);
}

async function startBatchGeneration(options) {
  const chatId = options.chatId || 'default';
  const messages = options.messages || [];
  const sliceSize = options.sliceSize || 5;

  const progress = loadBatchProgress(chatId);
  const totalMessages = messages.length;
  let idx = progress.lastProcessedIndex || 0;

  (async () => {
    try {
      let totalFound = 0;
      while (idx < totalMessages) {
        const slice = messages.slice(idx, idx + sliceSize);
        if (slice.length === 0) break;

        const result = await processMessages(slice, { eventId: chatId, autoMerge: false });
        totalFound += result.events.length;
        idx += slice.length;

        saveBatchProgress(chatId, { lastProcessedIndex: idx, totalMessages, completed: false });
        if (options.onProgress) {
          options.onProgress({ current: idx, total: totalMessages, eventsFound: totalFound });
        }
      }

      const allEvents = loadEvents(chatId);
      if (allEvents.length > 0) {
        const merged = await mergeEvents([], allEvents, 50);
        saveEvents(chatId, merged);
      }

      saveBatchProgress(chatId, { lastProcessedIndex: totalMessages, totalMessages, completed: true, completedAt: new Date().toISOString() });
      if (options.onComplete) options.onComplete({ totalEvents: totalFound });
    } catch (err) {
      saveBatchProgress(chatId, { lastProcessedIndex: idx, totalMessages, completed: false, error: err.message });
      if (options.onError) options.onError(err);
    }
  })();
}

function getBatchProgress(chatId) {
  return loadBatchProgress(chatId || 'default');
}

export {
  setLLMConfig,
  processMessages,
  extractEvents,
  mergeEvents,
  exportMemory,
  getEvents,
  getAllEvents,
  updateEvent,
  deleteEvent,
  getMemory,
  startBatchGeneration,
  getBatchProgress,
};
