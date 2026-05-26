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
    // If it's a peer-unavailable error, it's benign during our multi-connect attempts
    if (err.type === 'peer-unavailable') {
      console.log("PeerJS: Target peer is unavailable (benign routing event).");
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
  const fullPeerId = conn.peer;
  const cleanPeerId = fullPeerId.replace(/-ext$/, '').replace(/-web$/, '');
  activeConnections.set(cleanPeerId, conn);

  conn.on('open', () => {
    console.log("Data connection opened with:", cleanPeerId);
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(cleanPeerId, 'open');
    }
  });

  conn.on('data', (data) => {
    console.log("Received data from:", cleanPeerId, data);
    if (onMessageCallback && data && data.type === 'chat') {
      onMessageCallback(cleanPeerId, {
        text: data.text,
        timestamp: data.timestamp || Date.now(),
        sender: data.sender || cleanPeerId
      });
    }
  });

  conn.on('close', () => {
    console.log("Data connection closed with:", cleanPeerId);
    if (activeConnections.get(cleanPeerId) === conn) {
      activeConnections.delete(cleanPeerId);
    }
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(cleanPeerId, 'close');
    }
  });

  conn.on('error', (err) => {
    console.error(`Connection error with ${cleanPeerId}:`, err);
    if (onConnectionStateChangeCallback) {
      onConnectionStateChangeCallback(cleanPeerId, 'error', err);
    }
  });
}

class MultiConnectionWrapper {
  constructor(cleanPeerId, conns) {
    this.cleanPeerId = cleanPeerId;
    this.conns = conns;
    this.open = false;
    this.activeConn = null;
    this.listeners = { open: [], error: [] };

    let failedCount = 0;

    for (const conn of conns) {
      conn.on('open', () => {
        if (this.open) {
          // If we already opened a connection, close this duplicate
          conn.close();
          return;
        }
        this.open = true;
        this.activeConn = conn;
        
        // Register the working connection via our standard listeners
        setupConnectionListeners(conn);

        // Notify open listeners
        this.listeners.open.forEach(cb => cb());
      });

      conn.on('error', (err) => {
        failedCount++;
        // If all connection attempts failed, notify error listeners
        if (failedCount === conns.length && !this.open) {
          this.listeners.error.forEach(cb => cb(err));
        }
      });
    }
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  off(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(x => x !== cb);
    }
  }

  send(data) {
    if (this.activeConn && this.open) {
      this.activeConn.send(data);
    } else {
      throw new Error("Connection not open.");
    }
  }
}

/**
 * Connect to a target peer.
 *
 * @param {string} peerId
 * @returns {DataConnection|MultiConnectionWrapper}
 */
export function connectToPeer(peerId) {
  if (!peer || peer.destroyed) {
    throw new Error("Chat engine is not initialized.");
  }

  const cleanPeerId = peerId.replace(/-ext$/, '').replace(/-web$/, '');

  // If already connected and open, return existing connection
  if (activeConnections.has(cleanPeerId)) {
    const existing = activeConnections.get(cleanPeerId);
    if (existing.open) {
      return existing;
    }
  }

  console.log("Initiating WebRTC connection to peer suffixes for:", cleanPeerId);
  const connExt = peer.connect(cleanPeerId + '-ext', { reliable: true });
  const connWeb = peer.connect(cleanPeerId + '-web', { reliable: true });
  const connRaw = peer.connect(cleanPeerId, { reliable: true });

  const wrapper = new MultiConnectionWrapper(cleanPeerId, [connExt, connWeb, connRaw]);
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
      const onOpen = () => {
        conn.send(payload);
        conn.off('open', onOpen);
        conn.off('error', onError);
        resolve(payload);
      };
      const onError = (err) => {
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
