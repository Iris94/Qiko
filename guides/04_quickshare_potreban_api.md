# API-ji Potrebni za QuickShare Projekat

Specifični API-ji i metode koje ćeš koristiti u QuickShare ekstenziji.

---

## 1. chrome.tabs (Dobijanje URL-a Stranice)

**Šta treba:** Dobijanje trenutnog URL-a kada korisnik pritisne shortcut (Alt+S).

```javascript
// Dobijanje aktivnog taba
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const activeTab = tabs[0];
  const currentUrl = activeTab.url;
  
  // Pošalji URL partneru
  await sendToPartner(currentUrl);
});

// Async/Await verzija (preporučeno)
const getCurrentTab = () => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
};

const url = (await getCurrentTab()).url;
```

**Permission:** `"tabs"` ili `"activeTab"` (bolje - ne pokazuje warning)

---

## 2. chrome.commands (Keyboard Shortcuts)

**Šta treba:** Alt+S za slanje URL-a, Alt+C za otvaranje chat inputa.

```json
// manifest.json
{
  "commands": {
    "send-url": {
      "suggested_key": {
        "default": "Alt+S",
        "mac": "Alt+S"
      },
      "description": "Pošalji trenutni URL"
    },
    "open-chat": {
      "suggested_key": {
        "default": "Alt+C",
        "mac": "Alt+C"
      },
      "description": "Otvori chat input"
    }
  }
}
```

```javascript
// background.js
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'send-url') {
    const tab = await getCurrentTab();
    await sendToPartner(tab.url);
    
    // Notifikacija korisniku
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'URL poslat!',
      message: 'Link je poslat partneru'
    });
  } else if (command === 'open-chat') {
    // Otvori chat input modal
    await openChatModal();
  }
});
```

---

## 3. chrome.scripting (Injektovanje Chat UI-ja)

**Šta treba:** Injektovanje modal-a za chat input u trenutnu stranicu.

```javascript
// Injektovanje chat modal-a
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['chat-modal.js']
});

// Ili direktno kod:
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => {
    // Kreiraj modal element
    const modal = document.createElement('div');
    modal.id = 'quickshare-chat-modal';
    modal.innerHTML = `
      <input type="text" id="chat-input" maxlength="200" />
      <button id="send-btn">Pošalji</button>
    `;
    document.body.appendChild(modal);
  }
});
```

**Permission:** `"scripting"`

**CSS injektovanje:**
```javascript
chrome.scripting.insertCSS({
  target: { tabId: tab.id },
  files: ['chat-modal.css']
});
```

---

## 4. chrome.storage (Čuvanje Room ID-a i Partner Info)

**Šta treba:** Čuvanje Room ID-a, partner ID-a, i ostalih podataka.

```javascript
// Čuvanje Room ID-a nakon pariranja
chrome.storage.local.set({
  roomId: 'abc123',
  partnerId: 'user456',
  isPaired: true
});

// Provjera da li je pariran
chrome.storage.local.get(['roomId', 'partnerId', 'isPaired'], (result) => {
  if (result.isPaired && result.roomId) {
    console.log('Pariran sa:', result.partnerId);
  }
});

// Async/Await verzija
const getRoomInfo = async () => {
  const result = await chrome.storage.local.get(['roomId', 'partnerId']);
  return result;
};
```

**Permission:** `"storage"`

---

## 5. chrome.notifications (Notifikacije za Primljene Poruke)

**Šta treba:** Desktop notifikacije kada partner pošalje poruku ili link.

```javascript
// Notifikacija za primljenu poruku
chrome.notifications.create(`msg-${Date.now()}`, {
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Nova poruka',
  message: messageText,
  buttons: [
    { title: 'Otvori link' }
  ]
}, (notificationId) => {
  // Čuvanje link-a za kasnije
  chrome.storage.local.set({
    [`notification-${notificationId}`]: messageUrl
  });
});

// Klik na notifikaciju
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Dobij link iz storage-a
  const key = `notification-${notificationId}`;
  const result = await chrome.storage.local.get([key]);
  
  if (result[key]) {
    // Otvori link u novom tabu
    chrome.tabs.create({ url: result[key] });
    
    // Obriši iz storage-a (self-destruct)
    chrome.storage.local.remove([key]);
  }
  
  // Obriši notifikaciju
  chrome.notifications.clear(notificationId);
});
```

**Permission:** `"notifications"`

---

## 6. chrome.runtime (Message Passing između Komponenti)

**Šta treba:** Komunikacija između Content Script (chat modal) i Background Script.

### Content Script → Background:

```javascript
// content.js (chat-modal.js)
const sendButton = document.getElementById('send-btn');
sendButton.addEventListener('click', () => {
  const message = document.getElementById('chat-input').value;
  
  // Pošalji poruku background scriptu
  chrome.runtime.sendMessage({
    action: 'send-message',
    message: message,
    roomId: roomId
  }, (response) => {
    if (response.success) {
      // Poruka poslata
      document.getElementById('chat-input').value = '';
    }
  });
});
```

### Background → Content Script:

```javascript
// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'send-message') {
    // Pošalji poruku preko Supabase/WebRTC
    sendToPartner(message.message, message.roomId).then(() => {
      sendResponse({ success: true });
    });
    return true;  // Asinhron odgovor
  }
});

// Slanje poruke content scriptu (kada stigne nova poruka)
chrome.tabs.sendMessage(tabId, {
  action: 'new-message',
  message: receivedMessage
}, (response) => {
  // Content script je primio poruku
});
```

### Background → Content Script (Nova Poruka):

```javascript
// background.js - kada stigne nova poruka od partnera
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'display-message',
      message: newMessage,
      sender: 'partner'
    });
  }
});
```

```javascript
// content.js - oslušavanje novih poruka
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'display-message') {
    displayMessageInChat(message.message);
  }
});
```

---

## 7. chrome.action (Status Badge)

**Šta treba:** Badge na ikoni da pokazuje status (pariran, nova poruka, itd.).

```javascript
// Postavljanje badge-a "ON" kada je pariran
chrome.action.setBadgeText({
  text: 'ON',
  color: '#00FF00'
});

// Badge sa brojem novih poruka
chrome.action.setBadgeText({
  text: '3',
  backgroundColor: '#FF0000'
});

// Uklanjanje badge-a
chrome.action.setBadgeText({ text: '' });

// Promjena ikone na osnovu statusa
chrome.action.setIcon({
  path: {
    16: 'icons/icon-connected16.png',
    32: 'icons/icon-connected32.png'
  }
});
```

---

## 8. chrome.storage.onChanged (Realtime Updates)

**Šta treba:** Osłušavanje promjena u storage-u (korisno za Supabase sync).

```javascript
// Osłušavanje promjena u storage-u
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.newMessage && areaName === 'local') {
    // Nova poruka u storage-u
    const message = changes.newMessage.newValue;
    displayNotification(message);
  }
  
  if (changes.partnerStatus && areaName === 'local') {
    // Partner je online/offline
    updateUI(changes.partnerStatus.newValue);
  }
});
```

---

## Kompletni Primer Background Script-a

```javascript
// background.js
const getCurrentTab = () => {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
};

// Shortcut: Alt+S - Pošalji URL
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'send-url') {
    const tab = await getCurrentTab();
    const roomId = (await chrome.storage.local.get(['roomId'])).roomId;
    
    if (roomId && tab.url) {
      // Pošalji URL preko Supabase/WebRTC
      await sendMessageToPartner(roomId, tab.url);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'URL poslat!',
        message: tab.url
      });
    }
  }
  
  if (command === 'open-chat') {
    const tab = await getCurrentTab();
    
    // Injektuj chat modal
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['chat-modal.js']
    });
    
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['chat-modal.css']
    });
  }
});

// Primanje poruka od content scripta
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'send-message') {
    sendMessageToPartner(message.roomId, message.message).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Funkcija za slanje poruke (Supabase/WebRTC)
async function sendMessageToPartner(roomId, message) {
  // Tvoja implementacija (Supabase Realtime ili WebRTC)
}

// Funkcija za primanje poruka (iz Supabase/WebRTC)
function onMessageReceived(message, senderId) {
  // Prikaži notifikaciju
  chrome.notifications.create(`msg-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Nova poruka',
    message: message.substring(0, 50) + '...'
  });
  
  // Ažuriraj storage
  chrome.storage.local.set({
    lastMessage: message,
    lastMessageTime: Date.now()
  });
}
```

---

## Manifest.json za QuickShare

```json
{
  "manifest_version": 3,
  "name": "QuickShare",
  "version": "1.0.0",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "notifications"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "action": {
    "default_icon": "icons/icon48.png"
  },
  
  "commands": {
    "send-url": {
      "suggested_key": {
        "default": "Alt+S"
      },
      "description": "Pošalji trenutni URL"
    },
    "open-chat": {
      "suggested_key": {
        "default": "Alt+C"
      },
      "description": "Otvori chat"
    }
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["chat-modal.js"],
      "css": ["chat-modal.css"]
    }
  ]
}
```

---

## Resursi

- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

