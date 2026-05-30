/* ════════════════════════════════════════════════════════════
   GHOST — Marketing Site Interactions
   ════════════════════════════════════════════════════════════ */
'use strict';

// ── 4 popup themes (matching extension presets) ─────────────────────────────
const THEMES = {
  'purple-amber': {
    name: 'Purple Amber', sub: 'Default',
    vars: {
      '--bg': '#0a0418', '--surface': '#140b26', '--surface2': '#1e1038',
      '--surface3': '#2a1848', '--border': '#3a2560',
      '--accent': '#FAAE7B', '--accent-2': '#7c3aed', '--highlight': '#b07de0',
      '--grad-a': '#7c3aed', '--grad-b': '#FAAE7B',
      '--text': '#f0e8ff', '--text-muted': '#8a6fc0',
      '--accent-glow': 'rgba(250,174,123,0.22)',
    },
    glyph: '👻',
  },
  'teal-coral': {
    name: 'Teal × Coral', sub: 'Reef',
    vars: {
      '--bg': '#04100f', '--surface': '#0b2626', '--surface2': '#113232',
      '--surface3': '#164040', '--border': '#1a4a4a',
      '--accent': '#ff6b6b', '--accent-2': '#00b4a0', '--highlight': '#00d4aa',
      '--grad-a': '#00b4a0', '--grad-b': '#ff6b6b',
      '--text': '#e0f8f4', '--text-muted': '#5a9e98',
      '--accent-glow': 'rgba(255,107,107,0.22)',
    },
    glyph: '🐚',
  },
  'synthwave': {
    name: 'Synthwave Dream', sub: '1986',
    vars: {
      '--bg': '#08011a', '--surface': '#170537', '--surface2': '#220848',
      '--surface3': '#2c0a5a', '--border': '#3d1066',
      '--accent': '#f72585', '--accent-2': '#7209b7', '--highlight': '#9b5de5',
      '--grad-a': '#7209b7', '--grad-b': '#f72585',
      '--text': '#f8eaff', '--text-muted': '#9b5de5',
      '--accent-glow': 'rgba(247,37,133,0.25)',
    },
    glyph: '🌆',
  },
  'synth-dusk': {
    name: 'Synth Dusk', sub: 'Twilight',
    vars: {
      '--bg': '#09071a', '--surface': '#181438', '--surface2': '#221c4a',
      '--surface3': '#2c245c', '--border': '#352b60',
      '--accent': '#fb923c', '--accent-2': '#6d28d9', '--highlight': '#a855f7',
      '--grad-a': '#6d28d9', '--grad-b': '#fb923c',
      '--text': '#faf0ff', '--text-muted': '#7c5fc0',
      '--accent-glow': 'rgba(251,146,60,0.22)',
    },
    glyph: '🌅',
  },
};

let currentTheme = 'purple-amber';

function applyTheme(id) {
  const t = THEMES[id]; if (!t) return;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.dataset.theme = id;
  currentTheme = id;
  // sync UI
  document.querySelectorAll('#themesRow .theme-card').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === id);
  });
  document.querySelectorAll('#tweakThemes .tweak-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === id);
  });
}

// ── Build theme cards ───────────────────────────────────────────────────────
function buildThemeCards() {
  const row = document.getElementById('themesRow');
  Object.entries(THEMES).forEach(([id, t]) => {
    const card = document.createElement('button');
    card.className = 'theme-card' + (id === currentTheme ? ' active' : '');
    card.dataset.theme = id;
    card.style.setProperty('--g-a', t.vars['--grad-a']);
    card.style.setProperty('--g-b', t.vars['--grad-b']);
    card.style.background = t.vars['--bg'];
    card.innerHTML = `
      <div class="swatch">
        <div><div class="glow"></div></div>
        <div><div class="glow2"></div></div>
        <div></div>
        <div class="orb-icon">${t.glyph}</div>
      </div>
      <div class="label">
        <div class="name">${t.name}</div>
        <div class="sub">${t.sub}</div>
      </div>
    `;
    card.addEventListener('click', () => applyTheme(id));
    row.appendChild(card);
  });

  // tweaks panel theme buttons
  const tweakRow = document.getElementById('tweakThemes');
  Object.entries(THEMES).forEach(([id, t]) => {
    const b = document.createElement('button');
    b.className = 'tweak-btn' + (id === currentTheme ? ' active' : '');
    b.dataset.theme = id;
    b.textContent = t.name;
    b.style.borderLeft = `3px solid ${t.vars['--grad-b']}`;
    b.addEventListener('click', () => applyTheme(id));
    tweakRow.appendChild(b);
  });
}

// ── Nav progress + active link ──────────────────────────────────────────────
function navScroll() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const pct = Math.min(100, Math.max(0, (window.scrollY / total) * 100));
  document.getElementById('navProgress').style.width = pct + '%';

  // active link
  const links = document.querySelectorAll('.nav-links a[data-link]');
  let active = '';
  links.forEach(a => {
    const sec = document.querySelector(a.getAttribute('href'));
    if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) active = a.getAttribute('href');
  });
  links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === active));
}
window.addEventListener('scroll', navScroll, { passive: true });

// ── Smooth nav links ────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    const t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
  });
});

// ── Hero form-fill animation ────────────────────────────────────────────────
const cursor = document.getElementById('ghostCursor');
const hoverPill = document.getElementById('hoverPill');
const demoForm = document.getElementById('demoForm');

let demoRunning = false;
let demoAbort = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function lowMotion() { return document.body.dataset.motion === 'low'; }

async function moveCursorTo(target, msg) {
  if (!cursor || !target) return;
  const stageRect = demoForm.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  // position relative to demoForm (which is positioned)
  const x = r.left - stageRect.left + r.width * 0.18;
  const y = r.top - stageRect.top + r.height * 0.55;
  cursor.style.transform = `translate(${x}px, ${y}px)`;
  cursor.dataset.msg = msg || 'May I?';
  cursor.classList.add('is-talking');

  // pill follows
  hoverPill.style.left = (r.left - stageRect.left + r.width - 70) + 'px';
  hoverPill.style.top = (r.top - stageRect.top - 26) + 'px';
  hoverPill.classList.add('show');

  await sleep(lowMotion() ? 100 : 700);
}

async function typeInto(el, text) {
  el.classList.add('is-filling');
  el.focus({ preventScroll: true });
  if (lowMotion()) {
    el.value = text;
    el.classList.remove('is-filling');
    el.classList.add('is-filled');
    return;
  }
  const speed = Math.max(18, Math.min(35, 600 / text.length));
  for (let i = 0; i < text.length; i++) {
    if (demoAbort) return;
    el.value = text.slice(0, i + 1);
    await sleep(speed);
  }
  el.classList.remove('is-filling');
  el.classList.add('is-filled');
}

async function runDemo() {
  if (demoRunning) return;
  demoRunning = true;
  demoAbort = false;

  const fields = Array.from(demoForm.querySelectorAll('[data-fill]'));
  // reset
  fields.forEach(f => { f.value = ''; f.classList.remove('is-filling', 'is-filled'); });
  cursor.classList.remove('is-talking');
  hoverPill.classList.remove('show');

  await sleep(600);

  for (const f of fields) {
    if (demoAbort) break;
    await moveCursorTo(f, f.dataset.msg || 'May I?');
    await sleep(160);
    await typeInto(f, f.dataset.fill);
    await sleep(180);
  }

  // park cursor on the Haunt button
  const haunt = demoForm.querySelector('.haunt');
  if (haunt && !demoAbort) {
    await moveCursorTo(haunt, 'haunted ✓');
    haunt.style.transform = 'scale(0.96)';
    haunt.style.boxShadow = '0 0 30px var(--accent)';
    await sleep(800);
    haunt.style.transform = '';
    haunt.style.boxShadow = '';
  }
  hoverPill.classList.remove('show');
  cursor.classList.remove('is-talking');

  demoRunning = false;

  // loop
  await sleep(2500);
  if (!demoAbort && document.body.dataset.motion === 'high') runDemo();
}

// Start when hero is visible
const heroObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting && !demoRunning) runDemo();
    else if (!e.isIntersecting) { demoAbort = true; }
  });
}, { threshold: 0.3 });
heroObserver.observe(demoForm);

// Replay button
document.getElementById('tweakReplay')?.addEventListener('click', () => {
  demoAbort = true;
  setTimeout(() => { demoRunning = false; demoAbort = false; runDemo(); }, 200);
});

// ── Fields marquee ──────────────────────────────────────────────────────────
const FIELDS = {
  Identity: ['firstName','lastName','middleName','fullName','displayName','dob','age','gender','nationality','placeOfBirth','passportNo','passportExpiry','nationalId','taxId','voterId','drivingLicence','bloodGroup','maritalStatus','medicalNotes','ecName','ecRelation','ecPhone'],
  Contact: ['email','emailAlt','phone','phoneAlt','whatsapp','fax','address1','address2','landmark','city','district','state','zip','country','countryCode','poBox','website','linkedin','github','twitter','instagram','skype','telegram','discord'],
  Career: ['company','jobTitle','department','employeeId','yearsExp','noticePeriod','currentCtc','expectedCtc','skills','bio','degree','major','university','gradYear','gpa','bankName','bankAccount','ifsc','gstin','cardNumber','cardExpiry','cvv','cardHolder'],
  Login: ['username','password','passwordConfirm','otp','pin','secAnswer1','secAnswer2','secAnswer3','recoveryEmail','recoveryPhone'],
};

function buildMarquees() {
  // mix fields into 3 rows, repeat each row twice for seamless loop
  const all = [];
  Object.entries(FIELDS).forEach(([sec, keys]) => keys.forEach(k => all.push({ sec, k })));
  // shuffle deterministically
  const shuffled = [...all].sort((a, b) => ((a.k.charCodeAt(0)+a.k.charCodeAt(a.k.length-1)) - (b.k.charCodeAt(0)+b.k.charCodeAt(b.k.length-1))));

  const slices = [
    shuffled.slice(0, 28),
    shuffled.slice(28, 56),
    shuffled.slice(56, 79).concat(shuffled.slice(0, 5)),
  ];
  const ids = ['marqueeA', 'marqueeB', 'marqueeC'];
  const highlights = ['email', 'github', 'passportNo', 'cardNumber', 'taxId', 'username', 'cvv', 'aadhaar', 'linkedin', 'gstin'];

  slices.forEach((slice, i) => {
    const track = document.getElementById(ids[i]);
    if (!track) return;
    const html = slice.map(({ sec, k }) => {
      const hl = highlights.includes(k) || Math.random() < 0.05;
      const cls = `chip${hl ? ' accent' : ''}${k === 'password' || k === 'cvv' ? ' glow' : ''}`;
      return `<span class="${cls}"><span class="sec">${sec}</span>${k}</span>`;
    }).join('');
    // duplicate for seamless loop
    track.innerHTML = html + html;
  });
}

// ── Draggable popup ─────────────────────────────────────────────────────────
const popupCard = document.getElementById('popupCard');
const popupStage = document.getElementById('popupStage');

let popupState = { x: 0, y: 0, rotY: -12, rotX: 8, dragging: false, sx: 0, sy: 0, dx: 0, dy: 0 };

function setPopupTransform() {
  popupCard.style.transform = `translate(calc(-50% + ${popupState.x}px), calc(-50% + ${popupState.y}px)) rotateY(${popupState.rotY}deg) rotateX(${popupState.rotX}deg)`;
}

function startDrag(e) {
  popupState.dragging = true;
  popupCard.classList.add('is-dragging');
  const pt = e.touches ? e.touches[0] : e;
  popupState.sx = pt.clientX;
  popupState.sy = pt.clientY;
  popupState.dx = popupState.x;
  popupState.dy = popupState.y;
  e.preventDefault();
}

function moveDrag(e) {
  if (!popupState.dragging) return;
  const pt = e.touches ? e.touches[0] : e;
  const ax = pt.clientX - popupState.sx;
  const ay = pt.clientY - popupState.sy;
  popupState.x = popupState.dx + ax;
  popupState.y = popupState.dy + ay;
  // subtle tilt based on velocity
  popupState.rotY = -12 + ax * 0.05;
  popupState.rotX = 8 - ay * 0.05;
  setPopupTransform();
}

function endDrag() {
  if (!popupState.dragging) return;
  popupState.dragging = false;
  popupCard.classList.remove('is-dragging');
  // ease back to base tilt
  popupState.rotY = -8;
  popupState.rotX = 4;
  setPopupTransform();
}

popupCard.addEventListener('mousedown', startDrag);
popupCard.addEventListener('touchstart', startDrag, { passive: false });
window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, { passive: false });
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

// Idle float when not dragged
let popupIdle = 0;
function popupFloat() {
  if (!popupState.dragging) {
    popupIdle += 0.012;
    popupState.x += Math.sin(popupIdle) * 0.15;
    popupState.y += Math.cos(popupIdle * 0.8) * 0.1;
    setPopupTransform();
  }
  requestAnimationFrame(popupFloat);
}
setPopupTransform();
if (!lowMotion()) requestAnimationFrame(popupFloat);

// Mouse parallax on the popup stage
popupStage.addEventListener('mousemove', e => {
  if (popupState.dragging || lowMotion()) return;
  const r = popupStage.getBoundingClientRect();
  const nx = (e.clientX - r.left) / r.width - 0.5;
  const ny = (e.clientY - r.top) / r.height - 0.5;
  popupState.rotY = -8 + nx * 14;
  popupState.rotX = 4 - ny * 10;
  setPopupTransform();
});

// Reset on 'R'
window.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') resetPopup();
});
function resetPopup() {
  popupState.x = 0; popupState.y = 0; popupState.rotY = -12; popupState.rotX = 8;
  setPopupTransform();
}
document.getElementById('tweakResetPopup')?.addEventListener('click', resetPopup);

// ── Hero mini popup parallax ───────────────────────────────────────────────
const miniPopup = document.getElementById('miniPopup');
document.querySelector('.hero-stage')?.addEventListener('mousemove', e => {
  if (lowMotion()) return;
  const r = e.currentTarget.getBoundingClientRect();
  const nx = (e.clientX - r.left) / r.width - 0.5;
  const ny = (e.clientY - r.top) / r.height - 0.5;
  if (miniPopup) miniPopup.style.transform = `rotate(${6 + nx * 4}deg) translate(${nx * 12}px, ${ny * 12}px)`;
});

// ── Pillar cards stagger reveal ────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.pillar-card, .sec-card, .browser, .theme-card').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = `opacity 0.7s ${i % 4 * 0.08}s, transform 0.7s ${i % 4 * 0.08}s, border-color 0.3s, background 0.3s`;
  revealObserver.observe(el);
});

// ── Tweaks panel protocol ───────────────────────────────────────────────────
const tweaksPanel = document.getElementById('tweaksPanel');

window.addEventListener('message', (e) => {
  if (e.data?.type === '__activate_edit_mode') tweaksPanel.classList.add('active');
  if (e.data?.type === '__deactivate_edit_mode') tweaksPanel.classList.remove('active');
});

document.getElementById('tweaksClose')?.addEventListener('click', () => {
  tweaksPanel.classList.remove('active');
  try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch {}
});

// Motion toggle
document.querySelectorAll('#tweakMotion .tweak-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.body.dataset.motion = b.dataset.motion;
    document.querySelectorAll('#tweakMotion .tweak-btn').forEach(x => x.classList.toggle('active', x === b));
  });
});

// Font toggle
document.querySelectorAll('#tweakFont .tweak-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#tweakFont .tweak-btn').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.font === 'grotesk') {
      document.documentElement.style.setProperty('--display', '"Space Grotesk", sans-serif');
    } else {
      document.documentElement.style.setProperty('--display', '"Instrument Serif", "Times New Roman", serif');
    }
  });
});

// ── Install quickstart tabs ─────────────────────────────────────────────────
const QS_CONTENT = {
  mac: `<span class="qc-c"># 1. clone</span>
git clone https://github.com/anubhavmohandas/GHOST.git
<span class="qc-c"># 2. open chrome://extensions, enable Developer mode</span>
<span class="qc-c"># 3. Load unpacked → select GHOST folder</span>
<span class="qc-c"># 4. profit. (or pull updates)</span>
./update.sh`,
  win: `<span class="qc-c">REM 1. clone</span>
git clone https://github.com/anubhavmohandas/GHOST.git
<span class="qc-c">REM 2. open chrome://extensions, enable Developer mode</span>
<span class="qc-c">REM 3. Load unpacked → select GHOST folder</span>
<span class="qc-c">REM 4. profit. (or pull updates)</span>
update.bat`,
};
document.querySelectorAll('.qs-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.qs-tab').forEach(x => x.classList.toggle('active', x === t));
    const code = document.querySelector('#qsCode pre');
    if (code) code.innerHTML = QS_CONTENT[t.dataset.os] || QS_CONTENT.mac;
  });
});
buildThemeCards();
buildMarquees();
applyTheme('purple-amber');
navScroll();

// Announce tweaks availability AFTER listener is wired
try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}

// ── Ghost custom cursor (replaces system pointer site-wide) ─────────────────
(function () {
  const el = document.createElement('div');
  el.id = 'ghost-pointer';
  el.textContent = '👻';
  document.body.appendChild(el);

  let cx = window.innerWidth / 2, cy = window.innerHeight / 2;

  document.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
  }, { passive: true });

  document.addEventListener('mousedown', () => el.classList.add('clicking'));
  document.addEventListener('mouseup',   () => el.classList.remove('clicking'));

  // Hide when pointer leaves window, restore on enter
  document.addEventListener('mouseleave', () => { el.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
})();
