/**
 * GHOST — Popup Script v3
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

// ── Themes ────────────────────────────────────────────────────────────────────
const PRESET_THEMES = {
  'purple-amber': {
    name: 'Purple Amber',
    vars: {
      '--bg': '#140b26', '--surface': '#1e1038', '--surface2': '#2a1848',
      '--border': '#3a2560', '--accent': '#FAAE7B', '--accent-hover': '#f09958',
      '--accent-glow': 'rgba(250,174,123,0.2)', '--highlight': '#b07de0',
      '--grad-a': '#7c3aed', '--grad-b': '#FAAE7B',
      '--text': '#f0e8ff', '--text-muted': '#8a6fc0',
    },
  },
  'teal-coral': {
    name: 'Teal × Coral',
    vars: {
      '--bg': '#061919', '--surface': '#0b2626', '--surface2': '#113232',
      '--border': '#1a4a4a', '--accent': '#ff6b6b', '--accent-hover': '#e85d5d',
      '--accent-glow': 'rgba(255,107,107,0.2)', '--highlight': '#00d4aa',
      '--grad-a': '#00b4a0', '--grad-b': '#ff6b6b',
      '--text': '#e0f8f4', '--text-muted': '#5a9e98',
    },
  },
  'synthwave': {
    name: 'Synthwave Dream',
    vars: {
      '--bg': '#0d0221', '--surface': '#170537', '--surface2': '#220848',
      '--border': '#3d1066', '--accent': '#f72585', '--accent-hover': '#d91f78',
      '--accent-glow': 'rgba(247,37,133,0.2)', '--highlight': '#7209b7',
      '--grad-a': '#7209b7', '--grad-b': '#f72585',
      '--text': '#f8eaff', '--text-muted': '#9b5de5',
    },
  },
  'synth-dusk': {
    name: 'Synth Dusk',
    vars: {
      '--bg': '#0f0c24', '--surface': '#181438', '--surface2': '#221c4a',
      '--border': '#352b60', '--accent': '#fb923c', '--accent-hover': '#ea7c20',
      '--accent-glow': 'rgba(251,146,60,0.2)', '--highlight': '#a855f7',
      '--grad-a': '#6d28d9', '--grad-b': '#fb923c',
      '--text': '#faf0ff', '--text-muted': '#7c5fc0',
    },
  },
};

const CUSTOM_COLOR_FIELDS = [
  { v: '--bg',         label: 'Background' },
  { v: '--surface',    label: 'Surface' },
  { v: '--surface2',   label: 'Surface 2' },
  { v: '--border',     label: 'Border' },
  { v: '--accent',     label: 'Accent' },
  { v: '--highlight',  label: 'Highlight' },
  { v: '--grad-a',     label: 'Gradient A' },
  { v: '--grad-b',     label: 'Gradient B' },
  { v: '--text',       label: 'Text' },
  { v: '--text-muted', label: 'Text Muted' },
];

let activeThemeId = 'purple-amber';

function applyThemeVars(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));
}

async function loadTheme() {
  const d = await store.get(['activeThemeId', 'customTheme']);
  activeThemeId = d.activeThemeId || 'purple-amber';
  if (activeThemeId === 'custom' && d.customTheme) {
    applyThemeVars(d.customTheme);
  } else if (PRESET_THEMES[activeThemeId]) {
    applyThemeVars(PRESET_THEMES[activeThemeId].vars);
  } else {
    applyThemeVars(PRESET_THEMES['purple-amber'].vars);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let profiles     = {}, activeId = null;
let siteBindings = {};   // { hostname: profileId }
let currentHost  = '';
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
const settingPill       = $('settingPill');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const d = await store.get(['profiles','activeId','settings','siteBindings']);
  settings     = { ...settings, ...(d.settings || {}) };
  siteBindings = d.siteBindings || {};
  await loadTheme();
  await applySettings();

  if (d.profiles && Object.keys(d.profiles).length) {
    profiles = d.profiles;
    activeId = d.activeId && profiles[d.activeId] ? d.activeId : Object.keys(profiles)[0];
  } else {
    const id = uid();
    profiles = { [id]: emptyProfile('Default') };
    activeId = id;
    await persistAll();
  }

  // Per-site auto-select
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentHost = new URL(tab.url).hostname;
      $('siteHostname').textContent = currentHost;
      if (siteBindings[currentHost] && profiles[siteBindings[currentHost]]) {
        activeId = siteBindings[currentHost];
        updateBindBtn(true);
      } else {
        updateBindBtn(false);
      }
    }
  } catch {}

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
  await store.set({ profiles, activeId, settings, siteBindings });
}

// ── Per-site binding ──────────────────────────────────────────────────────────
function updateBindBtn(bound) {
  const btn = $('bindBtn');
  if (!btn) return;
  if (bound) {
    btn.textContent = '🔗 Bound ✓';
    btn.classList.add('bound');
    btn.title = 'Click to unbind this site';
  } else {
    btn.textContent = '🔗 Bind site';
    btn.classList.remove('bound');
    btn.title = 'Bind current profile to this site';
  }
}

$('bindBtn').addEventListener('click', async () => {
  if (!currentHost) return showToast('No site detected', 'error');
  if (siteBindings[currentHost] === activeId) {
    // unbind
    delete siteBindings[currentHost];
    updateBindBtn(false);
    showToast(`Unbound from ${currentHost}`);
  } else {
    // bind
    siteBindings[currentHost] = activeId;
    updateBindBtn(true);
    showToast(`Bound "${profiles[activeId].name}" to ${currentHost}`, 'success');
  }
  await persistAll();
});

// ── Themes Panel ──────────────────────────────────────────────────────────────
function renderThemesPanel() {
  const grid = $('themePresetsGrid');
  grid.innerHTML = '';
  Object.entries(PRESET_THEMES).forEach(([id, theme]) => {
    const v = theme.vars;
    const card = document.createElement('div');
    card.className = `theme-card${activeThemeId === id ? ' active' : ''}`;
    card.dataset.themeId = id;
    card.innerHTML = `
      <div class="theme-card-preview" style="background:${v['--bg']}">
        <div class="tcp-header">
          <div class="tcp-dot" style="background:${v['--grad-a']}"></div>
          <div class="tcp-title" style="background:${v['--grad-b']}"></div>
        </div>
        <div class="tcp-tabs">
          <div class="tcp-tab act" style="background:${v['--highlight']}"></div>
          <div class="tcp-tab" style="background:${v['--text-muted']}"></div>
          <div class="tcp-tab" style="background:${v['--text-muted']}"></div>
        </div>
        <div style="display:flex;gap:3px;padding-top:2px">
          <div class="tcp-btn" style="background:linear-gradient(90deg,${v['--grad-a']},${v['--grad-b']})"></div>
          <div class="tcp-btn2" style="border-color:${v['--accent']}"></div>
        </div>
        <div class="tcp-row">
          <div class="tcp-field" style="background:${v['--surface2']}"></div>
          <div class="tcp-field" style="background:${v['--surface2']}"></div>
        </div>
      </div>
      <div class="theme-card-label">
        <span>${escHtml(theme.name)}</span>
        ${id === 'purple-amber' ? '<span class="theme-card-badge">DEFAULT</span>' : ''}
      </div>
    `;
    card.addEventListener('click', async () => {
      activeThemeId = id;
      applyThemeVars(theme.vars);
      await store.set({ activeThemeId });
      document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      syncCustomBuilderToVars(theme.vars);
      showToast(`Theme: ${theme.name}`, 'success');
    });
    grid.appendChild(card);
  });
  buildCustomBuilder();
}

function buildCustomBuilder() {
  const grid = $('colorGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const baseVars = activeThemeId === 'custom'
    ? null
    : (PRESET_THEMES[activeThemeId]?.vars || PRESET_THEMES['purple-amber'].vars);

  CUSTOM_COLOR_FIELDS.forEach(({ v: varName, label }) => {
    // Read live computed value (captures whatever is currently applied)
    const liveVal = getComputedStyle(document.documentElement)
      .getPropertyValue(varName).trim() || '#000000';
    const isHex = /^#[0-9a-fA-F]{6}$/i.test(liveVal);

    const row = document.createElement('div');
    row.className = 'color-row';
    row.dataset.var = varName;
    row.innerHTML = `
      <label>${escHtml(label)}</label>
      <div class="color-row-inline">
        <input type="color" value="${isHex ? liveVal : '#7c3aed'}" />
        <input class="color-hex" type="text" value="${escHtml(liveVal)}" maxlength="40" />
      </div>
    `;
    const picker  = row.querySelector('input[type="color"]');
    const hexInp  = row.querySelector('.color-hex');

    picker.addEventListener('input', () => {
      hexInp.value = picker.value;
      document.documentElement.style.setProperty(varName, picker.value);
    });
    hexInp.addEventListener('change', () => {
      const val = hexInp.value.trim();
      document.documentElement.style.setProperty(varName, val);
      if (/^#[0-9a-fA-F]{6}$/i.test(val)) picker.value = val;
    });
    grid.appendChild(row);
  });
}

function syncCustomBuilderToVars(vars) {
  CUSTOM_COLOR_FIELDS.forEach(({ v: varName }) => {
    const row = document.querySelector(`.color-row[data-var="${varName}"]`);
    if (!row) return;
    const val = vars[varName] || '#000000';
    const picker = row.querySelector('input[type="color"]');
    const hexInp = row.querySelector('.color-hex');
    if (hexInp) hexInp.value = val;
    if (picker && /^#[0-9a-fA-F]{6}$/i.test(val)) picker.value = val;
  });
}

function collectCustomVars() {
  const vars = {};
  CUSTOM_COLOR_FIELDS.forEach(({ v: varName }) => {
    const row = document.querySelector(`.color-row[data-var="${varName}"]`);
    if (row) vars[varName] = row.querySelector('.color-hex').value.trim();
  });
  // Derive accent-hover & accent-glow from accent if possible
  if (vars['--accent']) {
    vars['--accent-hover'] = vars['--accent'];
    const hex = vars['--accent'].replace('#','');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      vars['--accent-glow'] = `rgba(${r},${g},${b},0.2)`;
    }
  }
  return vars;
}

$('themesBtn').addEventListener('click', () => {
  renderThemesPanel();
  $('themesOverlay').classList.remove('hidden');
});
$('closeThemes').addEventListener('click', () => $('themesOverlay').classList.add('hidden'));

$('applyCustomBtn').addEventListener('click', () => {
  const vars = collectCustomVars();
  applyThemeVars(vars);
  showToast('Custom theme applied', 'success');
});

$('saveCustomBtn').addEventListener('click', async () => {
  const vars = collectCustomVars();
  applyThemeVars(vars);
  activeThemeId = 'custom';
  await store.set({ activeThemeId, customTheme: vars });
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('active'));
  showToast('Custom theme saved ✓', 'success');
});

$('resetCustomBtn').addEventListener('click', () => {
  const base = PRESET_THEMES[activeThemeId === 'custom' ? 'purple-amber' : activeThemeId];
  if (base) {
    applyThemeVars(base.vars);
    syncCustomBuilderToVars(base.vars);
  }
});

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
  a.href = url; a.download = `ghost-backup-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ✓', 'success');
  setTimeout(() => showDriveReminder(), 900);
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
async function applySettings() {
  settingHighlight.checked  = settings.highlight;
  settingAutoSave.checked   = settings.autoSave;
  settingFillHidden.checked = settings.fillHidden;
  settingFillSelect.checked = settings.fillSelect;
  // pill toggle — stored separately so content script can read it independently
  const pd = await store.get(['pillEnabled']);
  settingPill.checked = pd.pillEnabled !== false; // default true
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
settingPill.addEventListener('change', async () => {
  await store.set({ pillEnabled: settingPill.checked });
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

// ── Drive Reminder ────────────────────────────────────────────────────────────
function showDriveReminder() {
  const existing = $('driveReminder');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'driveReminder';
  bar.className = 'drive-reminder';
  bar.innerHTML = `
    <span class="drive-reminder-icon">☁️</span>
    <span class="drive-reminder-text">Keep it safe — back up to Google Drive</span>
    <a class="drive-reminder-btn" href="https://drive.google.com" target="_blank" rel="noopener">Open Drive →</a>
    <button class="drive-reminder-close icon-btn" title="Dismiss">✕</button>
  `;
  bar.querySelector('.drive-reminder-close').addEventListener('click', () => bar.remove());
  document.querySelector('.app').appendChild(bar);

  // Auto-dismiss after 12 s
  setTimeout(() => { if (bar.parentNode) bar.remove(); }, 12000);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DOB → Auto Age ────────────────────────────────────────────────────────────
function calcAge(dobValue) {
  if (!dobValue) return '';
  const dob  = new Date(dobValue);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age > 0 ? String(age) : '';
}

document.addEventListener('change', (e) => {
  if (e.target.dataset.field === 'dob') {
    const ageEl = $('ageInput');
    if (ageEl) {
      ageEl.value = calcAge(e.target.value);
      // also persist into profile
      const p = profiles[activeId];
      if (p?.personal) p.personal.age = ageEl.value;
    }
  }
});

// ── Dictation Mode ────────────────────────────────────────────────────────────

// Fields to cycle through during dictation (label + data-field key)
const DICTATION_FIELDS = [
  { label: 'First Name',    section: 'personal',     key: 'firstName' },
  { label: 'Last Name',     section: 'personal',     key: 'lastName' },
  { label: 'Email',         section: 'contact',      key: 'email' },
  { label: 'Phone',         section: 'contact',      key: 'phone' },
  { label: 'Date of Birth', section: 'personal',     key: 'dob' },
  { label: 'City',          section: 'contact',      key: 'city' },
  { label: 'State',         section: 'contact',      key: 'state' },
  { label: 'Country',       section: 'contact',      key: 'country' },
  { label: 'Company',       section: 'professional', key: 'company' },
  { label: 'Job Title',     section: 'professional', key: 'jobTitle' },
  { label: 'Username',      section: 'credentials',  key: 'username' },
];

let dictating    = false;
let dictIndex    = 0;
let recognition  = null;

const dictateBtn    = $('dictateBtn');
const dictateStatus = $('dictateStatus');
const dictateSkip   = $('dictateSkip');

function stopDictation(msg = 'Dictation stopped') {
  dictating = false;
  if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
  dictateBtn.textContent = '🎤 Dictate';
  dictateBtn.className   = 'btn-dictate';
  dictateStatus.textContent = msg;
  dictateSkip.style.display = 'none';
}

function nextDictationField() {
  if (dictIndex >= DICTATION_FIELDS.length) {
    saveCurrentProfile();
    stopDictation('All done — profile saved ✓');
    dictateBtn.classList.add('done');
    return;
  }

  const field = DICTATION_FIELDS[dictIndex];
  dictateStatus.textContent = `🎤 Say your ${field.label}...`;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    stopDictation('Speech recognition not supported in this browser');
    return;
  }

  recognition = new SR();
  recognition.lang = 'en-IN'; // Indian English — handles accents better
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e) => {
    const val = e.results[0][0].transcript.trim();
    const p = profiles[activeId];
    if (p?.[field.section]) {
      p[field.section][field.key] = val;
      // update UI input
      const el = document.querySelector(`[data-field="${field.key}"][data-section="${field.section}"]`);
      if (el) el.value = val;
      // auto age if DOB was dictated
      if (field.key === 'dob') {
        const parsed = new Date(val);
        if (!isNaN(parsed)) {
          const iso = parsed.toISOString().split('T')[0];
          if (el) el.value = iso;
          p.personal.dob = iso;
          const ageEl = $('ageInput');
          if (ageEl) { ageEl.value = calcAge(iso); p.personal.age = ageEl.value; }
        }
      }
    }
    dictateStatus.textContent = `✓ ${field.label}: "${val}"`;
    dictIndex++;
    setTimeout(() => { if (dictating) nextDictationField(); }, 800);
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      dictateStatus.textContent = `No speech detected — skipping ${field.label}`;
      dictIndex++;
      setTimeout(() => { if (dictating) nextDictationField(); }, 600);
    } else if (e.error === 'not-allowed') {
      stopDictation('Mic blocked — allow microphone in browser settings then retry');
    } else {
      stopDictation(`Error: ${e.error}`);
    }
  };

  recognition.start();
}

dictateBtn.addEventListener('click', async () => {
  if (dictating) {
    stopDictation('Dictation cancelled');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('Speech API not supported here', 'error');
    return;
  }
  // Request mic permission explicitly — Chrome extensions require this before SpeechRecognition works
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // release immediately, we only needed the permission grant
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Mic blocked — click the 🎤 icon in your address bar to allow microphone'
      : `Mic error: ${err.message}`;
    showToast(msg, 'error');
    dictateStatus.textContent = msg;
    return;
  }
  dictating  = true;
  dictIndex  = 0;
  dictateBtn.textContent = '⏹ Stop';
  dictateBtn.className   = 'btn-dictate listening';
  dictateSkip.style.display = 'inline-block';
  nextDictationField();
});

dictateSkip.addEventListener('click', () => {
  if (!dictating) return;
  try { if (recognition) recognition.stop(); } catch {}
  dictIndex++;
  setTimeout(() => { if (dictating) nextDictationField(); }, 200);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
