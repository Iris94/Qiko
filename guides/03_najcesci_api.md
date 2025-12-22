# Najčešće Korišćeni Chrome Extensions API-ji

Pregled API-ja koje ćeš najčešće koristiti u razvoju ekstenzija.

---

## 1. chrome.action (Toolbar Icon)

Upravljanje ikonom ekstenzije u toolbar-u.

### Metode:

```javascript
// Postavljanje ikone
chrome.action.setIcon({
  path: "icons/icon48.png",
  tabId: tabId  // opcionalno - samo za određeni tab
});

// Postavljanje badge teksta
chrome.action.setBadgeText({
  text: "5",  // ili "" da se ukloni
  tabId: tabId  // opcionalno
});

// Postavljanje badge boje
chrome.action.setBadgeBackgroundColor({
  color: "#FF0000",
  tabId: tabId
});

// Postavljanje tooltip-a
chrome.action.setTitle({
  title: "Novi tekst",
  tabId: tabId
});
```

### Eventi:

```javascript
// Klik na ikonu (samo ako NEMA default_popup u manifestu!)
chrome.action.onClicked.addListener((tab) => {
  console.log('Kliknuta ikona na tabu:', tab.id);
});
```

**Važno:** `onClicked` se **ne pokreće** ako imaš `default_popup` u manifestu!

---

## 2. chrome.tabs (Upravljanje Tabovima)

Rad sa tabovima u pregledaču.

### Metode:

```javascript
// Dobijanje aktivnog taba
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0];
  console.log(activeTab.url);
});

// Kreiranje novog taba
chrome.tabs.create({
  url: "https://example.com",
  active: true  // da li će biti fokusiran
});

// Otvaranje URL-a u trenutnom tabu
chrome.tabs.update(tabId, {
  url: "https://example.com"
});

// Zatvaranje taba
chrome.tabs.remove(tabId);

// Reload taba
chrome.tabs.reload(tabId);

// Duplikovanje taba
chrome.tabs.duplicate(tabId);
```

### Svojstva Tab Objekta:

```javascript
{
  id: 123,
  url: "https://example.com",
  title: "Example Domain",
  favIconUrl: "https://example.com/favicon.ico",
  active: true,
  pinned: false,
  windowId: 456
}
```

### Eventi:

```javascript
// Tab kreiran
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Novi tab:', tab.id);
});

// Tab aktivan
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Aktiviran tab:', activeInfo.tabId);
});

// Tab URL promijenjen
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab završen učitavanje:', tab.url);
  }
});
```

---

## 3. chrome.storage (Čuvanje Podataka)

Čuvanje podataka lokalno ili sinkronizovano kroz uređaje.

### Tipovi Storage-a:

1. **local** - Lokalno na uređaju
2. **sync** - Sinkronizovano kroz Chrome account (max 100KB po ekstenziji)
3. **session** - Samo za trenutnu sesiju (zatvara se kad se zatvori browser)
4. **managed** - Administriran od strane organizacije

### Metode:

```javascript
// Čuvanje podataka
chrome.storage.local.set({ key: 'value', user: { name: 'John' } }, () => {
  console.log('Sačuvano!');
});

// Čitanje podataka
chrome.storage.local.get(['key', 'user'], (result) => {
  console.log(result.key);     // 'value'
  console.log(result.user);    // { name: 'John' }
});

// Čitanje svega
chrome.storage.local.get(null, (allData) => {
  console.log('Sve:', allData);
});

// Brisanje određenog ključa
chrome.storage.local.remove(['key'], () => {
  console.log('Obrisano!');
});

// Brisanje svega
chrome.storage.local.clear(() => {
  console.log('Sve obrisano!');
});
```

### Async/Await Primer:

```javascript
// Moderniji način
const saveData = async () => {
  await chrome.storage.local.set({ key: 'value' });
  const result = await chrome.storage.local.get('key');
  console.log(result.key);
};
```

### Eventi:

```javascript
// Promjena u storage-u
chrome.storage.onChanged.addListener((changes, areaName) => {
  for (let key in changes) {
    console.log(`Promjena u ${areaName}:`, key);
    console.log('Staro:', changes[key].oldValue);
    console.log('Novo:', changes[key].newValue);
  }
});
```

---

## 4. chrome.scripting (Injektovanje Skripti)

Injektovanje JavaScript i CSS u stranice.

### Metode:

```javascript
// Injektovanje JavaScript fajla
chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content.js']
});

// Injektovanje JavaScript koda (string)
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    document.body.style.backgroundColor = 'red';
  }
});

// Injektovanje CSS fajla
chrome.scripting.insertCSS({
  target: { tabId: tabId },
  files: ['styles.css']
});

// Injektovanje CSS koda (string)
chrome.scripting.insertCSS({
  target: { tabId: tabId },
  css: 'body { background: red; }'
});

// Uklanjanje CSS-a
chrome.scripting.removeCSS({
  target: { tabId: tabId },
  files: ['styles.css']
});
```

**Važno:** Zahtjeva `"scripting"` permission u manifestu!

---

## 5. chrome.runtime (Core API)

Osnovni API za upravljanje ekstenzijom.

### Metode:

```javascript
// Dobijanje URL-a ekstenzije fajla
const url = chrome.runtime.getURL('images/icon.png');
// Vraća: chrome-extension://[id]/images/icon.png

// Otvaranje options page
chrome.runtime.openOptionsPage();

// Reload ekstenzije (samo u development)
chrome.runtime.reload();
```

### Eventi:

```javascript
// Ekstenzija instalirana/updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Prvi put instalirana!');
  } else if (details.reason === 'update') {
    console.log('Updated sa verzije:', details.previousVersion);
  }
});

// Ekstenzija enable/disable
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser startovan');
});
```

### Message Passing:

```javascript
// Slanje poruke (iz bilo koje komponente)
chrome.runtime.sendMessage({ action: 'hello', data: 'test' }, (response) => {
  console.log('Odgovor:', response);
});

// Slanje poruke do određene komponente
chrome.runtime.sendMessage(extensionId, { action: 'hello' });

// Primanje poruke (background script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'hello') {
    sendResponse({ status: 'ok' });
    return true;  // Važno ako šalješ asinhron odgovor!
  }
});

// Primanje poruke sa eksternih ekstenzija
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Primanje od druge ekstenzije
});
```

---

## 6. chrome.notifications (Desktop Notifikacije)

Desktop notifikacije za korisnika.

### Metode:

```javascript
// Kreiranje notifikacije
chrome.notifications.create('notification-id', {
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Naslov',
  message: 'Poruka notifikacije'
}, (notificationId) => {
  console.log('Notifikacija kreirana:', notificationId);
});

// Uklanjanje notifikacije
chrome.notifications.clear('notification-id', (wasCleared) => {
  console.log('Uklonjena:', wasCleared);
});

// Dobijanje svih notifikacija
chrome.notifications.getAll((notifications) => {
  console.log('Sve notifikacije:', notifications);
});
```

### Tipovi Notifikacija:

- `basic` - Osnovna (ikonica, naslov, poruka)
- `image` - Sa slikom
- `list` - Lista stavki
- `progress` - Progress bar

### Eventi:

```javascript
// Klik na notifikaciju
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Kliknuto:', notificationId);
});

// Notifikacija zatvorena
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log('Zatvoreno od strane korisnika:', byUser);
});
```

**Važno:** Zahtjeva `"notifications"` permission!

---

## 7. chrome.contextMenus (Desni Klik Meni)

Dodavanje stavki u context menu (desni klik).

### Metode:

```javascript
// Kreiranje context menu stavke
chrome.contextMenus.create({
  id: 'my-menu-item',
  title: 'Moj izbor',
  contexts: ['page', 'selection'],  // gde se prikazuje
  onclick: (info, tab) => {
    console.log('Kliknuto!', info.selectionText);
  }
});

// Kreiranje parent stavke
chrome.contextMenus.create({
  id: 'parent',
  title: 'Parent Menu'
});

// Kreiranje child stavke
chrome.contextMenus.create({
  id: 'child',
  parentId: 'parent',
  title: 'Child Menu'
});

// Ažuriranje stavke
chrome.contextMenus.update('my-menu-item', {
  title: 'Novi naslov'
});

// Brisanje stavke
chrome.contextMenus.remove('my-menu-item');
```

### Contexts (Gde se prikazuje):

- `page` - Na stranici
- `selection` - Na selektovanom tekstu
- `link` - Na linku
- `image` - Na slici
- `video` - Na videu
- `audio` - Na audio fajlu

### Eventi (Moderni način):

```javascript
// Umesto onclick u create(), koristi listener
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'my-menu-item') {
    console.log('Kliknuto!', info.selectionText);
  }
});
```

**Važno:** Zahtjeva `"contextMenus"` permission!

---

## 8. chrome.commands (Keyboard Shortcuts)

Osłušavanje keyboard shortcuts definisanih u manifestu.

### Eventi:

```javascript
// Shortcut pritisnut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-feature') {
    // Tvoj kod
  } else if (command === '_execute_action') {
    // Kao da je kliknuta ikona ekstenzije
  }
});
```

---

## 9. chrome.windows (Upravljanje Prozorima)

Rad sa browser prozorima.

### Metode:

```javascript
// Dobijanje trenutnog prozora
chrome.windows.getCurrent((window) => {
  console.log('Trenutni prozor:', window.id);
});

// Kreiranje novog prozora
chrome.windows.create({
  url: 'https://example.com',
  type: 'normal',  // 'normal', 'popup', 'panel'
  focused: true
});

// Zatvaranje prozora
chrome.windows.remove(windowId);
```

---

## Praktični Saveti

1. **Uvek proveri da li API postoji:**
   ```javascript
   if (chrome.storage) {
     chrome.storage.local.get(...);
   }
   ```

2. **Koristi error handling:**
   ```javascript
   chrome.tabs.query({...}, (tabs) => {
     if (chrome.runtime.lastError) {
       console.error('Greška:', chrome.runtime.lastError);
       return;
     }
     // Kod
   });
   ```

3. **Async/Await wrapper:**
   ```javascript
   const getActiveTab = () => {
     return new Promise((resolve) => {
       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
         resolve(tabs[0]);
       });
     });
   };
   ```

---

## Resursi

- [Chrome Extensions API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [API Index](https://developer.chrome.com/docs/extensions/reference/api/)

