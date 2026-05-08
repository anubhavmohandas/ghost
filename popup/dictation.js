'use strict';

// ── Fields ─────────────────────────────────────────────────────────────────────
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

// ── DOM ────────────────────────────────────────────────────────────────────────
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
const micMeter    = document.getElementById('micMeter');
const micBar      = document.getElementById('micBar');
const micLabel    = document.getElementById('micLabel');
const textInput   = document.getElementById('textInput');
const textSubmit  = document.getElementById('textSubmit');

// ── State ──────────────────────────────────────────────────────────────────────
let dictIndex   = 0;
let running     = false;
let recognition = null;
let audioCtx    = null;
let analyser    = null;
let micStream   = null;
let animFrame   = null;
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

// ── Mic level visualizer ───────────────────────────────────────────────────────
function startMicMeter(stream) {
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(buf);
    const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
    const pct = Math.min(100, avg * 3);
    micBar.style.width = pct + '%';
    micBar.style.background = pct > 20
      ? `linear-gradient(90deg, #7c3aed, #4ade80)`
      : `linear-gradient(90deg, #7c3aed, #fb923c)`;
    animFrame = requestAnimationFrame(draw);
  }
  draw();
  micMeter.style.display = 'block';
  micLabel.style.display = 'block';
}

function stopMicMeter() {
  if (animFrame) cancelAnimationFrame(animFrame);
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  micMeter.style.display = 'none';
  micLabel.style.display = 'none';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function setProgress(i) {
  progressBar.style.width = `${Math.round((i / FIELDS.length) * 100)}%`;
}

function showTextInput(fieldLabel) {
  textInput.placeholder = `Type your ${fieldLabel} (voice not working)`;
  textInput.value = '';
  textInput.style.display = 'block';
  textSubmit.style.display = 'inline-block';
  textInput.focus();
}

function hideTextInput() {
  textInput.style.display = 'none';
  textSubmit.style.display = 'none';
  textInput.value = '';
}

// ── Save & finish ──────────────────────────────────────────────────────────────
async function saveAndFinish(msg = 'Done') {
  running = false;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  stopMicMeter();
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  hideTextInput();

  orb.className = 'orb done-orb';
  orb.textContent = '✓';
  fieldLabel.textContent = 'Complete';
  fieldName.textContent  = msg;
  fieldValue.textContent = '';
  setStatus('Results saved — this tab will close shortly.', 'ok');
  setProgress(FIELDS.length);
  updateSteps();

  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());

  await chrome.storage.local.set({ dictationResult: { results, ts: Date.now() } });
  setTimeout(() => window.close(), 3000);
}

function abortAll(msg = 'Stopped') {
  running = false;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  stopMicMeter();
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  hideTextInput();

  orb.className = 'orb error-orb';
  orb.textContent = '⏹';
  fieldLabel.textContent = 'Stopped';
  fieldName.textContent  = msg;
  setStatus('Dictation cancelled. Close this tab.', 'err');
  btnRow.innerHTML = '<button class="btn-close" id="closeBtn">Close tab</button>';
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
}

// ── Apply a value and move on ──────────────────────────────────────────────────
function applyValue(val) {
  if (val) {
    const field = FIELDS[dictIndex];
    results[field.key] = { section: field.section, value: val };
    fieldValue.textContent = `"${val}"`;
    setStatus('✓ Got it', 'ok');
  }
  dictIndex++;
  hideTextInput();
  setTimeout(() => { if (running) dictateField(); }, 700);
}

// ── Core dictation loop ────────────────────────────────────────────────────────
let noSpeechCount = 0;

function dictateField() {
  if (!running || dictIndex >= FIELDS.length) {
    saveAndFinish('All fields captured ✓');
    return;
  }

  const field = FIELDS[dictIndex];
  setProgress(dictIndex);
  updateSteps();
  hideTextInput();

  fieldLabel.textContent = `Field ${dictIndex + 1} of ${FIELDS.length}`;
  fieldName.textContent  = field.label;
  fieldValue.textContent = '';
  setStatus('🎤 Speak now…');
  orb.className = 'orb listening';
  orb.textContent = '🎤';
  noSpeechCount = 0;

  startRecognition(field);
}

function startRecognition(field) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang            = 'en-IN';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;
  recognition.continuous      = false;

  recognition.onresult = (e) => {
    noSpeechCount = 0;
    const val = e.results[0][0].transcript.trim();
    applyValue(val);
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      noSpeechCount++;
      if (noSpeechCount < 3) {
        // retry up to 3 times before falling back to text input
        setStatus(`No speech detected (${noSpeechCount}/3) — keep talking or use text below`);
        if (noSpeechCount === 2) showTextInput(field.label);
        startRecognition(field); // restart for same field
      } else {
        setStatus(`Voice not working — type "${field.label}" below or skip`, 'err');
        showTextInput(field.label);
        // stop retrying — user must type or skip
        recognition = null;
      }
      return;
    }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      orb.className = 'orb error-orb';
      orb.textContent = '🚫';
      fieldLabel.textContent = 'Permission denied';
      fieldName.textContent  = 'Microphone access blocked';
      setStatus('Allow microphone in the browser address bar, then reload this tab.', 'err');
      running = false;
      return;
    }
    // network or other error — show text fallback
    setStatus(`Recognition error: ${e.error} — type below or skip`);
    showTextInput(field.label);
  };

  recognition.start();
}

// ── Text input fallback ────────────────────────────────────────────────────────
textSubmit.addEventListener('click', () => {
  const val = textInput.value.trim();
  if (!val) return;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  applyValue(val);
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') textSubmit.click();
});

// ── Buttons ────────────────────────────────────────────────────────────────────
skipBtn.addEventListener('click', () => {
  if (!running) return;
  if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
  applyValue(''); // empty = skip
});

stopBtn.addEventListener('click', () => abortAll('Dictation stopped'));

// ── Init: check mic first, then start ─────────────────────────────────────────
async function init() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    orb.className = 'orb error-orb';
    orb.textContent = '❌';
    fieldName.textContent = 'Speech API not supported';
    setStatus('Use Chrome or Edge for dictation.', 'err');
    return;
  }

  setStatus('Requesting microphone access…');
  fieldName.textContent = 'Checking microphone';
  fieldLabel.textContent = 'Setup';

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startMicMeter(micStream);
    setStatus('🎙 Microphone active — watch the level bar. If it doesn\'t move when you speak, select a different mic in your OS settings.');

    // Give user 2 seconds to see the mic meter and confirm it's working
    await new Promise(r => setTimeout(r, 2000));

    running = true;
    dictateField();
  } catch (err) {
    orb.className = 'orb error-orb';
    orb.textContent = '🚫';
    fieldName.textContent = 'Microphone blocked';
    setStatus('Click the camera/mic icon in the address bar above and allow microphone access, then reload.', 'err');
  }
}

init();
