import { CONFIG } from './Logic/config.js';

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

async function checkPresence() {
  await updatePresence();
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

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument() {
  if (typeof chrome.offscreen === 'undefined') return false;
  if (typeof chrome.offscreen.hasDocument === 'function') {
    return await chrome.offscreen.hasDocument();
  }
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  return contexts.length > 0;
}

async function setupOffscreen() {
  try {
    const state = await getStorageData(['qiko_id']);
    if (!state.qiko_id) {
      if (await hasOffscreenDocument()) {
        await chrome.offscreen.closeDocument();
      }
      return false;
    }

    if (await hasOffscreenDocument()) return false;

    console.log("Creating offscreen document for background WebRTC...");
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['WEB_RTC'],
      justification: 'Maintaining a background PeerJS WebRTC connection for direct messaging.'
    });
    return true;
  } catch (err) {
    if (
      !err.message.includes('Only a single offscreen document may be created') &&
      !err.message.includes('No current offscreen document')
    ) {
      console.error("Failed to setup offscreen document:", err);
    }
    return false;
  }
}

let offscreenReadyPromise = null;
let resolveOffscreenReady = null;

function resetOffscreenReady() {
  offscreenReadyPromise = new Promise((resolve) => {
    resolveOffscreenReady = resolve;
  });
}
resetOffscreenReady();

async function pingOffscreen() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'ping' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function ensureOffscreen() {
  const exists = await hasOffscreenDocument();
  if (exists) {
    const alive = await pingOffscreen();
    if (alive) {
      return;
    }
    try {
      await chrome.offscreen.closeDocument();
    } catch (e) {}
  }
  resetOffscreenReady();
  await setupOffscreen();
  await Promise.race([
    offscreenReadyPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Offscreen initialization timed out")), 5000))
  ]);
}

async function ensureOffscreenAndSendMessage(partnerId, text) {
  await ensureOffscreen();
  return await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'sendMessage',
      partnerId,
      text
    }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res && res.success) {
        resolve(res.payload);
      } else {
        reject(new Error((res && res.error) || 'Failed to send message via background channel.'));
      }
    });
  });
}

chrome.alarms.create('qiko_keep_alive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'qiko_keep_alive') {
    checkPresence();
  }
});

chrome.runtime.onStartup.addListener(() => {
  checkPresence();
  setupOffscreen();
});

chrome.runtime.onInstalled.addListener(() => {
  checkPresence();
  setupOffscreen();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.qiko_token || changes.qiko_user_id) {
    checkPresence();
  }
  if (changes.qiko_id) {
    setupOffscreen();
  }

  // Forward storage changes to the offscreen document
  const mappedChanges = {};
  for (const [key, val] of Object.entries(changes)) {
    mappedChanges[key] = {
      newValue: val.newValue,
      oldValue: val.oldValue
    };
  }
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'storageChanged',
    changes: mappedChanges
  }).catch(() => {
    // Ignore errors when offscreen is closed/inactive
  });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  let senderId = null;
  if (notificationId && notificationId.startsWith("qiko_notif_")) {
    const parts = notificationId.split("_");
    if (parts.length >= 3) {
      senderId = parts[2];
    }
  }

  const openDashboard = () => {
    chrome.tabs.query({ url: chrome.runtime.getURL("screens/dashboard.html") }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: "screens/dashboard.html" });
      }
    });
  };

  if (senderId) {
    chrome.storage.local.set({ qiko_active_partner: senderId }, () => {
      openDashboard();
    });
  } else {
    openDashboard();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "qiko_popup") {
    isPopupOpen = true;
    chrome.storage.local.set({ qiko_popup_open: true });
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
      chrome.storage.local.set({ qiko_popup_open: false });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_OFFSCREEN') {
    ensureOffscreen().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }
  if (message.type === 'OPEN_POPUP') {
    if (chrome.action && typeof chrome.action.openPopup === 'function') {
      chrome.action.openPopup().catch((err) => {
        console.warn("openPopup failed, falling back to dashboard:", err);
        chrome.tabs.create({ url: "screens/dashboard.html" });
      });
    } else {
      chrome.tabs.create({ url: "screens/dashboard.html" });
    }
    sendResponse({ success: true });
    return true;
  }
  if (message.target === 'background') {
    if (message.type === 'offscreen_ready') {
      if (resolveOffscreenReady) resolveOffscreenReady();
      sendResponse({ success: true });
      return true;
    }
    if (message.type === 'sendMessage') {
      ensureOffscreenAndSendMessage(message.partnerId, message.text)
        .then((payload) => {
          sendResponse({ success: true, payload });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message || 'Connection failed' });
        });
      return true;
    }
    if (message.type === 'getStorage') {
      chrome.storage.local.get(message.keys, (result) => {
        sendResponse(result);
      });
      return true; // async
    }
    if (message.type === 'setStorage') {
      chrome.storage.local.set(message.items, () => {
        sendResponse({ success: true });
      });
      return true; // async
    }
    if (message.type === 'showNotification') {
      const showSystemNotification = () => {
        const notifId = `qiko_notif_${message.senderId}_${Date.now()}`;
        try {
          chrome.notifications.create(notifId, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/logo-128.png'),
            title: `Qiko - ${message.displayName}`,
            message: message.text,
            priority: 2
          });
        } catch (err) {
          console.error("[Background] Failed to create system notification:", err);
        }
      };

      chrome.storage.local.get('qiko_theme', (result) => {
        const theme = result.qiko_theme || 'system';
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'SHOW_TOAST',
              senderName: message.displayName,
              text: message.text,
              theme: theme
            }, (res) => {
              if (chrome.runtime.lastError || !res || !res.success) {
                showSystemNotification();
              }
            });
          } else {
            showSystemNotification();
          }
        });
      });

      sendResponse({ success: true });
      return true;
    }
  }
});

// Initial presence and offscreen check
checkPresence();
setupOffscreen();
