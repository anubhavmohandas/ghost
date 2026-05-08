/**
 * AutoFill Pro — Background Service Worker (MV3)
 * Handles keyboard shortcut and relays fill to active tab.
 */

'use strict';

// ── Keyboard shortcut → fill active tab ──────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-autofill') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const data = await chrome.storage.local.get(['profiles', 'activeId', 'settings']);
  const profile  = data.profiles?.[data.activeId];
  const settings = data.settings || { highlight: true, autoSave: false, fillHidden: false };
  if (!profile) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_SMART',
      profile,
      settings,
    });
  } catch {
    // Content script not yet injected — inject it programmatically
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js'],
    });
    // Retry after injection settles
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { type: 'FILL_SMART', profile, settings });
    }, 300);
  }
});

// ── Handle SHORTCUT_FILL from content script keydown ─────────────────────────

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type !== 'SHORTCUT_FILL') return;
  // Verify sender is our own extension's content script running in a real tab
  if (sender.id !== chrome.runtime.id || !sender.tab?.id) return;
  const tabId = sender.tab.id;

  const data = await chrome.storage.local.get(['profiles', 'activeId', 'settings']);
  const profile  = data.profiles?.[data.activeId];
  const settings = data.settings || {};
  if (!profile) return;

  chrome.tabs.sendMessage(tabId, { type: 'FILL_SMART', profile, settings });
});
