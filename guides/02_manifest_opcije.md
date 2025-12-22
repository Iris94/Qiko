# Manifest.json - Sve Opcije

`manifest.json` je **središte** tvoje ekstenzije. Evo svih važnih opcija koje možeš dodati.

---

## Obavezna Polja

```json
{
  "manifest_version": 3,
  "name": "Ime Ekstenzije",
  "version": "1.0.0"
}
```

- `manifest_version` - **MORA biti 3** (V2 više nije podržan)
- `name` - Ime ekstenzije (max 45 karaktera za Chrome Web Store)
- `version` - Verzija u formatu "major.minor.patch"

---

## Osnovne Informacije

```json
{
  "description": "Opis šta ekstenzija radi",
  "author": "Tvoje ime",
  "homepage_url": "https://tvoj-sajt.com",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Icons:** Obavezno koristi sve veličine. 16px za toolbar, 48px za extension management, 128px za Chrome Web Store.

---

## Action (Toolbar Icon & Popup)

```json
{
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "Hover tekst na ikoni"
  }
}
```

**Važno:**
- Ako imaš `default_popup`, klik na ikonu **otvara popup** (ne izvršava kod)
- Ako **nemaš** `default_popup`, klik pokreće `chrome.action.onClicked` event
- `default_title` se prikazuje kad hover-uješ mišem

---

## Background Script (Service Worker)

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

- `service_worker` - Putanja do JavaScript fajla
- `type: "module"` - Omogućava ES6 import/export (opcionalno)

**Primer bez type:**
```javascript
// background.js
chrome.runtime.onInstalled.addListener(() => {});
```

**Primer sa module:**
```javascript
// background.js
import { helper } from './helper.js';
```

---

## Content Scripts

```json
{
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle",
      "all_frames": false,
      "match_about_blank": false
    }
  ]
}
```

- `matches` - URL pattern gde se skripta izvršava (wildcard `*` dozvoljen)
- `js` - Array JavaScript fajlova (izvršavaju se redom)
- `css` - Array CSS fajlova (injiciraju se prije DOM parsing)
- `run_at` - Kada se izvršava:
  - `"document_start"` - Prije DOM
  - `"document_end"` - Nakon DOM, prije `DOMContentLoaded`
  - `"document_idle"` - **Default** - Nakon `DOMContentLoaded` (preporučeno)
- `all_frames` - `true` = izvršava i u iframe-ovima
- `match_about_blank` - `true` = izvršava na `about:blank` stranicama

**Primer multiple matches:**
```json
"matches": [
  "https://*.google.com/*",
  "https://*.github.com/*"
]
```

---

## Permissions

```json
{
  "permissions": [
    "tabs",
    "storage",
    "scripting",
    "activeTab",
    "notifications"
  ],
  "host_permissions": [
    "https://api.example.com/*"
  ]
}
```

### Najčešće Permissions:

- `"tabs"` - Pristup informacijama o tabovima (`chrome.tabs` API)
- `"storage"` - Čuvanje podataka (`chrome.storage` API)
- `"scripting"` - Injektovanje skripti (`chrome.scripting` API)
- `"activeTab"` - Pristup trenutnom tabu (samo kad korisnik aktivira ekstenziju) - **Ne pokazuje warning!**
- `"notifications"` - Desktop notifikacije
- `"contextMenus"` - Desni klik meni
- `"webRequest"` - Intercept HTTP zahtjeva (zahtjeva enterprise)

### Host Permissions:

- `"host_permissions"` - Dozvole za pristup određenim domenima
- Može koristiti wildcards: `"https://*.example.com/*"`

**Važno:** `"activeTab"` je **bolji** od `"tabs"` ako trebaš samo trenutni tab - ne pokazuje upozorenje korisniku!

---

## Commands (Keyboard Shortcuts)

```json
{
  "commands": {
    "toggle-feature": {
      "suggested_key": {
        "default": "Ctrl+Shift+Y",
        "mac": "Command+Shift+Y"
      },
      "description": "Toggle feature on/off"
    },
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+B",
        "mac": "Command+B"
      }
    }
  }
}
```

- `_execute_action` - Specialna komanda koja pokreće `chrome.action.onClicked` event
- `description` - Opis koji se prikazuje u `chrome://extensions/shortcuts`
- Modifiers: `Ctrl`, `Alt`, `Shift` (ili `Command` na Mac-u)

**Osłušavanje komande:**
```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-feature') {
    // Kod
  }
});
```

---

## Web Accessible Resources

```json
{
  "web_accessible_resources": [
    {
      "resources": ["images/*.png", "fonts/*.woff2"],
      "matches": ["https://example.com/*"]
    }
  ]
}
```

- Omogućava web stranicama da pristupe fajlovima ekstenzije
- Korisno za slike, fontove, itd.
- **Sigurnosno:** Definiše tačno koje fajlove i koje stranice mogu pristupiti

---

## Options Page

```json
{
  "options_page": "options.html"
}
```

Ili u Manifest V3 (preporučeno):

```json
{
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

- `open_in_tab: false` - Otvara u embedded stranici (default)
- `open_in_tab: true` - Otvara u novom tabu

---

## Side Panel (Manifest V3)

```json
{
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

- Novi feature u Manifest V3
- Sidebar panel (kao DevTools sidebar)
- Pristupa se sa `chrome.sidePanel` API

---

## Declarative Content (Bez Permissions!)

```json
{
  "declarative_net_request": {
    "rule_resources": [
      {
        "id": "ruleset_1",
        "enabled": true,
        "path": "rules.json"
      }
    ]
  }
}
```

- Omogućava blocking/modificiranje HTTP zahtjeva **bez** `webRequest` permission
- Performantnije od `webRequest`
- Koristi `rules.json` fajl sa pravilima

---

## Chrome URL Overrides

```json
{
  "chrome_url_overrides": {
    "newtab": "newtab.html",
    "bookmarks": "bookmarks.html",
    "history": "history.html"
  }
}
```

- Menja Chrome built-in stranice
- **Zahtjeva** dozvolu za svaku override

---

## Complete Primer Manifesta

```json
{
  "manifest_version": 3,
  "name": "Moj Extension",
  "version": "1.0.0",
  "description": "Opis ekstenzije",
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "action": {
    "default_icon": "icons/icon16.png",
    "default_title": "Klikni me"
  },
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+Y"
      }
    }
  }
}
```

---

## Važne Napomene

⚠️ **Nakon promena u manifestu, MORAŠ reload-ovati ekstenziju!**
⚠️ **Koristi Manifest V3** - V2 više nije podržan
⚠️ **Minimalne permissions** - Traži samo ono što ti treba
⚠️ **Testiraj u Developer Mode** prije publish-a

---

## Resursi

- [Manifest File Format](https://developer.chrome.com/docs/extensions/mv3/manifest/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/)

