'use strict';

// ── Fields ─────────────────────────────────────────────────────────────────────
const FIELDS = [
  { label: 'First Name',    section: 'personal',     key: 'firstName' },
  { label: 'Last Name',     section: 'personal',     key: 'lastName' },
  { label: 'Email',         section: 'contact',      key: 'email' },
  { label: 'Phone',         section: 'contact',      key: 'phone' },
  { label: 'Date of Birth', section: 'personal',     key: 'dob',   hint: 'e.g. 1995-08-15' },
  { label: 'City',          section: 'contact',      key: 'city' },
  { label: 'State',         section: 'contact',      key: 'state' },
  { label: 'Country',       section: 'contact',      key: 'country' },
  { label: 'Company',       section: 'professional', key: 'company' },
  { label: 'Job Title',     section: 'professional', key: 'jobTitle' },
  { label: 'Username',      section: 'credentials',  key: 'username' },
];

// ── DOM ────────────────────────────────────────────────────────────────────────
const orb         = document.getElementById('orb');
const fieldLabel  = document.getElementById('fieldLabel');
const fieldName   = document.getElementById('fieldName');
const statusEl    = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const stepsList   = document.getElementById('stepsList');
const skipBtn     = document.getElementById('skipBtn');
const stopBtn     = document.getElementById('stopBtn');
const btnRow      = document.getElementById('btnRow');
const micMeter    = document.getElementById('micMeter');
const micBar      = document.getElementById('micBar');
const micLabel    = document.getElementById('micLabel');
const textInput   = document.getElementById('textInput');
const textSubmit  = document.getElementById('textSubmit');
const voiceBadge  = document.getElementById('voiceBadge');

// ── State ──────────────────────────────────────────────────────────────────────
let dictIndex   = 0;
let running     = false;
let recognition = null;
let audioCtx    = null;
let micStream   = null;
let animFrame   = null;
let voiceWorking = false; // becomes true if recognition.onresult ever fires
const results   = {};

// ── Step list ──────────────────────────────────────────────────────────────────
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

// ── Mic level meter ────────────────────────────────────────────────────────────
function startMicMeter(stream) {
  audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(buf);
    const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
    const pct = Math.min(100, avg * 3);
    micBar.style.width = pct + '%';
    micBar.style.background = pct > 15
      ? 'linear-gradient(90deg, #7c3aed, #4ade80)'
      : 'linear-gradient(90deg, #7c3aed, #fb923c)';
    animFrame = requestAnimationFrame(draw);
  }
  draw();
  micMeter.style.display = 'block';
  micLabel.style.display = 'block';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}
function setProgress(i) {
  progressBar.style.width = `${Math.round((i / FIELDS.length) * 100)}%`;
}

// ── Save & finish ──────────────────────────────────────────────────────────────
async function saveAndFinish() {
  running = false;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  if (animFrame) cancelAnimationFrame(animFrame);
  if (audioCtx) { audioCtx.close(); }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); }

  orb.className = 'orb done-orb';
  orb.textContent = '✓';
  fieldLabel.textContent = 'Complete';
  fieldName.textContent  = 'All fields captured';
  textInput.style.display = 'none';
  textSubmit.style.display = 'none';
  micMeter.style.display = 'none';
  micLabel.style.display = 'none';
  setStatus('Profile updated — this tab closes in 3 seconds.', 'ok');
  setProgress(FIELDS.length);
  updateSteps();

  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close now</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());

  await chrome.storage.local.set({ dictationResult: { results, ts: Date.now() } });
  setTimeout(() => window.close(), 3000);
}

function abortAll() {
  running = false;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  if (animFrame) cancelAnimationFrame(animFrame);
  if (audioCtx) { audioCtx.close(); }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); }

  orb.className = 'orb error-orb';
  orb.textContent = '⏹';
  fieldLabel.textContent = 'Stopped';
  fieldName.textContent  = 'Dictation cancelled';
  textInput.style.display = 'none';
  textSubmit.style.display = 'none';
  micMeter.style.display = 'none';
  micLabel.style.display = 'none';
  setStatus('Close this tab when done.', 'err');
  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
}

// ── Apply value and advance ────────────────────────────────────────────────────
function applyValue(val) {
  if (val && val.trim()) {
    const field = FIELDS[dictIndex];
    results[field.key] = { section: field.section, value: val.trim() };
  }
  dictIndex++;
  textInput.value = '';
  setTimeout(() => { if (running) showField(); }, 400);
}

// ── Show a field: text input always visible, voice attempted in background ─────
function showField() {
  if (!running || dictIndex >= FIELDS.length) {
    saveAndFinish();
    return;
  }

  const field = FIELDS[dictIndex];
  setProgress(dictIndex);
  updateSteps();

  fieldLabel.textContent = `Field ${dictIndex + 1} of ${FIELDS.length}`;
  fieldName.textContent  = field.label;
  textInput.placeholder  = field.hint || `Enter your ${field.label}`;
  textInput.value        = '';
  textInput.style.display = 'block';
  textSubmit.style.display = 'inline-block';
  textInput.focus();

  // Try voice in background — if it works, auto-fill the text box
  if (voiceWorking || dictIndex === 0) {
    tryVoice(field);
  } else {
    setStatus('Type your answer and press Enter ↵');
    orb.className = 'orb';
    orb.textContent = '⌨️';
  }
}

function tryVoice(field) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  if (recognition) { try { recognition.abort(); } catch {} }

  recognition = new SR();
  recognition.lang            = 'en-IN';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;
  recognition.continuous      = false;

  orb.className = 'orb listening';
  orb.textContent = '🎤';
  setStatus('🎤 Speak or type below — both work');

  recognition.onresult = (e) => {
    voiceWorking = true;
    const val = e.results[0][0].transcript.trim();
    // Auto-fill the text box — user can edit before submitting
    textInput.value = val;
    setStatus(`🎤 Heard: "${val}" — edit if needed, then press Enter`, 'ok');
    orb.className = 'orb';
    orb.textContent = '✓';
    textInput.focus();
    textInput.select();
    recognition = null;
  };

  recognition.onerror = (e) => {
    recognition = null;
    orb.className = 'orb';
    orb.textContent = '⌨️';
    if (e.error === 'network' || e.error === 'service-not-allowed') {
      voiceWorking = false;
      setStatus('Voice unavailable in extension — type your answer below');
      if (voiceBadge) voiceBadge.style.display = 'none';
    } else if (e.error === 'not-allowed') {
      setStatus('Mic blocked — type your answer below');
    } else {
      setStatus('Type your answer and press Enter ↵');
    }
  };

  try { recognition.start(); } catch { recognition = null; }
}

// ── Button handlers ────────────────────────────────────────────────────────────
textSubmit.addEventListener('click', () => {
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  applyValue(textInput.value);
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') textSubmit.click();
});

skipBtn.addEventListener('click', () => {
  if (!running) return;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  applyValue('');
});

stopBtn.addEventListener('click', () => abortAll());

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  setStatus('Starting…');

  // Try to get mic for level meter (non-blocking)
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startMicMeter(micStream);
  } catch {
    // mic denied or unavailable — continue without meter
  }

  running = true;
  showField();
}

init();
