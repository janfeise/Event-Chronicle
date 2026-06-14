// timeline.js — Timeline Rendering, Filtering, and Grouping
// =============================================================================

(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------------

  let allEvents = [];
  let filteredEvents = [];

  // -----------------------------------------------------------------------
  // API Access
  // -----------------------------------------------------------------------

  function getBridge() {
    // In ST, the timeline page runs in an iframe. The API is on window.parent.
    if (window.parent && window.parent.EventChronicle) {
      return window.parent.EventChronicle;
    }
    // Fallback for direct access
    if (window.EventChronicle) {
      return window.EventChronicle;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Refresh
  // -----------------------------------------------------------------------

  window.refreshTimeline = function() {
    var bridge = getBridge();
    var container = document.getElementById('ec-timeline-container');

    if (!bridge) {
      container.innerHTML = '<div class="ec-empty"><div class="ec-empty-icon">⚠</div><p>Event Chronicle extension not found. Ensure the extension is installed and loaded.</p></div>';
      return;
    }

    var events = bridge.getAllEvents();
    allEvents = events || [];
    populateFilters(events || []);
    applyFilters();
  };

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------

  function populateFilters(events) {
    var chatSelect = document.getElementById('ec-filter-chat');
    if (!chatSelect) return;

    // Extract unique locations
    var locations = new Set();
    events.forEach(function(e) {
      if (e.location) locations.add(e.location);
    });

    // Preserve current selection
    var currentVal = chatSelect.value;

    chatSelect.innerHTML = '<option value="">All Locations</option>';
    var sorted = Array.from(locations).sort();
    sorted.forEach(function(loc) {
      var option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      chatSelect.appendChild(option);
    });

    // Restore selection
    if (currentVal && locations.has(currentVal)) {
      chatSelect.value = currentVal;
    }
  }

  window.applyFilters = function() {
    var chatFilter = document.getElementById('ec-filter-chat').value;
    var importanceFilter = parseInt(document.getElementById('ec-filter-importance').value, 10) || 0;
    var searchFilter = (document.getElementById('ec-filter-search').value || '').toLowerCase();

    filteredEvents = allEvents.filter(function(e) {
      if (chatFilter && e.location !== chatFilter) return false;
      if (importanceFilter > 0 && (e.importance || 0) < importanceFilter) return false;
      if (searchFilter) {
        var haystack = [
          e.title || '',
          e.summary || '',
          (e.tags || []).join(' '),
          (e.participants || []).join(' '),
          e.location || ''
        ].join(' ').toLowerCase();
        if (haystack.indexOf(searchFilter) === -1) return false;
      }
      return true;
    });

    // Sort by id timestamp (oldest first)
    filteredEvents.sort(function(a, b) {
      return (a.id || '').localeCompare(b.id || '');
    });

    // Update count
    var countEl = document.getElementById('ec-event-count');
    if (countEl) {
      countEl.textContent = filteredEvents.length + ' / ' + allEvents.length + ' events';
    }

    renderTimeline(filteredEvents);
  };

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  function renderTimeline(events) {
    var container = document.getElementById('ec-timeline-container');

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="ec-empty"><div class="ec-empty-icon">📭</div><p>No events recorded yet. Start chatting to build your chronicle!</p></div>';
      return;
    }

    // Group by location
    var groups = groupByLocation(events);

    var html = '';
    groups.forEach(function(groupEvents, groupName) {
      html += '<div class="ec-group-header">' +
        '<h3>📍 ' + escapeHtml(groupName || 'Unplaced') + '</h3>' +
        '<span class="ec-badge">' + groupEvents.length + ' events</span>' +
        '</div>';

      for (var i = 0; i < groupEvents.length; i++) {
        html += renderEventCard(groupEvents[i]);
      }
    });

    container.innerHTML = html;
  }

  function groupByLocation(events) {
    var map = new Map();
    events.forEach(function(e) {
      var key = e.location || 'Unplaced';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }

  function renderEventCard(event) {
    var stars = renderStars(event.importance || 5);
    var tagsHtml = (event.tags || []).map(function(t) {
      return '<span class="ec-tag">' + escapeHtml(t) + '</span>';
    }).join('');

    // Extract timestamp from event id: evt_{timestamp}_{random}
    var timeStr = '';
    var id = event.id || '';
    var match = id.match(/evt_(\d+)/);
    if (match) {
      try {
        var ts = parseInt(match[1], 10);
        timeStr = new Date(ts).toLocaleString();
      } catch (e) {
        timeStr = '';
      }
    }

    // Escape event id for safe HTML attribute
    var safeId = escapeAttr(event.id || '');

    return (
      '<div class="ec-event-card" data-event-id="' + safeId + '">' +
        (timeStr ? '<div class="ec-event-time">📅 ' + escapeHtml(timeStr) + '</div>' : '') +
        '<div class="ec-event-card-header">' +
          '<span class="ec-event-title">' + escapeHtml(event.title || 'Untitled') + '</span>' +
          '<span class="ec-event-stars">' + stars + '</span>' +
        '</div>' +
        '<div class="ec-event-summary">' + escapeHtml(event.summary || '') + '</div>' +
        '<div class="ec-event-meta">' +
          (event.participants && event.participants.length ?
            '<span>👤 ' + escapeHtml(event.participants.join(', ')) + '</span>' : '') +
          (event.location ? '<span>📍 ' + escapeHtml(event.location) + '</span>' : '') +
        '</div>' +
        (event.tags && event.tags.length ?
          '<div class="ec-event-tags">' + tagsHtml + '</div>' : '') +
        '<div class="ec-event-actions">' +
          '<button class="ec-btn ec-btn-secondary ec-btn-sm" onclick="openEditModal(\'' + safeId + '\')">✏️ Edit</button>' +
          '<button class="ec-btn ec-btn-danger ec-btn-sm" onclick="confirmDelete(\'' + safeId + '\')">🗑 Delete</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderStars(importance) {
    var stars = '';
    for (var i = 1; i <= 10; i++) {
      stars += (i <= importance)
        ? '<span class="ec-star-filled">★</span>'
        : '<span class="ec-star-empty">☆</span>';
    }
    return stars;
  }

  // -----------------------------------------------------------------------
  // Export Memory
  // -----------------------------------------------------------------------

  window.exportMemory = function() {
    var bridge = getBridge();
    if (!bridge) return;

    var memory = bridge.exportMemory(null, {
      highlightThreshold: 6,
      groupBy: 'location',
    });

    if (memory) {
      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(memory).then(function() {
          alert('Memory prompt copied to clipboard! Paste it into a system message or author note.');
        }).catch(function() {
          showMemoryModal(memory);
        });
      } else {
        showMemoryModal(memory);
      }
    } else {
      alert('No events to export. Chat first to build your chronicle.');
    }
  };

  function showMemoryModal(text) {
    // Show in a modal/textarea for manual copy
    var overlay = document.createElement('div');
    overlay.className = 'ec-modal-overlay active';
    overlay.innerHTML = '<div class="ec-modal" style="max-width:700px;">' +
      '<h3>Memory Prompt</h3>' +
      '<p style="color:#999;margin-bottom:12px;font-size:13px;">Copy the text below and paste into your system prompt or author note.</p>' +
      '<textarea readonly style="width:100%;height:300px;font-size:12px;font-family:monospace;" onclick="this.select()">' +
      escapeHtml(text) +
      '</textarea>' +
      '<div class="ec-modal-actions">' +
        '<button class="ec-btn ec-btn-primary" onclick="this.closest(\'.ec-modal-overlay\').remove()">Close</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function() {
    // Try immediately, and retry after a short delay (API may not be ready)
    window.refreshTimeline();
    setTimeout(window.refreshTimeline, 2000);
  });

})();
