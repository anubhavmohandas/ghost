# 👻 GHOST
### General Handler of Stored Templates

> A browser extension that silently fills any form with your saved profiles — personal info, credentials, custom fields, and security payloads.

![Version](https://img.shields.io/badge/version-5.4.0-7c3aed?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-22d3ee?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![Browsers](https://img.shields.io/badge/browsers-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-d4d0ff?style=flat-square)

---

## What it does

Most autofill tools only cover name + email. GHOST covers **79 field types** across every kind of form you'll encounter — job applications, KYC, government portals, bug bounty signups, CTF registrations, checkout pages, banking forms.

Fill a form in one click. Or use **Smart Fill** to only fill empty fields. Or inject a payload directly into a focused field for testing.

---

## Install

### Chrome / Edge / Brave (Manifest V3)

1. Download and extract `ghost-v5.4.zip`
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the extracted folder (the one containing `manifest.json` at its root)

### Firefox

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `manifest-firefox.json` from the extracted folder

> **Note:** Firefox temporary add-ons are removed on browser restart. For permanent install, submit to [addons.mozilla.org](https://addons.mozilla.org) or use a signed build.

### Safari

Requires Xcode:

```bash
xcrun safari-web-extension-converter /path/to/ghost-extension/
```

This generates an Xcode project. Build it and enable in Safari → Preferences → Extensions.

### Updating

Run `update.sh` (macOS/Linux) or `update.bat` (Windows) from the repo root to pull the latest changes, then hit the **↺ reload** button on `chrome://extensions`.

---

## Usage

| Action | How |
|---|---|
| Fill everything | Click **Haunt All** |
| Fill only empty fields | Click **Smart Fill** |
| Preview what's detectable | Click **👁 Preview** |
| Inject a payload into focused field | Go to Payloads tab → **⚡** |
| Keyboard shortcut | `Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Windows/Linux) |
| Export profiles (encrypted) | Footer → **📤 Export** → enter passphrase in modal |
| Import profiles | Footer → **📥 Import** → enter passphrase in modal |
| Bind a profile to a site | Settings → **Site Bindings** → add current URL |
| Toggle hover pill | Settings → enable/disable **Show hover pill** |
| Set PIN lock | Settings → **Set PIN** → encrypts sensitive fields at rest |

---

## Security

### PIN Lock & At-Rest Encryption

v5.4 adds optional PIN-based encryption of sensitive profile fields stored in `chrome.storage.local`.

When a PIN is set:
- **Two PBKDF2 derivations** are performed from the PIN — one for a verification hash (stored), one for the AES-GCM encryption key (never stored, held in memory only for the popup session).
- **600,000 iterations**, SHA-256, 32-byte random salt — per the current OWASP recommendation.
- **Sensitive fields encrypted**: entire `credentials` section + `cardNumber`, `cvv`, `cardExpiry`, `cardHolder`, `bankAccount`, `bankName`, `ifsc`, `gstin` from the professional section.
- Session key is cleared when the popup closes. Without the PIN, stored ciphertext is unreadable.
- If no PIN is set, behaviour is unchanged — no overhead, no prompts.

### Passphrase Modal

Export and import passphrases are entered through an inline modal (no `window.prompt()`). The modal includes a show/hide toggle.

### Message Sender Verification

The background service worker verifies `sender.id === chrome.runtime.id` on all incoming messages, blocking external scripts from triggering fills.

### Export Encryption

Export uses **AES-GCM 256-bit** with a PBKDF2-derived key (600,000 iterations, SHA-256, 32-byte salt). Without a passphrase, export is plain JSON.

### Storage

All data stored **locally** via `chrome.storage.local`. No analytics, no telemetry, no external requests of any kind.

---

## Field Coverage

### 🪪 Identity Tab
`firstName` `lastName` `middleName` `fullName` `displayName` `dob` `age` `gender`
`nationality` `placeOfBirth` `passportNo` `passportExpiry` `nationalId` (Aadhaar)
`taxId` (PAN / SSN / TIN) `voterId` `drivingLicence` `bloodGroup` `maritalStatus`
`medicalNotes` `ecName` `ecRelation` `ecPhone`

### 📞 Contact Tab
`email` `emailAlt` `phone` `phoneAlt` `whatsapp` `fax`
`address1` `address2` `landmark` `city` `district` `state` `zip` `country` `countryCode` `poBox`
`website` `linkedin` `github` `twitter` `instagram` `skype` `telegram` `discord`

### 💼 Career Tab
`company` `jobTitle` `department` `employeeId` `yearsExp` `noticePeriod`
`currentCtc` `expectedCtc` `skills` `bio`
`degree` `major` `university` `gradYear` `gpa`
`bankName` `bankAccount` `ifsc` `gstin`
`cardNumber` `cardExpiry` `cvv` `cardHolder`

### 🔐 Login Tab
`username` `password` `passwordConfirm` `otp` `pin`
`secAnswer1` `secAnswer2` `secAnswer3` `recoveryEmail` `recoveryPhone`

### 🛠 Custom Tab
Map any CSS selector, `name`, or `id` to any value. Handles site-specific fields that aren't in the standard map.

### 💀 Payloads (inside Login tab)
Named text payloads injected directly into the focused field. Useful for security testing, CTF forms, or repetitive test data entry.

---

## How field detection works

GHOST's content script scans all visible `<input>` and `<textarea>` elements and builds a haystack from:

```
input[name] + input[id] + input[autocomplete] + input[placeholder]
+ aria-label + label[for] + wrapping label text + aria-labelledby
```

Each field key has a set of regex patterns matched against this haystack, plus optional `autocomplete` attribute matching and `type` matching for unambiguous types (`password`, `email`, `tel`, `url`).

For `<select>` dropdowns, GHOST tries exact value match → case-insensitive text match → partial match.

React / Vue / Angular compatibility is handled by firing `input`, `change`, and `blur` events via the native `HTMLInputElement.prototype.value` setter — bypasses framework state management issues.

The hover pill only appears on fields whose bounding rect is fully within the visible viewport (right edge > 300px, left/top ≥ 0). This prevents stray pills on off-screen or layout-ghost elements.

---

## Project Structure

```
ghost-extension/
├── manifest.json              # MV3 manifest (Chrome/Edge/Brave)
├── manifest-firefox.json      # MV2 manifest (Firefox)
├── background/
│   ├── background.js          # Service worker — shortcut handler + sender verification
│   └── background-ff.js       # Firefox background script
├── content/
│   └── content.js             # Field detection + fill logic + hover pill
├── popup/
│   ├── popup.html             # Extension popup UI (includes PIN overlay + passphrase modal)
│   ├── popup.css              # Theme system — 4 presets + custom builder
│   └── popup.js               # Profile management, PIN lock, encryption, export/import
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .github/workflows/
│   └── release.yml            # GitHub Actions — auto-builds Chrome/Firefox/macOS zips on tag push
├── update.sh                  # Pull latest + reload reminder (macOS/Linux)
├── update.bat                 # Pull latest + reload reminder (Windows)
└── store-assets/
    └── chrome-web-store.md    # CWS listing copy
```

---

## Adding a new field type

1. Add a new entry to `FIELD_MAP` in `content/content.js`:

```js
yourFieldKey: {
  patterns: ['regex1', 'regex2'],
  autocomplete: 'autocomplete-value',  // optional
  type: 'input-type',                  // optional, e.g. 'email'
  selectValues: ['option1', 'option2'] // optional, for <select> elements
},
```

2. Add it to `KEY_SECTION` in `content/content.js` (map to `personal`, `contact`, `professional`, or `credentials`).

3. Add the field key to `emptyProfile()` in `popup/popup.js` under the correct section.

4. Add an `<input>` to the correct tab in `popup/popup.html` with `data-field="yourFieldKey"` and `data-section="sectionName"`.

---

## Releasing

Tag a commit and push — GitHub Actions builds Chrome zip, Firefox zip, and macOS tar.gz automatically:

```bash
git tag v5.4.0
git push origin v5.4.0
```

The release workflow (`release.yml`) attaches all three artifacts to the GitHub Release.

---

## Contributing

PRs welcome. If you find a site where GHOST doesn't detect a field correctly, open an issue with the field's `name`, `id`, `autocomplete`, and label text — will add it to the pattern map.

---

## Version History

| Version | Date | What changed |
|---------|------|--------------|
| **5.4** | 2026-05-08 | Security audit + hardening: PIN lock with AES-GCM at-rest encryption (600k PBKDF2 iterations, 32-byte salt, two-key architecture); passphrase modal replaces `window.prompt()`; background sender verification (`sender.id` check); chunked `b64()` to prevent V8 stack overflow on large buffers; `escHtml()` encodes single quotes; import schema validation; pill toggle setting; `drivingLicence` autocomplete bug fixed; keyboard shortcut `.toLowerCase()` fix; left-side stray pill fix (`rect.right < 300` threshold + `rect.left < 0` / `rect.top < 0` guards); dictation `getUserMedia` permission flow; update.sh + update.bat; GitHub Actions release workflow. |
| **5.2** | 2026-05-08 | Per-site profile binding UI. Firefox MV2 manifest. Chrome Web Store assets. Rounded popup corners. |
| **5.1** | 2026-05-08 | Smart hover pill states — gradient sweep + sarcastic message when field has data; sad ghost when field is empty. 5-second profile cache for instant hover response. |
| **5.0** | 2026-05-08 | Full theme system — Purple Amber default, 4 presets (Teal×Coral, Synthwave Dream, Synth Dusk), custom builder with 10 live color pickers. |
| **3.0** | 2026-04 | Per-site profile binding. Field hover pill (👻 May I?). Dark/light theme toggle. |
| **2.0** | 2026-04 | Rebrand to GHOST. Deep Teal + Coral palette. DOB calendar picker with auto-age. Dictation mode (Web Speech API, en-IN). |
| **1.0** | 2026-04 | Initial release. 79 field types across 5 tabs. AES-GCM encrypted export/import. Multiple profiles. Payload injection. Smart Fill + Haunt All. |

---

## License

MIT — see [LICENSE](LICENSE)
