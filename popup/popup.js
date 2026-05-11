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
let settings = { highlight: true, autoSave: false, fillHidden: false, fillSelect: true, autoLockMs: 0 };

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

  await initPinLock(); // blocks until PIN verified or skipped
  updatePinSettingsUI();

  if (d.profiles && Object.keys(d.profiles).length) {
    profiles = await decryptFromStorage(d.profiles); // no-op if no PIN
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

  // Apply any pending dictation results written while popup was closed
  await applyPendingDictation();

  // Load IRCTC data (lazy UI init happens on tab click, but data loads now)
  await loadIrctcData();
}

// ── Apply dictation results that were saved while popup was closed ─────────────
async function applyPendingDictation() {
  const d = await store.get('dictationResult');
  if (!d.dictationResult) return;
  const { results, profileId } = d.dictationResult;
  if (!results) return;

  // DI-03: skip if dictation was recorded for a different profile
  if (profileId && profileId !== activeId) {
    console.warn('[GHOST] Dictation profileId mismatch — skipping to prevent cross-profile corruption');
    return;
  }

  const p = profiles[activeId];
  if (!p) return;

  for (const [key, { section, value }] of Object.entries(results)) {
    if (p[section]) {
      p[section][key] = value;
      const el = document.querySelector(`[data-field="${key}"][data-section="${section}"]`);
      if (el) el.value = value;
      if (key === 'dob') {
        const parsed = new Date(value);
        if (!isNaN(parsed)) {
          const iso = parsed.toISOString().split('T')[0];
          if (el) el.value = iso;
          p.personal.dob = iso;
          const ageEl = $('ageInput');
          if (ageEl) { ageEl.value = calcAge(iso); p.personal.age = ageEl.value; }
        }
      }
    }
  }

  const saved = await saveCurrentProfile();
  if (saved) {
    showToast('Dictation results applied ✓', 'success');
    if ($('dictateStatus')) $('dictateStatus').textContent = '✓ Dictation applied';
    await chrome.storage.local.remove('dictationResult');
  } else {
    showToast('Dictation received — save failed', 'error');
    if ($('dictateStatus')) $('dictateStatus').textContent = '⚠ Dictation save failed';
  }
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

  const deferred = []; // type="password" fields — set after Chrome's autocomplete manager settles

  document.querySelectorAll('[data-field][data-section]').forEach((el) => {
    const sec = el.dataset.section;
    const key = el.dataset.field;
    if (p[sec]?.[key] === undefined) return;
    const val = p[sec][key];
    if (el.type === 'password' && val) {
      deferred.push({ el, val }); // defer — Chrome clears password values set at DOM load time
    } else {
      el.value = val;
    }
  });

  // Chrome deliberately clears programmatically-set type="password" values in
  // extension popups during its autocomplete pass. 250ms defers past that window.
  if (deferred.length) {
    setTimeout(() => deferred.forEach(({ el, val }) => { el.value = val; }), 250);
  }

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
  // Validate password match — only when BOTH fields have values (BUG-06)
  const pwdEl  = document.querySelector('[data-field="password"][data-section="credentials"]');
  const cfmEl  = document.querySelector('[data-field="passwordConfirm"][data-section="credentials"]');
  if (pwdEl && cfmEl && pwdEl.value && cfmEl.value && pwdEl.value !== cfmEl.value) {
    showToast('Password and Confirm Password do not match', 'error');
    cfmEl.focus();
    cfmEl.style.borderColor = 'var(--error, #f87171)';
    setTimeout(() => { cfmEl.style.borderColor = ''; }, 2500);
    return false; // BUG-04: return bool so callers can check
  }
  collectCurrentProfile();
  await persistAll();
  return true;
}

async function persistAll() {
  const toStore = sessionKey ? await encryptForStorage(profiles) : profiles;
  await store.set({ profiles: toStore, activeId, settings, siteBindings });
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
        row.innerHTML = `<span class="preview-key">${escHtml(profileKey)}</span><span class="preview-el">${escHtml(label || tagInfo)}</span>`;
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
  const passphrase = await showPassphraseModal(
    'Export Passphrase',
    'Encrypts the backup file. Leave blank for plain JSON (not recommended).',
    'Passphrase (optional)'
  );
  if (passphrase === null) return; // user cancelled
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
    const pp = await showPassphraseModal(
      'Import Passphrase',
      'Enter the passphrase used when this backup was exported.'
    );
    if (pp === null) return; // user cancelled
    try { parsed = JSON.parse(await aesDecrypt(parsed, pp)); }
    catch { return showToast('Decryption failed', 'error'); }
  }

  if (!parsed.profiles || typeof parsed.profiles !== 'object' || Array.isArray(parsed.profiles))
    return showToast('Invalid backup — missing profiles', 'error');

  // Schema guard: each profile must be an object with a name string
  const isValidProfile = (p) =>
    p && typeof p === 'object' && !Array.isArray(p) && typeof p.name === 'string'
    && ['personal','contact','professional','credentials'].every((s) => typeof (p[s] || {}) === 'object')
    && Array.isArray(p.custom || []) && Array.isArray(p.payloads || []);

  const badProfiles = Object.values(parsed.profiles).filter((p) => !isValidProfile(p));
  if (badProfiles.length) return showToast(`Invalid backup — ${badProfiles.length} malformed profile(s)`, 'error');

  const merge = confirm('Merge? (Cancel = overwrite)');
  profiles = merge ? { ...profiles, ...parsed.profiles } : parsed.profiles;
  if (!merge) activeId = parsed.activeId && parsed.profiles[parsed.activeId]
    ? parsed.activeId : Object.keys(profiles)[0];
  await persistAll();
  renderProfileSelect();
  loadProfileIntoUI(activeId);
  showToast('Imported ✓', 'success');
});

// ── AES-GCM ───────────────────────────────────────────────────────────────────
async function deriveKey(pp, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']
  );
}
async function aesEncrypt(plain, pp) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
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
// Chunked b64 — avoids call-stack overflow on large buffers (spread limit ~65k args)
const b64 = (buf) => {
  let s = '';
  const chunk = 0x8000; // 32k per chunk — well under V8's stack limit
  for (let i = 0; i < buf.length; i += chunk)
    s += String.fromCharCode(...buf.subarray ? buf.subarray(i, i + chunk) : Array.from(buf).slice(i, i + chunk));
  return btoa(s);
};
const ub64 = (s)   => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ── PIN Lock & At-Rest Encryption ─────────────────────────────────────────────
// sessionKey: AES-GCM CryptoKey held only in memory for this popup session.
// Sensitive fields (credentials + financial) are encrypted before chrome.storage writes
// and decrypted after reads. Key is derived from the user's PIN via PBKDF2.
//
// Session persistence: after a successful PIN unlock, the raw key bytes are cached in
// chrome.storage.session (MV3 in-memory storage — survives popup close/reopen but clears
// on browser restart). This means PIN is only required once per browser session.

let sessionKey    = null;
let pinConfigured = false;

// Cache sessionKey into chrome.storage.session so next popup open doesn't re-prompt.
async function cacheSessionKey(key) {
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.session.set({ ghostSessionKey: b64(new Uint8Array(raw)) });
  } catch { /* storage.session unavailable (e.g. Firefox) — silent */ }
}

// Write the auto-lock expiry into session storage (0 = never).
async function scheduleLockAt() {
  const ms = settings.autoLockMs || 0;
  if (ms <= 0) {
    await chrome.storage.session.remove('ghostLockAt').catch(() => {});
    return;
  }
  const lockAt = Date.now() + ms;
  await chrome.storage.session.set({ ghostLockAt: lockAt }).catch(() => {});
}

// Attempt to restore sessionKey from chrome.storage.session cache.
// Returns true if successful, false if cache miss or error.
async function tryRestoreSessionKey() {
  try {
    const d = await chrome.storage.session.get(['ghostSessionKey', 'ghostLockAt']);
    if (!d.ghostSessionKey) return false;
    // Auto-lock: if expiry is set and has passed, treat as cache miss
    if (d.ghostLockAt && Date.now() >= d.ghostLockAt) {
      await clearSessionCache();
      return false;
    }
    sessionKey = await crypto.subtle.importKey(
      'raw', ub64(d.ghostSessionKey), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
    return true;
  } catch {
    return false;
  }
}

// Wipe session cache — call when PIN is removed or changed.
async function clearSessionCache() {
  try { await chrome.storage.session.remove(['ghostSessionKey', 'ghostLockAt']); } catch {}
}

const SENSITIVE_PRO_KEYS = [
  'cardNumber','cvv','cardExpiry','cardHolder',
  'bankAccount','bankName','ifsc','gstin',
];

// Derive AES-GCM encryption key from PIN + dedicated key-salt
async function derivePinKey(pin, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
}

// Derive verification hash from PIN + separate hash-salt (never same salt as key)
async function derivePinHash(pin, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' }, km, 256
  );
  return b64(new Uint8Array(bits));
}

// Encrypt a JS object → { iv, ct } blob using current sessionKey
async function encryptBlob(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, sessionKey,
    new TextEncoder().encode(JSON.stringify(obj))
  );
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

// Decrypt { iv, ct } blob → JS object
async function decryptBlob(blob) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(blob.iv) }, sessionKey, ub64(blob.ct)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

// Deep-clone profiles, encrypt sensitive fields, return clone for storage
async function encryptForStorage(profs) {
  if (!sessionKey) return profs;
  const out = JSON.parse(JSON.stringify(profs));
  for (const p of Object.values(out)) {
    // Encrypt entire credentials section
    if (p.credentials) {
      p.__enc_creds = await encryptBlob(p.credentials);
      Object.keys(p.credentials).forEach(k => p.credentials[k] = '');
    }
    // Encrypt sensitive financial keys from professional
    const fin = {};
    SENSITIVE_PRO_KEYS.forEach(k => {
      if (p.professional?.[k]) { fin[k] = p.professional[k]; p.professional[k] = ''; }
    });
    if (Object.keys(fin).length) p.__enc_fin = await encryptBlob(fin);
  }
  return out;
}

// Deep-clone profiles from storage, decrypt sensitive fields, return plaintext clone
async function decryptFromStorage(profs) {
  if (!sessionKey) return profs;
  const out = JSON.parse(JSON.stringify(profs));
  for (const p of Object.values(out)) {
    if (p.__enc_creds) {
      try { Object.assign(p.credentials, await decryptBlob(p.__enc_creds)); } catch { /* wrong key */ }
      delete p.__enc_creds;
    }
    if (p.__enc_fin) {
      try { Object.assign(p.professional, await decryptBlob(p.__enc_fin)); } catch { /* wrong key */ }
      delete p.__enc_fin;
    }
  }
  return out;
}

// ── Passphrase Modal (replaces browser prompt()) ───────────────────────────────
// Returns passphrase string, '' for blank, or null for cancelled.
function showPassphraseModal(title, subtitle, placeholder = 'Passphrase') {
  return new Promise((resolve) => {
    $('ppTitle').textContent    = title;
    $('ppSubtitle').textContent = subtitle;
    $('ppInput').placeholder    = placeholder;
    $('ppInput').value          = '';
    $('ppInput').type           = 'password';
    $('ppToggleBtn').textContent = '👁';
    $('passphraseModal').classList.remove('hidden');

    const cleanup = () => {
      $('passphraseModal').classList.add('hidden');
      $('ppConfirmBtn').removeEventListener('click', onOk);
      $('ppCancelBtn').removeEventListener('click', onCancel);
    };
    const onOk     = () => { cleanup(); resolve($('ppInput').value); };
    const onCancel = () => { cleanup(); resolve(null); };

    $('ppConfirmBtn').addEventListener('click', onOk);
    $('ppCancelBtn').addEventListener('click', onCancel);
    $('ppInput').addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter')  { $('ppInput').removeEventListener('keydown', handler); onOk(); }
      if (e.key === 'Escape') { $('ppInput').removeEventListener('keydown', handler); onCancel(); }
    });
    setTimeout(() => $('ppInput').focus(), 50);
  });
}

$('ppToggleBtn').addEventListener('click', () => {
  const i = $('ppInput');
  const hide = i.type === 'password';
  i.type = hide ? 'text' : 'password';
  $('ppToggleBtn').textContent = hide ? '🙈' : '👁';
});

// ── PIN Overlay — core show function (used by both init and settings) ──────────
// Shows the PIN overlay, wires up all listeners via AbortController so they are
// guaranteed cleaned up after the overlay resolves — no stale handlers persist.
function runPinOverlay({ mode, pinData }) {
  // mode: 'unlock' | 'set'
  const overlay   = $('pinOverlay');
  const pinInput  = $('pinInput');
  const pinCfm    = $('pinConfirmInput');
  const pinError  = $('pinError');
  const submitBtn = $('pinSubmitBtn');
  const skipBtn   = $('pinSkipBtn');

  pinInput.value = ''; pinCfm.value = '';
  pinError.classList.add('hidden');

  if (mode === 'set') {
    $('pinTitle').textContent    = pinConfigured ? 'Change PIN' : 'Secure your data';
    $('pinSubtitle').textContent = 'Set a PIN to encrypt passwords and card details at rest.';
    submitBtn.textContent = 'Set PIN';
    pinCfm.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    skipBtn.textContent = 'Skip — set up later in Settings';
  } else {
    $('pinTitle').textContent    = 'Unlock GHOST';
    $('pinSubtitle').textContent = 'Enter your PIN to decrypt and access your profiles';
    submitBtn.textContent = 'Unlock';
    pinCfm.classList.add('hidden');
    skipBtn.classList.remove('hidden');
    skipBtn.textContent = 'Forgot PIN? Clear all data in Settings';
  }

  overlay.classList.remove('hidden');
  setTimeout(() => pinInput.focus(), 50);

  return new Promise((resolve) => {
    const ac = new AbortController();
    const sig = { signal: ac.signal };

    function cleanup(result) {
      ac.abort(); // removes all listeners attached with this signal
      overlay.classList.add('hidden');
      resolve(result);
    }

    async function attempt() {
      const pin = pinInput.value.trim();
      if (!pin) {
        pinError.textContent = 'Please enter a PIN';
        pinError.classList.remove('hidden');
        return;
      }
      pinError.classList.add('hidden');
      submitBtn.disabled = true;

      try {
        if (mode === 'set') {
          const cfm = pinCfm.value.trim();
          if (pin !== cfm) {
            pinError.textContent = 'PINs do not match';
            pinError.classList.remove('hidden');
            pinCfm.value = ''; pinCfm.focus();
            return;
          }
          const hashSalt = crypto.getRandomValues(new Uint8Array(32));
          const keySalt  = crypto.getRandomValues(new Uint8Array(32));
          const pinHash  = await derivePinHash(pin, hashSalt);
          sessionKey     = await derivePinKey(pin, keySalt);
          pinConfigured  = true;
          await store.set({ pinHash, pinSalt: b64(hashSalt), pinKeySalt: b64(keySalt) });
          await cacheSessionKey(sessionKey); // persist across popup close/reopen
          await scheduleLockAt();
          cleanup({ ok: true });
        } else {
          // unlock
          submitBtn.textContent = 'Checking…';
          const attempt = await derivePinHash(pin, ub64(pinData.pinSalt));
          if (attempt !== pinData.pinHash) {
            pinError.textContent = 'Incorrect PIN — try again';
            pinError.classList.remove('hidden');
            pinInput.value = ''; pinInput.focus();
          } else {
            sessionKey = await derivePinKey(pin, ub64(pinData.pinKeySalt));
            await cacheSessionKey(sessionKey); // persist across popup close/reopen
            await scheduleLockAt();
            cleanup({ ok: true });
          }
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'set' ? 'Set PIN' : 'Unlock';
      }
    }

    submitBtn.addEventListener('click', attempt, sig);
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); }, sig);
    pinCfm.addEventListener('keydown',   e => { if (e.key === 'Enter') attempt(); }, sig);
    skipBtn.addEventListener('click', () => cleanup({ ok: false, skipped: true }), sig);
  });
}

// ── initPinLock — called once from init() ─────────────────────────────────────
async function initPinLock() {
  const d = await store.get(['pinHash', 'pinSalt', 'pinKeySalt']);
  pinConfigured = !!(d.pinHash && d.pinSalt && d.pinKeySalt);

  // No PIN configured — proceed without any prompt.
  // User can set a PIN any time via Settings → Security.
  if (!pinConfigured) return;

  // PIN is configured. Try to restore session key from cache first.
  // If cache hit (same browser session, popup just closed/reopened) — no prompt needed.
  const restored = await tryRestoreSessionKey();
  if (restored) { await scheduleLockAt(); return; }

  // Cache miss (browser restarted) — must prompt for PIN.
  await runPinOverlay({ mode: 'unlock', pinData: d });
  // Re-arm timer after each successful unlock
  if (sessionKey) await scheduleLockAt();
}

// ── PIN management from Settings ───────────────────────────────────────────────
function updatePinSettingsUI() {
  const label     = $('pinStatusLabel');
  const setBtn    = $('setPinBtn');
  const removeBtn = $('removePinBtn');
  const lockBtn   = $('lockNowBtn');
  const alRow     = $('autoLockRow');
  if (pinConfigured) {
    label.textContent = '🔒 Active';
    label.style.color = 'var(--success)';
    setBtn.classList.add('hidden');
    removeBtn.classList.remove('hidden');
    if (lockBtn) lockBtn.classList.remove('hidden');
    if (alRow)  alRow.classList.remove('hidden');
  } else {
    label.textContent = 'Not set';
    label.style.color = '';
    setBtn.classList.remove('hidden');
    removeBtn.classList.add('hidden');
    if (lockBtn) lockBtn.classList.add('hidden');
    if (alRow)  alRow.classList.add('hidden');
  }
}

// Lock Now — clears session key cache so next popup open requires PIN again
const _lockNowBtn = $('lockNowBtn');
if (_lockNowBtn) {
  _lockNowBtn.addEventListener('click', async () => {
    await clearSessionCache();
    sessionKey = null;
    showToast('GHOST locked 🔒', 'success');
    setTimeout(() => window.close(), 800);
  });
}

$('setPinBtn').addEventListener('click', async () => {
  $('settingsOverlay').classList.add('hidden');
  await clearSessionCache(); // clear any old cached key before setting new one
  const result = await runPinOverlay({ mode: 'set', pinData: null });
  if (result.ok) {
    await persistAll(); // re-encrypt existing profiles with new key
    updatePinSettingsUI();
    showToast('PIN set — data encrypted ✓', 'success');
  }
  $('settingsOverlay').classList.remove('hidden');
});

$('removePinBtn').addEventListener('click', async () => {
  if (!pinConfigured) return;
  const pp = await showPassphraseModal(
    'Confirm current PIN',
    'Enter your PIN to remove encryption. Data will be stored in plaintext.',
    'Current PIN'
  );
  if (pp === null) return;

  const d = await store.get(['pinHash', 'pinSalt']);
  const check = await derivePinHash(pp, ub64(d.pinSalt));
  if (check !== d.pinHash) return showToast('Incorrect PIN', 'error');

  // profiles already decrypted in memory — null the key so persistAll writes plaintext
  sessionKey    = null;
  pinConfigured = false;
  await clearSessionCache();
  await chrome.storage.local.remove(['pinHash', 'pinSalt', 'pinKeySalt']);
  await store.set({ profiles, activeId, settings, siteBindings });
  updatePinSettingsUI();
  showToast('PIN removed — data stored in plaintext', 'success');
});


// ── Settings ──────────────────────────────────────────────────────────────────
async function applySettings() {
  settingHighlight.checked  = settings.highlight;
  settingAutoSave.checked   = settings.autoSave;
  settingFillHidden.checked = settings.fillHidden;
  settingFillSelect.checked = settings.fillSelect;
  // pill toggle — stored separately so content script can read it independently
  const pd = await store.get(['pillEnabled']);
  settingPill.checked = pd.pillEnabled === true; // default false — user must opt in
  // auto-lock dropdown
  const alSel = $('autoLockSelect');
  if (alSel) alSel.value = String(settings.autoLockMs || 0);
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
const _alSel = $('autoLockSelect');
if (_alSel) {
  _alSel.addEventListener('change', async () => {
    settings.autoLockMs = parseInt(_alSel.value, 10) || 0;
    await store.set({ settings });
    await scheduleLockAt(); // re-arm immediately with new interval
  });
}
$('clearAllData').addEventListener('click', async () => {
  if (!confirm('Clear ALL data? This cannot be undone.')) return;
  sessionKey    = null;
  pinConfigured = false;
  await clearSessionCache();
  await chrome.storage.local.clear();
  await init();
  showToast('All data cleared');
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
function uid() {
  // Use CSPRNG for profile IDs — Math.random() is not cryptographically secure
  const arr = crypto.getRandomValues(new Uint32Array(2));
  return Date.now().toString(36) + arr[0].toString(36) + arr[1].toString(36);
}
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
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

// ── Dictation Mode — opens a dedicated tab (extension popups can't get mic permission) ──

const dictateBtn    = $('dictateBtn');
const dictateStatus = $('dictateStatus');
const dictateSkip   = $('dictateSkip');

if (dictateSkip) dictateSkip.style.display = 'none'; // not used in tab-based flow

dictateBtn.addEventListener('click', async () => {
  // Open the dictation page as a real tab — Chrome will show mic permission prompt there
  dictateBtn.disabled = true;
  dictateStatus.textContent = '🎤 Opening dictation tab…';
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup/dictation.html') });
    dictateStatus.textContent = 'Dictation running in new tab — come back when done';
  } catch {
    dictateStatus.textContent = 'Could not open dictation tab';
  }
  dictateBtn.disabled = false;
});

// Listen for results written by the dictation tab
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.dictationResult) return;
  const { results, profileId } = changes.dictationResult.newValue || {};
  if (!results) return;

  // DI-03: skip if dictation was for a different profile
  if (profileId && profileId !== activeId) {
    console.warn('[GHOST] Dictation profileId mismatch in onChanged — ignoring');
    return;
  }

  const p = profiles[activeId];
  if (!p) return;

  // Apply each dictated value to the active profile
  for (const [key, { section, value }] of Object.entries(results)) {
    if (p[section]) {
      p[section][key] = value;
      const el = document.querySelector(`[data-field="${key}"][data-section="${section}"]`);
      if (el) el.value = value;

      // Auto-age calc if DOB dictated
      if (key === 'dob') {
        const parsed = new Date(value);
        if (!isNaN(parsed)) {
          const iso = parsed.toISOString().split('T')[0];
          if (el) el.value = iso;
          p.personal.dob = iso;
          const ageEl = $('ageInput');
          if (ageEl) { ageEl.value = calcAge(iso); p.personal.age = ageEl.value; }
        }
      }
    }
  }

  const saved = await saveCurrentProfile();
  if (saved) {
    dictateStatus.textContent = '✓ Dictation applied — profile saved';
    showToast('Dictation results applied ✓', 'success');
    await chrome.storage.local.remove('dictationResult'); // only delete after confirmed save
  } else {
    dictateStatus.textContent = '⚠ Dictation received — save failed (password mismatch?)';
    showToast('Dictation received but save failed', 'error');
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// IRCTC / Train Tab
// ══════════════════════════════════════════════════════════════════════════════

// ── Default IRCTC data structure ──────────────────────────────────────────────
function emptyIrctcData() {
  return {
    journey: {
      from: '', to: '', date: '',
      trainType: 'sleeper',   // 'sleeper' | 'premium'
      class: 'SL',
      quota: 'GN',
      trainNo: '', trainName: '',
    },
    passengers: [],
    autoInsuranceNo: true,
    mobile: '', email: '',
  };
}

function emptyPassenger() {
  return {
    id: uid(),
    name: '', age: '', gender: 'M',
    berthPref: 'NP',
    foodPref: 'VEG',
    idType: 'AADHAR', idNumber: '',
    passengerType: 'ADULT',
    nationality: 'Indian',
  };
}

let irctcData = emptyIrctcData();
let irctcTrainType = 'sleeper'; // mirrors irctcData.journey.trainType for reactive UI
let tatkalTimerInterval = null;

// ── Persist / Load ─────────────────────────────────────────────────────────────
async function saveIrctcData() {
  await store.set({ irctcData });
}
async function loadIrctcData() {
  const d = await store.get('irctcData');
  if (d.irctcData) {
    irctcData = { ...emptyIrctcData(), ...d.irctcData };
    if (!Array.isArray(irctcData.passengers)) irctcData.passengers = [];
  }
}

// ── Berth options by train type ───────────────────────────────────────────────
function berthOptions(trainType) {
  if (trainType === 'premium') {
    return [
      { value: 'WS', label: 'Window' },
      { value: 'AS', label: 'Aisle' },
      { value: 'NP', label: 'No Preference' },
    ];
  }
  return [
    { value: 'LB',  label: 'Lower' },
    { value: 'MB',  label: 'Middle' },
    { value: 'UB',  label: 'Upper' },
    { value: 'SL',  label: 'Side Lower' },
    { value: 'SU',  label: 'Side Upper' },
    { value: 'NP',  label: 'No Preference' },
  ];
}

function buildSelect(opts, selected, cls) {
  return opts.map(o =>
    `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.label}</option>`
  ).join('');
}

// ── Render a single passenger card ───────────────────────────────────────────
function renderPassengerCard(pax, idx, total) {
  const berths  = berthOptions(irctcTrainType);
  const showFood = irctcTrainType === 'premium';

  const berthSel  = `<select class="pax-berth" data-paxid="${pax.id}">
    ${buildSelect(berths, pax.berthPref)}
  </select>`;

  const foodSel = showFood ? `
    <label class="irctc-label">Food Pref
      <select class="pax-food" data-paxid="${pax.id}">
        <option value="VEG"${pax.foodPref==='VEG'?' selected':''}>Veg</option>
        <option value="NON_VEG"${pax.foodPref==='NON_VEG'?' selected':''}>Non-Veg</option>
        <option value="JAIN"${pax.foodPref==='JAIN'?' selected':''}>Jain</option>
        <option value="NO_FOOD"${pax.foodPref==='NO_FOOD'?' selected':''}>No Meal</option>
      </select>
    </label>` : '';

  return `
  <div class="passenger-card" data-paxid="${pax.id}">
    <div class="passenger-card-header">
      <span class="passenger-card-title">Passenger ${idx + 1}</span>
      ${total > 1 ? `<button class="remove-pax-btn" data-paxid="${pax.id}" title="Remove">✕</button>` : ''}
    </div>
    <div class="irctc-grid" style="gap:5px">
      <label class="irctc-label" style="grid-column:1/-1">Full Name
        <input class="pax-name" data-paxid="${pax.id}" value="${escHtml(pax.name)}" placeholder="As on Aadhaar/ID" />
      </label>
      <label class="irctc-label">Age
        <input class="pax-age" data-paxid="${pax.id}" type="number" min="1" max="125" value="${pax.age}" placeholder="25" />
      </label>
      <label class="irctc-label">Gender
        <select class="pax-gender" data-paxid="${pax.id}">
          <option value="M"${pax.gender==='M'?' selected':''}>Male</option>
          <option value="F"${pax.gender==='F'?' selected':''}>Female</option>
          <option value="T"${pax.gender==='T'?' selected':''}>Transgender</option>
        </select>
      </label>
      <label class="irctc-label">Berth Pref${berthSel}</label>
      <label class="irctc-label">Type
        <select class="pax-type" data-paxid="${pax.id}">
          <option value="ADULT"${pax.passengerType==='ADULT'?' selected':''}>Adult</option>
          <option value="CHILD"${pax.passengerType==='CHILD'?' selected':''}>Child (5-11)</option>
          <option value="SENIOR_M"${pax.passengerType==='SENIOR_M'?' selected':''}>Senior ♂</option>
          <option value="SENIOR_F"${pax.passengerType==='SENIOR_F'?' selected':''}>Senior ♀</option>
        </select>
      </label>
      ${foodSel}
      <label class="irctc-label">ID Proof
        <select class="pax-idtype" data-paxid="${pax.id}">
          <option value="AADHAR"${pax.idType==='AADHAR'?' selected':''}>Aadhaar</option>
          <option value="PAN"${pax.idType==='PAN'?' selected':''}>PAN</option>
          <option value="PASSPORT"${pax.idType==='PASSPORT'?' selected':''}>Passport</option>
          <option value="VOTER"${pax.idType==='VOTER'?' selected':''}>Voter ID</option>
          <option value="DL"${pax.idType==='DL'?' selected':''}>Driving Licence</option>
        </select>
      </label>
      <label class="irctc-label">ID Number
        <input class="pax-idno" data-paxid="${pax.id}" value="${escHtml(pax.idNumber)}" placeholder="XXXX XXXX XXXX" />
      </label>
    </div>
  </div>`;
}

// ── Render all passengers ─────────────────────────────────────────────────────
function renderPassengers() {
  const list = $('passengersList');
  if (!list) return;
  const paxes = irctcData.passengers;
  list.innerHTML = paxes.length === 0
    ? '<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px">No passengers — add one below</div>'
    : paxes.map((p, i) => renderPassengerCard(p, i, paxes.length)).join('');

  // Wire up passenger field listeners
  list.querySelectorAll('[data-paxid]').forEach(el => {
    el.addEventListener('input',  () => syncPaxField(el));
    el.addEventListener('change', () => syncPaxField(el));
  });
  list.querySelectorAll('.remove-pax-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      irctcData.passengers = irctcData.passengers.filter(p => p.id !== btn.dataset.paxid);
      renderPassengers();
      updateAddPaxBtn();
    });
  });
}

// ── Sync a passenger field back to irctcData ─────────────────────────────────
function syncPaxField(el) {
  const paxId = el.dataset.paxid;
  const pax   = irctcData.passengers.find(p => p.id === paxId);
  if (!pax) return;
  if (el.classList.contains('pax-name'))   pax.name          = el.value;
  if (el.classList.contains('pax-age'))    pax.age           = el.value;
  if (el.classList.contains('pax-gender')) pax.gender        = el.value;
  if (el.classList.contains('pax-berth'))  pax.berthPref     = el.value;
  if (el.classList.contains('pax-food'))   pax.foodPref      = el.value;
  if (el.classList.contains('pax-type'))   pax.passengerType = el.value;
  if (el.classList.contains('pax-idtype')) pax.idType        = el.value;
  if (el.classList.contains('pax-idno'))   pax.idNumber      = el.value;
}

function updateAddPaxBtn() {
  const btn = $('addPaxBtn');
  if (btn) btn.disabled = irctcData.passengers.length >= 6;
}

// ── Populate journey inputs from irctcData ────────────────────────────────────
function populateJourneyUI() {
  const j = irctcData.journey;
  const set = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
  set('irctc-from',      j.from);
  set('irctc-to',        j.to);
  set('irctc-date',      j.date);
  set('irctc-quota',     j.quota);
  set('irctc-class',     j.class);
  set('irctc-train',     j.trainNo);
  set('irctc-trainname', j.trainName);
  set('irctc-mobile',    irctcData.mobile);
  set('irctc-email',     irctcData.email);
  const ins = $('irctcAutoInsurance');
  if (ins) ins.checked = irctcData.autoInsuranceNo !== false;
  setTrainType(j.trainType || 'sleeper', false);
  updateQuotaUI(j.quota);
}

// ── Collect journey inputs into irctcData ─────────────────────────────────────
function collectJourneyFromUI() {
  const g = (id) => { const el = $(id); return el ? el.value.trim() : ''; };
  irctcData.journey.from      = g('irctc-from').toUpperCase();
  irctcData.journey.to        = g('irctc-to').toUpperCase();
  irctcData.journey.date      = g('irctc-date');
  irctcData.journey.quota     = g('irctc-quota');
  irctcData.journey.class     = g('irctc-class');
  irctcData.journey.trainNo   = g('irctc-train');
  irctcData.journey.trainName = g('irctc-trainname');
  irctcData.journey.trainType = irctcTrainType;
  irctcData.mobile            = g('irctc-mobile');
  irctcData.email             = g('irctc-email');
  const ins = $('irctcAutoInsurance');
  irctcData.autoInsuranceNo   = ins ? ins.checked : true;
}

// ── Train type toggle ─────────────────────────────────────────────────────────
function setTrainType(type, reRender = true) {
  irctcTrainType               = type;
  irctcData.journey.trainType  = type;
  const sleepBtn = $('trainTypeSleeper');
  const premBtn  = $('trainTypePremium');
  if (sleepBtn && premBtn) {
    sleepBtn.classList.toggle('active', type === 'sleeper');
    premBtn.classList.toggle('active',  type === 'premium');
  }
  if (reRender) renderPassengers();
}

$('trainTypeSleeper')?.addEventListener('click', () => setTrainType('sleeper'));
$('trainTypePremium')?.addEventListener('click', () => setTrainType('premium'));

// ── Add passenger ─────────────────────────────────────────────────────────────
$('addPaxBtn')?.addEventListener('click', () => {
  if (irctcData.passengers.length >= 6) return;
  irctcData.passengers.push(emptyPassenger());
  renderPassengers();
  updateAddPaxBtn();
});

// ── Quota change → Aadhaar reminder + timer class badge ───────────────────────
function updateQuotaUI(quota) {
  const reminder = $('aadharReminder');
  if (reminder) reminder.classList.toggle('hidden', quota !== 'TQ' && quota !== 'PT');
  updateTimerBadge();
}

$('irctc-quota')?.addEventListener('change', (e) => {
  updateQuotaUI(e.target.value);
  restartTatkalTimer();
});
$('irctc-class')?.addEventListener('change', () => {
  updateTimerBadge();
  restartTatkalTimer();
});
$('irctc-date')?.addEventListener('change', () => restartTatkalTimer());

// ── Tatkal countdown timer ────────────────────────────────────────────────────
// AC classes open at 10:00 AM; Non-AC (SL, 2S) open at 11:00 AM
// Booking opens 1 day before journey date
const AC_CLASSES    = new Set(['1A','2A','3A','3E','CC','EC']);
const NON_AC_CLASSES = new Set(['SL','2S']);

function isAcClass(cls) { return AC_CLASSES.has(cls); }

function tatkalOpenTime(journeyDate, cls) {
  // Returns Date object for when Tatkal opens, or null if not determinable
  if (!journeyDate) return null;
  const jd   = new Date(journeyDate);
  if (isNaN(jd)) return null;
  const opens = new Date(jd);
  opens.setDate(opens.getDate() - 1);
  const hour  = isAcClass(cls) ? 10 : 11;
  opens.setHours(hour, 0, 0, 0);
  return opens;
}

function updateTimerBadge() {
  const badge = $('tatkalClassBadge');
  if (!badge) return;
  const cls = ($('irctc-class')?.value) || 'SL';
  if (isAcClass(cls)) {
    badge.textContent = 'AC — 10:00 AM';
  } else {
    badge.textContent = 'Non-AC — 11:00 AM';
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

function tickTatkalTimer() {
  const cd     = $('tatkalCountdown');
  const label  = $('tatkalOpensLabel');
  if (!cd || !label) return;

  const cls      = ($('irctc-class')?.value)   || irctcData.journey.class || 'SL';
  const dateVal  = ($('irctc-date')?.value)    || irctcData.journey.date  || '';
  const quota    = ($('irctc-quota')?.value)   || irctcData.journey.quota || 'GN';

  // Only show meaningful timer for Tatkal/Premium Tatkal
  if (quota !== 'TQ' && quota !== 'PT') {
    cd.textContent    = '—';
    cd.className      = 'tatkal-countdown';
    label.textContent = 'Select Tatkal quota to see countdown';
    return;
  }

  if (!dateVal) {
    cd.textContent    = '--:--:--';
    cd.className      = 'tatkal-countdown';
    label.textContent = 'Set journey date to start countdown';
    return;
  }

  const opensAt = tatkalOpenTime(dateVal, cls);
  if (!opensAt) {
    cd.textContent    = '--:--:--';
    label.textContent = 'Invalid date';
    return;
  }

  const now        = Date.now();
  const remaining  = opensAt.getTime() - now;
  const openDateStr = opensAt.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  const openTimeStr = isAcClass(cls) ? '10:00 AM' : '11:00 AM';

  if (remaining > 0) {
    // More than 24h away → show days + time
    const days = Math.floor(remaining / 86400000);
    if (days >= 1) {
      cd.textContent    = `${days}d ${formatCountdown(remaining % 86400000)}`;
      label.textContent = `Opens ${openDateStr} at ${openTimeStr}`;
      cd.className      = 'tatkal-countdown';
    } else {
      cd.textContent    = formatCountdown(remaining);
      cd.className      = `tatkal-countdown${remaining < 300000 ? ' urgent' : ''}`; // red under 5 min
      label.textContent = `Opens ${openDateStr} at ${openTimeStr} — Be ready!`;
    }
  } else if (remaining > -300000) {
    // Within 5 minutes past open time — booking is LIVE
    cd.textContent    = 'BOOK NOW 🚀';
    cd.className      = 'tatkal-countdown ready';
    label.textContent = `Tatkal window is OPEN — ${openTimeStr} on ${openDateStr}`;
  } else {
    // Past window
    cd.textContent    = 'Window passed';
    cd.className      = 'tatkal-countdown';
    label.textContent = `Tatkal opened ${openDateStr} at ${openTimeStr}`;
  }
}

function restartTatkalTimer() {
  if (tatkalTimerInterval) clearInterval(tatkalTimerInterval);
  tickTatkalTimer();
  tatkalTimerInterval = setInterval(tickTatkalTimer, 1000);
}

// ── Save button ───────────────────────────────────────────────────────────────
$('irctcSaveBtn')?.addEventListener('click', async () => {
  collectJourneyFromUI();
  await saveIrctcData();
  showToast('IRCTC profile saved ✓', 'success');
});

// ── Fill button — sends IRCTC data to content script ─────────────────────────
$('irctcFillBtn')?.addEventListener('click', async () => {
  collectJourneyFromUI();
  await saveIrctcData();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return showToast('No active tab', 'error');
    await chrome.tabs.sendMessage(tab.id, {
      type: 'IRCTC_FILL',
      data: irctcData,
    });
    showToast('Filling IRCTC form ⚡', 'success');
  } catch {
    // Try injecting content script first
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
      setTimeout(async () => {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(t.id, { type: 'IRCTC_FILL', data: irctcData }).catch(() => {});
      }, 400);
    } catch {
      showToast('Could not reach IRCTC tab', 'error');
    }
  }
});

// ── Init IRCTC tab ─────────────────────────────────────────────────────────────
async function initIrctcTab() {
  await loadIrctcData();
  populateJourneyUI();
  renderPassengers();
  updateAddPaxBtn();
  updateTimerBadge();
  restartTatkalTimer();

  // Pre-fill contact from active general profile if empty
  if (!irctcData.mobile && profiles[activeId]?.contact?.phone) {
    const el = $('irctc-mobile');
    if (el) el.value = profiles[activeId].contact.phone;
  }
  if (!irctcData.email && profiles[activeId]?.contact?.email) {
    const el = $('irctc-email');
    if (el) el.value = profiles[activeId].contact.email;
  }
}

// Hook into tab click to lazy-init
document.querySelector('.tab[data-tab="irctc"]')?.addEventListener('click', () => {
  initIrctcTab();
});


// ── Boot ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
