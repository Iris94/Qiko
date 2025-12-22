# Browser Interni Metode (Standardni JavaScript/Web API)

Metode koje možeš koristiti u ekstenzijama - standardni web API-ji koje već znaš.

---

## 1. DOM Manipulacija (Content Scripts)

Sve standardne DOM metode rade u **Content Scripts**.

### Query Selectors:

```javascript
// Pronalaženje elemenata
const element = document.querySelector('.my-class');
const elements = document.querySelectorAll('.my-class');
const byId = document.getElementById('my-id');
const byClass = document.getElementsByClassName('my-class');

// Kreiranje elemenata
const div = document.createElement('div');
div.className = 'my-class';
div.textContent = 'Hello World';
div.innerHTML = '<strong>Bold text</strong>';
```

### Manipulacija:

```javascript
// Dodavanje/uklanjanje elemenata
document.body.appendChild(div);
element.remove();

// Dodavanje event listenera
element.addEventListener('click', (e) => {
  console.log('Kliknuto!');
});

// Stilizovanje
element.style.backgroundColor = 'red';
element.style.display = 'none';
element.classList.add('active');
element.classList.remove('active');
element.classList.toggle('active');
```

### Shadow DOM (Za Izolaciju CSS-a):

```javascript
// Kreiranje Shadow DOM-a (izoluje CSS od stranice)
const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'open' });

// Dodavanje CSS-a
const style = document.createElement('style');
style.textContent = `
  .my-class { color: red; }
`;
shadow.appendChild(style);

// Dodavanje HTML-a
shadow.innerHTML = '<div class="my-class">Isolated content</div>';

// Dodavanje u stranicu
document.body.appendChild(host);
```

**Zašto Shadow DOM?** Osigurava da tvoj CSS ne utiče na stranicu i obrnuto!

---

## 2. Fetch API (HTTP Zahtjevi)

Za komunikaciju sa Supabase, Firebase, ili bilo kojim API-jem.

### Osnovni Fetch:

```javascript
// GET zahtjev
fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Greška:', error));

// POST zahtjev
fetch('https://api.example.com/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Hello',
    roomId: 'abc123'
  })
})
  .then(response => response.json())
  .then(data => console.log(data));
```

### Async/Await:

```javascript
const sendMessage = async (message, roomId) => {
  try {
    const response = await fetch('https://api.example.com/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, roomId })
    });
    
    if (!response.ok) {
      throw new Error('Network error');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Greška:', error);
    throw error;
  }
};
```

### Sa Supabase:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';

const sendToSupabase = async (message, roomId) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({
      room_id: roomId,
      message: message,
      created_at: new Date().toISOString()
    })
  });
  
  return await response.json();
};
```

---

## 3. WebSocket (Realtime Komunikacija)

Za direktnu realtime komunikaciju (Supabase Realtime koristi WebSocket).

```javascript
const ws = new WebSocket('wss://your-supabase-url/realtime/v1/websocket');

ws.onopen = () => {
  console.log('Konekcija otvorena');
  
  // Subscribe na kanal
  ws.send(JSON.stringify({
    topic: 'room:abc123',
    event: 'phx_join',
    payload: {}
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Poruka primljena:', data);
  
  if (data.event === 'new_message') {
    handleNewMessage(data.payload);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket greška:', error);
};

ws.onclose = () => {
  console.log('Konekcija zatvorena');
  // Reconnect logika
};

// Slanje poruke
const sendMessage = (message) => {
  ws.send(JSON.stringify({
    topic: 'room:abc123',
    event: 'new_message',
    payload: { message }
  }));
};
```

---

## 4. Local Storage & Session Storage

**Ne koristi direktno u ekstenzijama!** Umesto toga koristi `chrome.storage`.

Ali ako **MORAŠ** (npr. u Content Script-u da čuvaš privremene podatke stranice):

```javascript
// Local Storage
localStorage.setItem('key', 'value');
const value = localStorage.getItem('key');
localStorage.removeItem('key');
localStorage.clear();

// Session Storage (briše se kad se tab zatvori)
sessionStorage.setItem('key', 'value');
const value = sessionStorage.getItem('key');
```

**Bolje:** Koristi `chrome.storage.local` umesto `localStorage` u ekstenzijama!

---

## 5. IndexedDB (Za Velike Podatke)

Za kompleksnije skladištenje podataka (npr. cache slika, veliki JSON objekti).

```javascript
// Otvaranje baze
const request = indexedDB.open('MyDatabase', 1);

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  
  // Kreiranje object store
  const objectStore = db.createObjectStore('messages', { keyPath: 'id' });
  objectStore.createIndex('roomId', 'roomId', { unique: false });
};

request.onsuccess = (event) => {
  const db = event.target.result;
  
  // Dodavanje podataka
  const transaction = db.transaction(['messages'], 'readwrite');
  const store = transaction.objectStore('messages');
  store.add({ id: 1, message: 'Hello', roomId: 'abc123' });
  
  // Čitanje podataka
  const getRequest = store.get(1);
  getRequest.onsuccess = () => {
    console.log(getRequest.result);
  };
};
```

**Napomena:** Za većinu slučajeva, `chrome.storage` je dovoljno!

---

## 6. URL & URLSearchParams

Parsiranje i manipulacija URL-ova.

```javascript
// Parsiranje URL-a
const url = new URL('https://example.com/path?param=value');
console.log(url.hostname);  // 'example.com'
console.log(url.pathname);  // '/path'
console.log(url.search);    // '?param=value'

// Dobijanje query parametara
const params = new URLSearchParams(url.search);
console.log(params.get('param'));  // 'value'
params.set('new', 'value');
console.log(params.toString());    // 'param=value&new=value'

// Kreiranje novog URL-a
const newUrl = new URL('/new-path', url.origin);
console.log(newUrl.href);  // 'https://example.com/new-path'
```

---

## 7. Crypto API (Za Hashing, Enkripciju)

Za generisanje Room ID-a, hash-ovanje, itd.

```javascript
// Generisanje random ID-a
const randomId = crypto.randomUUID();
console.log(randomId);  // '550e8400-e29b-41d4-a716-446655440000'

// Hash-ovanje (SHA-256)
const message = 'Hello World';
const encoder = new TextEncoder();
const data = encoder.encode(message);

crypto.subtle.digest('SHA-256', data).then(hash => {
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(hashHex);
});
```

**Za Room ID:**
```javascript
// Jednostavno generisanje Room ID-a
const generateRoomId = () => {
  return crypto.randomUUID().split('-')[0];  // Prvi segment
};

const roomId = generateRoomId();  // '550e8400'
```

---

## 8. EventTarget & Custom Events

Za komunikaciju između komponenti u Content Script-u.

```javascript
// Kreiranje custom eventa
const event = new CustomEvent('messageReceived', {
  detail: { message: 'Hello', sender: 'partner' }
});

// Slanje eventa
document.dispatchEvent(event);

// Osłušavanje eventa
document.addEventListener('messageReceived', (e) => {
  console.log('Poruka:', e.detail.message);
});
```

---

## 9. MutationObserver (Za Dinamičke Stranice)

Za praćenje promjena u DOM-u (SPA stranice koje se update-uju bez refresh-a).

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      console.log('Novi elementi dodati:', mutation.addedNodes);
      
      // Provjeri da li je dodan određeni element
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList.contains('chat-message')) {
          handleNewMessage(node);
        }
      });
    }
  });
});

// Počni osłušavanje
observer.observe(document.body, {
  childList: true,      // Gledaj dodavanje/brisanje child elemenata
  subtree: true,        // Gledaj i u nested elementima
  attributes: false,    // Ne gledaj promjene atributa
  characterData: false  // Ne gledaj promjene teksta
});

// Zaustavi osłušavanje
observer.disconnect();
```

**Zašto koristiti?** Ako stranica koristi React/Vue/Angular, DOM se mijenja bez refresh-a. MutationObserver hvata te promjene!

---

## 10. IntersectionObserver (Za Visibility)

Detektovanje kada element postane vidljiv na ekranu.

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      console.log('Element je vidljiv!');
      // Npr. označi poruku kao pročitanu
    }
  });
});

const element = document.querySelector('.message');
observer.observe(element);
```

---

## 11. Performance API

Mjerenje performansi (korisno za debugging).

```javascript
// Mjerenje vremena
performance.mark('start');
// ... tvoj kod ...
performance.mark('end');
performance.measure('my-measure', 'start', 'end');

const measure = performance.getEntriesByName('my-measure')[0];
console.log('Trajanje:', measure.duration, 'ms');
```

---

## Šta NE Radi u Background Script-u

Background Script (Service Worker) **NEMA** pristup:

❌ `document` - Nema DOM
❌ `window` - Nema window objekta (u većini slučajeva)
❌ `localStorage` - Koristi `chrome.storage`
❌ `XMLHttpRequest` - Koristi `fetch` (ali fetch radi!)

✅ `fetch` - Radi!
✅ `crypto` - Radi!
✅ `URL` / `URLSearchParams` - Rade!
✅ `JSON` - Radi!

---

## Praktični Primjeri

### Parsiranje URL-a i Slanje:

```javascript
const tab = await getCurrentTab();
const url = new URL(tab.url);

// Slanje samo domena
await sendMessage(url.hostname);

// Slanje sa query parametrima
const params = new URLSearchParams(url.search);
params.set('utm_source', 'quickshare');
const newUrl = `${url.origin}${url.pathname}?${params.toString()}`;
await sendMessage(newUrl);
```

### Kreiranje Modal-a sa Shadow DOM:

```javascript
const createChatModal = () => {
  const host = document.createElement('div');
  host.id = 'quickshare-modal-host';
  
  const shadow = host.attachShadow({ mode: 'open' });
  
  // CSS (izolovan)
  const style = document.createElement('style');
  style.textContent = `
    .modal { position: fixed; top: 20px; right: 20px; ... }
    input { padding: 10px; ... }
  `;
  shadow.appendChild(style);
  
  // HTML
  shadow.innerHTML = `
    <div class="modal">
      <input type="text" id="chat-input" maxlength="200" />
      <button id="send-btn">Pošalji</button>
    </div>
  `;
  
  document.body.appendChild(host);
  
  // Event listeneri
  const sendBtn = shadow.querySelector('#send-btn');
  sendBtn.addEventListener('click', () => {
    const input = shadow.querySelector('#chat-input');
    sendMessage(input.value);
  });
};
```

---

## Resursi

- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [Can I Use](https://caniuse.com/) - Browser podrška

