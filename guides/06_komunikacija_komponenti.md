# Komunikacija između Komponenti Ekstenzije

Kako različite komponente (Background, Content Script, Popup) komuniciraju jedna sa drugom.

---

## Arhitektura Komunikacije

```
┌─────────────────┐
│  Background     │ (Service Worker)
│  Script         │
└────────┬────────┘
         │
         │ chrome.runtime.sendMessage
         │ chrome.tabs.sendMessage
         │
    ┌────┴────┬──────────────────┐
    │         │                  │
┌───▼───┐ ┌──▼─────┐      ┌─────▼─────┐
│Content│ │ Popup  │      │  Options  │
│Script │ │        │      │   Page    │
└───────┘ └────────┘      └───────────┘
```

---

## 1. Content Script → Background Script

Content Script šalje poruku Background Script-u.

### Content Script (content.js):

```javascript
// Slanje poruke
chrome.runtime.sendMessage({
  action: 'send-message',
  data: {
    message: 'Hello from content script',
    url: window.location.href
  }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Greška:', chrome.runtime.lastError);
    return;
  }
  console.log('Odgovor:', response);
});

// Async/Await wrapper
const sendMessage = (message) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
};

// Korišćenje
(async () => {
  try {
    const response = await sendMessage({ action: 'hello' });
    console.log(response);
  } catch (error) {
    console.error(error);
  }
})();
```

### Background Script (background.js):

```javascript
// Primanje poruke
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Poruka primljena:', message);
  console.log('Od posiljatelja:', sender.tab?.url);
  
  if (message.action === 'send-message') {
    // Obradi poruku
    handleMessage(message.data).then((result) => {
      sendResponse({ success: true, result });
    });
    
    // VAŽNO: Vrati true ako šalješ asinhron odgovor!
    return true;
  }
  
  // Sinhron odgovor
  sendResponse({ received: true });
});
```

**Važno:** Ako šalješ asinhron odgovor (npr. sa `async/await`), **moraš** vratiti `true` iz listenera!

---

## 2. Background Script → Content Script

Background Script šalje poruku određenom Content Script-u u tabu.

### Background Script (background.js):

```javascript
// Slanje poruke određenom tabu
chrome.tabs.sendMessage(tabId, {
  action: 'update-ui',
  data: { status: 'connected' }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Greška:', chrome.runtime.lastError);
    // Content script možda nije učitan
    return;
  }
  console.log('Odgovor:', response);
});

// Slanje svim tabovima
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'broadcast',
      message: 'Hello all tabs!'
    });
  });
});

// Async/Await wrapper
const sendMessageToTab = (tabId, message) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
};
```

### Content Script (content.js):

```javascript
// Primanje poruke od Background Script-a
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'update-ui') {
    // Ažuriraj UI
    updateUI(message.data);
    sendResponse({ success: true });
  }
  
  if (message.action === 'broadcast') {
    console.log('Broadcast poruka:', message.message);
    sendResponse({ received: true });
  }
});
```

---

## 3. Popup → Background Script

Popup šalje poruku Background Script-u.

### Popup (popup.js):

```javascript
// Slanje poruke
document.getElementById('send-btn').addEventListener('click', async () => {
  const message = document.getElementById('input').value;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'send-from-popup',
      message: message
    });
    
    console.log('Odgovor:', response);
  } catch (error) {
    console.error('Greška:', error);
  }
});
```

### Background Script (background.js):

```javascript
// Isti listener kao za Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'send-from-popup') {
    handleMessage(message.message).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
```

---

## 4. Background Script → Popup

Background Script šalje poruku Popup-u (rjeđe, jer popup nije uvek otvoren).

**Problem:** Popup se ne osłušava dok nije otvoren!

**Rešenje:** Koristi `chrome.storage` + `chrome.storage.onChanged` za komunikaciju:

### Background Script (background.js):

```javascript
// Umesto slanja poruke, spremi u storage
chrome.storage.local.set({
  popupNotification: {
    message: 'Nova poruka!',
    timestamp: Date.now()
  }
});
```

### Popup (popup.js):

```javascript
// Osłušaj promjene u storage-u
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.popupNotification) {
    const notification = changes.popupNotification.newValue;
    displayNotification(notification.message);
  }
});

// Ili pročitaj odmah pri otvaranju
chrome.storage.local.get(['popupNotification'], (result) => {
  if (result.popupNotification) {
    displayNotification(result.popupNotification.message);
  }
});
```

---

## 5. Content Script ↔ Content Script (Različiti Tabovi)

Content Script-ovi **ne mogu direktno** komunicirati jedan sa drugim.

**Rešenje:** Koristi Background Script kao "hub":

```
Content Script (Tab 1) → Background → Content Script (Tab 2)
```

### Content Script (Tab 1):

```javascript
chrome.runtime.sendMessage({
  action: 'forward-to-tab',
  targetTabId: 123,
  message: 'Hello from Tab 1'
});
```

### Background Script (background.js):

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'forward-to-tab') {
    chrome.tabs.sendMessage(message.targetTabId, {
      action: 'message-from-another-tab',
      message: message.message
    });
  }
});
```

### Content Script (Tab 2):

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'message-from-another-tab') {
    console.log('Poruka od drugog taba:', message.message);
  }
});
```

---

## 6. External Messages (Druge Ekstenzije)

Komunikacija sa drugim ekstenzijama.

### Manifest (manifest.json):

```json
{
  "externally_connectable": {
    "matches": [
      "https://example.com/*"
    ],
    "ids": [
      "extension-id-1",
      "extension-id-2"
    ]
  }
}
```

### Slanje Eksternoj Ekstenziji:

```javascript
chrome.runtime.sendMessage('extension-id-1', {
  action: 'hello',
  message: 'Hello from my extension'
}, (response) => {
  console.log('Odgovor:', response);
});
```

### Primanje Eksternih Poruka:

```javascript
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (sender.id === 'trusted-extension-id') {
    handleExternalMessage(message);
    sendResponse({ received: true });
  }
});
```

---

## 7. Long-Lived Connections (Za Kontinuiranu Komunikaciju)

Za kontinuiranu komunikaciju (npr. WebSocket-like).

### Content Script (content.js):

```javascript
// Otvaranje konekcije
const port = chrome.runtime.connect({ name: 'content-script' });

// Slanje poruke
port.postMessage({ action: 'hello', data: 'test' });

// Primanje poruke
port.onMessage.addListener((message) => {
  console.log('Poruka primljena:', message);
});

// Zatvaranje konekcije
port.disconnect();
```

### Background Script (background.js):

```javascript
// Primanje konekcije
chrome.runtime.onConnect.addListener((port) => {
  console.log('Konekcija otvorena:', port.name);
  
  // Primanje poruke
  port.onMessage.addListener((message) => {
    console.log('Poruka:', message);
    
    // Slanje odgovora
    port.postMessage({ response: 'ok' });
  });
  
  // Konekcija zatvorena
  port.onDisconnect.addListener(() => {
    console.log('Konekcija zatvorena');
  });
});
```

**Kada koristiti?** Ako trebaš kontinuiranu, dvosmernu komunikaciju (npr. realtime chat).

---

## Best Practices

### 1. Error Handling:

```javascript
chrome.runtime.sendMessage({ action: 'test' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Greška:', chrome.runtime.lastError.message);
    // Možda Background Script nije učitan
    return;
  }
  // Obradi odgovor
  console.log(response);
});
```

### 2. Timeout za Odgovor:

```javascript
const sendMessageWithTimeout = (message, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout'));
    }, timeout);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
};
```

### 3. Type-Safe Messages:

```javascript
// Definiši tipove poruka
const MessageTypes = {
  SEND_MESSAGE: 'send-message',
  UPDATE_UI: 'update-ui',
  GET_STATUS: 'get-status'
};

// Koristi konstantne tipove
chrome.runtime.sendMessage({
  type: MessageTypes.SEND_MESSAGE,
  payload: { message: 'Hello' }
});
```

### 4. Async/Await Helper:

```javascript
// Helper funkcija
const sendMessage = (message) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
};

// Korišćenje
try {
  const response = await sendMessage({ action: 'hello' });
  console.log(response);
} catch (error) {
  console.error('Greška:', error);
}
```

---

## Kompletan Primer: QuickShare Chat

### Background Script (background.js):

```javascript
// Osłušavanje poruka od Content Scripta
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'send-chat-message') {
    // Pošalji preko Supabase/WebRTC
    sendToPartner(message.roomId, message.text).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'get-room-id') {
    chrome.storage.local.get(['roomId'], (result) => {
      sendResponse({ roomId: result.roomId });
    });
    return true;
  }
});

// Kada stigne poruka od partnera, prosledi Content Script-u
function onPartnerMessageReceived(message, roomId) {
  // Pronađi sve aktivne tabove
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'new-message',
        message: message,
        timestamp: Date.now()
      }).catch(() => {
        // Tab možda nema Content Script (nije problem)
      });
    });
  });
}
```

### Content Script (chat-modal.js):

```javascript
// Slanje poruke
async function sendChatMessage(text) {
  try {
    // Dobij Room ID
    const roomResponse = await sendMessageToBackground({
      action: 'get-room-id'
    });
    
    if (!roomResponse.roomId) {
      alert('Nisi pariran!');
      return;
    }
    
    // Pošalji poruku
    const response = await sendMessageToBackground({
      action: 'send-chat-message',
      roomId: roomResponse.roomId,
      text: text
    });
    
    if (response.success) {
      console.log('Poruka poslata!');
    }
  } catch (error) {
    console.error('Greška pri slanju:', error);
  }
}

// Helper funkcija
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Primanje novih poruka
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'new-message') {
    displayMessage(message.message);
  }
});

// Event listener za dugme
document.getElementById('send-btn').addEventListener('click', () => {
  const input = document.getElementById('chat-input');
  sendChatMessage(input.value);
  input.value = '';
});
```

---

## Resursi

- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Long-lived Connections](https://developer.chrome.com/docs/extensions/mv3/messaging/#connect)

