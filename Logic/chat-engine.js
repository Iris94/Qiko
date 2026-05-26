import { getUidByQikoId, registerPresence, unregisterPresence, getActivePeers } from './firebase-db.js';

let peer = null;
let dbToken = null; // Store database token for active peer queries
let presenceInterval = null; // Periodic presence registration
const activeConnections = new Map(); // peerId -> DataConnection
const pendingWrappers = new Set(); // active multi-connect attempts

// Callbacks
let onMessageCallback = null;
let onConnectionStateChangeCallback = null;
let onPeerErrorCallback = null;

/**
 * Initialize the PeerJS instance.
 *
 * @param {string} myQikoId - The user's own Qiko ID (can include client suffixes).
 * @param {Object} callbacks - Callback functions for Peer events.
 * @param {string|null} token - Optional Firebase ID token for presence registration.
 */
export function initChatEngine(myQikoId, callbacks = {}, token = null) {
  dbToken = token;

  if (peer && !peer.destroyed) {
    if (peer.id === myQikoId) {
      console.log("PeerJS already initialized for Qiko ID:", myQikoId);
      return peer;
    }
    peer.destroy();
  }

  // Clear any existing intervals
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
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
      
      // Parse target peer ID from error message to notify MultiConnectionWrapper
      const match = err.message.match(/Could not connect to peer (.+)$/);
      if (match) {
        const targetId = match[1].trim();
        triggerConnectionFailure(targetId, err);
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

  peer.on('close', async () => {
    console.log("Peer instance closed.");
    if (presenceInterval) {
      clearInterval(presenceInterval);
      presenceInterval = null;
    }
    if (dbToken && peer) {
      try {
        const cleanId = peer.id.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');
        const uid = await getUidByQikoId(cleanId, dbToken);
        if (uid) {
          await unregisterPresence(uid, peer.id, dbToken);
          console.log("Presence unregistered successfully.");
        }
      } catch (e) {
        // Safe to ignore on close
      }
    }
    activeConnections.clear();
  });

  peer.on('open', async (id) => {
    console.log("My PeerJS ID is:", id);
    if (dbToken) {
      try {
        const cleanId = id.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');
        const uid = await getUidByQikoId(cleanId, dbToken);
        if (uid) {
          await registerPresence(uid, id, dbToken);
          console.log("Presence registered successfully for peer ID:", id);
        }
      } catch (e) {
        console.warn("Could not register presence in Firebase:", e);
      }
      
      // Setup periodic presence refresh (every 2 minutes)
      if (presenceInterval) clearInterval(presenceInterval);
      presenceInterval = setInterval(async () => {
        if (peer && !peer.destroyed && dbToken) {
          try {
            const cleanId = peer.id.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');
            const uid = await getUidByQikoId(cleanId, dbToken);
            if (uid) {
              await registerPresence(uid, peer.id, dbToken);
            }
          } catch (e) {
            // Ignore periodic registration errors
          }
        }
      }, 2 * 60 * 1000);
    }
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
  const cleanPeerId = fullPeerId.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');
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
    this.failedTargets = new Set();

    pendingWrappers.add(this);

    for (const conn of conns) {
      conn.on('open', () => {
        if (this.open) {
          // If we already opened a connection, close this duplicate
          conn.close();
          return;
        }
        this.open = true;
        this.activeConn = conn;
        pendingWrappers.delete(this);
        
        // Register the working connection via our standard listeners
        setupConnectionListeners(conn);

        // Notify open listeners
        this.listeners.open.forEach(cb => cb());
      });

      conn.on('error', (err) => {
        this.handleFailure(conn.peer, err);
      });
    }
  }

  handleFailure(targetId, err) {
    this.failedTargets.add(targetId);
    if (this.failedTargets.size >= this.conns.length && !this.open) {
      pendingWrappers.delete(this);
      this.listeners.error.forEach(cb => cb(err || new Error("All routing targets failed.")));
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

function triggerConnectionFailure(targetId, err) {
  for (const wrapper of pendingWrappers) {
    for (const conn of wrapper.conns) {
      if (conn.peer === targetId) {
        wrapper.handleFailure(targetId, err);
      }
    }
  }
}

/**
 * Connect to a target peer.
 *
 * @param {string} peerId
 * @returns {Promise<MultiConnectionWrapper>}
 */
export async function connectToPeer(peerId) {
  if (!peer || peer.destroyed) {
    throw new Error("Chat engine is not initialized.");
  }

  const cleanPeerId = peerId.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');

  // If already connected and open, return existing connection
  if (activeConnections.has(cleanPeerId)) {
    const existing = activeConnections.get(cleanPeerId);
    if (existing.open) {
      return existing;
    }
  }

  console.log("Initiating WebRTC connection to peer suffixes for:", cleanPeerId);
  
  let targets = [];
  if (dbToken) {
    try {
      const uid = await getUidByQikoId(cleanPeerId, dbToken);
      if (uid) {
        const activePeers = await getActivePeers(uid, dbToken);
        if (activePeers && activePeers.length > 0) {
          targets.push(...activePeers);
        }
      }
    } catch (e) {
      console.warn("Could not query active peers from Firebase (falling back to suffixes):", e);
    }
  }

  // Fallback default suffixes
  targets.push(cleanPeerId + '-ext');
  targets.push(cleanPeerId + '-web');
  targets.push(cleanPeerId);

  // De-duplicate targets
  targets = [...new Set(targets)];

  console.log("Connecting to target peer IDs:", targets);

  const conns = targets.map(t => peer.connect(t, { reliable: true }));
  const wrapper = new MultiConnectionWrapper(cleanPeerId, conns);
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
export async function sendMessage(peerId, text, myQikoId) {
  let conn = activeConnections.get(peerId);

  // If connection is not active, try to connect first
  if (!conn || !conn.open) {
    conn = await connectToPeer(peerId);
  }

  const payload = {
    type: 'chat',
    text: text,
    sender: myQikoId,
    timestamp: Date.now()
  };

  if (conn.open) {
    conn.send(payload);
    return payload;
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
export async function disconnectChatEngine() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  if (peer) {
    if (dbToken) {
      try {
        const cleanId = peer.id.replace(/-ext-.*$/, '').replace(/-web-.*$/, '').replace(/-ext$/, '').replace(/-web$/, '');
        const uid = await getUidByQikoId(cleanId, dbToken);
        if (uid) {
          await unregisterPresence(uid, peer.id, dbToken);
        }
      } catch (e) {
        // Safe to ignore
      }
    }
    peer.destroy();
    peer = null;
  }
  activeConnections.clear();
}
