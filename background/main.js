// Background Script - Entry Point
const OFFSCREEN_DOCUMENT_PATH = '/offscreen/offscreen.html';

let isConnected = false;
let connectedPeerId = null;

// FIREFOX FALLBACK VARIABLES
let peer = null;
let currentConnection = null;

// Ensure offscreen document exists
async function setupOffscreenDocument() {
  if (!chrome.offscreen) return; // Not supported in Firefox
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['WEB_RTC'],
    justification: 'To hold WebRTC connection for P2P messaging'
  });
}

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return contexts.length > 0;
  } else {
    const matchedClients = await clients.matchAll();
    return matchedClients.some(client => client.url.includes(chrome.runtime.id));
  }
}

// -------------------------------------------------------------
// FIREFOX DIRECT PEERJS LOGIC (Used if chrome.offscreen is missing)
// -------------------------------------------------------------
function handlePeerConnected(targetId) {
  isConnected = true;
  connectedPeerId = targetId;
  chrome.runtime.sendMessage({ target: 'popup', action: 'peer_connected', targetId }).catch(() => {});
}

function handlePeerData(data, senderId) {
  chrome.runtime.sendMessage({ target: 'popup', action: 'message_received', data, senderId }).catch(() => {});
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../icons/icon128.png',
    title: 'New Message',
    message: text.substring(0, 50) + (text.length > 50 ? '...' : '')
  });
}

function handlePeerDisconnected() {
  isConnected = false;
  connectedPeerId = null;
  chrome.storage.local.remove(['quiko_session']);
  chrome.runtime.sendMessage({ target: 'popup', action: 'peer_disconnected' }).catch(() => {});
}

function initFirefoxPeer(peerId, sendResponse) {
  if (peer) peer.destroy();
  peer = new Peer(peerId, { debug: 2 });
  
  peer.on('open', (id) => sendResponse({ success: true, id }));
  peer.on('connection', (conn) => {
    currentConnection = conn;
    setupFirefoxListeners(conn);
    handlePeerConnected(conn.peer);
  });
  peer.on('error', (err) => sendResponse({ success: false, error: err.message }));
}

function connectFirefoxPeer(targetId, sendResponse) {
  if (!peer) return sendResponse({ success: false, error: 'Peer not initialized' });
  const conn = peer.connect(targetId);
  currentConnection = conn;
  
  conn.on('open', () => {
    setupFirefoxListeners(conn);
    handlePeerConnected(targetId);
    sendResponse({ success: true });
  });
  conn.on('error', (err) => sendResponse({ success: false, error: err.message }));
}

function setupFirefoxListeners(conn) {
  conn.on('data', (data) => handlePeerData(data, conn.peer));
  conn.on('close', () => {
    currentConnection = null;
    handlePeerDisconnected();
  });
}

function sendFirefoxMessage(data, sendResponse) {
  if (currentConnection && currentConnection.open) {
    currentConnection.send(data);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'No active connection' });
  }
}

function disconnectFirefox(sendResponse) {
  if (currentConnection) currentConnection.close();
  if (peer) peer.destroy();
  peer = null;
  currentConnection = null;
  isConnected = false;
  connectedPeerId = null;
  chrome.storage.local.remove(['quiko_session']);
  sendResponse({ success: true });
}

// -------------------------------------------------------------
// MESSAGE ROUTING (Routes to Offscreen for Chrome, or Direct for Firefox)
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background') {
    switch (message.action) {
      case 'init_peer':
        if (chrome.offscreen) {
          setupOffscreenDocument().then(() => {
            chrome.runtime.sendMessage({ target: 'offscreen', action: 'init_peer', peerId: message.peerId }, sendResponse);
          });
        } else {
          initFirefoxPeer(message.peerId, sendResponse);
        }
        return true; 
        
      case 'connect_to_peer':
        if (chrome.offscreen) {
          setupOffscreenDocument().then(() => {
            chrome.runtime.sendMessage({ target: 'offscreen', action: 'connect_to_peer', targetId: message.targetId }, sendResponse);
          });
        } else {
          connectFirefoxPeer(message.targetId, sendResponse);
        }
        return true;
        
      case 'send_message':
        if (chrome.offscreen) {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'send_message', data: message.data }, sendResponse);
        } else {
          sendFirefoxMessage(message.data, sendResponse);
        }
        return true; 
        
      case 'get_status':
        sendResponse({ isConnected, connectedPeerId });
        break;
        
      case 'disconnect':
        if (chrome.offscreen) {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'disconnect' }, () => {
            isConnected = false;
            connectedPeerId = null;
            chrome.storage.local.remove(['quiko_session']);
            sendResponse({ success: true });
          });
        } else {
          disconnectFirefox(sendResponse);
        }
        return true;
    }
  } else if (message.action === 'peer_connected') {
    // Chrome Offscreen callback
    handlePeerConnected(message.targetId);
  } else if (message.action === 'peer_data_received') {
    // Chrome Offscreen callback
    handlePeerData(message.data, message.senderId);
  } else if (message.action === 'peer_disconnected') {
    // Chrome Offscreen callback
    handlePeerDisconnected();
  }
});
