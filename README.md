# 👻 GHOST
### General Handler of Stored Templates

> A browser extension that silently fills any form with your saved profiles — personal info, credentials, custom fields, and security payloads.

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=flat-square)
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

1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the repo folder

### Firefox

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the repo folder

> **Note:** Firefox temporary add-ons are removed on browser restart. For permanent install, submit to [addons.mozilla.org](https://addons.mozilla.org) or use a signed build.

### Safari

Requires Xcode:

```bash
xcrun safari-web-extension-converter /path/to/ghost-extension/
```

This generates an Xcode project. Build it and enable in Safari → Preferences → Extensions.

---

## Usage

| Action | How |
|---|---|
| Fill everything | Click **Haunt All** |
| Fill only empty fields | Click **Smart Fill** |
| Preview what's detectable | Click **👁 Preview** |
| Inject a payload into focused field | Go to Payloads tab → **⚡** |
| Keyboard shortcut | `Alt + F` anywhere on page |
| Export profiles (encrypted) | Footer → **📤 Export** → set passphrase |
| Import profiles | Footer → **📥 Import** |

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

---

## Data & Privacy

- All data stored **locally** via `chrome.storage.local`. Nothing leaves your browser.
- Export uses **AES-GCM 256-bit** encryption with a PBKDF2-derived key (310,000 iterations, SHA-256). If you don't set a passphrase, export is plain JSON.
- No analytics, no telemetry, no external requests.

---

## Project Structure

```
ghost-extension/
├── manifest.json          # MV3 manifest
├── background/
│   └── background.js      # Service worker — keyboard shortcut handler
├── content/
│   └── content.js         # Field detection + fill logic (injected into pages)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Dark purple/cyan theme
│   └── popup.js           # Profile management, storage, export/import
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
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

## Contributing

PRs welcome. If you find a site where GHOST doesn't detect a field correctly, open an issue with the field's `name`, `id`, `autocomplete`, and label text — will add it to the pattern map.

---

## License

MIT — see [LICENSE](LICENSE)
