/**
 * GHOST — Content Script v5.1
 * Smart field detection across 80+ real-world form field patterns.
 * Hover pill: gradient sweep when data exists, sad state when it doesn't.
 */
'use strict';

// ── Double-injection guard ─────────────────────────────────────────────────────
// background.js re-injects this script on keyboard shortcut if content script
// wasn't already present. Guard prevents duplicate pill elements + listeners.
if (window.__ghostInjected) {
  // Already running — just respond to fill requests, don't re-init
  throw 'GHOST:already-injected'; // string throw — no stack trace, no DevTools noise
}
window.__ghostInjected = true;

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
    // No autocomplete value — 'cc-number' was a copy-paste bug that would match CC fields
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
  // password type is unambiguous — always match
  if (sig.type === 'password' && input.type === 'password') return true;
  // autocomplete attribute is authoritative when present
  if (sig.autocomplete) {
    const ac = input.getAttribute('autocomplete');
    if (ac && (ac === sig.autocomplete || ac.endsWith(sig.autocomplete))) return true;
  }
  // pattern matching against label/name/id/placeholder haystack
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


// ── IRCTC Smart Fill ──────────────────────────────────────────────────────────
// Targets IRCTC's specific field names/IDs for each passenger slot and journey.
function irctcFill(data) {
  if (!data) return;
  const j = data.journey || {};

  // ── Journey fields ────────────────────────────────────────────────────────
  // IRCTC uses React-controlled inputs — nativeSet fires synthetic events
  const setByName = (name, val) => {
    const el = document.querySelector(`input[name="${name}"], input#${CSS.escape(name)}, select[name="${name}"]`);
    if (el && val) { nativeSet(el, val); highlight(el); }
  };
  const setByPlaceholder = (ph, val) => {
    const el = [...document.querySelectorAll('input')].find(i =>
      i.placeholder && i.placeholder.toLowerCase().includes(ph.toLowerCase())
    );
    if (el && val) { nativeSet(el, val); highlight(el); }
  };
  // Fire a native click + Angular-compatible change event on a radio
  const angularRadioClick = (radio) => {
    radio.click();
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    // For Angular Material mat-radio-button: click the host element too
    const matHost = radio.closest('mat-radio-button');
    if (matHost) matHost.click();
    highlight(radio);
  };

  const clickRadioNo = () => {
    // ── Strategy 1: IRCTC-specific — find radio whose label contains "no" near "insurance" heading ──
    const NO_TEXTS = ["no, i don't want", "no,i don't want", "no i don't want", "do not want", "opt out"];
    const INS_TEXTS = ['travel insurance', 'insurance'];

    // Walk every label element; if its text matches a "No" phrase, click its radio
    const allLabels = [...document.querySelectorAll('label')];
    let clicked = false;
    for (const lbl of allLabels) {
      const txt = lbl.textContent.trim().toLowerCase();
      if (NO_TEXTS.some(t => txt.includes(t))) {
        // Make sure it's in an insurance context (parent/sibling section has "insurance")
        const section = lbl.closest('section, div.col, div.row, app-insurance, [class*="insurance"], [id*="insurance"]')
                     || lbl.parentElement?.parentElement;
        const sectionTxt = section?.textContent?.toLowerCase() || '';
        if (!section || INS_TEXTS.some(t => sectionTxt.includes(t)) || true) {
          // grab the radio inside this label, or radio with matching value
          const radio = lbl.querySelector('input[type="radio"]')
                     || document.getElementById(lbl.htmlFor);
          if (radio) { angularRadioClick(radio); clicked = true; }
        }
      }
    }
    if (clicked) return;

    // ── Strategy 2: Scan all radios globally, pick ones whose visible label text says "no" ──
    const allRadios = [...document.querySelectorAll('input[type="radio"]')];
    for (const r of allRadios) {
      // Get surrounding text from the label pointing to it or its nearest text node
      const associatedLabel = allLabels.find(l => l.htmlFor === r.id)
                           || r.closest('label');
      const nearText = (associatedLabel?.textContent || r.nextSibling?.textContent || r.parentElement?.textContent || '').trim().toLowerCase();
      const isNo = NO_TEXTS.some(t => nearText.includes(t))
                || ['no','0','n','false'].includes((r.value || '').toLowerCase());
      // Confirm insurance context
      const block = r.closest('[class*="insurance"],[id*="insurance"],app-insurance')
                 || (r.closest('section, .col-sm-12, .block') );
      const blockTxt = block?.textContent?.toLowerCase() || '';
      if (isNo && INS_TEXTS.some(t => blockTxt.includes(t))) {
        angularRadioClick(r);
        clicked = true;
      }
    }
    if (clicked) return;

    // ── Strategy 3: IRCTC Angular — click mat-radio-button whose text contains "No" ──
    const matBtns = [...document.querySelectorAll('mat-radio-button')];
    for (const btn of matBtns) {
      const txt = btn.textContent.trim().toLowerCase();
      if (NO_TEXTS.some(t => txt.includes(t))) {
        btn.click();
        const inner = btn.querySelector('input[type="radio"]');
        if (inner) angularRadioClick(inner);
        clicked = true;
      }
    }
    if (clicked) return;

    // ── Strategy 4: broadest fallback — any radio with value 0/N near the word "insurance" ──
    for (const r of allRadios) {
      if (['0','n','no','false'].includes((r.value || '').toLowerCase())) {
        const ctx = r.closest('div,section,table')?.textContent?.toLowerCase() || '';
        if (INS_TEXTS.some(t => ctx.includes(t))) {
          angularRadioClick(r);
        }
      }
    }
  };

  // Fill contact
  if (data.mobile) setByName('mobileNumber', data.mobile);
  if (data.email)  setByName('email',        data.email);

  // Auto-insurance No — retry at 700ms, 1.8s, 3.5s (insurance section loads after Angular renders passengers)
  if (data.autoInsuranceNo) {
    [700, 1800, 3500].forEach(delay => setTimeout(clickRadioNo, delay));
  }

  // ── Passenger rows ────────────────────────────────────────────────────────
  // IRCTC uses PrimeNG p-autocomplete for the name field.
  // The inner <input> has NO name/id — only placeholder="Name" and maxlength="16".
  // formcontrolname is on the <p-autocomplete> wrapper which is NOT queryable via
  // querySelectorAll in Angular prod mode. We target by placeholder + position.

  // Name limit: IRCTC caps at 16 chars
  const irctcName = (n) => (n || '').slice(0, 16).trim();

  // PrimeNG autocomplete needs blur + Escape after nativeSet so the dropdown
  // closes and Angular's internal model gets the typed value.
  const primeSet = (el, val) => {
    el.focus();
    nativeSet(el, val);
    // Close any autocomplete dropdown that opens, then blur to commit
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape', keyCode: 27 }));
    el.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, cancelable: true, key: 'Escape', keyCode: 27 }));
    el.dispatchEvent(new Event('blur',  { bubbles: true }));
    highlight(el);
  };

  // Collect all visible passenger-row inputs by placeholder
  // Each passenger row has: [Name input, Age input] + selects for Gender/Berth/Food/ID
  const nameInputs  = [...document.querySelectorAll('input[placeholder="Name"],input[placeholder*="Passenger Name" i]')];
  const ageInputs   = [...document.querySelectorAll('input[placeholder="Age"],input[placeholder*="passenger age" i]')];

  // ── Select helper (native Angular selects) ───────────────────────────────
  const setSelect = (el, val) => {
    if (!el || !val) return;
    const v = String(val).toLowerCase();
    const opts = [...el.options];
    const match = opts.find(o => o.value.toLowerCase() === v || o.text.toLowerCase() === v)
               || opts.find(o => o.value.toLowerCase().startsWith(v) || o.text.toLowerCase().startsWith(v))
               || opts.find(o => o.text.toLowerCase().includes(v));
    if (!match) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, match.value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    highlight(el);
  };

  // ── p-autocomplete fill: type value, wait for IRCTC dropdown, click match ──
  // IRCTC uses forceSelection=true — we must select from the list, not free-type.
  // If no match in list, fall back to typing + blur (will work for new passengers).
  const primeAutoFill = (inputEl, val) => {
    if (!inputEl || !val) return;
    inputEl.focus();
    nativeSet(inputEl, val);
    // Wait for IRCTC's autocomplete panel to appear, then click matching option
    let tries = 0;
    const pick = setInterval(() => {
      const panel = document.querySelector(
        '.ui-autocomplete-panel .ui-autocomplete-items, .p-autocomplete-panel .p-autocomplete-items,' +
        '.ui-autocomplete-panel ul, .p-autocomplete-panel ul'
      );
      const items = panel ? [...panel.querySelectorAll('li')] : [];
      const v = val.toLowerCase();
      const match = items.find(li => li.textContent.toLowerCase().includes(v));
      if (match) {
        clearInterval(pick);
        match.click();
        highlight(inputEl);
        return;
      }
      if (++tries > 10) { // ~1s timeout — no list appeared, blur and accept typed value
        clearInterval(pick);
        inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
        highlight(inputEl);
      }
    }, 100);
  };

  // ── Use app-passenger components as per-row containers ────────────────────
  // Each <app-passenger> wraps one passenger row — far more reliable than
  // global positional counting which breaks with extra selects on the page.
  const paxRows = [...document.querySelectorAll('app-passenger')];

  // Fallback if app-passenger not found: group by nameInputs count
  const usePaxRows = paxRows.length > 0;

  const getRowEl = (i) => usePaxRows ? paxRows[i] : document;

  // Within a row element, find a select by formcontrolname or position
  const rowSelect = (rowEl, fc, colIdx) => {
    if (!rowEl) return null;
    // Try formcontrolname attribute (Angular sometimes renders it, sometimes not)
    const byFC = rowEl.querySelector(`select[formcontrolname="${fc}"]`);
    if (byFC) return byFC;
    // Positional within this row only — much safer than global positional
    const rowSelects = [...rowEl.querySelectorAll('select')].filter(s => s.offsetParent !== null);
    return rowSelects[colIdx] || null;
  };

  const GENDER_MAP = { M:'Male', F:'Female', T:'Transgender', Male:'Male', Female:'Female', Transgender:'Transgender' };
  const BERTH_MAP  = { NP:'No Preference', LB:'Lower Berth', UB:'Upper Berth', MB:'Middle Berth',
                       SL:'Side Lower', SU:'Side Upper', WS:'Window Seat', AS:'Aisle Seat' };
  const FOOD_MAP   = { VEG:'Veg', NON_VEG:'Non Veg', JAIN:'Jain', NO_FOOD:'No Meal', None:'No Meal' };

  // ID-number inputs
  const idNumInputs = [...document.querySelectorAll(
    'input[placeholder*="xxxx" i],input[placeholder*="ID No" i],input[placeholder*="Aadhaar" i],input[placeholder*="Passport" i],input[placeholder*="PAN" i]'
  )];

  (data.passengers || []).forEach((pax, i) => {
    const rowEl  = getRowEl(i);
    const delay  = i * 1200; // stagger passengers to avoid focus/blur conflicts

    // ── Name: p-autocomplete — type and select from IRCTC dropdown ────────────
    const nameVal = irctcName(pax.name);
    const nameEl  = usePaxRows
      ? rowEl?.querySelector('input[placeholder="Name"],input[placeholder*="Passenger" i]')
      : nameInputs[i];
    if (nameEl && nameVal) setTimeout(() => primeAutoFill(nameEl, nameVal), delay);

    // ── Age ───────────────────────────────────────────────────────────────────
    const ageEl = usePaxRows
      ? rowEl?.querySelector('input[placeholder="Age"]')
      : ageInputs[i];
    if (ageEl && pax.age) setTimeout(() => { nativeSet(ageEl, String(pax.age)); highlight(ageEl); }, delay + 50);

    // ── Gender (select, col 0 in passenger row) ───────────────────────────────
    setTimeout(() => {
      const gEl = rowSelect(rowEl, 'passengerGender', 0);
      if (gEl && pax.gender) setSelect(gEl, GENDER_MAP[pax.gender] || pax.gender);
    }, delay + 100);

    // ── Berth (select, col 2) ─────────────────────────────────────────────────
    setTimeout(() => {
      const bEl = rowSelect(rowEl, 'passengerBerthChoice', 2)
               || rowSelect(rowEl, 'berthChoice', 2);
      if (bEl && pax.berthPref) setSelect(bEl, BERTH_MAP[pax.berthPref] || pax.berthPref);
    }, delay + 150);

    // ── Food (select, col 3) ──────────────────────────────────────────────────
    setTimeout(() => {
      const fEl = rowSelect(rowEl, 'passengerFoodChoice', 3)
               || rowSelect(rowEl, 'foodChoice', 3);
      if (fEl && pax.foodPref) setSelect(fEl, FOOD_MAP[pax.foodPref] || pax.foodPref);
    }, delay + 200);

    // ── ID type (select, col 4) ───────────────────────────────────────────────
    setTimeout(() => {
      const idEl = rowSelect(rowEl, 'passengerIdCard', 4)
                || rowSelect(rowEl, 'idCard', 4);
      if (idEl && pax.idType) setSelect(idEl, pax.idType);
    }, delay + 250);

    // ── ID number ─────────────────────────────────────────────────────────────
    const idNumEl = usePaxRows
      ? rowEl?.querySelector('input[placeholder*="xxxx" i],input[placeholder*="ID" i]')
      : idNumInputs[i];
    if (idNumEl && pax.idNumber) setTimeout(() => primeAutoFill(idNumEl, pax.idNumber), delay + 300);
  });
}

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


  else if (type === 'IRCTC_FILL') {
    irctcFill(msg.data);
    sendResponse({ ok: true });
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

// ── Cmd+Shift+G / Ctrl+Shift+G — trigger autofill (page-level fallback) ──────
// Mirrors the native command shortcut in manifest.json so fill works even if
// the native command registration fails (e.g. Brave conflict resolution).
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const trigger = isMac
    ? (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'g')
    : (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g');
  if (!trigger) return;
  try { chrome.runtime.sendMessage({ type: 'SHORTCUT_FILL' }); } catch { /* context invalidated */ }
});

// ── Hover Pill ────────────────────────────────────────────────────────────────
// "👻 May I?" pill at right edge of any detectable field.
// Hovering the pill shows a data-aware state before clicking.
// Has data  → gradient sweeps in, sarcastic "Done bro Done 🕺" vibe
// No data   → sad ghost, "tune mujhe data diya hi nai 🥹"

const PILL_HAS_DATA_MSGS = [
  'Done bro 🕺',
  'karta hoon 💅',
  'haan bhai 🫡',
  'bhar dunga 👻',
  'chill bro 😤',
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
    /* Start hidden & non-interactive — showPill() makes it visible */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s, transform 0.12s, border-color 0.15s;
    white-space: nowrap;
    user-select: none;
    overflow: hidden;
    max-width: 160px;
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

// Load profile with 5-second in-memory cache — silently handles invalidated context
async function getProfile() {
  if (cachedProfile && (Date.now() - profileLoadTs) < 5000) return cachedProfile;
  return new Promise((res) => {
    try {
      chrome.storage.local.get(['profiles', 'activeId'], (d) => {
        if (chrome.runtime.lastError) { res(null); return; }
        cachedProfile = d.profiles?.[d.activeId] || null;
        profileLoadTs = Date.now();
        res(cachedProfile);
      });
    } catch {
      res(null); // extension context invalidated — return null quietly
    }
  });
}

async function showPill(input, profileKey) {
  try {
    const rect = input.getBoundingClientRect();

    // Strict visibility guard — pill (max 160px) needs at least 300px of right-edge clearance
    // from the left side of the viewport to render without bleeding off-screen.
    // Also reject fields that are partially off-screen on any edge.
    // Only show pill when field's right edge is in the right half of the viewport.
    // This filters narrow left-side fields (LinkedIn, Portfolio etc.) where the pill
    // would overlap the field content. Also reject off-screen / zero-size fields.
    if (
      rect.width  <= 0 || rect.height <= 0 ||
      rect.right  < Math.max(300, window.innerWidth * 0.35) ||
      rect.left   < 0  ||
      rect.top    < 0  ||
      rect.bottom <= 0 ||
      rect.top    >= window.innerHeight ||
      rect.left   >= window.innerWidth
    ) return;

    const pill = getPill();
    pillTarget = { input, profileKey };

    const pillH = 26;

    // Anchor the pill's RIGHT edge to 8px inside the field's right border.
    // Using right: (viewport-relative) is width-agnostic — works for both
    // "May I?" (~95px) and "tune data diya hi nai 🥹" (~155px) without overflow.
    // Safe here because the viewport guard above already filtered left-side fields
    // (rect.right >= max(300, 35% viewport)), so right: values stay well-bounded.
    const rightOffset = window.innerWidth - rect.right + 8;

    // Set position with transition disabled so it snaps instantly (no travelling).
    // Then restore transition so opacity/transform/border-color can still animate.
    pill.style.transition    = 'none';
    pill.style.top           = `${Math.max(4, rect.top + (rect.height - pillH) / 2)}px`;
    pill.style.right         = `${rightOffset}px`;
    pill.style.left          = '';
    void pill.offsetWidth;   // force reflow — commits position before transition re-enables
    pill.style.transition    = '';
    pill.style.opacity       = '1';
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
  } catch (_) {
    // Swallow any error (extension context invalidated, detached DOM, etc.)
  }
}

function hidePill(delay = 0) {
  clearTimeout(pillHideTimer);
  if (delay === 0) {
    // Instant hide — no timer, no travel
    const pill = document.getElementById('ghost-pill');
    if (pill) {
      resetPillAppearance(pill);
      pill.style.opacity       = '0';
      pill.style.pointerEvents = 'none';
      pill.style.left          = '';
      pill.style.right         = '';
      pill.style.top           = '';
    }
    pillTarget = null;
    return;
  }
  pillHideTimer = setTimeout(() => {
    const pill = document.getElementById('ghost-pill');
    if (pill) {
      resetPillAppearance(pill);
      pill.style.opacity       = '0';
      pill.style.pointerEvents = 'none';
      pill.style.left          = '';
      pill.style.right         = '';
      pill.style.top           = '';
    }
    pillTarget = null;
  }, delay);
}

// Attach hover listeners to all recognizable inputs (respects pillEnabled setting)
let _pillEnabled = false; // live-updated via storage.onChanged

// Read initial value once
try {
  chrome.storage.local.get(['pillEnabled'], (d) => {
    if (!chrome.runtime.lastError) _pillEnabled = d.pillEnabled === true;
  });
} catch { /* context invalidated */ }

// Keep in sync when user toggles in Settings — no page refresh needed
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'pillEnabled' in changes) {
      _pillEnabled = changes.pillEnabled.newValue === true;
    }
  });
} catch { /* context invalidated */ }

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
      if (!_pillEnabled) return;
      if (!isVisible(input, false)) return;
      showPill(input, mappedKey).catch(() => {}); // never let this surface as unhandled rejection
    });
    input.addEventListener('mouseleave', () => hidePill(150));
  });
}

// Pill mouseenter → apply data-aware state
// relatedTarget check ensures we only fire when entering from OUTSIDE the pill
document.addEventListener('mouseover', (e) => {
  const pill = document.getElementById('ghost-pill');
  if (!pill || !e.target.closest('#ghost-pill')) return;
  // Came from inside the pill (moving between child elements) — skip
  if (pill.contains(e.relatedTarget)) return;
  clearTimeout(pillHideTimer);

  const hasData = pill.dataset.hasData === '1';
  if (hasData) {
    pill.classList.add('pill-sweep');
    const msg = PILL_HAS_DATA_MSGS[Math.floor(Math.random() * PILL_HAS_DATA_MSGS.length)];
    pill.querySelector('.pill-text').textContent = msg;
  } else {
    pill.classList.add('pill-sad');
    pill.querySelector('.pill-ghost').textContent = '🥹';
    pill.querySelector('.pill-text').textContent  = 'tune data diya hi nai';
  }
});

// Pill mouseleave → reset only when leaving to OUTSIDE the pill
document.addEventListener('mouseout', (e) => {
  const pill = document.getElementById('ghost-pill');
  if (!pill || !e.target.closest('#ghost-pill')) return;
  // Moving to a child inside the pill — don't reset
  if (pill.contains(e.relatedTarget)) return;
  resetPillAppearance(pill);
  hidePill(300);
});

// Pill click → fill field (only if data exists)
document.addEventListener('click', async (e) => {
  try {
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
  } catch (_) {
    // Swallow — extension context invalidated or DOM race
  }
});

// Initial scan + MutationObserver for dynamic forms
attachHoverListeners();
new MutationObserver(() => attachHoverListeners()).observe(document.body, {
  childList: true, subtree: true,
});

// ── Hide pill on scroll/resize ──────────────────────────────────────────────
['scroll', 'resize'].forEach(evt =>
  window.addEventListener(evt, () => {
    const pill = document.getElementById('ghost-pill');
    if (pill) {
      pill.style.transition    = 'none';
      pill.style.opacity       = '0';
      pill.style.pointerEvents = 'none';
    }
    pillTarget = null;
    clearTimeout(pillHideTimer);
  }, { passive: true, capture: true })
);
