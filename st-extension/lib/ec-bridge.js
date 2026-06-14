// ec-bridge.js — Bridges event-chronicle SDK to SillyTavern
// =============================================================================
// This is the central adapter that wraps all SDK calls with ST-specific logic.
// All modules use CommonJS (require / module.exports) for ST compatibility.
// =============================================================================

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// SDK loading (lazy, cached)
// ---------------------------------------------------------------------------

let sdk = null;

function loadSDK() {
  if (sdk) return sdk;

  // Priority 1: Vendored copy
  const vendorPath = path.join(__dirname, '..', 'vendor', 'event-chronicle', 'index.js');
  if (fs.existsSync(vendorPath)) {
    sdk = require(vendorPath);
    return sdk;
  }

  // Priority 2: npm-installed
  try {
    sdk = require('event-chronicle');
    return sdk;
  } catch (e) {
    throw new Error(
      '[EC Bridge] SDK not found. Run install.js: node extensions/event-chronicle/install.js'
    );
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the SDK bridge.
 * @param {Object} options
 * @param {Object} options.llmConfig - LLM configuration { provider, baseUrl, apiKey, model, temperature?, maxTokens? }
 * @param {string} options.dataDir - Where to store chronicle data files
 * @param {string} [options.promptsDir] - Where to find prompt .md files
 * @param {boolean} [options.healthCheck=false] - Whether to perform LLM health check
 */
async function init(options) {
  const sdk = loadSDK();

  if (options.dataDir) {
    sdk.setDataDir(options.dataDir);
  }

  // Resolve promptsDir: prefer explicit, then vendored, then default
  const promptsDir = options.promptsDir ||
    path.join(__dirname, '..', 'vendor', 'event-chronicle', 'prompts');

  await sdk.startup({
    healthCheck: options.healthCheck ?? false,
    llmConfig: options.llmConfig,
    dataDir: options.dataDir,
    promptsDir: promptsDir,
  });

  console.log('[EC Bridge] SDK initialized');
}

/**
 * Re-initialize LLM with new config (e.g., after settings change).
 */
async function reinit(options) {
  const sdk = loadSDK();
  if (options.llmConfig) {
    sdk.initLLM(options.llmConfig);
  }
  if (options.dataDir) {
    sdk.setDataDir(options.dataDir);
  }
  console.log('[EC Bridge] SDK re-initialized with new config');
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Process chat messages: extract events, append to chronicle, auto-merge.
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ eventId?: string, autoMerge?: boolean }} options
 * @returns {Promise<import('event-chronicle').ProcessResult>}
 */
async function processMessages(messages, options) {
  const sdk = loadSDK();
  return sdk.processMessages(messages, {
    eventId: options.eventId,
    autoMerge: options.autoMerge ?? true,
  });
}

/**
 * Get memory prompt for injection into LLM context.
 * @param {string} chatId
 * @param {import('event-chronicle').MemoryExportOptions} [options]
 * @returns {string}
 */
function getMemory(chatId, options) {
  const sdk = loadSDK();
  try {
    return sdk.exportMemory(chatId, options);
  } catch (e) {
    // File may not exist yet — return empty
    return '';
  }
}

// ---------------------------------------------------------------------------
// Event CRUD
// ---------------------------------------------------------------------------

/**
 * Get all events for a specific chronicle/chat.
 * @param {string} chatId
 * @returns {Array<import('event-chronicle').Event>}
 */
function getEvents(chatId) {
  const sdk = loadSDK();
  return sdk.loadChronicle(chatId);
}

/**
 * Get all events across all chronicles (for timeline overview).
 * Each event is tagged with _chatId for write-back.
 * @returns {Array<import('event-chronicle').Event & { _chatId: string }>}
 */
function getAllEvents() {
  const sdk = loadSDK();
  const dataDir = sdk.getDataDir();
  const allEvents = [];

  if (!fs.existsSync(dataDir)) return [];

  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    // Match chronicle data files: {chatId}.json
    // Skip state files, batch progress, backups, logs
    if (
      file.endsWith('.json') &&
      !file.includes('_state') &&
      !file.includes('_batch') &&
      !file.includes('_backup') &&
      !file.startsWith('event_')
    ) {
      const chatId = file.replace('.json', '');
      try {
        const events = sdk.loadChronicle(chatId);
        // Tag each event with its source chatId for edit/delete write-back
        for (const e of events) {
          e._chatId = chatId;
        }
        allEvents.push(...events);
      } catch (e) {
        // skip unreadable files
      }
    }

    // Also match SDK's timestamped filenames: event_{timestamp}.json
    if (file.startsWith('event_') && file.endsWith('.json') && !file.includes('_state')) {
      try {
        const events = sdk.loadChronicle(file.replace('.json', ''));
        const chatId = file.replace('.json', '');
        for (const e of events) {
          e._chatId = chatId;
        }
        allEvents.push(...events);
      } catch (e) {
        // skip
      }
    }
  }
  return allEvents;
}

/**
 * Update a single event in-place.
 * @param {string} chatId
 * @param {import('event-chronicle').Event} updatedEvent
 * @returns {import('event-chronicle').Event | null}
 */
function updateEvent(chatId, updatedEvent) {
  const sdk = loadSDK();
  const events = sdk.loadChronicle(chatId);
  const idx = events.findIndex(e => e.id === updatedEvent.id);
  if (idx === -1) return null;

  // Merge: preserve fields not in updatedEvent
  events[idx] = { ...events[idx], ...updatedEvent, _chatId: undefined };

  // Write directly to maintain {chatId}.json naming
  const dataDir = sdk.getDataDir();
  const filePath = path.join(dataDir, `${chatId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf-8');

  return events[idx];
}

/**
 * Delete a single event by ID.
 * @param {string} chatId
 * @param {string} eventId
 * @returns {boolean} true if deleted, false if not found
 */
function deleteEvent(chatId, eventId) {
  const sdk = loadSDK();
  const events = sdk.loadChronicle(chatId);
  const filtered = events.filter(e => e.id !== eventId);
  if (filtered.length === events.length) return false;

  const dataDir = sdk.getDataDir();
  const filePath = path.join(dataDir, `${chatId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');

  return true;
}

// ---------------------------------------------------------------------------
// Batch Generation (incremental, with progress tracking)
// ---------------------------------------------------------------------------

/**
 * Start incremental batch generation from chat history.
 * Runs asynchronously; reports progress via callbacks.
 *
 * @param {Object} options
 * @param {string} options.chatId
 * @param {Array} options.messages - Full chat message array from ST
 * @param {number} [options.sliceSize=5]
 * @param {Function} [options.onProgress] - ({ current, total, eventsFound }) => void
 * @param {Function} [options.onComplete] - ({ totalEvents }) => void
 * @param {Function} [options.onError] - (error) => void
 */
function startBatchGeneration(options) {
  const sdk = loadSDK();

  const {
    chatId,
    messages,
    sliceSize = 5,
    onProgress,
    onComplete,
    onError,
  } = options;

  // Load or create progress
  const progress = loadBatchProgress(chatId);
  const totalMessages = messages.length;
  let lastProcessedIndex = progress.lastProcessedIndex || 0;

  // Auto-backup before batch if there's existing data
  backupChronicle(chatId);

  // Process in background (fire-and-forget with callbacks)
  (async () => {
    try {
      let totalEventsFound = 0;

      while (lastProcessedIndex < totalMessages) {
        const slice = messages.slice(
          lastProcessedIndex,
          lastProcessedIndex + sliceSize
        );

        if (slice.length === 0) break;

        // Convert ST message format to SDK ChatMessage format
        const chatMessages = slice.map(m => ({
          role: m.name || (m.is_user ? 'user' : 'assistant'),
          content: m.mes || '',
        }));

        const result = await sdk.processMessages(chatMessages, {
          eventId: chatId,
          autoMerge: false, // Don't merge during batch; do it once at the end
        });

        totalEventsFound += result.events.length;
        lastProcessedIndex += slice.length;

        // Save progress after each slice (enables resume)
        saveBatchProgress(chatId, {
          lastProcessedIndex,
          totalMessages,
          completed: false,
          startedAt: progress.startedAt || new Date().toISOString(),
        });

        if (onProgress) {
          onProgress({
            current: lastProcessedIndex,
            total: totalMessages,
            eventsFound: totalEventsFound,
          });
        }
      }

      // Batch complete: trigger a final merge to deduplicate
      const allEvents = sdk.loadChronicle(chatId);
      if (allEvents.length > 0) {
        // Merge all events — pass the same set for self-dedup + consolidation
        const merged = await sdk.mergeEvents([], allEvents);
        const dataDir = sdk.getDataDir();
        const filePath = path.join(dataDir, `${chatId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
      }

      // Mark complete
      saveBatchProgress(chatId, {
        lastProcessedIndex: totalMessages,
        totalMessages,
        completed: true,
        startedAt: progress.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      if (onComplete) {
        onComplete({ totalEvents: totalEventsFound });
      }
    } catch (err) {
      // Save progress so user can resume
      saveBatchProgress(chatId, {
        lastProcessedIndex,
        totalMessages,
        completed: false,
        error: err.message,
      });

      if (onError) {
        onError(err);
      }
    }
  })();
}

/**
 * Get batch generation progress for a chat.
 * @param {string} chatId
 * @returns {{ lastProcessedIndex: number, totalMessages: number, completed: boolean, startedAt?: string, completedAt?: string, error?: string }}
 */
function getBatchProgress(chatId) {
  return loadBatchProgress(chatId);
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/**
 * Auto-backup an existing chronicle before destructive operations.
 */
function backupChronicle(chatId) {
  const sdk = loadSDK();
  const dataDir = sdk.getDataDir();
  const srcPath = path.join(dataDir, `${chatId}.json`);

  if (!fs.existsSync(srcPath)) return null;

  const events = sdk.loadChronicle(chatId);
  if (events.length === 0) return null;

  const backupName = `${chatId}_backup_${Date.now()}.json`;
  const backupPath = path.join(dataDir, backupName);
  fs.copyFileSync(srcPath, backupPath);

  console.log(`[EC Bridge] Backup created: ${backupName}`);
  return backupName;
}

// ---------------------------------------------------------------------------
// Batch Progress Persistence
// ---------------------------------------------------------------------------

function batchProgressPath(chatId) {
  const sdk = loadSDK();
  return path.join(sdk.getDataDir(), `${chatId}_batch_progress.json`);
}

function loadBatchProgress(chatId) {
  const filePath = batchProgressPath(chatId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      // corrupted — start fresh
    }
  }
  return { lastProcessedIndex: 0, totalMessages: 0, completed: false };
}

function saveBatchProgress(chatId, progress) {
  const filePath = batchProgressPath(chatId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  init,
  reinit,
  processMessages,
  getMemory,
  getEvents,
  getAllEvents,
  updateEvent,
  deleteEvent,
  startBatchGeneration,
  getBatchProgress,
  backupChronicle,
};
