'use strict';

const FIELDS = [
  { label: 'First Name',       section: 'personal',     key: 'firstName' },
  { label: 'Last Name',        section: 'personal',     key: 'lastName' },
  { label: 'Full Name',        section: 'personal',     key: 'fullName' },
  { label: 'Date of Birth',    section: 'personal',     key: 'dob',      hint: 'e.g. 1995-08-15' },
  { label: 'Gender',           section: 'personal',     key: 'gender' },
  { label: 'Nationality',      section: 'personal',     key: 'nationality' },
  { label: 'Email',            section: 'contact',      key: 'email' },
  { label: 'Phone',            section: 'contact',      key: 'phone' },
  { label: 'WhatsApp',         section: 'contact',      key: 'whatsapp' },
  { label: 'Address Line 1',   section: 'contact',      key: 'address1' },
  { label: 'City',             section: 'contact',      key: 'city' },
  { label: 'State',            section: 'contact',      key: 'state' },
  { label: 'ZIP / PIN',        section: 'contact',      key: 'zip' },
  { label: 'Country',          section: 'contact',      key: 'country' },
  { label: 'Website',          section: 'contact',      key: 'website' },
  { label: 'LinkedIn',         section: 'contact',      key: 'linkedin' },
  { label: 'GitHub',           section: 'contact',      key: 'github' },
  { label: 'Company',          section: 'professional', key: 'company' },
  { label: 'Job Title',        section: 'professional', key: 'jobTitle' },
  { label: 'Department',       section: 'professional', key: 'department' },
  { label: 'Years Experience', section: 'professional', key: 'yearsExp' },
  { label: 'Current CTC',      section: 'professional', key: 'currentCtc' },
  { label: 'Expected CTC',     section: 'professional', key: 'expectedCtc' },
  { label: 'Skills',           section: 'professional', key: 'skills',   hint: 'comma-separated' },
  { label: 'Bio / Summary',    section: 'professional', key: 'bio' },
  { label: 'Degree',           section: 'professional', key: 'degree' },
  { label: 'University',       section: 'professional', key: 'university' },
  { label: 'Grad Year',        section: 'professional', key: 'gradYear' },
  { label: 'Username',         section: 'credentials',  key: 'username' },
];

// ── DOM ────────────────────────────────────────────────────────────────────────
const progressBar = document.getElementById('progressBar');
const fieldNum    = document.getElementById('fieldNum');
const fieldName   = document.getElementById('fieldName');
const fieldHint   = document.getElementById('fieldHint');
const textInput   = document.getElementById('textInput');
const stepsList   = document.getElementById('stepsList');
const statusEl    = document.getElementById('status');
const orbEl       = document.getElementById('orb');
const skipBtn     = document.getElementById('skipBtn');
const stopBtn     = document.getElementById('stopBtn');
const donePanel   = document.getElementById('donePanel');
const mainPanel   = document.getElementById('mainPanel');
const braveNotice = document.getElementById('braveNotice');

// ── State ──────────────────────────────────────────────────────────────────────
let index           = 0;
let stopped         = false;
let recognition     = null;
let voiceAvailable  = true;  // optimistic — flipped on network/blocked error
let voiceEnabled    = true;  // user can toggle off
const results       = {};
let existingProfile = null;

// ── Build step list ────────────────────────────────────────────────────────────
FIELDS.forEach((f, i) => {
  const el = document.createElement('div');
  el.className = 'step';
  el.id = `step-${i}`;
  el.innerHTML = `<span class="step-dot"></span>
    <span class="step-label">${f.label}</span>
    <span class="step-val" id="stepval-${i}"></span>`;
  el.addEventListener('click', () => jumpTo(i));
  stepsList.appendChild(el);
});

function updateSteps() {
  FIELDS.forEach((_, i) => {
    const el = document.getElementById(`step-${i}`);
    if (!el) return;
    el.className = i < index ? 'step done' : i === index ? 'step current' : 'step';
  });
  document.getElementById(`step-${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function setStepValue(i, val) {
  const el = document.getElementById(`stepval-${i}`);
  if (el) el.textContent = val ? (val.length > 16 ? val.slice(0, 16) + '…' : val) : '';
}

function setProgress(i) {
  progressBar.style.width = `${Math.round((i / FIELDS.length) * 100)}%`;
}

// ── Voice recognition ──────────────────────────────────────────────────────────
function startListening() {
  if (!voiceEnabled || !voiceAvailable) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { voiceAvailable = false; setVoiceOff(); return; }

  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }

  recognition = new SR();
  recognition.lang            = 'en-IN';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;
  recognition.continuous      = false;

  orbEl.className = 'orb listening';
  orbEl.textContent = '🎤';
  setStatus('🎤 Listening… speak your answer');

  recognition.onresult = (e) => {
    const val = e.results[0][0].transcript.trim();
    textInput.value = val;
    orbEl.className = 'orb heard';
    orbEl.textContent = '✓';
    setStatus(`Heard: "${val}" — press Enter to confirm or edit`);
    textInput.focus();
    recognition = null;
  };

  recognition.onerror = (e) => {
    recognition = null;
    if (e.error === 'network' || e.error === 'service-not-allowed') {
      voiceAvailable = false;
      setVoiceOff();
      showBraveNotice();
    } else if (e.error === 'not-allowed') {
      voiceAvailable = false;
      setVoiceOff();
      setStatus('⚠️ Mic permission denied — type your answer below');
    } else if (e.error === 'no-speech') {
      orbEl.className = 'orb';
      orbEl.textContent = '🎤';
      setStatus('No speech detected — speak louder or type below');
    } else {
      orbEl.className = 'orb';
      orbEl.textContent = '🎤';
      setStatus('Speak your answer or type below');
    }
    textInput.focus();
  };

  recognition.onend = () => {
    if (recognition) recognition = null;
  };

  try { recognition.start(); } catch { recognition = null; voiceAvailable = false; setVoiceOff(); }
}

function stopListening() {
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
}

function setVoiceOff() {
  orbEl.className = 'orb off';
  orbEl.textContent = '⌨️';
  setStatus('Voice unavailable — type your answer and press Enter');
  textInput.focus();
}

function showBraveNotice() {
  if (braveNotice) braveNotice.style.display = 'block';
}

// ── Show field ─────────────────────────────────────────────────────────────────
function showField() {
  if (stopped || index >= FIELDS.length) { finish(); return; }

  const f = FIELDS[index];
  setProgress(index);
  updateSteps();

  fieldNum.textContent  = `${index + 1} / ${FIELDS.length}`;
  fieldName.textContent = f.label;
  fieldHint.textContent = f.hint ? `Format: ${f.hint}` : '';

  // Pre-fill with existing value
  const saved = results[f.key]?.value ?? existingProfile?.[f.section]?.[f.key] ?? '';
  textInput.value = saved;
  textInput.placeholder = f.hint || `Say or type your ${f.label}`;

  if (!voiceAvailable || !voiceEnabled) {
    textInput.focus();
    if (voiceAvailable) setStatus('Speak your answer or type below');
  } else {
    startListening();
  }
}

function setStatus(msg) { statusEl.textContent = msg; }

// ── Navigation ─────────────────────────────────────────────────────────────────
function advance(val) {
  stopListening();
  const f = FIELDS[index];
  if (val && val.trim()) {
    results[f.key] = { section: f.section, value: val.trim() };
    setStepValue(index, val.trim());
  }
  index++;
  textInput.value = '';
  showField();
}

function goBack() {
  if (index === 0) return;
  stopListening();
  const f = FIELDS[index];
  const cur = textInput.value.trim();
  if (cur) { results[f.key] = { section: f.section, value: cur }; setStepValue(index, cur); }
  index--;
  showField();
}

function jumpTo(i) {
  stopListening();
  const cur = textInput.value.trim();
  if (cur) { results[FIELDS[index].key] = { section: FIELDS[index].section, value: cur }; setStepValue(index, cur); }
  index = i;
  showField();
}

// ── Finish ─────────────────────────────────────────────────────────────────────
async function finish() {
  stopListening();
  setProgress(FIELDS.length);
  updateSteps();
  mainPanel.style.display = 'none';
  donePanel.style.display = 'flex';
  document.getElementById('savedCount').textContent =
    `${Object.keys(results).length} of ${FIELDS.length} fields saved`;
  await chrome.storage.local.set({ dictationResult: { results, ts: Date.now() } });
  setTimeout(() => window.close(), 3000);
}

// ── Keyboard ───────────────────────────────────────────────────────────────────
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    advance(textInput.value);
  } else if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    goBack();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    advance('');
  }
});

// Typing in text input → stop mic (user chose to type)
textInput.addEventListener('input', () => {
  if (recognition) stopListening();
  orbEl.className = 'orb';
  orbEl.textContent = '🎤';
});

// Click orb to re-trigger mic
orbEl.addEventListener('click', () => {
  if (!voiceAvailable) return;
  textInput.value = '';
  startListening();
});

skipBtn.addEventListener('click', () => advance(''));
stopBtn.addEventListener('click', () => { stopped = true; finish(); });
document.getElementById('closeBtn').addEventListener('click', () => window.close());
document.getElementById('dismissBrave')?.addEventListener('click', () => {
  if (braveNotice) braveNotice.style.display = 'none';
});

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const d = await chrome.storage.local.get(['profiles', 'activeId']);
    existingProfile = d.profiles?.[d.activeId] || null;
  } catch {}
  showField();
}

init();
