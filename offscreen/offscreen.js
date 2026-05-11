let peer = null;
let currentConnection = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  switch (message.action) {
    case 'init_peer':
      initPeer(message.peerId, sendResponse);
      return true; // async
    
    case 'connect_to_peer':
      connectToPeer(message.targetId, sendResponse);
      return true; // async
      
    case 'send_message':
      sendPeerMessage(message.data, sendResponse);
      return true; // async
      
    case 'disconnect':
      disconnectPeer(sendResponse);
      return true;
  }
});

function initPeer(peerId, sendResponse) {
  if (peer) {
    peer.destroy();
  }
  
  // Use public PeerJS server for now
  peer = new Peer(peerId, {
    debug: 2
  });

  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);
    sendResponse({ success: true, id: id });
  });

  peer.on('connection', (conn) => {
    console.log('Incoming connection from: ' + conn.peer);
    currentConnection = conn;
    setupConnectionListeners(conn);
    
    // Notify background that we are connected
    chrome.runtime.sendMessage({
      action: 'peer_connected',
      targetId: conn.peer
    });
  });

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    sendResponse({ success: false, error: err.message });
  });
}

function connectToPeer(targetId, sendResponse) {
  if (!peer) {
    sendResponse({ success: false, error: 'Peer not initialized' });
    return;
  }

  const conn = peer.connect(targetId);
  currentConnection = conn;
  
  conn.on('open', () => {
    console.log('Connected to: ' + targetId);
    setupConnectionListeners(conn);
    
    // Notify background
    chrome.runtime.sendMessage({
      action: 'peer_connected',
      targetId: targetId
    });
    
    sendResponse({ success: true });
  });
  
  conn.on('error', (err) => {
    sendResponse({ success: false, error: err.message });
  });
}

function setupConnectionListeners(conn) {
  conn.on('data', (data) => {
    console.log('Received data', data);
    // Forward data to background script
    chrome.runtime.sendMessage({
      action: 'peer_data_received',
      data: data,
      senderId: conn.peer
    });
  });

  conn.on('close', () => {
    console.log('Connection closed');
    currentConnection = null;
    chrome.runtime.sendMessage({
      action: 'peer_disconnected'
    });
  });
}

function sendPeerMessage(data, sendResponse) {
  if (currentConnection && currentConnection.open) {
    currentConnection.send(data);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'No active connection' });
  }
}

function disconnectPeer(sendResponse) {
  if (currentConnection) {
    currentConnection.close();
    currentConnection = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  sendResponse({ success: true });
}
