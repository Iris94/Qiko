# Fajlovi i Struktura Ekstenzije - Best Practices

## Koliko Fajlova je OK?

**Kratak odgovor:** Nema stvarnog hard limita, ali **performanse** su ključne.

### Praktični Limiti:

✅ **Do 20-30 fajlova** - Potpuno OK, nema problema
✅ **Do 50 fajlova** - OK za veće ekstenzije
⚠️ **100+ fajlova** - Može biti sporo, ali još uvek OK
❌ **1000+ fajlova** - Ne preporučujem (osim ako nisu sve male ikone)

### Šta Utječe na Performanse?

1. **Velicina fajlova** - Veće fajlove učitava duže
2. **Broj HTTP request-ova** - Svaki fajl = jedan request
3. **Kada se učitavaju** - Lazy loading vs eager loading

---

## Kako Browser Učitava Fajlove?

### Background Script (Service Worker):
- Učitava se **jednom** kad se ekstenzija aktivira
- **Terminira se** kad nije potreban (Manifest V3)
- Možeš koristiti **ES6 modules** za modularnost

### Content Scripts:
- Učitava se **na svakoj stranici** koja match-uje `matches` pattern
- **Bitno:** Svaki content script fajl = jedan request po stranici
- Koristi **minimalne fajlove** ili kombinuj fajlove

### Popup HTML/CSS/JS:
- Učitava se **kad se popup otvori**
- Brzo se učitava jer je mali

---

## Struktura Fajlova - Preporuke

### Minimalna Struktura (5-10 fajlova):
```
quiko/
├── manifest.json
├── script.js          (background)
├── index.html         (popup)
├── style.css          (popup)
└── icons/
    └── icon128.png
```

### Modulna Struktura (15-30 fajlova):
```
quiko/
├── manifest.json
├── 
├── background/        (ili scripts/)
│   ├── main.js       (service worker entry point)
│   ├── messaging.js  (message handling)
│   ├── storage.js    (storage utilities)
│   └── supabase.js   (Supabase client)
│
├── content/
│   ├── chat-modal.js  (chat UI)
│   └── chat-modal.css
│
├── popup/
│   ├── index.html
│   ├── popup.js
│   └── popup.css
│
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## ES6 Modules - Najbolji Pristup za Modularnost

### Manifest V3 Podržava ES6 Modules!

```json
{
  "background": {
    "service_worker": "background/main.js",
    "type": "module"
  }
}
```

### Kada Koristiti `type: "module"`:

✅ **Kada imaš više fajlova** - Lakše organizovanje
✅ **Kada želiš modularan kod** - Import/export
✅ **Kada deliš utility funkcije** - Reusability

❌ **Kada imaš samo 1-2 fajla** - Overkill

### Primer sa Modules:

**manifest.json:**
```json
{
  "background": {
    "service_worker": "background/main.js",
    "type": "module"
  }
}
```

**background/main.js:**
```javascript
import { handleMessages } from './messaging.js';
import { initStorage } from './storage.js';
import { initSupabase } from './supabase.js';

chrome.runtime.onInstalled.addListener(() => {
  initStorage();
  initSupabase();
});

chrome.runtime.onMessage.addListener(handleMessages);
```

**background/messaging.js:**
```javascript
export function handleMessages(message, sender, sendResponse) {
  if (message.action === 'send-url') {
    // Handle send URL
    sendResponse({ success: true });
  }
}
```

**background/storage.js:**
```javascript
export async function initStorage() {
  // Initialize storage
}

export async function getRoomId() {
  const result = await chrome.storage.local.get(['roomId']);
  return result.roomId;
}
```

---

## Content Scripts - Minimalizuj Broj Fajlova

### ❌ Loše (4 HTTP request-ova po stranici):
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/chat.js", "content/utils.js", "content/api.js", "content/dom.js"]
    }
  ]
}
```

### ✅ Dobro (1 HTTP request po stranici):
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/chat-modal.js"]  // Kombinovani fajl
    }
  ]
}
```

**Ili koristi bundler** (webpack, rollup) da kombinuje fajlove u production.

---

## QuickShare - Preporučena Struktura

### Opcija 1: Minimalna (Za MVP)
```
quiko/
├── manifest.json
├── script.js          (sve background logika)
├── index.html         (popup)
├── style.css          (popup)
└── icons/
    └── icon128.png
```
**Broj fajlova:** ~5
**Težina:** Vrlo lako

### Opcija 2: Modulna (Za production)
```
quiko/
├── manifest.json
├── 
├── background/
│   ├── main.js        (entry point)
│   ├── commands.js    (Alt+S, Alt+C handlers)
│   ├── messaging.js   (message passing)
│   ├── storage.js     (storage helpers)
│   └── supabase.js    (Supabase client)
│
├── content/
│   ├── chat-modal.js
│   └── chat-modal.css
│
├── popup/
│   ├── index.html
│   ├── popup.js
│   └── popup.css
│
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```
**Broj fajlova:** ~15
**Težina:** Lako

### Opcija 3: Sa Bundlerom (Za kompleksnije projekte)
Koristi webpack/rollup da kombinuje fajlove u production build.

---

## Best Practices

### 1. **Organizuj po Funkcionalnosti**
```
background/
  ├── messaging/
  │   ├── handler.js
  │   └── types.js
  ├── storage/
  │   └── helpers.js
  └── api/
      └── supabase.js
```

### 2. **Koristi ES6 Modules**
- Lakše za održavanje
- Clear dependencies
- Tree shaking (ako koristiš bundler)

### 3. **Minimalizuj Content Scripts**
- 1-2 fajla maksimum
- Kombinuj manje utility fajlove

### 4. **Lazy Loading gde Možeš**
```javascript
// Učitaj modul samo kad je potreban
if (condition) {
  const module = await import('./heavy-module.js');
  module.doSomething();
}
```

### 5. **Koristi Utility Funkcije**
```javascript
// utils/helpers.js
export function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}
```

---

## Performanse - Metrije

### Normalno:
- Background script: < 50KB (kompresovano)
- Content script: < 100KB po stranici
- Popup: < 20KB

### Brzo Učitavanje:
- Background: < 100ms
- Content: < 50ms
- Popup: < 30ms

**Testiraj:** Chrome DevTools → Network tab → Učitaj ekstenziju

---

## Kada Koristiti Bundler?

### Koristi Bundler (webpack/rollup) ako:
- Imaš **50+ fajlova**
- Koristiš **npm pakete**
- Želiš **code splitting**
- Želiš **minifikaciju**

### Ne Koristi Bundler ako:
- Imaš **< 20 fajlova**
- Ne koristiš npm pakete
- Želiš jednostavnost

---

## QuickShare - Konkretna Preporuka

Za **QuickShare MVP**, preporučujem:

### Struktura (10-12 fajlova):
```
quiko/
├── manifest.json
├── 
├── background/
│   ├── main.js        (entry point sa ES6 modules)
│   ├── commands.js    (Alt+S, Alt+C)
│   ├── messaging.js   (message handling)
│   └── supabase.js    (Supabase client)
│
├── content/
│   └── chat-modal.js  (CSS u JS-u ili inline)
│
├── popup/
│   ├── index.html
│   ├── popup.js
│   └── popup.css
│
└── icons/
    └── icon128.png    (koristi za sve veličine)
```

**Manifest:**
```json
{
  "background": {
    "service_worker": "background/main.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/chat-modal.js"]
    }
  ]
}
```

**background/main.js:**
```javascript
import { handleCommands } from './commands.js';
import { initMessaging } from './messaging.js';

chrome.commands.onCommand.addListener(handleCommands);
chrome.runtime.onMessage.addListener(initMessaging);
```

---

## TL;DR

1. **Do 30 fajlova = OK** bez problema
2. **Koristi ES6 modules** (`"type": "module"`) za modularnost
3. **Minimalizuj content scripts** (1-2 fajla)
4. **Organizuj po funkcionalnosti** (background/, content/, popup/)
5. **Za QuickShare: 10-15 fajlova** je idealno

**Ne brini o broju fajlova** - brini o organizaciji i performansama!

