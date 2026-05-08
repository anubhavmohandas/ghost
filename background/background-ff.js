/**
 * GHOST — Firefox Background Script (MV2)
 * Handles keyboard shortcut and relays fill to active tab.
 */
'use strict';

browser.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-autofill') return;
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab  = tabs[0];
  if (!tab?.id) return;

  const data     = await browser.storage.local.get(['profiles','activeId','settings']);
  const profile  = data.profiles?.[data.activeId];
  const settings = data.settings || {};
  if (!profile) return;

  try {
    await browser.tabs.sendMessage(tab.id, { type: 'FILL_SMART', profile, settings });
  } catch {
    await browser.tabs.executeScript(tab.id, { file: 'content/content.js' });
    setTimeout(() => {
      browser.tabs.sendMessage(tab.id, { type: 'FILL_SMART', profile, settings });
    }, 300);
  }
});

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type !== 'SHORTCUT_FILL') return;
  const tabId = sender.tab?.id;
  if (!tabId) return;
  const data    = await browser.storage.local.get(['profiles','activeId','settings']);
  const profile = data.profiles?.[data.activeId];
  if (!profile) return;
  browser.tabs.sendMessage(tabId, { type: 'FILL_SMART', profile, settings: data.settings || {} });
});
