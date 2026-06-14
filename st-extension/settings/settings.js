// settings.js — 设置面板交互逻辑
// =============================================================================
// 处理批量生成按钮、进度显示、状态指示器和设置变更通知。
// 运行在 ST 的设置 iframe 中。
// =============================================================================

(function() {
  'use strict';

  var pollInterval = null;

  // -----------------------------------------------------------------------
  // 获取扩展 API（挂载在 window.parent 或 globalThis 上）
  // -----------------------------------------------------------------------

  function getAPI() {
    if (window.parent && window.parent.EventChronicle) {
      return window.parent.EventChronicle;
    }
    if (window.EventChronicle) {
      return window.EventChronicle;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // 状态显示
  // -----------------------------------------------------------------------

  function updateStatus() {
    var indicator = document.getElementById('ec-status-indicator');
    var text = document.getElementById('ec-status-text');
    var detail = document.getElementById('ec-status-detail');

    if (!indicator || !text) return;

    var api = getAPI();

    if (!api) {
      indicator.className = 'ec-indicator error';
      text.textContent = '扩展未加载';
      if (detail) detail.textContent = 'Event Chronicle 扩展未激活。';
      return;
    }

    if (api.isReady()) {
      indicator.className = 'ec-indicator ready';
      text.textContent = '运行中 — LLM 已连接';
      var settings = api.getSettings();
      if (detail && settings) {
        var override = settings.llmOverride || {};
        var model = override.model || 'ST 默认';
        detail.textContent = '模型: ' + model + ' · 每 ' + settings.extractTriggerCount + ' 条消息提取 · 每 ' + settings.mergeTriggerCount + ' 条事件整理';
      }
    } else {
      indicator.className = 'ec-indicator error';
      text.textContent = '未初始化 — 请检查 API 密钥';
      if (detail) detail.textContent = '请在设置中配置 LLM 后重启 SillyTavern。';
    }
  }

  // -----------------------------------------------------------------------
  // 批量生成
  // -----------------------------------------------------------------------

  function getChatMessages() {
    // 从 ST 父级上下文获取聊天消息
    try {
      if (window.parent && typeof window.parent.getContext === 'function') {
        var ctx = window.parent.getContext();
        if (ctx && Array.isArray(ctx.chat)) {
          return ctx.chat;
        }
      }
    } catch (e) { /* 跨域 */ }

    try {
      if (typeof getContext === 'function') {
        var ctx = getContext();
        if (ctx && Array.isArray(ctx.chat)) {
          return ctx.chat;
        }
      }
    } catch (e) { /* 不在 ST 上下文中 */ }

    return [];
  }

  function showTokenWarning(messagesCount, sliceSize) {
    var sliceCount = Math.ceil(messagesCount / sliceSize);
    var estimatedTokens = sliceCount * 3000;

    return confirm(
      '⚠ Token 消耗提醒\n\n' +
      '此操作将处理全部聊天历史以生成事件编年史数据。\n\n' +
      '消息总数: ' + messagesCount + ' 条\n' +
      '切片大小: ' + sliceSize + ' 条/批次\n' +
      '预计 LLM 调用: ~' + sliceCount + ' 次\n' +
      '预计 Token 消耗: ~' + estimatedTokens.toLocaleString() + ' tokens\n\n' +
      '操作在后台运行，中断后可以恢复。\n\n' +
      '是否继续？'
    );
  }

  async function handleBatchStart() {
    var api = getAPI();

    if (!api) {
      alert('Event Chronicle 扩展未加载。');
      return;
    }

    if (!api.isReady()) {
      alert('SDK 未就绪。请检查 API 密钥配置后重启 SillyTavern。');
      return;
    }

    var messages = getChatMessages();

    if (!messages || messages.length === 0) {
      alert('未找到聊天消息。请先打开一个聊天，再执行批量生成。');
      return;
    }

    var sliceInput = document.getElementById('ec-batch-slice');
    var sliceSize = parseInt(sliceInput ? sliceInput.value : '5', 10);

    if (!showTokenWarning(messages.length, sliceSize)) {
      return;
    }

    // 显示进度 UI
    var startBtn = document.getElementById('ec-batch-start');
    var resumeBtn = document.getElementById('ec-batch-resume');
    var progressContainer = document.getElementById('ec-batch-progress-container');
    var progressFill = document.getElementById('ec-batch-progress-fill');
    var progressText = document.getElementById('ec-batch-progress-text');
    var statusSpan = document.getElementById('ec-batch-status');

    if (progressContainer) progressContainer.style.display = 'block';
    if (startBtn) { startBtn.style.display = 'none'; startBtn.disabled = true; }
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (statusSpan) { statusSpan.textContent = '正在启动...'; statusSpan.style.color = '#ffaa00'; }

    var chatId = api.getCurrentChatId ? api.getCurrentChatId() : 'batch';

    api.startBatchGeneration({
      chatId: chatId,
      messages: messages,
      sliceSize: sliceSize,
      onProgress: function(progress) {
        var pct = Math.round((progress.current / progress.total) * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressText) {
          progressText.textContent =
            progress.current + ' / ' + progress.total + ' 条消息 · 已发现 ' + progress.eventsFound + ' 个事件';
        }
        if (statusSpan) {
          statusSpan.textContent = '已完成 ' + pct + '%';
          statusSpan.style.color = '#ffaa00';
        }
      },
      onComplete: function(result) {
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) {
          progressText.textContent = '生成完成！共 ' + result.totalEvents + ' 个事件。';
        }
        if (statusSpan) {
          statusSpan.textContent = '✓ 完成';
          statusSpan.style.color = '#4caf50';
        }
        setTimeout(function() {
          if (progressContainer) progressContainer.style.display = 'none';
          if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; }
          if (statusSpan) { statusSpan.textContent = ''; }
        }, 4000);

        if (api.onSettingsChanged) api.onSettingsChanged();
      },
      onError: function(err) {
        if (statusSpan) {
          statusSpan.textContent = '错误: ' + (err.message || err);
          statusSpan.style.color = '#f44336';
        }
        if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; }
        checkBatchResumability();

        if (window.parent && window.parent.toastr) {
          window.parent.toastr.error('批量生成失败: ' + (err.message || err));
        }
      },
    });
  }

  function checkBatchResumability() {
    var api = getAPI();
    if (!api || !api.getBatchProgress) return;

    var chatId = 'batch';
    try { chatId = api.getCurrentChatId ? api.getCurrentChatId() : 'batch'; } catch (e) {}

    var progress = api.getBatchProgress(chatId);
    var resumeBtn = document.getElementById('ec-batch-resume');

    if (progress && !progress.completed && progress.lastProcessedIndex > 0) {
      if (resumeBtn) {
        resumeBtn.style.display = '';
        resumeBtn.textContent =
          '↻ 继续 (' + progress.lastProcessedIndex + '/' + progress.totalMessages + ')';
      }
    } else {
      if (resumeBtn) resumeBtn.style.display = 'none';
    }
  }

  // -----------------------------------------------------------------------
  // 表单变更 → 通知 index.js 重新初始化
  // -----------------------------------------------------------------------

  function setupFormWatcher() {
    var form = document.getElementById('ec-settings-container');
    if (!form) return;

    var inputs = form.querySelectorAll('input[name]');
    inputs.forEach(function(input) {
      input.addEventListener('change', function() {
        clearTimeout(window._ecSettingsTimer);
        window._ecSettingsTimer = setTimeout(function() {
          var api = getAPI();
          if (api && api.onSettingsChanged) {
            api.onSettingsChanged();
            setTimeout(updateStatus, 2000);
          }
        }, 1000);
      });
    });
  }

  // -----------------------------------------------------------------------
  // 初始化
  // -----------------------------------------------------------------------

  function init() {
    var startBtn = document.getElementById('ec-batch-start');
    var resumeBtn = document.getElementById('ec-batch-resume');

    if (startBtn) startBtn.addEventListener('click', handleBatchStart);
    if (resumeBtn) resumeBtn.addEventListener('click', handleBatchStart);

    setTimeout(updateStatus, 1000);
    setTimeout(checkBatchResumability, 1500);

    pollInterval = setInterval(updateStatus, 10000);

    setupFormWatcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('beforeunload', function() {
    if (pollInterval) clearInterval(pollInterval);
  });
})();
