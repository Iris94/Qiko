import { CONFIG } from './config.js';

let activeReader = null;
let currentUid = null;
let currentToken = null;
let isConnecting = false;

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

async function checkAndConnectStream() {
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

async function startInboxStream(uid, token) {
  isConnecting = true;
  const url = `${CONFIG.FIREBASE_DB_URL}/inbox/${uid}.json?auth=${token}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/event-stream' }
    });

    if (!response.ok) {
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
    await setStorageData({ [historyKey]: history });

    const currentActivePartner = localData.qiko_active_partner;
    if (currentActivePartner !== senderId) {
      chrome.notifications.create(msgId, {
        type: 'basic',
        iconUrl: 'icons/logo-128.png',
        title: `Qiko Message from ${senderId}`,
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

checkAndConnectStream();
