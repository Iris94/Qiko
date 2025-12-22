# Osnovni Principi Chrome Ekstenzija

## Šta su Chrome Ekstenzije?

Chrome ekstenzije su aplikacije koje proširuju funkcionalnost Chrome pregledača. Pišu se u **HTML, CSS i JavaScript** - standardne web tehnologije koje već znaš.

---

## Ključne Komponente Ekstenzije

### 1. **Manifest.json** (Centralni Fajl)
- Definiše **SVE** o ekstenziji: ime, verziju, dozvole, fajlove
- **OBAVEZAN** fajl - bez njega ekstenzija ne postoji
- Formata je JSON

### 2. **Background Script (Service Worker)**
- Kod koji radi "u pozadini" - čak i kad nije otvoren tab
- **NE MORA** da se učitava na stranici da bi radio
- Sluša događaje pregledača (otvaranje tabova, klikovi, itd.)
- **NEMA pristup DOM-u** stranice
- Zbog Manifest V3, koristi se **Service Worker** (ne Background Page)

**Primer:**
```javascript
// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ekstenzija instalirana!');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Kliknuta ikona ekstenzije!');
});
```

### 3. **Content Script**
- Kod koji se **injicuje direktno u web stranicu**
- Ima pristup **DOM-u stranice** (može čitati/mijenjati HTML)
- **IZOLOVAN** - ne vidi JavaScript varijable sa stranice
- Može da se pokrene na određenim URL-ovima (definiše se u manifestu)

**Primer:**
```javascript
// content.js
const heading = document.querySelector('h1');
if (heading) {
  heading.style.color = 'red';
}
```

### 4. **Popup**
- Mini prozor koji se otvara kad klikneš na ikonu ekstenzije
- Ima svoj HTML/CSS/JS (kao mali web sajt)
- **ODVOJEN** od stranice - ne može pristupiti DOM-u

### 5. **Options Page**
- Stranica sa postavkama ekstenzije
- Otvara se sa `chrome://extensions` → "Options" ili programski

---

## Kako Ekstenzije Komuniciraju?

### Izolacija Konteksta

Svaka komponenta živi u svom "svetu":
- **Background Script** → Ne vidi DOM, ne vidi varijable sa stranice
- **Content Script** → Vidi DOM, ali ne vidi JavaScript sa stranice
- **Stranica** → Ne vidi ekstenziju (osim ako ekstenzija ne želi)

### Message Passing (Komunikacija)

Da bi komponente razgovarale, koristi se **Message Passing API**:

```javascript
// Content Script → Background
chrome.runtime.sendMessage({action: 'hello'}, (response) => {
  console.log(response);
});

// Background → Content Script
chrome.tabs.sendMessage(tabId, {action: 'update'});

// Background prima poruke
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'hello') {
    sendResponse({status: 'ok'});
  }
});
```

---

## Životni Ciklus Ekstenzije

1. **Instalacija** → `chrome.runtime.onInstalled` event
2. **Enable/Disable** → Korisnik može uključiti/isključiti
3. **Update** → `chrome.runtime.onInstalled` sa `reason: 'update'`
4. **Uninstall** → `chrome.runtime.setUninstallURL()` za cleanup

---

## Ključne Razlike: Manifest V2 vs V3

### Manifest V2 (Stari, zastareo)
- Background Page (uvek aktivan)
- `browser_action` i `page_action`

### Manifest V3 (Novi, aktuelan)
- **Service Worker** (terminira se kad nije potreban)
- `action` (umesto browser_action/page_action)
- Strože sigurnosne zahtjeve

**Važno:** Koristi **Manifest V3** - V2 više nije podržan!

---

## Permissions (Dozvole)

Ekstenzija **MORA** da traži dozvole za:
- `"tabs"` - Pristup informacijama o tabovima
- `"storage"` - Čuvanje podataka
- `"activeTab"` - Pristup trenutnom tabu (kad korisnik aktivira ekstenziju)
- `"scripting"` - Injektovanje skripti u stranice

**Važno:** Što više dozvola = više upozorenja korisniku pri instalaciji.

---

## Content Security Policy (CSP)

Ekstenzije imaju **strože** CSP pravila:
- **Ne može** `eval()` direktno
- **Ne može** inline `<script>` tagovi (osim u određenim slučajevima)
- **Može** `chrome-extension://` URL-ove

---

## Praktični Saveti

1. **Testiranje:** Uvek testiraj u Developer Mode (`chrome://extensions`)
2. **Debugging:** Koristi Chrome DevTools za background scripts i popup
3. **Reload:** Nakon promena u manifestu, **reload ekstenziju**
4. **Error Handling:** Uvek proveravaj da li API postoji prije korišćenja

---

## Najvažniji Koncepti za Zapamtiti

✅ **Manifest = Konfiguracija ekstenzije**
✅ **Background Script = Backend logika**
✅ **Content Script = Frontend na stranici**
✅ **Message Passing = Komunikacija između komponenti**
✅ **Permissions = Dozvole za funkcionalnosti**

---

## Resursi

- [Chrome Extensions Overview](https://developer.chrome.com/docs/extensions/mv3/overview/)
- [Architecture Overview](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)

