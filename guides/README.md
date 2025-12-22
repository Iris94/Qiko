# Chrome Extensions Development Guides

Kompletan vodič za razvoj Chrome ekstenzija, organizovan u nekoliko fajlova.

---

## Struktura Guide-ova

### 📘 [01_osnovni_principi.md](./01_osnovni_principi.md)
- Šta su Chrome ekstenzije
- Osnovne komponente (Manifest, Background Script, Content Script, Popup)
- Kako ekstenzije komuniciraju
- Manifest V2 vs V3
- Permissions sistem

**Kada čitati:** Početak - osnovno razumijevanje arhitekture

---

### 📋 [02_manifest_opcije.md](./02_manifest_opcije.md)
- Sve opcije u `manifest.json`
- Obavezna polja
- Action (toolbar icon)
- Background Script
- Content Scripts
- Permissions
- Commands (keyboard shortcuts)
- I ostale opcije

**Kada čitati:** Kada konfigurišeš ekstenziju, dodaješ permissions, shortcuts, itd.

---

### 🔧 [03_najcesci_api.md](./03_najcesci_api.md)
- Najčešće korišćeni Chrome Extensions API-ji
- `chrome.action` - Toolbar icon
- `chrome.tabs` - Upravljanje tabovima
- `chrome.storage` - Čuvanje podataka
- `chrome.scripting` - Injektovanje skripti
- `chrome.runtime` - Core API
- `chrome.notifications` - Desktop notifikacije
- `chrome.contextMenus` - Desni klik meni
- I ostali česti API-ji

**Kada čitati:** Kada implementiraš funkcionalnosti ekstenzije

---

### 🚀 [04_quickshare_potreban_api.md](./04_quickshare_potreban_api.md)
- Specifični API-ji za QuickShare projekat
- `chrome.tabs` - Dobijanje URL-a
- `chrome.commands` - Keyboard shortcuts (Alt+S, Alt+C)
- `chrome.scripting` - Injektovanje chat modal-a
- `chrome.storage` - Čuvanje Room ID-a
- `chrome.notifications` - Notifikacije za poruke
- `chrome.runtime` - Message passing
- Kompletan primer Background Script-a

**Kada čitati:** Kada implementiraš QuickShare funkcionalnosti

---

### 🌐 [05_browser_metode.md](./05_browser_metode.md)
- Standardni JavaScript/Web API-ji koje možeš koristiti
- DOM manipulacija (Content Scripts)
- Fetch API (HTTP zahtjevi)
- WebSocket (Realtime komunikacija)
- URL & URLSearchParams
- Crypto API (generisanje ID-jeva)
- MutationObserver (dinamičke stranice)
- Shadow DOM (CSS izolacija)
- I ostali browser API-ji

**Kada čitati:** Kada radiš sa DOM-om, API pozivima, parsiranje URL-ova, itd.

---

### 📡 [06_komunikacija_komponenti.md](./06_komunikacija_komponenti.md)
- Kako komponente komuniciraju jedna sa drugom
- Content Script ↔ Background Script
- Popup ↔ Background Script
- Background Script → Content Script
- Long-lived connections
- Best practices
- Kompletan primer za QuickShare chat

**Kada čitati:** Kada trebaš da povežeš različite komponente ekstenzije

---

## Kako Koristiti Ove Guide-ove

### Za Početnike:

1. Pročitaj **01_osnovni_principi.md** - Razumi arhitekturu
2. Pročitaj **02_manifest_opcije.md** - Nauči manifest
3. Pročitaj **03_najcesci_api.md** - Nauči osnovne API-je
4. Vrati se na **02_manifest_opcije.md** i **03_najcesci_api.md** kao referenca

### Za QuickShare Projekat:

1. Pročitaj **01_osnovni_principi.md** (osnovno razumijevanje)
2. Pročitaj **04_quickshare_potreban_api.md** (šta ti treba)
3. Koristi **02_manifest_opcije.md** i **03_najcesci_api.md** kao referencu
4. Pročitaj **06_komunikacija_komponenti.md** (kako povezati komponente)
5. Koristi **05_browser_metode.md** za Fetch API, URL parsing, itd.

---

## Najčešće Reference

### Manifest Options:
- `action` - Toolbar icon
- `background` - Service Worker
- `content_scripts` - Scripts u stranice
- `permissions` - Dozvole
- `commands` - Keyboard shortcuts

### API-ji (Koje ćeš najviše koristiti):
- `chrome.tabs.query()` - Dobijanje aktivnog taba
- `chrome.scripting.executeScript()` - Injektovanje koda
- `chrome.storage.local.set/get()` - Čuvanje podataka
- `chrome.runtime.sendMessage()` - Slanje poruka
- `chrome.runtime.onMessage.addListener()` - Primanje poruka
- `chrome.notifications.create()` - Desktop notifikacije
- `chrome.commands.onCommand.addListener()` - Keyboard shortcuts

### Browser API-ji:
- `fetch()` - HTTP zahtjevi (Supabase, itd.)
- `document.querySelector()` - DOM manipulacija
- `new URL()` - Parsiranje URL-ova
- `crypto.randomUUID()` - Generisanje ID-jeva
- `MutationObserver` - Praćenje DOM promjena

---

## Resursi

### Službena Dokumentacija:
- [Chrome Extensions Overview](https://developer.chrome.com/docs/extensions/mv3/overview/)
- [API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Manifest File Format](https://developer.chrome.com/docs/extensions/mv3/manifest/)

### Tutoriali:
- [Get Started](https://developer.chrome.com/docs/extensions/get-started/)
- [Hello World](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)

### QuickShare Specifično:
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

---

## Tips & Tricks

1. **Nikad ne uči API-je napamet** - Koristi dokumentaciju kao referencu
2. **Testiraj često** - Reload ekstenziju nakon svake promjene
3. **Developer Mode** - Uvek koristi `chrome://extensions` u Developer Mode
4. **Error Handling** - Uvijek proveravaj `chrome.runtime.lastError`
5. **Async/Await** - Koristi wrapper funkcije za Chrome API-je
6. **Permissions** - Traži minimalne permissions (koristi `activeTab` umesto `tabs` gde možeš)

---

## Troubleshooting

### "Extension context invalidated"
- Ekstenzija je reload-ovana dok je Content Script još aktivan
- Rješenje: Provjeri `chrome.runtime.lastError` prije korišćenja API-ja

### "Cannot access chrome.runtime"
- Content Script možda nije učitan
- Rješenje: Provjeri da li je `content_scripts` ispravno konfigurisan u manifestu

### "Script injection failed"
- Tab možda ne dopušta script injection
- Rješenje: Provjeri `"scripting"` permission i `activeTab` ili `host_permissions`

### "chrome.storage is undefined"
- Provjeri da li imaš `"storage"` permission u manifestu

---

## Kontakt & Pitanja

Ako imaš pitanja o nečemu iz guide-ova:
1. Prvo provjeri službenu dokumentaciju
2. Koristi Chrome DevTools Console za debugging
3. Provjeri `chrome://extensions` za error poruke

---

**Sretno sa razvojem! 🚀**

