// editor.js — Event Edit & Delete Operations
// =============================================================================

(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  var currentEditEventId = null;

  // -----------------------------------------------------------------------
  // API Access
  // -----------------------------------------------------------------------

  function getBridge() {
    if (window.parent && window.parent.EventChronicle) {
      return window.parent.EventChronicle;
    }
    if (window.EventChronicle) {
      return window.EventChronicle;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Find which chat an event belongs to
  // -----------------------------------------------------------------------

  function findChatIdForEvent(eventId) {
    var bridge = getBridge();
    if (!bridge) return null;

    var allEvents = bridge.getAllEvents();
    for (var i = 0; i < allEvents.length; i++) {
      if (allEvents[i].id === eventId) {
        return allEvents[i]._chatId || null;
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Edit Modal
  // -----------------------------------------------------------------------

  window.openEditModal = function(eventId) {
    var bridge = getBridge();
    if (!bridge) {
      alert('扩展不可用。');
      return;
    }

    var allEvents = bridge.getAllEvents();
    var event = null;
    for (var i = 0; i < allEvents.length; i++) {
      if (allEvents[i].id === eventId) {
        event = allEvents[i];
        break;
      }
    }
    if (!event) {
      alert('未找到该事件。');
      return;
    }

    currentEditEventId = eventId;

    document.getElementById('ec-modal-title').textContent = '编辑: ' + (event.title || '未命名');
    document.getElementById('ec-edit-title').value = event.title || '';
    document.getElementById('ec-edit-summary').value = event.summary || '';
    document.getElementById('ec-edit-importance').value = event.importance || 5;
    document.getElementById('ec-edit-participants').value = (event.participants || []).join(', ');
    document.getElementById('ec-edit-location').value = event.location || '';
    document.getElementById('ec-edit-tags').value = (event.tags || []).join(', ');

    document.getElementById('ec-edit-modal').classList.add('active');
  };

  window.closeEditModal = function() {
    document.getElementById('ec-edit-modal').classList.remove('active');
    currentEditEventId = null;
  };

  window.saveEdit = function() {
    var bridge = getBridge();
    if (!bridge || !currentEditEventId) return;

    var importanceVal = parseInt(document.getElementById('ec-edit-importance').value, 10);
    if (isNaN(importanceVal) || importanceVal < 1) importanceVal = 1;
    if (importanceVal > 10) importanceVal = 10;

    var updated = {
      id: currentEditEventId,
      title: document.getElementById('ec-edit-title').value.trim(),
      summary: document.getElementById('ec-edit-summary').value.trim(),
      importance: importanceVal,
      participants: document.getElementById('ec-edit-participants').value
        .split(',').map(function(s) { return s.trim(); }).filter(Boolean),
      location: document.getElementById('ec-edit-location').value.trim(),
      tags: document.getElementById('ec-edit-tags').value
        .split(',').map(function(s) { return s.trim(); }).filter(Boolean),
    };

    // Find which chat this event belongs to
    var chatId = findChatIdForEvent(currentEditEventId);

    if (!chatId) {
      alert('无法确定此事件所属的聊天。请刷新后重试。');
      return;
    }

    var result = bridge.updateEvent(chatId, updated);
    if (result) {
      closeEditModal();
      if (window.refreshTimeline) window.refreshTimeline();
    } else {
      alert('更新事件失败。该事件可能已被删除。');
    }
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  window.confirmDelete = function(eventId) {
    var bridge = getBridge();
    if (!bridge) return;

    // Find the event to show its title in the confirmation
    var allEvents = bridge.getAllEvents();
    var event = null;
    for (var i = 0; i < allEvents.length; i++) {
      if (allEvents[i].id === eventId) {
        event = allEvents[i];
        break;
      }
    }

    var title = event ? (event.title || '未命名') : eventId;
    if (!confirm('删除事件 "' + title + '"?\n\n此操作不可撤销。')) return;

    var chatId = findChatIdForEvent(eventId);
    if (!chatId) {
      alert('无法确定此事件所属的聊天。请刷新后重试。');
      return;
    }

    var deleted = bridge.deleteEvent(chatId, eventId);
    if (deleted) {
      if (window.refreshTimeline) window.refreshTimeline();
      // Toast notification
      if (window.parent && window.parent.toastr) {
        window.parent.toastr.success('事件已删除: ' + title);
      }
    } else {
      alert('删除事件失败。该事件可能已被删除。');
    }
  };

  // -----------------------------------------------------------------------
  // Modal close on overlay click & Escape key
  // -----------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function() {
    var overlay = document.getElementById('ec-edit-modal');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) window.closeEditModal();
      });
    }

    // Escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && currentEditEventId) {
        window.closeEditModal();
      }
    });
  });

})();
