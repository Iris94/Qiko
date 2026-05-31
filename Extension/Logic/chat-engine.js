class ConnectionWrapper {
  constructor(extConn, webConn, baseId) {
    this.extConn = extConn;
    this.webConn = webConn;
    this.baseId = baseId;
    this.openListeners = new Map();
    this.errorListeners = new Map();
  }

  get open() {
    return (this.extConn && this.extConn.open) || (this.webConn && this.webConn.open);
  }

  send(data) {
    if (this.extConn && this.extConn.open) {
      this.extConn.send(data);
    } else if (this.webConn && this.webConn.open) {
      this.webConn.send(data);
    } else {
      throw new Error("Connection is not open.");
    }
  }

  on(event, callback) {
    if (event === 'open') {
      const onOpen = () => {
        callback();
        this.off('open', callback);
      };
      this.openListeners.set(callback, onOpen);
      this.extConn.on('open', onOpen);
      this.webConn.on('open', onOpen);
    } else if (event === 'error') {
      let extFailed = false;
      let webFailed = false;
      const onError = (err) => {
        if (err && err.type === 'peer-unavailable') {
          if (err.message && err.message.includes(this.baseId + '-ext')) extFailed = true;
          if (err.message && err.message.includes(this.baseId + '-web')) webFailed = true;
        } else {
          extFailed = true;
          webFailed = true;
        }
        if (extFailed && webFailed) {
          callback(err);
          this.off('error', callback);
        }
      };
      this.errorListeners.set(callback, onError);
      this.extConn.on('error', onError);
      this.webConn.on('error', onError);
    } else {
      this.extConn.on(event, callback);
      this.webConn.on(event, callback);
    }
  }

  off(event, callback) {
    if (event === 'open') {
      const wrapped = this.openListeners.get(callback);
      if (wrapped) {
        this.extConn.off('open', wrapped);
        this.webConn.off('open', wrapped);
        this.openListeners.delete(callback);
      }
    } else if (event === 'error') {
      const wrapped = this.errorListeners.get(callback);
      if (wrapped) {
        this.extConn.off('error', wrapped);
        this.webConn.off('error', wrapped);
        this.errorListeners.delete(callback);
      }
    } else {
      this.extConn.off(event, callback);
      this.webConn.off(event, callback);
    }
  }

  close() {
    if (this.extConn) this.extConn.close();
    if (this.webConn) this.webConn.close();
  }

  emit(event, ...args) {
    // compatibility helper
  }
}

let peer = null;
let suspended = false;
const activeConnections = new Map();

let onMessageCallback = null;
let onConnectionStateChangeCallback = null;
let onPeerErrorCallback = null;

/**
 * Initialize the PeerJS instance.
 *
 * @param {string} myQikoId - The user's own Qiko ID.
 * @param {Object} callbacks - Callback functions for Peer events.
 */
export function initChatEngine(myQikoId, callbacks = {}) {
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const suffix = isExtension ? '-ext' : '-web';
  const registeredPeerId = myQikoId.endsWith(suffix) ? myQikoId : (myQikoId + suffix);

  if (peer && !peer.destroyed) {
    if (peer.id === registeredPeerId) {
      console.log("PeerJS already initialized for Qiko ID:", registeredPeerId);
      return peer;
    }
    peer.destroy();
  }

  onMessageCallback = callbacks.onMessage || null;
  onConnectionStateChangeCallback = callbacks.onConnectionStateChange || null;
  onPeerErrorCallback = callbacks.onPeerError || null;

  console.log("Initializing PeerJS client with Qiko ID:", registeredPeerId);

  // Initialize Peer. PeerJS uses default cloud servers if no config is passed.
  peer = new Peer(registeredPeerId, {
    debug: 1,
    host: '0.peerjs.com',
    port: 443,
    secure: true
  });

  // Handle incoming connections from other peers
  peer.on('connection', (conn) => {
    console.log("Incoming WebRTC P2P connection from:", conn.peer);
    setupConnectionListeners(conn);
  });

  peer.on('error', (err) => {
    if (err.type === 'peer-unavailable') {
      const match = err.message.match(/Could not connect to peer ([\w-]+)/);
      const targetPeerId = match ? match[1] : null;
      if (targetPeerId) {
        const basePeerId = targetPeerId.replace(/-ext$|-web$/, '');
        console.warn(`[ChatEngine] Peer ${basePeerId} is offline or unavailable.`);
        const conn = activeConnections.get(basePeerId);
        if (conn) {
          if (typeof conn.emit === 'function') {
            conn.emit('error', err);
          }
          conn.close();
          activeConnections.delete(basePeerId);
        }
      }
      return;
    }

    console.error("PeerJS global error:", err);
    if (onPeerErrorCallback) {
      onPeerErrorCallback(err);
    }
  });

  peer.on('disconnected', () => {
    if (!suspended) {
      console.log("Peer disconnected from coordination server. Reconnecting...");
      peer.reconnect();
    } else {
      console.log("Peer disconnected (suspended). Will not auto-reconnect.");
    }
  });

  peer.on('close', () => {
    console.log("Peer instance closed.");
    activeConnections.clear();
  });

  return peer;
}

/**
 * Set up listeners on a specific DataConnection.
 *
 * @param {DataConnection} conn
 */
function setupConnectionListeners(conn) {
  const fullPeerId = conn.peer;
  const basePeerId = fullPeerId.replace(/-ext$|-web$/, '');

  conn.on('open', () => {
    console.log("Data connection opened with:", basePeerId);
    
    const existing = activeConnections.get(basePeerId);
    if (existing && existing !== conn) {
      console.log("Replacing old connection with new one for:", basePeerId);
      existing.close();
    }

    activeConnections.set(basePeerId, conn);
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(basePeerId, 'open');
    }
  });

  conn.on('data', (data) => {
    console.log("Received data from:", basePeerId, data);
    if (onMessageCallback && data && data.type === 'chat') {
      onMessageCallback(basePeerId, {
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        sender: data.sender || basePeerId
      });
    }
  });

  conn.on('close', () => {
    console.log("Data connection closed with:", basePeerId);
    if (activeConnections.get(basePeerId) === conn) {
      activeConnections.delete(basePeerId);
    }
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(basePeerId, 'close');
    }
  });

  conn.on('error', (err) => {
    if (err && err.message && err.message.includes("Could not connect to peer")) {
      console.warn(`Connection error with ${basePeerId} (user offline):`, err.message);
    } else {
      console.error(`Connection error with ${basePeerId}:`, err);
    }
    if (activeConnections.get(basePeerId) === conn) {
      activeConnections.delete(basePeerId);
    }
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(basePeerId, 'error', err);
    }
  });
}

/**
 * Connect to a target peer.
 *
 * @param {string} peerId
 * @returns {DataConnection|ConnectionWrapper}
 */
export function connectToPeer(peerId) {
  if (!peer || peer.destroyed) {
    throw new Error("Chat engine is not initialized.");
  }

  // If already connected and open, return existing connection
  if (activeConnections.has(peerId)) {
    const existing = activeConnections.get(peerId);
    if (existing.open) {
      return existing;
    }
  }

  console.log("Initiating WebRTC connection to peer (base):", peerId);
  const extConn = peer.connect(peerId + '-ext', { reliable: true });
  const webConn = peer.connect(peerId + '-web', { reliable: true });

  setupConnectionListeners(extConn);
  setupConnectionListeners(webConn);

  const wrapper = new ConnectionWrapper(extConn, webConn, peerId);
  return wrapper;
}

/**
 * Send a chat message to a target peer.
 *
 * @param {string} peerId
 * @param {string} text
 * @param {string} myQikoId
 * @returns {Promise<Object>} Resolves with the payload when sent.
 */
export function sendMessage(peerId, text, myQikoId) {
  let conn = activeConnections.get(peerId);

  // If connection is not active, try to connect first
  if (!conn || !conn.open) {
    conn = connectToPeer(peerId);
  }

  const payload = {
    type: 'chat',
    text: text,
    sender: myQikoId,
    timestamp: Date.now()
  };

  if (conn.open) {
    conn.send(payload);
    return Promise.resolve(payload);
  } else {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        conn.off('open', onOpen);
        conn.off('error', onError);
        reject(new Error("Connection timeout: Peer is unreachable."));
      }, 10000);

      const onOpen = () => {
        clearTimeout(timeoutId);
        conn.send(payload);
        conn.off('open', onOpen);
        conn.off('error', onError);
        resolve(payload);
      };
      const onError = (err) => {
        clearTimeout(timeoutId);
        conn.off('open', onOpen);
        conn.off('error', onError);
        reject(err);
      };
      conn.on('open', onOpen);
      conn.on('error', onError);
    });
  }
}

/**
 * Disconnect and destroy the Peer instance.
 */
export function disconnectChatEngine() {
  suspended = false;
  if (peer) {
    peer.destroy();
    peer = null;
  }
  activeConnections.clear();
}

/**
 * Temporarily suspend the peer connection without destroying it.
 * The peer ID remains valid on the server and can be resumed.
 */
export function suspendChatEngine() {
  suspended = true;
  for (const conn of activeConnections.values()) {
    if (conn && typeof conn.close === 'function') {
      conn.close();
    }
  }
  activeConnections.clear();
  if (peer && !peer.destroyed && !peer.disconnected) {
    peer.disconnect();
  }
}

/**
 * Resume a previously suspended peer connection.
 * Returns a Promise that resolves when the peer is reconnected.
 */
export function resumeChatEngine() {
  suspended = false;
  if (peer && !peer.destroyed && peer.disconnected) {
    return new Promise((resolve) => {
      const onOpen = () => {
        peer.off('open', onOpen);
        resolve();
      };
      peer.on('open', onOpen);
      peer.reconnect();
      setTimeout(() => {
        peer.off('open', onOpen);
        resolve();
      }, 5000);
    });
  }
  return Promise.resolve();
}
