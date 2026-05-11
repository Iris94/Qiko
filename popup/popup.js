import { getUserEmail } from './utils/user.js';
import { mountConnections } from './components/connections.js';
import { mountInvite } from './components/invite.js';
import { mountJoin } from './components/join.js';
import { mountMessage } from './components/message.js';
import { getSession } from './storage.js';

let current = null;
let state = 'dashboard';

function setHeaderToDashboardMode(isDashboard) {
  const connectBtn = document.querySelector('.connect-text');
  if (!connectBtn) return;
  connectBtn.textContent = isDashboard ? 'Connect' : 'Dashboard';
}

function clearMain() {
  const main = document.querySelector('.section-main');
  if (!main) return;
  while (main.firstChild) main.removeChild(main.firstChild);
}

function renderDashboard() {
  if (current && current.destroy) current.destroy();
  clearMain();
  const main = document.querySelector('.section-main');
  const h1 = document.createElement('h1');
  h1.className = 'test-phase';
  h1.textContent = 'Dashboard';
  main.appendChild(h1);
  state = 'dashboard';
  setHeaderToDashboardMode(true);
}

function showConnections() {
  if (current && current.destroy) current.destroy();
  clearMain();
  const main = document.querySelector('.section-main');
  current = mountConnections(main, {
    onInvite: () => showInvite(),
    onJoin: () => showJoin()
  });
  state = 'connections';
  setHeaderToDashboardMode(false);
}

function showInvite() {
  if (current && current.destroy) current.destroy();
  clearMain();
  const main = document.querySelector('.section-main');
  current = mountInvite(main, {
    onBack: () => showConnections()
  });
  state = 'invite';
  setHeaderToDashboardMode(false);
}

function showJoin() {
  if (current && current.destroy) current.destroy();
  clearMain();
  const main = document.querySelector('.section-main');
  current = mountJoin(main, {
    onBack: () => showConnections()
  });
  state = 'join';
  setHeaderToDashboardMode(false);
}

function showChat() {
  if (current && current.destroy) current.destroy();
  clearMain();
  const main = document.querySelector('.section-main');
  current = mountMessage(main, {
    onDisconnect: () => renderDashboard()
  });
  state = 'chat';
  setHeaderToDashboardMode(false);
}

function handleHeaderButtonClick() {
  const connectBtn = document.querySelector('.connect-text');
  if (!connectBtn) return;
  
  if (state === 'chat') {
    // Cannot navigate away while in chat unless disconnect
    return;
  }
  
  if (state === 'dashboard') {
    showConnections();
  } else {
    if (current && current.destroy) current.destroy();
    renderDashboard();
  }
}

async function initUI() {
  const connectBtn = document.querySelector('.connect-text');
  connectBtn.addEventListener('click', handleHeaderButtonClick);

  // Check connection status
  chrome.runtime.sendMessage({
    target: 'background',
    action: 'get_status'
  }, (response) => {
    if (response && response.isConnected) {
      showChat();
    } else {
      renderDashboard();
    }
  });
  
  // Listen for connection events from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'popup') {
      if (message.action === 'peer_connected') {
        showChat();
      } else if (message.action === 'peer_disconnected') {
        if (state === 'chat') {
          renderDashboard();
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const emailResult = await getUserEmail();
  
  if (emailResult.success) {
    const userBox = document.querySelector('.user-box');
    const userStatus = document.querySelector('.user-status');
    const userEmail = document.createElement('span');
    userEmail.textContent = emailResult.email;
    userEmail.classList.add('user-email');
    userBox.appendChild(userEmail);
    userStatus.classList.add('online');
    
  } else {
    console.log("No email found:", emailResult.error || "User not signed in");
  }

  initUI();
});
