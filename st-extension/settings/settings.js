// settings.js — Settings Panel Interactivity
// =============================================================================
// Handles batch generation button, progress display, status indicator,
// and settings change notifications. Runs inside ST's settings iframe.
// =============================================================================

(function() {
  'use strict';

  let pollInterval = null;

  // -----------------------------------------------------------------------
  // Get reference to the extension API (exposed on window.parent or globalThis)
  // -----------------------------------------------------------------------

  function getAPI() {
    // In ST settings iframe, the API is on the parent window
    if (window.parent && window.parent.EventChronicle) {
      return window.parent.EventChronicle;
    }
    // Fallback: direct access
    if (window.EventChronicle) {
      return window.EventChronicle;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Status display
  // -----------------------------------------------------------------------

  function updateStatus() {
    const indicator = document.getElementById('ec-status-indicator');
    const text = document.getElementById('ec-status-text');
    const detail = document.getElementById('ec-status-detail');

    if (!indicator || !text) return;

    const api = getAPI();

    if (!api) {
      indicator.className = 'ec-indicator error';
      text.textContent = 'Extension not loaded';
      if (detail) detail.textContent = 'Event Chronicle extension is not active.';
      return;
    }

    if (api.isReady()) {
      indicator.className = 'ec-indicator ready';
      text.textContent = 'Active — LLM connected';
      const settings = api.getSettings();
      if (detail && settings) {
        const override = settings.llmOverride || {};
        const model = override.model || 'ST default';
        detail.textContent = `Model: ${model} · Extract every ${settings.extractTriggerCount} msg · Merge every ${settings.mergeTriggerCount} events`;
      }
    } else {
      indicator.className = 'ec-indicator error';
      text.textContent = 'Not initialized — check API key';
      if (detail) detail.textContent = 'Configure LLM in settings and restart SillyTavern.';
    }
  }

  // -----------------------------------------------------------------------
  // Batch generation
  // -----------------------------------------------------------------------

  function getChatMessages() {
    // Attempt to get chat messages from ST parent context
    try {
      if (window.parent && typeof window.parent.getContext === 'function') {
        const ctx = window.parent.getContext();
        if (ctx && Array.isArray(ctx.chat)) {
          return ctx.chat;
        }
      }
    } catch (e) { /* cross-origin */ }

    // Fallback: try direct access
    try {
      if (typeof getContext === 'function') {
        const ctx = getContext();
        if (ctx && Array.isArray(ctx.chat)) {
          return ctx.chat;
        }
      }
    } catch (e) { /* not in ST context */ }

    return [];
  }

  function showTokenWarning(messagesCount, sliceSize) {
    const sliceCount = Math.ceil(messagesCount / sliceSize);
    const estimatedTokens = sliceCount * 3000; // rough: ~3K tokens per slice

    return confirm(
      '⚠ Token Consumption Warning\n\n' +
      'This will process the entire chat history to generate event chronicle data.\n\n' +
      `Total messages: ${messagesCount}\n` +
      `Slice size: ${sliceSize} messages/slice\n` +
      `Estimated LLM calls: ~${sliceCount}\n` +
      `Estimated token consumption: ~${estimatedTokens.toLocaleString()} tokens\n\n` +
      'The operation runs in the background and can be resumed if interrupted.\n\n' +
      'Do you want to continue?'
    );
  }

  async function handleBatchStart() {
    const api = getAPI();

    if (!api) {
      alert('Event Chronicle extension is not loaded.');
      return;
    }

    if (!api.isReady()) {
      alert('SDK is not ready. Please check your API key configuration and restart SillyTavern.');
      return;
    }

    // Get chat messages
    const messages = getChatMessages();

    if (!messages || messages.length === 0) {
      alert('No chat messages found. Open a chat first, then try batch generation.');
      return;
    }

    // Read slice size from form
    const sliceInput = document.getElementById('ec-batch-slice');
    const sliceSize = parseInt(sliceInput?.value || '5', 10);

    // Warn about token consumption
    if (!showTokenWarning(messages.length, sliceSize)) {
      return;
    }

    // Show progress UI
    const startBtn = document.getElementById('ec-batch-start');
    const resumeBtn = document.getElementById('ec-batch-resume');
    const progressContainer = document.getElementById('ec-batch-progress-container');
    const progressFill = document.getElementById('ec-batch-progress-fill');
    const progressText = document.getElementById('ec-batch-progress-text');
    const statusSpan = document.getElementById('ec-batch-status');

    if (progressContainer) progressContainer.style.display = 'block';
    if (startBtn) { startBtn.style.display = 'none'; startBtn.disabled = true; }
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (statusSpan) { statusSpan.textContent = 'Starting...'; statusSpan.style.color = '#ffaa00'; }

    // Get chat ID
    const chatId = api.getCurrentChatId ? api.getCurrentChatId() : 'batch';

    // Start batch
    api.startBatchGeneration({
      chatId,
      messages,
      sliceSize,
      onProgress: function(progress) {
        const pct = Math.round((progress.current / progress.total) * 100);
        if (progressFill) progressFill.style.width = pct + '%';
        if (progressText) {
          progressText.textContent =
            `${progress.current} / ${progress.total} messages · ${progress.eventsFound} events found`;
        }
        if (statusSpan) {
          statusSpan.textContent = `${pct}% complete`;
          statusSpan.style.color = '#ffaa00';
        }
      },
      onComplete: function(result) {
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) {
          progressText.textContent = `Complete! ${result.totalEvents} total events generated.`;
        }
        if (statusSpan) {
          statusSpan.textContent = '✓ Done!';
          statusSpan.style.color = '#4caf50';
        }
        // Hide progress after delay, restore button
        setTimeout(function() {
          if (progressContainer) progressContainer.style.display = 'none';
          if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; }
          if (statusSpan) { statusSpan.textContent = ''; }
        }, 4000);

        // Notify settings change
        if (api.onSettingsChanged) api.onSettingsChanged();
      },
      onError: function(err) {
        if (statusSpan) {
          statusSpan.textContent = 'Error: ' + (err.message || err);
          statusSpan.style.color = '#f44336';
        }
        if (startBtn) { startBtn.style.display = ''; startBtn.disabled = false; }
        checkBatchResumability();

        // Toast
        if (window.parent && window.parent.toastr) {
          window.parent.toastr.error('Batch generation error: ' + (err.message || err));
        }
      },
    });
  }

  function checkBatchResumability() {
    const api = getAPI();
    if (!api || !api.getBatchProgress) return;

    let chatId = 'batch';
    try { chatId = api.getCurrentChatId ? api.getCurrentChatId() : 'batch'; } catch (e) {}

    const progress = api.getBatchProgress(chatId);
    const resumeBtn = document.getElementById('ec-batch-resume');

    if (progress && !progress.completed && progress.lastProcessedIndex > 0) {
      if (resumeBtn) {
        resumeBtn.style.display = '';
        resumeBtn.textContent =
          '↻ Resume (' + progress.lastProcessedIndex + '/' + progress.totalMessages + ')';
      }
    } else {
      if (resumeBtn) resumeBtn.style.display = 'none';
    }
  }

  // -----------------------------------------------------------------------
  // Form change → notify index.js for re-init
  // -----------------------------------------------------------------------

  function setupFormWatcher() {
    const form = document.getElementById('ec-settings-container');
    if (!form) return;

    // Watch for input changes and notify extension
    const inputs = form.querySelectorAll('input[name]');
    inputs.forEach(function(input) {
      input.addEventListener('change', function() {
        // Debounce: wait 1 second after last change
        clearTimeout(window._ecSettingsTimer);
        window._ecSettingsTimer = setTimeout(function() {
          const api = getAPI();
          if (api && api.onSettingsChanged) {
            api.onSettingsChanged();
            // Update status display after re-init
            setTimeout(updateStatus, 2000);
          }
        }, 1000);
      });
    });
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  function init() {
    // Bind batch button
    const startBtn = document.getElementById('ec-batch-start');
    const resumeBtn = document.getElementById('ec-batch-resume');

    if (startBtn) startBtn.addEventListener('click', handleBatchStart);
    if (resumeBtn) resumeBtn.addEventListener('click', handleBatchStart);

    // Initial status check (may take a moment for SDK to init)
    setTimeout(updateStatus, 1000);
    setTimeout(checkBatchResumability, 1500);

    // Periodic status update
    pollInterval = setInterval(updateStatus, 10000);

    // Watch form changes
    setupFormWatcher();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', function() {
    if (pollInterval) clearInterval(pollInterval);
  });
})();
