let peer = null;
const activeConnections = new Map(); // peerId -> DataConnection

// Callbacks
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
  if (peer && !peer.destroyed) {
    if (peer.id === myQikoId) {
      console.log("PeerJS already initialized for Qiko ID:", myQikoId);
      return peer;
    }
    peer.destroy();
  }

  onMessageCallback = callbacks.onMessage || null;
  onConnectionStateChangeCallback = callbacks.onConnectionStateChange || null;
  onPeerErrorCallback = callbacks.onPeerError || null;

  console.log("Initializing PeerJS client with Qiko ID:", myQikoId);

  // Initialize Peer. PeerJS uses default cloud servers if no config is passed.
  peer = new Peer(myQikoId, {
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
        console.warn(`[ChatEngine] Peer ${targetPeerId} is offline or unavailable.`);
        const conn = activeConnections.get(targetPeerId);
        if (conn) {
          if (typeof conn.emit === 'function') {
            conn.emit('error', err);
          }
          conn.close();
          activeConnections.delete(targetPeerId);
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
    console.log("Peer disconnected from coordination server. Reconnecting...");
    peer.reconnect();
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
  const peerId = conn.peer;
  activeConnections.set(peerId, conn);

  conn.on('open', () => {
    console.log("Data connection opened with:", peerId);
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(peerId, 'open');
    }
  });

  conn.on('data', (data) => {
    console.log("Received data from:", peerId, data);
    if (onMessageCallback && data && data.type === 'chat') {
      onMessageCallback(peerId, {
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        sender: data.sender || peerId
      });
    }
  });

  conn.on('close', () => {
    console.log("Data connection closed with:", peerId);
    activeConnections.delete(peerId);
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(peerId, 'close');
    }
  });

  conn.on('error', (err) => {
    if (err && err.message && err.message.includes("Could not connect to peer")) {
      console.warn(`Connection error with ${peerId} (user offline):`, err.message);
    } else {
      console.error(`Connection error with ${peerId}:`, err);
    }
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(peerId, 'error', err);
    }
  });
}

/**
 * Connect to a target peer.
 *
 * @param {string} peerId
 * @returns {DataConnection}
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

  console.log("Initiating WebRTC connection to peer:", peerId);
  const conn = peer.connect(peerId, {
    reliable: true
  });

  setupConnectionListeners(conn);
  return conn;
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
  if (peer) {
    peer.destroy();
    peer = null;
  }
  activeConnections.clear();
}
