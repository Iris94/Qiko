import { DOM_IDS } from './constants.js';

/**
 * UI Manager Module for Qiko.
 * Handles all DOM operations, screen transitions, error rendering, modals, and list rendering.
 */

// Helper to get element by ID from DOM_IDS enum keys
function getEl(idKey) {
  const id = DOM_IDS[idKey];
  return id ? document.getElementById(id) : null;
}

/**
 * Toggles visibility of specific screens.
 *
 * @param {Array<string>} screensToShow - Keys of DOM_IDS to show.
 * @param {Array<string>} screensToHide - Keys of DOM_IDS to hide.
 */
export function toggleScreens(screensToShow, screensToHide) {
  screensToShow.forEach(key => {
    const el = getEl(key);
    if (el) el.classList.remove('hide');
  });
  screensToHide.forEach(key => {
    const el = getEl(key);
    if (el) el.classList.add('hide');
  });
}

/**
 * Show a single onboarding/login subscreen and hide all others.
 *
 * @param {string} targetScreenIdKey - Key in DOM_IDS to show (e.g. 'screenLoading').
 */
export function showSubScreen(targetScreenIdKey) {
  const subScreens = ['screenLoading', 'screenProfileSetup', 'screenVerification', 'screenSignIn'];
  subScreens.forEach(key => {
    const el = getEl(key);
    if (el) {
      if (key === targetScreenIdKey) {
        el.classList.remove('hide');
      } else {
        el.classList.add('hide');
      }
    }
  });
}

/**
 * Display a user-facing error message in the designated error container.
 *
 * @param {string} containerIdKey - Key in DOM_IDS representing the error element.
 * @param {string} message - Error message content.
 */
export function showError(containerIdKey, message) {
  const el = getEl(containerIdKey);
  if (el) {
    el.textContent = message || 'An unexpected error occurred.';
    el.classList.remove('hide');
  }
}

/**
 * Hide the error message and clear its contents.
 *
 * @param {string} containerIdKey - Key in DOM_IDS representing the error element.
 */
export function clearError(containerIdKey) {
  const el = getEl(containerIdKey);
  if (el) {
    el.textContent = '';
    el.classList.add('hide');
  }
}

/**
 * Render custom theme-styled Alert modal.
 *
 * @param {string} message
 * @returns {Promise<void>} Resolves when OK is clicked.
 */
export function showCustomAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'qiko-modal-overlay';
    
    const box = document.createElement('div');
    box.className = 'qiko-modal-box';
    
    const msgEl = document.createElement('p');
    msgEl.className = 'qiko-modal-message';
    msgEl.textContent = message;
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'qiko-modal-buttons';
    
    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'qiko-modal-btn qiko-modal-btn-primary';
    btnOk.textContent = 'OK';
    
    btnOk.onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 200);
    };
    
    btnGroup.appendChild(btnOk);
    box.appendChild(msgEl);
    box.appendChild(btnGroup);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add('show'), 10);
  });
}

/**
 * Render custom theme-styled Confirm modal.
 *
 * @param {string} message
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
 */
export function showCustomConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'qiko-modal-overlay';
    
    const box = document.createElement('div');
    box.className = 'qiko-modal-box';
    
    const msgEl = document.createElement('p');
    msgEl.className = 'qiko-modal-message';
    msgEl.textContent = message;
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'qiko-modal-buttons';
    
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'qiko-modal-btn qiko-modal-btn-secondary';
    btnCancel.textContent = 'Cancel';
    
    const btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'qiko-modal-btn qiko-modal-btn-primary';
    btnConfirm.textContent = 'Confirm';
    
    btnCancel.onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        resolve(false);
      }, 200);
    };
    
    btnConfirm.onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        resolve(true);
      }, 200);
    };
    
    btnGroup.appendChild(btnCancel);
    btnGroup.appendChild(btnConfirm);
    box.appendChild(msgEl);
    box.appendChild(btnGroup);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add('show'), 10);
  });
}

/**
 * Render the list of contact chips in the active chats bar.
 *
 * @param {Array<Object>} resolvedContacts - Contacts array with details: { id, displayName, isOnline }.
 * @param {string|null} activePartnerId - Currently selected partner Qiko ID.
 * @param {function(string)} onSelectContact - Callback when a contact is selected.
 */
export function renderContacts(resolvedContacts, activePartnerId, onSelectContact) {
  const activeChatsBar = getEl('activeChatsBar');
  const activeChatsList = getEl('activeChatsList');
  const chatMainSection = getEl('chatMainSection');
  const chatEmptyState = getEl('chatEmptyState');

  if (resolvedContacts.length === 0) {
    if (activeChatsBar) activeChatsBar.classList.add('hide');
    if (chatMainSection) chatMainSection.classList.add('hide');
    if (chatEmptyState) {
      chatEmptyState.classList.remove('hide');
      const emptyTitle = chatEmptyState.querySelector('.empty-title');
      const emptySubtitle = chatEmptyState.querySelector('.empty-subtitle');
      if (emptyTitle) emptyTitle.textContent = 'No connections currently';
      if (emptySubtitle) emptySubtitle.textContent = 'Add them by clicking connect button or by clicking + button in sidebar.';
    }
    return;
  }

  // Show contact bar
  if (activeChatsBar) activeChatsBar.classList.remove('hide');
  if (activeChatsList) activeChatsList.innerHTML = '';

  // Show choose connection state if no partner is active
  if (!activePartnerId) {
    if (chatMainSection) chatMainSection.classList.add('hide');
    if (chatEmptyState) {
      chatEmptyState.classList.remove('hide');
      const emptyTitle = chatEmptyState.querySelector('.empty-title');
      const emptySubtitle = chatEmptyState.querySelector('.empty-subtitle');
      if (emptyTitle) emptyTitle.textContent = 'Choose Connection';
      if (emptySubtitle) emptySubtitle.textContent = 'Select a contact from the bar above to start direct messaging.';
    }
  } else {
    if (chatEmptyState) chatEmptyState.classList.add('hide');
    if (chatMainSection) chatMainSection.classList.remove('hide');
  }

  resolvedContacts.forEach((contact, index) => {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'chat-contact-item';
    if (activePartnerId === contact.id) {
      itemContainer.classList.add('active');
    }

    const chip = document.createElement('div');
    const colorClass = `circle-pastel-${(index % 5) + 1}`;
    chip.className = `chat-chip ${colorClass}`;

    const indicator = document.createElement('span');
    indicator.className = 'online-indicator';
    if (contact.isOnline) {
      indicator.classList.add('online');
    }
    chip.appendChild(indicator);

    let displayLabel = contact.displayName || contact.id;
    if (displayLabel.length > 12) {
      displayLabel = displayLabel.slice(0, 12) + '...';
    }

    const nameTextNode = document.createTextNode(displayLabel);
    chip.appendChild(nameTextNode);
    itemContainer.appendChild(chip);

    itemContainer.addEventListener('click', () => {
      document.querySelectorAll('.chat-contact-item').forEach(c => c.classList.remove('active'));
      itemContainer.classList.add('active');
      
      if (chatEmptyState) chatEmptyState.classList.add('hide');
      if (chatMainSection) chatMainSection.classList.remove('hide');
      
      onSelectContact(contact.id);
    });

    if (activeChatsList) {
      activeChatsList.appendChild(itemContainer);
    }
  });
}

/**
 * Render chat history logs to the chat area.
 *
 * @param {Array<Object>} messages - Logged messages array.
 * @param {string} myQikoId - The user's own Qiko ID.
 */
export function renderChatLog(messages, myQikoId) {
  const chatMessagesLog = getEl('chatMessagesLog');
  if (!chatMessagesLog) return;

  chatMessagesLog.innerHTML = '';

  if (messages.length === 0) {
    chatMessagesLog.innerHTML = `
      <div class="msg-time">System</div>
      <div class="msg-bubble received">No messages yet. Send a message to start chatting!</div>
    `;
    return;
  }

  let lastTime = null;
  messages.forEach(msg => {
    if (msg.timestamp) {
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (lastTime !== timeStr) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = timeStr;
        chatMessagesLog.appendChild(timeDiv);
        lastTime = timeStr;
      }
    }

    const bubble = document.createElement('div');
    const received = (msg.received !== undefined) ? msg.received : (msg.sender !== myQikoId);
    bubble.className = `msg-bubble ${received ? 'received' : 'sent'}`;
    bubble.textContent = msg.text;
    chatMessagesLog.appendChild(bubble);
  });

  // Auto-scroll to bottom of log
  chatMessagesLog.scrollTop = chatMessagesLog.scrollHeight;
}
