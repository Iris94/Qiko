import * as chatEngine from './Logic/chat-engine.js';
import * as firebaseDb from './Logic/firebase-db.js';

let myQikoId = null;
let myUid = null;
let myToken = null;

// Storage Bridge over runtime messaging
const storage = {
  get: (keys) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'getStorage',
        keys: keys
      }, (response) => {
        resolve(response || {});
      });
    });
  },
  set: (items) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'setStorage',
        items: items
      }, () => {
        resolve();
      });
    });
  }
};

const storageListeners = [];
const storageOnChanged = {
  addListener: (callback) => {
    storageListeners.push(callback);
  }
};

// Listen to storage changed messages from background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen' && message.type === 'storageChanged') {
    for (const cb of storageListeners) {
      cb(message.changes);
    }
  }
});

async function init() {
  const state = await storage.get(['qiko_id', 'qiko_user_id', 'qiko_token']);
  myQikoId = state.qiko_id;
  myUid = state.qiko_user_id;
  myToken = state.qiko_token;

  if (!myQikoId) {
    console.log("[Offscreen] No Qiko ID found. Disconnecting chat engine if active.");
    chatEngine.disconnectChatEngine();
    return;
  }

  console.log("[Offscreen] Initializing Chat Engine with ID:", myQikoId);
    const randomIdSuffix = Math.random().toString(36).substring(2, 6);
    chatEngine.initChatEngine(myQikoId + '-ext-' + randomIdSuffix, {
      onMessage: async (senderId, data) => {
        console.log(`[Offscreen] Received message from ${senderId}:`, data);
        const historyKey = `qiko_history_${senderId}`;
        
        const storageState = await storage.get([historyKey, 'qiko_active_partner', 'qiko_popup_open']);
        const history = storageState[historyKey] || [];
        
        const isDuplicate = history.some(m => m.timestamp === data.timestamp && m.text === data.text);
        if (!isDuplicate) {
          history.push({
            sender: senderId,
            text: data.text,
            timestamp: data.timestamp,
            received: true
          });
          if (history.length > 100) {
            history.shift();
          }
          await storage.set({ [historyKey]: history });
          
          // Auto-add to contacts if not already present
          try {
            if (myUid && myToken) {
              const contacts = await firebaseDb.getContacts(myUid, myToken);
              if (contacts && !contacts.includes(senderId)) {
                contacts.push(senderId);
                await firebaseDb.updateContacts(myUid, contacts, myToken);
              }
            }
          } catch (e) {
            console.error("[Offscreen] Failed to update contacts:", e);
          }

          // Notify the popup or UI to re-render contacts
          await storage.set({ qiko_contacts_updated: Date.now() });

          // Check if popup is active with this partner
          const activePartner = storageState.qiko_active_partner;
          const isPopupOpen = storageState.qiko_popup_open || false;
          
          if (!isPopupOpen || activePartner !== senderId) {
            // Resolve display name for the notification
            let displayName = senderId;
            try {
              if (myToken) {
                const uidRes = await firebaseDb.getUidByQikoId(senderId, myToken);
                if (uidRes) {
                  const profile = await firebaseDb.getUserProfile(uidRes, myToken);
                  if (profile && profile.username && profile.username !== 'Guest') {
                    displayName = profile.username;
                  }
                }
              }
            } catch (err) {
              console.warn("[Offscreen] Failed to resolve display name:", err);
            }
            
            chrome.runtime.sendMessage({
              target: 'background',
              type: 'showNotification',
              senderId: senderId,
              displayName: displayName,
              text: data.text
            });
          }
        }
      },
      onConnectionStateChange: (peerId, status, err) => {
        console.log(`[Offscreen] P2P Status with ${peerId}:`, status);
        storage.set({ qiko_contacts_updated: Date.now() });
      }
    }, myToken);
  } catch (err) {
    console.error("[Offscreen] Failed to initialize PeerJS chat engine:", err);
  }
}

// Listen for storage changes
storageOnChanged.addListener((changes) => {
  if (changes.qiko_id) {
    if (changes.qiko_id.newValue) {
      init();
    } else {
      console.log("[Offscreen] Qiko ID removed. Disconnecting chat engine.");
      chatEngine.disconnectChatEngine();
    }
  }
  if (changes.qiko_user_id) {
    myUid = changes.qiko_user_id.newValue;
  }
  if (changes.qiko_token) {
    myToken = changes.qiko_token.newValue;
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    if (message.type === 'sendMessage') {
      console.log("[Offscreen] Sending message to:", message.partnerId);
      chatEngine.sendMessage(message.partnerId, message.text, myQikoId)
        .then((payload) => {
          sendResponse({ success: true, payload });
        })
        .catch(err => {
          console.error("[Offscreen] Send failed:", err);
          sendResponse({ success: false, error: err.message || 'Connection failed' });
        });
      return true; // async response
    }
  }
});

// Initial startup
init();
