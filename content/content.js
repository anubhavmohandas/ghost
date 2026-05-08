/**
 * GHOST — Content Script v5.1
 * Smart field detection across 80+ real-world form field patterns.
 * Hover pill: gradient sweep when data exists, sad state when it doesn't.
 */
'use strict';

// ── FIELD_MAP ─────────────────────────────────────────────────────────────────
// Each entry: { patterns[], autocomplete?, type?, selectValues? }
// patterns = regex strings matched against: name, id, autocomplete, placeholder, aria-label, label text
// selectValues = for <select> elements, the value/text to try matching

const FIELD_MAP = {

  // ── PERSONAL ────────────────────────────────────────────────────────────────
  firstName: {
    autocomplete: 'given-name',
    patterns: ['first.?name','given.?name','fname','forename','prenom','first'],
  },
  lastName: {
    autocomplete: 'family-name',
    patterns: ['last.?name','family.?name','lname','surname','last'],
  },
  middleName: {
    autocomplete: 'additional-name',
    patterns: ['middle.?name','middle.?initial','mname'],
  },
  fullName: {
    autocomplete: 'name',
    patterns: ['full.?name','complete.?name','your.?name','name$','^name'],
  },
  displayName: {
    patterns: ['display.?name','nick.?name','screen.?name','alias','handle','public.?name'],
  },
  dob: {
    autocomplete: 'bday',
    patterns: ['dob','date.?of.?birth','birth.?date','birthday','date_of_birth','birth.?day','born'],
  },
  age: {
    patterns: ['\\bage\\b','your.?age','age.?years'],
  },
  gender: {
    autocomplete: 'sex',
    patterns: ['gender','sex(?!ual)'],
    selectValues: ['male','female','other','prefer not'],
  },

  // ── IDENTITY / GOV IDs ───────────────────────────────────────────────────────
  nationality: {
    autocomplete: 'country-name',
    patterns: ['nationality','citizenship','national.?origin'],
  },
  placeOfBirth: {
    patterns: ['place.?of.?birth','birth.?place','city.?of.?birth','pob'],
  },
  passportNo: {
    patterns: ['passport.?(?:no|num|number)','passport.?id'],
  },
  passportExpiry: {
    patterns: ['passport.?expir','passport.?valid','passport.?expiry','passport.?date'],
  },
  nationalId: {
    patterns: ['national.?id','aadhaar','aadhar','uid','nic.?number','cnic','nid','citizen.?id','id.?number','identity.?number'],
  },
  taxId: {
    patterns: ['pan.?(?:card|no|number)?','ssn','tax.?id','tin','vat.?id','gst.?number','income.?tax','npi'],
  },
  voterId: {
    patterns: ['voter.?id','election.?id','epic.?no'],
  },
  drivingLicence: {
    autocomplete: 'cc-number', // fallback
    patterns: ['driving.?licen[cs]e','dl.?number','driver.?licen[cs]e','licence.?no'],
  },
  bloodGroup: {
    patterns: ['blood.?group','blood.?type'],
    selectValues: ['a+','a-','b+','b-','o+','o-','ab+','ab-'],
  },
  maritalStatus: {
    patterns: ['marital.?status','married','relationship.?status','civil.?status'],
    selectValues: ['single','married','divorced','widowed'],
  },
  medicalNotes: {
    patterns: ['allerg','medical.?(?:info|notes|condition|history)','health.?info','disability'],
  },

  // ── EMERGENCY CONTACT ─────────────────────────────────────────────────────
  ecName: {
    patterns: ['emergency.?contact.?name','ec.?name','next.?of.?kin.?name'],
  },
  ecRelation: {
    patterns: ['emergency.?contact.?rel','relationship.?to','ec.?relation','next.?of.?kin.?rel'],
  },
  ecPhone: {
    patterns: ['emergency.?(?:contact.?)?(?:phone|mobile|number)','ec.?phone','next.?of.?kin.?phone'],
  },

  // ── CONTACT ────────────────────────────────────────────────────────────────
  email: {
    autocomplete: 'email',
    type: 'email',
    patterns: ['e.?mail(?!.*confirm|.*repeat|.*alt|.*sec|.*recov|.*2|.*again)','email.?address','your.?email'],
  },
  emailAlt: {
    patterns: ['alternate.?email','secondary.?email','work.?email','alt.?email','email.?2','email2','backup.?email','other.?email'],
  },
  phone: {
    autocomplete: 'tel',
    type: 'tel',
    patterns: ['(?:primary|main|mobile|cell|contact|personal).?(?:phone|number|tel)?','phone(?!.*alt|.*2|.*sec|.*emerg)','tel(?!.*alt|.*2)','mobile(?!.*alt|.*2)'],
  },
  phoneAlt: {
    patterns: ['alternate.?(?:phone|number|mobile)','secondary.?(?:phone|number)','phone.?2','alt.?phone','other.?phone','landline'],
  },
  whatsapp: {
    patterns: ['whatsapp','wa.?number','watsapp'],
  },
  fax: {
    autocomplete: 'fax',
    patterns: ['fax'],
  },

  // ── ADDRESS ────────────────────────────────────────────────────────────────
  address1: {
    autocomplete: 'address-line1',
    patterns: ['address.?(?:line.?)?1','street.?address','addr(?:ess)?1','street','mailing.?address','billing.?address'],
  },
  address2: {
    autocomplete: 'address-line2',
    patterns: ['address.?(?:line.?)?2','apt','suite','flat','floor','addr(?:ess)?2','unit.?number'],
  },
  landmark: {
    patterns: ['landmark','nearby','near.?to'],
  },
  city: {
    autocomplete: 'address-level2',
    patterns: ['city','town','municipality','locality','tehsil'],
  },
  district: {
    patterns: ['district','taluk','taluka','sub.?district'],
  },
  state: {
    autocomplete: 'address-level1',
    patterns: ['state','province','region','county','territory','oblast'],
  },
  zip: {
    autocomplete: 'postal-code',
    patterns: ['zip','postal.?code','postcode','pin.?code','pincode','pcode'],
  },
  country: {
    autocomplete: 'country-name',
    patterns: ['country(?!.?code)'],
  },
  countryCode: {
    autocomplete: 'country',
    patterns: ['country.?code','iso.?code','calling.?code'],
  },
  poBox: {
    patterns: ['po.?box','p\.o\.box','postal.?box'],
  },

  // ── SOCIAL & WEB ─────────────────────────────────────────────────────────
  website: {
    type: 'url',
    patterns: ['website','portfolio','homepage','web.?(?:site|address|page|url)','personal.?url','blog'],
  },
  linkedin: {
    patterns: ['linkedin','linked.in'],
  },
  github: {
    patterns: ['github','git.?hub','gh.?username'],
  },
  twitter: {
    patterns: ['twitter','x.?handle','tweet'],
  },
  instagram: {
    patterns: ['instagram','insta'],
  },
  skype: {
    patterns: ['skype'],
  },
  telegram: {
    patterns: ['telegram','tg.?handle'],
  },
  discord: {
    patterns: ['discord'],
  },

  // ── PROFESSIONAL ─────────────────────────────────────────────────────────
  company: {
    autocomplete: 'organization',
    patterns: ['company','organisation','organization','employer','firm','business.?name','workplace'],
  },
  jobTitle: {
    autocomplete: 'organization-title',
    patterns: ['job.?title','designation','position','role(?!.?model)','title(?!.*mr|.*ms|.*dr)','occupation','profession'],
  },
  department: {
    patterns: ['department','dept','division','team(?!.*name)','group(?!.*name)'],
  },
  employeeId: {
    patterns: ['employee.?id','emp.?id','staff.?id','worker.?id','personnel.?id'],
  },
  yearsExp: {
    patterns: ['years?.?of.?exp','total.?exp','work.?exp','experience.?years?'],
  },
  noticePeriod: {
    patterns: ['notice.?period','notice.?days?','serving.?notice'],
  },
  currentCtc: {
    patterns: ['current.?(?:ctc|salary|package|compensation)','present.?salary','annual.?salary'],
  },
  expectedCtc: {
    patterns: ['expected.?(?:ctc|salary|package)','desired.?salary','target.?salary'],
  },
  skills: {
    patterns: ['skills?','expertise','tech.?stack','technologies','competencies','key.?skills'],
  },
  bio: {
    patterns: ['bio(?!metric)','about.?(?:me|yourself)','summary','overview','profile.?description','introduce.?yourself'],
  },

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  degree: {
    patterns: ['degree','qualification','highest.?education','academic.?qualification'],
    selectValues: ['bachelor','master','phd','diploma','10th','12th'],
  },
  major: {
    patterns: ['major','field.?of.?study','specialization','stream','branch','subject'],
  },
  university: {
    patterns: ['university','college','institution','school(?!.?name.*city)','institute'],
  },
  gradYear: {
    patterns: ['graduation.?year','passing.?year','year.?of.?(?:graduation|passing)','batch'],
  },
  gpa: {
    patterns: ['gpa','cgpa','percentage','aggregate','marks','grade(?!.?level)'],
  },

  // ── FINANCIAL / KYC ──────────────────────────────────────────────────────
  bankName: {
    patterns: ['bank.?name','bank(?!.?account|.?code|.?ifsc)'],
  },
  bankAccount: {
    patterns: ['account.?(?:no|num|number)','bank.?account','acc.?no'],
  },
  ifsc: {
    patterns: ['ifsc','routing.?number','sort.?code','bsb','swift'],
  },
  gstin: {
    patterns: ['gstin','gst.?(?:no|number|registration)'],
  },
  cardNumber: {
    autocomplete: 'cc-number',
    patterns: ['card.?(?:no|num|number)','credit.?card','debit.?card','card.?details'],
  },
  cardExpiry: {
    autocomplete: 'cc-exp',
    patterns: ['card.?expir','expiry','exp.?date','valid.?(?:thru|through|till|until)'],
  },
  cvv: {
    autocomplete: 'cc-csc',
    patterns: ['cvv','cvc','csc','security.?code','card.?verification'],
  },
  cardHolder: {
    autocomplete: 'cc-name',
    patterns: ['card.?holder','name.?on.?card','cardholder'],
  },

  // ── CREDENTIALS ──────────────────────────────────────────────────────────
  username: {
    autocomplete: 'username',
    patterns: ['username','user.?name','login(?!.?pass)','account.?name','handle'],
  },
  password: {
    autocomplete: 'current-password',
    type: 'password',
    patterns: ['password(?!.*confirm|.*repeat|.*again|.*new|.*old)','passwd(?!.*confirm)','^pass$','secret'],
  },
  passwordConfirm: {
    autocomplete: 'new-password',
    patterns: ['confirm.?pass','repeat.?pass','retype.?pass','verify.?pass','password.?confirm','password.?again'],
  },
  otp: {
    patterns: ['otp','one.?time','verification.?code','totp','mfa','tfa','2fa','auth.?code','sms.?code','email.?code'],
  },
  pin: {
    patterns: ['\\bpin\\b','pin.?code','atm.?pin','access.?pin'],
  },
  secAnswer1: {
    patterns: ['security.?answer(?!.*2|.*3)','secret.?answer(?!.*2)','mother.?maiden'],
  },
  secAnswer2: {
    patterns: ['security.?answer.?2','secret.?answer.?2','answer.?2'],
  },
  secAnswer3: {
    patterns: ['security.?answer.?3','secret.?answer.?3','answer.?3'],
  },
  recoveryEmail: {
    patterns: ['recovery.?email','rescue.?email','backup.?email'],
  },
  recoveryPhone: {
    patterns: ['recovery.?phone','rescue.?(?:phone|number)','backup.?phone'],
  },
};

// ── Profile key → section mapping ────────────────────────────────────────────
const KEY_SECTION = {};
['firstName','lastName','middleName','fullName','displayName','dob','age','gender',
 'nationality','placeOfBirth','passportNo','passportExpiry','nationalId','taxId',
 'voterId','drivingLicence','bloodGroup','maritalStatus','medicalNotes',
 'ecName','ecRelation','ecPhone'].forEach(k => KEY_SECTION[k] = 'personal');

['email','emailAlt','phone','phoneAlt','whatsapp','fax',
 'address1','address2','landmark','city','district','state','zip','country','countryCode','poBox',
 'website','linkedin','github','twitter','instagram','skype','telegram','discord'].forEach(k => KEY_SECTION[k] = 'contact');

['company','jobTitle','department','employeeId','yearsExp','noticePeriod','currentCtc','expectedCtc',
 'skills','bio','degree','major','university','gradYear','gpa',
 'bankName','bankAccount','ifsc','gstin','cardNumber','cardExpiry','cvv','cardHolder'].forEach(k => KEY_SECTION[k] = 'professional');

['username','password','passwordConfirm','otp','pin',
 'secAnswer1','secAnswer2','secAnswer3','recoveryEmail','recoveryPhone'].forEach(k => KEY_SECTION[k] = 'credentials');

// ── Utils ─────────────────────────────────────────────────────────────────────

function getLabel(input) {
  const aria = input.getAttribute('aria-label');
  if (aria?.trim()) return aria;
  if (input.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (lbl) return lbl.innerText;
  }
  const wrap = input.closest('label');
  if (wrap) return wrap.innerText;
  const lblBy = input.getAttribute('aria-labelledby');
  if (lblBy) {
    const el = document.getElementById(lblBy.split(' ')[0]);
    if (el) return el.innerText;
  }
  const prev = input.previousElementSibling;
  if (prev && ['LABEL','SPAN','DIV','P','LEGEND'].includes(prev.tagName)) return prev.innerText;
  const parent = input.parentElement;
  if (parent) {
    const lbl = parent.querySelector('label, .label, [class*="label"]');
    if (lbl && lbl !== input) return lbl.innerText;
  }
  return '';
}

function haystack(input) {
  return [
    input.name || '', input.id || '',
    input.getAttribute('autocomplete') || '',
    input.placeholder || '',
    input.getAttribute('data-field') || '',
    input.getAttribute('data-name') || '',
    input.className || '',
    getLabel(input),
  ].join(' ').toLowerCase();
}

function matchesSignature(input, sig) {
  if (sig.type && input.type === sig.type && ['password','email','tel','url'].includes(sig.type)) return true;
  if (sig.autocomplete) {
    const ac = input.getAttribute('autocomplete');
    if (ac && (ac === sig.autocomplete || ac.endsWith(sig.autocomplete))) return true;
  }
  const h = haystack(input);
  return sig.patterns.some((p) => new RegExp(p, 'i').test(h));
}

function isVisible(el, fillHidden) {
  if (fillHidden) return true;
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0
    && el.offsetWidth > 0 && el.offsetHeight > 0;
}

function getProfileValue(profile, key) {
  const sec = KEY_SECTION[key];
  return sec ? profile[sec]?.[key] : undefined;
}

// ── Field detection ───────────────────────────────────────────────────────────

function detectFields(fillHidden = false) {
  const selector = 'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="image"]):not([type="range"]):not([type="color"]), textarea';
  const inputs = [...document.querySelectorAll(selector)];
  const map = {};

  for (const input of inputs) {
    if (!isVisible(input, fillHidden)) continue;
    for (const [key, sig] of Object.entries(FIELD_MAP)) {
      if (!map[key] && matchesSignature(input, sig)) {
        map[key] = input;
        break;
      }
    }
  }
  return map;
}

// ── Fill ──────────────────────────────────────────────────────────────────────

function nativeSet(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  ['input','change','blur'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true })));
}

function nativeSelectSet(sel, value) {
  const opts = [...sel.options];
  // Try exact match, then includes match (case-insensitive)
  let opt = opts.find((o) => o.value.toLowerCase() === value.toLowerCase()
    || o.text.toLowerCase() === value.toLowerCase());
  if (!opt) opt = opts.find((o) =>
    o.value.toLowerCase().includes(value.toLowerCase()) ||
    o.text.toLowerCase().includes(value.toLowerCase())
  );
  if (opt) {
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function highlight(el) {
  const prev = el.style.outline;
  el.style.outline = '2px solid #22c55e';
  el.style.outlineOffset = '2px';
  setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = ''; }, 1600);
}

function fillFields(fieldMap, profile, opts = {}) {
  const { doHighlight = true } = opts;
  let count = 0;

  for (const [key, el] of Object.entries(fieldMap)) {
    const val = getProfileValue(profile, key);
    if (!val) continue;
    nativeSet(el, val);
    if (doHighlight) highlight(el);
    count++;
  }

  // Custom fields — CSS selector or name/id
  for (const { key, value } of (profile.custom || [])) {
    if (!key || !value) continue;
    let target = null;
    try { target = document.querySelector(key); } catch {}
    if (!target) target = document.querySelector(`[name="${key}"],[id="${key}"]`);
    if (target) {
      nativeSet(target, value);
      if (doHighlight) highlight(target);
      count++;
    }
  }

  return count;
}

function fillSelects(profile, opts = {}) {
  const { doHighlight = true } = opts;
  let count = 0;
  document.querySelectorAll('select').forEach((sel) => {
    if (!isVisible(sel, opts.fillHidden)) return;
    const h = haystack(sel);
    for (const [key, sig] of Object.entries(FIELD_MAP)) {
      if (!sig.selectValues) continue;
      if (!matchesSignature(sel, sig)) continue;
      const val = getProfileValue(profile, key);
      if (!val) continue;
      if (nativeSelectSet(sel, val)) {
        if (doHighlight) highlight(sel);
        count++;
        break;
      }
    }
  });
  return count;
}

// ── Message handler ───────────────────────────────────────────────────────────

let lastFocused = null;
document.addEventListener('focusin', (e) => {
  if (['INPUT','TEXTAREA'].includes(e.target.tagName)) lastFocused = e.target;
});

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  const { type, profile, settings = {} } = msg;
  const doHighlight = settings.highlight !== false;
  const fillHidden  = settings.fillHidden === true;
  const doSelect    = settings.fillSelect !== false;

  if (type === 'FILL_ALL') {
    const map = detectFields(fillHidden);
    let count = fillFields(map, profile, { doHighlight });
    if (doSelect) count += fillSelects(profile, { doHighlight, fillHidden });
    sendResponse({ ok: true, count });
  }

  else if (type === 'FILL_SMART') {
    const map = detectFields(false);
    const empties = Object.fromEntries(Object.entries(map).filter(([,el]) => !el.value.trim()));
    let count = fillFields(empties, profile, { doHighlight });
    if (doSelect) count += fillSelects(profile, { doHighlight });
    sendResponse({ ok: true, count });
  }

  else if (type === 'INJECT_PAYLOAD') {
    const target = lastFocused || document.activeElement;
    if (target && ['INPUT','TEXTAREA'].includes(target.tagName)) {
      nativeSet(target, msg.payload);
      if (doHighlight) highlight(target);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, reason: 'No focused field' });
    }
  }

  else if (type === 'PREVIEW_FIELDS') {
    const map = detectFields(fillHidden);
    const fields = Object.entries(map).map(([profileKey, el]) => ({
      profileKey,
      label: getLabel(el) || el.placeholder || '',
      tagInfo: `<${el.tagName.toLowerCase()} type="${el.type||'-'}" name="${el.name||el.id||'-'}">`,
    }));
    sendResponse({ ok: true, fields });
  }

  return true;
});

// ── Cmd+Shift+F / Ctrl+Shift+F shortcut ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const trigger = isMac
    ? (e.metaKey && e.shiftKey && e.key === 'f')
    : (e.ctrlKey && e.shiftKey && e.key === 'F');
  if (trigger) chrome.runtime.sendMessage({ type: 'SHORTCUT_FILL' });
});

// ── Hover Pill ────────────────────────────────────────────────────────────────
// "👻 May I?" pill at right edge of any detectable field.
// Hovering the pill shows a data-aware state before clicking.
// Has data  → gradient sweeps in, sarcastic "Done bro Done 🕺" vibe
// No data   → sad ghost, "tune mujhe data diya hi nai 🥹"

const PILL_HAS_DATA_MSGS = [
  'Done bro done 🕺',
  'tera kaam mera kaam 💅',
  'haan haan, karunga 😤',
  'bata de bas, bhar dunga 👻',
  'ek second bhai 🫡',
];

let ghostPill      = null;
let pillTarget     = null;
let pillHideTimer  = null;
let cachedProfile  = null;
let profileLoadTs  = 0;

// Inject pill styles once
const pillStyle = document.createElement('style');
pillStyle.textContent = `
  #ghost-pill {
    position: fixed;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px 3px 6px;
    background: #0d0221;
    border: 1.5px solid #7c3aed;
    border-radius: 20px;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #c4b5fd;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(124,58,237,0.3);
    pointer-events: all;
    transition: opacity 0.15s, transform 0.12s, border-color 0.2s;
    white-space: nowrap;
    user-select: none;
    overflow: hidden;
    background-size: 200% 100%;
    background-position: 100% 0;
  }
  #ghost-pill .pill-ghost { font-size: 13px; line-height: 1; transition: transform 0.2s; }
  #ghost-pill .pill-text  { font-weight: 600; letter-spacing: 0.02em; }

  /* ── State: data exists, pill hovered ── */
  #ghost-pill.pill-sweep {
    background-image: linear-gradient(90deg, #7c3aed 0%, #f72585 55%, #FAAE7B 100%) !important;
    background-size: 200% 100% !important;
    border-color: transparent !important;
    color: #fff !important;
    transform: scale(1.06);
    animation: ghostSweep 0.45s cubic-bezier(.4,0,.2,1) forwards;
  }
  #ghost-pill.pill-sweep .pill-ghost { transform: rotate(-10deg) scale(1.1); }
  @keyframes ghostSweep {
    from { background-position: 100% 0; }
    to   { background-position: 0% 0; }
  }

  /* ── State: no data, pill hovered ── */
  #ghost-pill.pill-sad {
    background: #1a0a2e !important;
    border-color: #3d1a60 !important;
    color: #6b4fa0 !important;
    cursor: not-allowed !important;
    transform: none !important;
    animation: ghostShake 0.35s ease;
  }
  @keyframes ghostShake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-3px); }
    40%      { transform: translateX(3px); }
    60%      { transform: translateX(-2px); }
    80%      { transform: translateX(2px); }
  }
`;
document.head.appendChild(pillStyle);

function createPill() {
  const el = document.createElement('div');
  el.id = 'ghost-pill';
  el.innerHTML = '<span class="pill-ghost">👻</span><span class="pill-text">May I?</span>';
  document.body.appendChild(el);
  return el;
}

function getPill() {
  if (!ghostPill || !document.getElementById('ghost-pill')) {
    ghostPill = createPill();
  }
  return ghostPill;
}

function resetPillAppearance(pill) {
  pill.classList.remove('pill-sweep', 'pill-sad');
  pill.querySelector('.pill-ghost').textContent = '👻';
  pill.querySelector('.pill-text').textContent  = 'May I?';
}

// Load profile with 5-second in-memory cache
async function getProfile() {
  if (cachedProfile && (Date.now() - profileLoadTs) < 5000) return cachedProfile;
  return new Promise((res) => {
    chrome.storage.local.get(['profiles', 'activeId'], (d) => {
      cachedProfile = d.profiles?.[d.activeId] || null;
      profileLoadTs = Date.now();
      res(cachedProfile);
    });
  });
}

async function showPill(input, profileKey) {
  const pill = getPill();
  pillTarget = { input, profileKey };

  const rect  = input.getBoundingClientRect();
  const pillH = 26;
  pill.style.top          = `${Math.max(4, rect.top + (rect.height - pillH) / 2)}px`;
  pill.style.left         = `${Math.max(4, rect.right - 88)}px`;
  pill.style.opacity      = '1';
  pill.style.pointerEvents = 'all';
  resetPillAppearance(pill);
  clearTimeout(pillHideTimer);

  // Pre-fetch profile so hover response is instant
  const profile = await getProfile();
  const hasData = !!(profile && getProfileValue(profile, profileKey));
  // Only update dataset if pill is still on this field
  if (pillTarget?.profileKey === profileKey) {
    pill.dataset.hasData = hasData ? '1' : '0';
  }
}

function hidePill(delay = 300) {
  clearTimeout(pillHideTimer);
  pillHideTimer = setTimeout(() => {
    const pill = document.getElementById('ghost-pill');
    if (pill) {
      resetPillAppearance(pill);
      pill.style.opacity      = '0';
      pill.style.pointerEvents = 'none';
    }
    pillTarget = null;
  }, delay);
}

// Attach hover listeners to all recognizable inputs
function attachHoverListeners() {
  const selector = 'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea';

  document.querySelectorAll(selector).forEach((input) => {
    if (input.__ghostHover) return;
    input.__ghostHover = true;

    let mappedKey = null;
    for (const [key, sig] of Object.entries(FIELD_MAP)) {
      if (matchesSignature(input, sig)) { mappedKey = key; break; }
    }
    if (!mappedKey) return;

    input.addEventListener('mouseenter', () => {
      if (!isVisible(input, false)) return;
      showPill(input, mappedKey);
    });
    input.addEventListener('mouseleave', () => hidePill(350));
  });
}

// Pill mouseenter → apply data-aware state
document.addEventListener('mouseover', (e) => {
  const pill = document.getElementById('ghost-pill');
  if (!pill || !e.target.closest('#ghost-pill')) return;
  clearTimeout(pillHideTimer);

  const hasData = pill.dataset.hasData === '1';
  if (hasData) {
    pill.classList.remove('pill-sad');
    pill.classList.add('pill-sweep');
    const msg = PILL_HAS_DATA_MSGS[Math.floor(Math.random() * PILL_HAS_DATA_MSGS.length)];
    pill.querySelector('.pill-text').textContent = msg;
  } else {
    pill.classList.remove('pill-sweep');
    pill.classList.add('pill-sad');
    pill.querySelector('.pill-ghost').textContent = '🥹';
    pill.querySelector('.pill-text').textContent  = 'tune data diya hi nai';
  }
});

// Pill mouseleave → reset
document.addEventListener('mouseout', (e) => {
  const pill = document.getElementById('ghost-pill');
  if (!pill || !e.target.closest('#ghost-pill')) return;
  resetPillAppearance(pill);
  hidePill(300);
});

// Pill click → fill field (only if data exists)
document.addEventListener('click', async (e) => {
  if (!e.target.closest('#ghost-pill')) return;
  if (!pillTarget) return;

  const pill    = document.getElementById('ghost-pill');
  const hasData = pill?.dataset.hasData === '1';
  if (!hasData) return; // no data — do nothing on click

  // Capture before hidePill(0) nulls pillTarget
  const { input, profileKey } = pillTarget;
  hidePill(0);

  const profile = await getProfile();
  if (!profile || !input) return;

  const val = getProfileValue(profile, profileKey);
  if (!val) return;

  nativeSet(input, val);
  highlight(input);
});

// Initial scan + MutationObserver for dynamic forms
attachHoverListeners();
new MutationObserver(() => attachHoverListeners()).observe(document.body, {
  childList: true, subtree: true,
});
