/**
 * GHOST — Background Service Worker (MV3)
 * Handles keyboard shortcut and relays fill to active tab.
 * If a PIN session key is cached in chrome.storage.session, decrypts
 * the profile before sending so credentials/financial fields fill correctly.
 */

'use strict';

// ── Crypto helpers (mirror of popup.js — background has no shared scope) ────
const b64  = (ab) => btoa(String.fromCharCode(...new Uint8Array(ab)));
const ub64 = (s)  => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function decryptBlob(blob, key) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(blob.iv) }, key, ub64(blob.ct)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

const SENSITIVE_PRO_KEYS = [
  'cardNumber','cvv','cardExpiry','cardHolder',
  'bankAccount','bankName','ifsc','gstin',
];

// Restore AES-GCM key from chrome.storage.session cache (set by popup on PIN unlock).
// Returns CryptoKey or null if no active session.
async function getSessionKey() {
  try {
    const d = await chrome.storage.session.get('ghostSessionKey');
    if (!d.ghostSessionKey) return null;
    return await crypto.subtle.importKey(
      'raw', ub64(d.ghostSessionKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
}

// Deep-decrypt a single profile using the session key.
async function decryptProfile(profile, key) {
  if (!key) return profile;
  const p = JSON.parse(JSON.stringify(profile)); // clone
  if (p.__enc_creds) {
    try { Object.assign(p.credentials, await decryptBlob(p.__enc_creds, key)); } catch {}
    delete p.__enc_creds;
  }
  if (p.__enc_fin) {
    try { Object.assign(p.professional, await decryptBlob(p.__enc_fin, key)); } catch {}
    delete p.__enc_fin;
  }
  return p;
}

// ── Get active profile, decrypted if session key is available ────────────────
async function getActiveProfile(data) {
  const raw = data.profiles?.[data.activeId];
  if (!raw) return null;
  const key = await getSessionKey();
  return decryptProfile(raw, key);
}

// ── Send fill to tab, injecting content script if needed ─────────────────────
async function sendFill(tabId, profile, settings) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'FILL_SMART', profile, settings });
  } catch {
    // Content script not yet injected — inject, then retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js'],
      });
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'FILL_SMART', profile, settings })
          .catch(() => {});
      }, 350);
    } catch { /* scripting not permitted on this tab (chrome://, pdf, etc.) */ }
  }
}

// ── Chrome native keyboard shortcut (Command+Shift+F / Ctrl+Shift+F) ─────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-autofill') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const data     = await chrome.storage.local.get(['profiles', 'activeId', 'settings']);
  const settings = data.settings || { highlight: true, fillHidden: false, fillSelect: true };
  const profile  = await getActiveProfile(data);
  if (!profile) return;

  await sendFill(tab.id, profile, settings);
});

// ── Handle SHORTCUT_FILL from content script keydown listener ────────────────
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type !== 'SHORTCUT_FILL') return;
  if (sender.id !== chrome.runtime.id || !sender.tab?.id) return;

  const data     = await chrome.storage.local.get(['profiles', 'activeId', 'settings']);
  const settings = data.settings || {};
  const profile  = await getActiveProfile(data);
  if (!profile) return;

  chrome.tabs.sendMessage(sender.tab.id, { type: 'FILL_SMART', profile, settings })
    .catch(() => {});
});
