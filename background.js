import { CONFIG } from './config.js';

let activeReader = null;
let currentUid = null;
let currentToken = null;
let isConnecting = false;
let isPopupOpen = false;

async function getStorageData(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function setStorageData(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

async function updatePresence() {
  try {
    const state = await getStorageData(['qiko_user_id', 'qiko_token']);
    const uid = state.qiko_user_id;
    const token = state.qiko_token;
    if (!uid || !token) return;

    const url = `${CONFIG.FIREBASE_DB_URL}/users/${uid}/last_seen.json?auth=${token}`;
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Date.now())
    });
  } catch (err) {
    console.error("Failed to update presence:", err);
  }
}

async function checkAndConnectStream() {
  updatePresence();
  if (isConnecting) return;
  
  const state = await getStorageData(['qiko_user_id', 'qiko_token']);
  const uid = state.qiko_user_id;
  const token = state.qiko_token;

  if (!uid || !token) {
    closeActiveStream();
    return;
  }

  if (activeReader && (currentUid !== uid || currentToken !== token)) {
    closeActiveStream();
  }

  if (!activeReader) {
    currentUid = uid;
    currentToken = token;
    startInboxStream(uid, token);
  }
}

function closeActiveStream() {
  if (activeReader) {
    try {
      activeReader.cancel();
    } catch (e) {
      console.error("Error cancelling stream reader:", e);
    }
    activeReader = null;
  }
  currentUid = null;
  currentToken = null;
  isConnecting = false;
}

async function attemptTokenRefresh() {
  try {
    const state = await getStorageData(['qiko_refresh_token']);
    const refreshToken = state.qiko_refresh_token;
    if (!refreshToken) {
      console.warn("No refresh token found in storage. Clearing session credentials...");
      await chrome.storage.local.remove([
        'qiko_user_id',
        'qiko_email',
        'qiko_username',
        'qiko_registered',
        'qiko_id',
        'qiko_token',
        'qiko_refresh_token'
      ]);
      return false;
    }

    const url = `https://securetoken.googleapis.com/v1/token?key=${CONFIG.FIREBASE_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });

    if (!response.ok) {
      if (response.status === 400) {
        console.warn("Refresh token is invalid or expired. Clearing session credentials...");
        await chrome.storage.local.remove([
          'qiko_user_id',
          'qiko_email',
          'qiko_username',
          'qiko_registered',
          'qiko_id',
          'qiko_token',
          'qiko_refresh_token'
        ]);
      }
      throw new Error(`Refresh API returned status ${response.status}`);
    }

    const data = await response.json();
    const newToken = data.id_token;
    const newRefreshToken = data.refresh_token;

    await setStorageData({
      qiko_token: newToken,
      qiko_refresh_token: newRefreshToken
    });
    
    console.log("Qiko Auth token successfully refreshed.");
    return true;
  } catch (err) {
    console.error("Token refresh failed:", err);
    return false;
  }
}

async function startInboxStream(uid, token) {
  isConnecting = true;
  const url = `${CONFIG.FIREBASE_DB_URL}/inbox/${uid}.json?auth=${token}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/event-stream' }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn("Unauthorized/expired stream token (401). Attempting refresh...");
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          isConnecting = false;
          checkAndConnectStream();
          return;
        }
      }
      throw new Error(`SSE stream HTTP status error: ${response.status}`);
    }

    activeReader = response.body.getReader();
    isConnecting = false;

    const decoder = new TextDecoder();
    let buffer = '';

    while (activeReader) {
      const { value, done } = await activeReader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let currentEvent = 'put';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === 'null') continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (currentEvent === 'put' || currentEvent === 'patch') {
              handleInboxPayload(parsed.path, parsed.data, uid, token);
            }
          } catch (err) {
            console.error("Failed to parse SSE payload data:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("Qiko inbox stream failed, retrying in 5 seconds...", err);
    closeActiveStream();
    setTimeout(() => checkAndConnectStream(), 5000);
  }
}

function handleInboxPayload(path, data, uid, token) {
  if (!data) return;

  if (path === '/') {
    for (const [key, msg] of Object.entries(data)) {
      if (msg && msg.sender_id && msg.text) {
        processIncomingMessage(key, msg, uid, token);
      }
    }
  } else {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (data.sender_id && data.text) {
      processIncomingMessage(cleanPath, data, uid, token);
    }
  }
}

async function processIncomingMessage(msgId, message, uid, token) {
  const senderId = message.sender_id;
  const text = message.text;
  const timestamp = message.timestamp || Date.now();

  try {
    const contactsUrl = `${CONFIG.FIREBASE_DB_URL}/users/${uid}/contacts.json?auth=${token}`;
    const contactsRes = await fetch(contactsUrl);
    let contacts = [];
    if (contactsRes.ok) {
      contacts = await contactsRes.json() || [];
    }
    if (!contacts.includes(senderId)) {
      contacts.push(senderId);
      await fetch(contactsUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contacts)
      });
      await setStorageData({ qiko_contacts_updated: Date.now() });
    }
  } catch (err) {
    console.error("Failed to automatically add sender to contacts list:", err);
  }

  const historyKey = `qiko_history_${senderId}`;
  const localData = await getStorageData([historyKey, 'qiko_active_partner']);
  const history = localData[historyKey] || [];

  const isDuplicate = history.some(m => m.timestamp === timestamp && m.text === text);
  if (!isDuplicate) {
    history.push({
      sender: senderId,
      text: text,
      timestamp: timestamp,
      received: true
    });
    if (history.length > 100) {
      history.shift();
    }
    await setStorageData({ [historyKey]: history });

    const currentActivePartner = localData.qiko_active_partner;
    const shouldNotify = !isPopupOpen || (currentActivePartner !== senderId);
    if (shouldNotify) {
      let displayName = senderId;
      try {
        const idRes = await fetch(`${CONFIG.FIREBASE_DB_URL}/qiko_ids/${senderId}.json?auth=${token}`);
        if (idRes.ok) {
          const senderUid = await idRes.json();
          if (senderUid) {
            const userRes = await fetch(`${CONFIG.FIREBASE_DB_URL}/users/${senderUid}.json?auth=${token}`);
            if (userRes.ok) {
              const senderProfile = await userRes.json();
              if (senderProfile && senderProfile.username && senderProfile.username !== 'Guest') {
                displayName = senderProfile.username;
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch sender profile for notification:", e);
      }

      const safeId = `qiko_notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      chrome.notifications.create(safeId, {
        type: 'basic',
        iconUrl: 'icons/logo-128.png',
        title: `Qiko Message from ${displayName}`,
        message: text,
        priority: 2
      });
    }
  }

  const deleteUrl = `${CONFIG.FIREBASE_DB_URL}/inbox/${uid}/${msgId}.json?auth=${token}`;
  try {
    await fetch(deleteUrl, { method: 'DELETE' });
  } catch (err) {
    console.error("Failed to delete processed message node:", err);
  }
}

chrome.alarms.create('qiko_keep_alive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'qiko_keep_alive') {
    checkAndConnectStream();
  }
});

chrome.runtime.onStartup.addListener(() => {
  checkAndConnectStream();
});

chrome.runtime.onInstalled.addListener(() => {
  checkAndConnectStream();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.qiko_token || changes.qiko_user_id) {
    checkAndConnectStream();
  }
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.query({ url: chrome.runtime.getURL("screens/dashboard.html") }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: "screens/dashboard.html" });
    }
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "qiko_popup") {
    isPopupOpen = true;
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
    });
  }
});

checkAndConnectStream();
