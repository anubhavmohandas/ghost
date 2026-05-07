/**
 * AutoFill Pro — Popup Script v2
 */
'use strict';

// ── Storage ──────────────────────────────────────────────────────────────────
const store = {
  get: (k) => new Promise((r) => chrome.storage.local.get(k, r)),
  set: (o) => new Promise((r) => chrome.storage.local.set(o, r)),
};

// ── Empty profile ─────────────────────────────────────────────────────────────
function emptyProfile(name = 'Default') {
  return {
    name,
    personal: {
      firstName:'', lastName:'', middleName:'', fullName:'', displayName:'',
      dob:'', age:'', gender:'',
      nationality:'', placeOfBirth:'', passportNo:'', passportExpiry:'',
      nationalId:'', taxId:'', voterId:'', drivingLicence:'',
      bloodGroup:'', maritalStatus:'', medicalNotes:'',
      ecName:'', ecRelation:'', ecPhone:'',
    },
    contact: {
      email:'', emailAlt:'', phone:'', phoneAlt:'', whatsapp:'', fax:'',
      address1:'', address2:'', landmark:'', city:'', district:'', state:'',
      zip:'', country:'', countryCode:'', poBox:'',
      website:'', linkedin:'', github:'', twitter:'', instagram:'',
      skype:'', telegram:'', discord:'',
    },
    professional: {
      company:'', jobTitle:'', department:'', employeeId:'',
      yearsExp:'', noticePeriod:'', currentCtc:'', expectedCtc:'',
      skills:'', bio:'',
      degree:'', major:'', university:'', gradYear:'', gpa:'',
      bankName:'', bankAccount:'', ifsc:'', gstin:'',
      cardNumber:'', cardExpiry:'', cvv:'', cardHolder:'',
    },
    credentials: {
      username:'', password:'', passwordConfirm:'', otp:'', pin:'',
      secAnswer1:'', secAnswer2:'', secAnswer3:'',
      recoveryEmail:'', recoveryPhone:'',
    },
    custom: [],    // [{key, value}]
    payloads: [],  // [{name, body}]
  };
}

// ── State ─────────────────────────────────────────────────────────────────────
let profiles = {}, activeId = null;
let settings = { highlight: true, autoSave: false, fillHidden: false, fillSelect: true };

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const profileSelect   = $('profileSelect');
const toast           = $('toast');
const customList      = $('customFieldsList');
const payloadsList    = $('payloadsList');
const previewBody     = $('previewBody');
const settingHighlight  = $('settingHighlight');
const settingAutoSave   = $('settingAutoSave');
const settingFillHidden = $('settingFillHidden');
const settingFillSelect = $('settingFillSelect');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const d = await store.get(['profiles','activeId','settings']);
  settings = { ...settings, ...(d.settings || {}) };
  applySettings();

  if (d.profiles && Object.keys(d.profiles).length) {
    profiles = d.profiles;
    activeId = d.activeId && profiles[d.activeId] ? d.activeId : Object.keys(profiles)[0];
  } else {
    const id = uid();
    profiles = { [id]: emptyProfile('Default') };
    activeId = id;
    await persistAll();
  }
  renderProfileSelect();
  loadProfileIntoUI(activeId);
}

// ── Profile CRUD ──────────────────────────────────────────────────────────────
function renderProfileSelect() {
  profileSelect.innerHTML = '';
  Object.entries(profiles).forEach(([id, p]) => {
    const o = document.createElement('option');
    o.value = id; o.textContent = p.name; o.selected = id === activeId;
    profileSelect.appendChild(o);
  });
}

profileSelect.addEventListener('change', async () => {
  await saveCurrentProfile();
  activeId = profileSelect.value;
  loadProfileIntoUI(activeId);
  await store.set({ activeId });
});

$('addProfileBtn').addEventListener('click', async () => {
  const name = prompt('Profile name:', 'New Profile');
  if (!name) return;
  await saveCurrentProfile();
  const id = uid();
  profiles[id] = emptyProfile(name.trim());
  activeId = id;
  await persistAll();
  renderProfileSelect();
  loadProfileIntoUI(activeId);
  showToast('Profile created', 'success');
});

$('deleteProfileBtn').addEventListener('click', async () => {
  if (Object.keys(profiles).length <= 1) return showToast('Cannot delete only profile', 'error');
  if (!confirm(`Delete "${profiles[activeId].name}"?`)) return;
  delete profiles[activeId];
  activeId = Object.keys(profiles)[0];
  await persistAll();
  renderProfileSelect();
  loadProfileIntoUI(activeId);
  showToast('Deleted');
});

// ── Load / Save profile ───────────────────────────────────────────────────────
function loadProfileIntoUI(id) {
  const p = profiles[id];
  if (!p) return;

  // Bind all [data-field][data-section] inputs
  document.querySelectorAll('[data-field][data-section]').forEach((el) => {
    const sec = el.dataset.section;
    const key = el.dataset.field;
    if (p[sec]?.[key] !== undefined) el.value = p[sec][key];
  });

  renderCustomFields(p.custom || []);
  renderPayloads(p.payloads || []);
}

function collectCurrentProfile() {
  const p = profiles[activeId];
  if (!p) return;

  document.querySelectorAll('[data-field][data-section]').forEach((el) => {
    const sec = el.dataset.section;
    const key = el.dataset.field;
    if (p[sec]) p[sec][key] = el.value;
  });

  p.custom   = collectCustomFields();
  p.payloads = collectPayloads();
}

async function saveCurrentProfile() {
  collectCurrentProfile();
  await persistAll();
}

async function persistAll() {
  await store.set({ profiles, activeId, settings });
}

// ── Custom Fields ─────────────────────────────────────────────────────────────
function renderCustomFields(fields) {
  customList.innerHTML = '';
  fields.forEach((f) => appendCustomField(f.key, f.value));
}

function appendCustomField(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <input class="key-input" type="text" placeholder="CSS selector / name / id" value="${escHtml(key)}" />
    <input type="text" placeholder="Value to fill" value="${escHtml(value)}" />
    <button class="icon-btn btn-danger-icon" title="Remove">✕</button>
  `;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    if (settings.autoSave) saveCurrentProfile();
  });
  customList.appendChild(row);
}

function collectCustomFields() {
  return [...customList.querySelectorAll('.custom-field-row')].map((r) => {
    const [k, v] = r.querySelectorAll('input');
    return { key: k.value.trim(), value: v.value };
  }).filter((f) => f.key);
}

$('addCustomField').addEventListener('click', () => appendCustomField());

// ── Payloads ──────────────────────────────────────────────────────────────────
function renderPayloads(payloads) {
  payloadsList.innerHTML = '';
  if (!payloads.length) { appendPayload('', ''); return; }
  payloads.forEach((p) => appendPayload(p.name, p.body));
}

function appendPayload(name = '', body = '') {
  const item = document.createElement('div');
  item.className = 'payload-item';
  item.innerHTML = `
    <div class="payload-header">
      <input class="payload-name" type="text" placeholder="Payload name" value="${escHtml(name)}" />
      <button class="icon-btn payload-inject" title="Inject into focused field">⚡</button>
      <button class="icon-btn btn-danger-icon payload-delete" title="Delete">✕</button>
    </div>
    <textarea class="payload-body" rows="3" placeholder="Payload / test data...">${escHtml(body)}</textarea>
  `;
  item.querySelector('.payload-inject').addEventListener('click', () =>
    injectPayload(item.querySelector('.payload-body').value)
  );
  item.querySelector('.payload-delete').addEventListener('click', () => {
    item.remove();
    if (settings.autoSave) saveCurrentProfile();
  });
  payloadsList.appendChild(item);
}

function collectPayloads() {
  return [...payloadsList.querySelectorAll('.payload-item')].map((i) => ({
    name: i.querySelector('.payload-name').value.trim(),
    body: i.querySelector('.payload-body').value,
  })).filter((p) => p.name || p.body);
}

$('addPayload').addEventListener('click', () => appendPayload());

async function injectPayload(body) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_PAYLOAD', payload: body });
    showToast('Injected ⚡', 'success');
  } catch { showToast('No focused field on page', 'error'); }
}

// ── Fill ──────────────────────────────────────────────────────────────────────
$('fillAllBtn').addEventListener('click', async () => {
  await saveCurrentProfile();
  sendFill('FILL_ALL');
});
$('fillSmartBtn').addEventListener('click', async () => {
  await saveCurrentProfile();
  sendFill('FILL_SMART');
});

async function sendFill(type) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const p = profiles[activeId];
    const res = await chrome.tabs.sendMessage(tab.id, { type, profile: p, settings });
    showToast(`${res?.count ?? '?'} field(s) filled ✓`, 'success');
  } catch { showToast('Cannot fill this page', 'error'); }
}

// ── Preview detected fields ───────────────────────────────────────────────────
$('previewBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'PREVIEW_FIELDS', settings });
    previewBody.innerHTML = '';
    if (!res?.fields?.length) {
      previewBody.innerHTML = '<span style="color:var(--text-muted)">No detectable fields found on this page.</span>';
    } else {
      res.fields.forEach(({ profileKey, label, tagInfo }) => {
        const row = document.createElement('div');
        row.className = 'preview-row';
        row.innerHTML = `<span class="preview-key">${profileKey}</span><span class="preview-el">${escHtml(label || tagInfo)}</span>`;
        previewBody.appendChild(row);
      });
    }
    $('previewOverlay').classList.remove('hidden');
  } catch { showToast('Cannot read page fields', 'error'); }
});
$('closePreview').addEventListener('click', () => $('previewOverlay').classList.add('hidden'));

// ── Save btn ──────────────────────────────────────────────────────────────────
$('saveBtn').addEventListener('click', async () => {
  await saveCurrentProfile();
  showToast('Saved ✓', 'success');
});

document.addEventListener('input', () => {
  if (settings.autoSave) saveCurrentProfile();
});

// ── Export (AES-GCM) ──────────────────────────────────────────────────────────
$('exportBtn').addEventListener('click', async () => {
  await saveCurrentProfile();
  const passphrase = prompt('Export passphrase (blank = plain JSON):');
  const payload = JSON.stringify({ profiles, activeId }, null, 2);
  let blob;
  if (passphrase) {
    try {
      blob = new Blob([JSON.stringify(await aesEncrypt(payload, passphrase))], { type: 'application/json' });
    } catch { return showToast('Encryption failed', 'error'); }
  } else {
    blob = new Blob([payload], { type: 'application/json' });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `autofill-pro-backup-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ✓', 'success');
});

// ── Import ────────────────────────────────────────────────────────────────────
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  $('importFile').value = '';
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { return showToast('Invalid JSON', 'error'); }

  if (parsed.iv && parsed.salt && parsed.ciphertext) {
    const pp = prompt('Enter passphrase:');
    if (!pp) return;
    try { parsed = JSON.parse(await aesDecrypt(parsed, pp)); }
    catch { return showToast('Decryption failed', 'error'); }
  }

  if (!parsed.profiles) return showToast('Invalid backup', 'error');
  const merge = confirm('Merge? (Cancel = overwrite)');
  profiles = merge ? { ...profiles, ...parsed.profiles } : parsed.profiles;
  if (!merge) activeId = parsed.activeId || Object.keys(profiles)[0];
  await persistAll();
  renderProfileSelect();
  loadProfileIntoUI(activeId);
  showToast('Imported ✓', 'success');
});

// ── AES-GCM ───────────────────────────────────────────────────────────────────
async function deriveKey(pp, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']
  );
}
async function aesEncrypt(plain, pp) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(pp, salt);
  const ct   = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return { iv: b64(iv), salt: b64(salt), ciphertext: b64(new Uint8Array(ct)) };
}
async function aesDecrypt({ iv, salt, ciphertext }, pp) {
  const key  = await deriveKey(pp, ub64(salt));
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv: ub64(iv) }, key, ub64(ciphertext));
  return new TextDecoder().decode(plain);
}
const b64  = (buf) => btoa(String.fromCharCode(...buf));
const ub64 = (s)   => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ── Settings ──────────────────────────────────────────────────────────────────
function applySettings() {
  settingHighlight.checked  = settings.highlight;
  settingAutoSave.checked   = settings.autoSave;
  settingFillHidden.checked = settings.fillHidden;
  settingFillSelect.checked = settings.fillSelect;
}
$('settingsBtn').addEventListener('click', () => $('settingsOverlay').classList.remove('hidden'));
$('closeSettings').addEventListener('click', () => $('settingsOverlay').classList.add('hidden'));
[settingHighlight, settingAutoSave, settingFillHidden, settingFillSelect].forEach((el) => {
  el.addEventListener('change', async () => {
    settings.highlight  = settingHighlight.checked;
    settings.autoSave   = settingAutoSave.checked;
    settings.fillHidden = settingFillHidden.checked;
    settings.fillSelect = settingFillSelect.checked;
    await store.set({ settings });
  });
});
$('clearAllData').addEventListener('click', async () => {
  if (!confirm('Clear ALL data?')) return;
  await chrome.storage.local.clear();
  await init();
  showToast('Cleared');
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(`tab-${t.dataset.tab}`).classList.add('active');
  });
});

// ── Password toggle ───────────────────────────────────────────────────────────
$('togglePwd').addEventListener('click', () => {
  const i = $('pwdInput');
  const hide = i.type === 'password';
  i.type = hide ? 'text' : 'password';
  $('togglePwd').textContent = hide ? '🙈' : '👁';
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let tt;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''}`;
  clearTimeout(tt);
  tt = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
