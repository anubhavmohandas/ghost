'use strict';

// ── Fields to dictate ──────────────────────────────────────────────────────────
const FIELDS = [
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

// ── DOM refs ───────────────────────────────────────────────────────────────────
const orb         = document.getElementById('orb');
const fieldLabel  = document.getElementById('fieldLabel');
const fieldName   = document.getElementById('fieldName');
const fieldValue  = document.getElementById('fieldValue');
const statusEl    = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const stepsList   = document.getElementById('stepsList');
const skipBtn     = document.getElementById('skipBtn');
const stopBtn     = document.getElementById('stopBtn');
const btnRow      = document.getElementById('btnRow');

// ── State ──────────────────────────────────────────────────────────────────────
let dictIndex   = 0;
let running     = false;
let recognition = null;
const results   = {}; // key → value collected

// ── Build step list ────────────────────────────────────────────────────────────
FIELDS.forEach((f, i) => {
  const el = document.createElement('div');
  el.className = 'step';
  el.id = `step-${i}`;
  el.innerHTML = `<span class="step-dot"></span><span>${f.label}</span>`;
  stepsList.appendChild(el);
});

function updateSteps() {
  FIELDS.forEach((_, i) => {
    const el = document.getElementById(`step-${i}`);
    if (!el) return;
    el.className = i < dictIndex ? 'step done' : i === dictIndex ? 'step current' : 'step';
  });
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function setProgress(i) {
  progressBar.style.width = `${Math.round((i / FIELDS.length) * 100)}%`;
}

// ── Save results to storage → popup picks up via onChanged ─────────────────────
async function saveAndFinish(msg = 'Done') {
  running = false;
  recognition = null;

  orb.className = 'orb done-orb';
  orb.textContent = '✓';
  fieldLabel.textContent = 'Complete';
  fieldName.textContent  = msg;
  fieldValue.textContent = '';
  setStatus('Results saved — you can close this tab.', 'ok');
  setProgress(FIELDS.length);
  updateSteps();

  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());

  // Write results into chrome.storage so popup.js can pick them up
  await chrome.storage.local.set({ dictationResult: { results, ts: Date.now() } });

  // Auto-close after 3 s
  setTimeout(() => window.close(), 3000);
}

function abortAll(msg = 'Stopped') {
  running = false;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  orb.className = 'orb error-orb';
  orb.textContent = '⏹';
  fieldLabel.textContent = 'Stopped';
  fieldName.textContent  = msg;
  setStatus('Dictation cancelled. You can close this tab.', 'err');
  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
}

// ── Core: dictate one field ────────────────────────────────────────────────────
function dictateField() {
  if (!running || dictIndex >= FIELDS.length) {
    saveAndFinish('All fields captured ✓');
    return;
  }

  const field = FIELDS[dictIndex];
  setProgress(dictIndex);
  updateSteps();

  fieldLabel.textContent = `Field ${dictIndex + 1} of ${FIELDS.length}`;
  fieldName.textContent  = field.label;
  fieldValue.textContent = '';
  setStatus('🎤 Listening…');
  orb.className = 'orb listening';
  orb.textContent = '🎤';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang             = 'en-IN';
  recognition.interimResults   = false;
  recognition.maxAlternatives  = 1;
  recognition.continuous       = false;

  recognition.onresult = (e) => {
    const val = e.results[0][0].transcript.trim();
    results[field.key] = { section: field.section, value: val };
    fieldValue.textContent = `"${val}"`;
    setStatus(`✓ Got it`, 'ok');
    dictIndex++;
    setTimeout(() => { if (running) dictateField(); }, 900);
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      setStatus(`No speech — skipping ${field.label}`);
      dictIndex++;
      setTimeout(() => { if (running) dictateField(); }, 600);
      return;
    }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      orb.className = 'orb error-orb';
      orb.textContent = '🚫';
      fieldLabel.textContent = 'Permission denied';
      fieldName.textContent  = 'Microphone access blocked';
      setStatus('Chrome blocked microphone. Allow it in the address bar above, then reload this tab.', 'err');
      running = false;
      recognition = null;
      btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
      document.getElementById('closeBtn').addEventListener('click', () => window.close());
      return;
    }
    // other errors — skip field
    setStatus(`Error: ${e.error} — skipping`);
    dictIndex++;
    setTimeout(() => { if (running) dictateField(); }, 600);
  };

  recognition.onend = () => {
    // onresult or onerror handles progression; this is a safety net
  };

  recognition.start();
}

// ── Start ──────────────────────────────────────────────────────────────────────
function start() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    orb.className = 'orb error-orb';
    orb.textContent = '❌';
    fieldName.textContent = 'Speech API not supported';
    setStatus('Use Chrome or Edge for dictation.', 'err');
    return;
  }
  running = true;
  dictateField();
}

// ── Button handlers ────────────────────────────────────────────────────────────
skipBtn.addEventListener('click', () => {
  if (!running) return;
  try { if (recognition) recognition.abort(); } catch {}
  recognition = null;
  dictIndex++;
  setTimeout(() => { if (running) dictateField(); }, 200);
});

stopBtn.addEventListener('click', () => abortAll('Dictation stopped'));

// ── Kick off ───────────────────────────────────────────────────────────────────
start();
