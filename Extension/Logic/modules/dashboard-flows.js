import { storage } from './storage.js';
import { getRoute } from './routing.js';
import * as firebaseAuth from '../firebase-auth.js';
import * as firebaseDb from '../firebase-db.js';
import * as chatEngine from '../chat-engine.js';
import { copyToClipboard, saveIdentityToFirebase } from './utils.js';
import {
  lookupProfileByQikoId,
  loadAndRenderContacts,
  selectPartner,
  removeConnection,
  addConnection
} from './contact-flows.js';

export async function initDashboardScreen(uiManager) {
  const state = await storage.get(['qiko_user_id', 'qiko_email', 'qiko_username', 'qiko_id', 'qiko_registered', 'qiko_token', 'qiko_refresh_token']);
  if (!state.qiko_user_id) {
    window.location.href = getRoute('start');
    return;
  }

  const userDisplay = document.getElementById('dashboard-user-display');
  if (userDisplay) {
    if (state.qiko_username && state.qiko_username !== 'Guest') {
      userDisplay.textContent = state.qiko_username;
    } else if (state.qiko_id) {
      const qId = state.qiko_id;
      userDisplay.textContent = qId.length > 12 ? qId.slice(0, 12) + '...' : qId;
    } else {
      userDisplay.textContent = 'Guest';
    }
  }

  const btnNavHome = document.getElementById('nav-btn-home');
  const btnNavProfile = document.getElementById('nav-btn-profile');
  const btnNavConnect = document.getElementById('nav-btn-connect');

  const sceneHome = document.getElementById('scene-chat-dashboard');
  const sceneProfile = document.getElementById('scene-user-profile');
  const sceneConnect = document.getElementById('scene-connect');

  const navButtons = [btnNavHome, btnNavProfile, btnNavConnect];
  const scenes = [sceneHome, sceneProfile, sceneConnect];

  function switchScene(activeBtn, activeScene) {
    navButtons.forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    scenes.forEach(sc => {
      if (sc) sc.classList.add('hide');
    });
    if (activeBtn) activeBtn.classList.add('active');
    if (activeScene) activeScene.classList.remove('hide');

    if (activeScene !== sceneHome) {
      state.qiko_active_partner = null;
      storage.remove('qiko_active_partner');
    }
  }

  const switchHomeScene = () => switchScene(btnNavHome, sceneHome);

  if (btnNavHome) btnNavHome.onclick = () => switchScene(btnNavHome, sceneHome);
  if (btnNavProfile) btnNavProfile.onclick = () => switchScene(btnNavProfile, sceneProfile);
  if (btnNavConnect) btnNavConnect.onclick = () => switchScene(btnNavConnect, sceneConnect);

  const btnConnectLarge = document.getElementById('btn-connect');
  if (btnConnectLarge) {
    btnConnectLarge.onclick = () => switchScene(btnNavConnect, sceneConnect);
  }

  // Remove connection event
  const btnRemoveConn = document.getElementById('btn-remove-connection');
  if (btnRemoveConn) {
    btnRemoveConn.onclick = async () => {
      const partnerId = state.qiko_active_partner;
      if (!partnerId) return;

      btnRemoveConn.disabled = true;
      btnRemoveConn.textContent = 'Removing...';

      const success = await removeConnection(partnerId, state, uiManager, async () => {
        const chatMainSection = document.getElementById('chat-main-section');
        const chatEmptyState = document.getElementById('chat-empty-state');
        if (chatMainSection) chatMainSection.classList.add('hide');
        if (chatEmptyState) {
          chatEmptyState.classList.remove('hide');
          const emptyTitle = chatEmptyState.querySelector('.empty-title');
          const emptySubtitle = chatEmptyState.querySelector('.empty-subtitle');
          if (emptyTitle) emptyTitle.textContent = "Choose Connection";
          if (emptySubtitle) emptySubtitle.textContent = "Select a contact from the bar above to start direct messaging.";
        }
        await loadAndRenderContacts(state, uiManager, (id) => selectPartner(id, state, uiManager, switchHomeScene));
        await uiManager.showCustomAlert(`Successfully removed ${partnerId} from contacts.`);
      });

      btnRemoveConn.disabled = false;
      btnRemoveConn.textContent = 'Remove';
    };
  }

  // Sending Messages Handler
  const btnSend = document.getElementById('btn-send-message');
  const inputMessage = document.getElementById('chat-message-input');

  const sendMessageFunc = async () => {
    if (!inputMessage) return;
    const msgText = inputMessage.value.trim();
    if (!msgText) return;

    const partnerId = state.qiko_active_partner;
    if (!partnerId) return;

    inputMessage.value = '';

    const timestamp = Date.now();
    const sentMsg = {
      sender: state.qiko_id,
      text: msgText,
      timestamp: timestamp,
      received: false
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.offscreen) {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'sendMessage',
            partnerId: partnerId,
            text: msgText
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
      } else {
        await chatEngine.sendMessage(partnerId, msgText, state.qiko_id);
      }

      const historyKey = `qiko_history_${partnerId}`;
      const historyData = await storage.get(historyKey);
      const history = historyData[historyKey] || [];
      history.push(sentMsg);
      if (history.length > 100) history.shift();
      await storage.set({ [historyKey]: history });
      uiManager.renderChatLog(history, state.qiko_id);

    } catch (err) {
      console.warn("P2P transmission failed (peer offline):", err);

      const historyKey = `qiko_history_${partnerId}`;
      const historyData = await storage.get(historyKey);
      const history = [...(historyData[historyKey] || [])];
      history.push({
        sender: 'system',
        text: `Message delivery failed: User is offline.`,
        timestamp: Date.now(),
        received: true
      });
      uiManager.renderChatLog(history, state.qiko_id);
    }
  };

  if (btnSend) {
    btnSend.addEventListener('click', sendMessageFunc);
  }
  if (inputMessage) {
    inputMessage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessageFunc();
      }
    });
  }

  // Setup sub-tabs
  initProfileTab(state, uiManager);
  initConnectTab(state, uiManager, switchHomeScene);

  // Initialize Chat Engine (PeerJS)
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    chrome.runtime.sendMessage({ type: 'CHECK_OFFSCREEN' });
  } else {
    try {
      chatEngine.initChatEngine(state.qiko_id, {
        onMessage: async (senderId, data) => {
          console.log(`Received message from ${senderId}:`, data);
          const historyKey = `qiko_history_${senderId}`;
          const historyData = await storage.get(historyKey);
          const history = historyData[historyKey] || [];
          
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
            
            try {
              if (state.qiko_user_id && state.qiko_token) {
                const contacts = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);
                if (contacts && !contacts.includes(senderId)) {
                  contacts.push(senderId);
                  await firebaseDb.updateContacts(state.qiko_user_id, contacts, state.qiko_token);
                }
              }
            } catch (e) {
              console.error("[WebPopup] Failed to auto-add contact on message:", e);
            }
            
            await loadAndRenderContacts(state, uiManager, (id) => selectPartner(id, state, uiManager, switchHomeScene));
            
            if (state.qiko_active_partner === senderId) {
              uiManager.renderChatLog(history, state.qiko_id);
            } else if (!state.qiko_active_partner) {
              await selectPartner(senderId, state, uiManager, switchHomeScene);
            }
          }
        },
        onConnectionStateChange: (peerId, status, err) => {
          console.log(`P2P Status with ${peerId}:`, status);
          loadAndRenderContacts(state, uiManager, (id) => selectPartner(id, state, uiManager, switchHomeScene));
        }
      });
    } catch (err) {
      console.error("Failed to initialize PeerJS chat engine in-page:", err);
    }
  }

  const activePartnerRes = await storage.get('qiko_active_partner');
  if (activePartnerRes.qiko_active_partner) {
    await selectPartner(activePartnerRes.qiko_active_partner, state, uiManager, switchHomeScene);
  } else {
    await loadAndRenderContacts(state, uiManager, (id) => selectPartner(id, state, uiManager, switchHomeScene));
  }

  // Storage listener
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.qiko_user_id && !changes.qiko_user_id.newValue) {
        window.location.href = getRoute('start');
        return;
      }
      if (changes.qiko_token) {
        state.qiko_token = changes.qiko_token.newValue;
      }
      if (changes.qiko_refresh_token) {
        state.qiko_refresh_token = changes.qiko_refresh_token.newValue;
      }
      if (changes.qiko_contacts_updated) {
        await loadAndRenderContacts(state, uiManager, (id) => selectPartner(id, state, uiManager, switchHomeScene));
      }

      if (!state.qiko_active_partner) {
        const historyKeyPrefix = 'qiko_history_';
        for (const key of Object.keys(changes)) {
          if (key.startsWith(historyKeyPrefix)) {
            const changedSenderId = key.substring(historyKeyPrefix.length);
            if (changedSenderId) {
              await selectPartner(changedSenderId, state, uiManager, switchHomeScene);
              break;
            }
          }
        }
      }

      if (changes.qiko_active_partner && changes.qiko_active_partner.newValue) {
        await selectPartner(changes.qiko_active_partner.newValue, state, uiManager, switchHomeScene);
      }

      const activePartner = state.qiko_active_partner;
      if (activePartner) {
        const historyKey = `qiko_history_${activePartner}`;
        if (changes[historyKey]) {
          uiManager.renderChatLog(changes[historyKey].newValue || [], state.qiko_id);
        }
      }
    });
  }

  // Presence pinger
  const pingPresence = async () => {
    try {
      await firebaseDb.updatePresence(state.qiko_user_id, Date.now(), state.qiko_token);
    } catch (err) {
      console.warn("Failed to ping presence status:", err);
    }
  };

  pingPresence();
  const presenceInterval = setInterval(pingPresence, 60000);

  window.addEventListener('unload', () => {
    clearInterval(presenceInterval);
    storage.remove('qiko_active_partner');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ qiko_popup_open: false });
    }
  });
}

function initProfileTab(state, uiManager) {
  const isRegistered = state.qiko_registered === true || state.qiko_registered === 'true';

  const formEdit = document.getElementById('form-profile-edit');
  const formUpgrade = document.getElementById('form-profile-upgrade');

  if (isRegistered) {
    if (formEdit) formEdit.classList.remove('hide');
    if (formUpgrade) formUpgrade.classList.add('hide');

    const idInput = document.getElementById('profile-edit-id');
    const emailInput = document.getElementById('profile-edit-email');
    const usernameInput = document.getElementById('profile-edit-username');

    if (idInput) idInput.value = state.qiko_id || '';
    if (emailInput) emailInput.value = state.qiko_email || '';
    if (usernameInput) usernameInput.value = state.qiko_username || '';

    if (formEdit) {
      formEdit.onsubmit = async (e) => {
        e.preventDefault();
        const successMsg = document.getElementById('profile-edit-success-msg');
        const saveBtn = document.getElementById('btn-profile-save');

        if (successMsg) successMsg.style.display = 'none';
        uiManager.clearError('profileEditErrorMsg');

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const nextEmail = emailInput.value.trim();
        const nextUsername = usernameInput.value.trim();

        try {
          await firebaseDb.patchUserProfile(state.qiko_user_id, { email: nextEmail, username: nextUsername }, state.qiko_token);
          
          const emailHash = await firebaseDb.hashEmail(nextEmail);
          await firebaseDb.saveEmailMapping(emailHash, state.qiko_id, state.qiko_user_id, state.qiko_token);

          await storage.set({
            qiko_email: nextEmail,
            qiko_username: nextUsername
          });

          state.qiko_email = nextEmail;
          state.qiko_username = nextUsername;

          const userDisplay = document.getElementById('dashboard-user-display');
          if (userDisplay) {
            userDisplay.textContent = nextUsername || state.qiko_id;
          }

          if (successMsg) {
            successMsg.style.display = 'flex';
            setTimeout(() => { successMsg.style.display = 'none'; }, 2500);
          }
        } catch (err) {
          console.error("Profile update failed:", err);
          uiManager.showError('profileEditErrorMsg', err.message || "Failed to update profile details.");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      };
    }
  } else {
    if (formEdit) formEdit.classList.add('hide');
    if (formUpgrade) formUpgrade.classList.remove('hide');

    if (state.qiko_token) {
      firebaseAuth.firebaseGetUserData(state.qiko_token).then(async (userInfo) => {
        if (userInfo && userInfo.email) {
          if (userInfo.emailVerified) {
            try {
              await saveIdentityToFirebase(state.qiko_id, state.qiko_user_id, userInfo.email, state.qiko_username, state.qiko_token);
              const sessionState = {
                qiko_registered: true,
                qiko_email: userInfo.email
              };
              await storage.set(sessionState);
              state.qiko_registered = true;
              state.qiko_email = userInfo.email;
              initProfileTab(state, uiManager);
            } catch (err) {
              console.error("Auto-upgrade save failed:", err);
            }
          } else {
            const pendingData = {
              flow: 'upgrade',
              uid: state.qiko_user_id,
              token: state.qiko_token,
              email: userInfo.email,
              username: state.qiko_username || 'Guest',
              qiko_id: state.qiko_id
            };
            await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });
            window.location.href = getRoute('logins', { flow: 'pending_verification' });
          }
        }
      }).catch(async (err) => {
        console.warn("Failed to check user info on profile tab load:", err.message || err);
        if (err.message && (err.message.includes("INVALID_ID_TOKEN") || err.message.includes("USER_NOT_FOUND"))) {
          await storage.clear();
          window.location.href = getRoute('start');
        }
      });
    }

    if (formUpgrade) {
      formUpgrade.onsubmit = async (e) => {
        e.preventDefault();
        uiManager.clearError('profileUpgradeErrorMsg');
        const submitBtn = document.getElementById('btn-profile-upgrade-submit');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Linking...';

        const email = document.getElementById('profile-upgrade-email').value.trim();
        const password = document.getElementById('profile-upgrade-password').value;
        const username = document.getElementById('profile-upgrade-username').value.trim();

        try {
          const emailHash = await firebaseDb.hashEmail(email);
          const inUse = await firebaseDb.isEmailRegistered(emailHash, state.qiko_token);
          if (inUse) {
            throw new Error("This email is already registered. Please sign in instead.");
          }

          const sessionAuth = await firebaseAuth.firebaseLinkEmail(state.qiko_token, email, password);

          const pendingData = {
            flow: 'upgrade',
            uid: state.qiko_user_id,
            token: sessionAuth.idToken,
            email: email,
            username: username,
            qiko_id: state.qiko_id
          };
          await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });

          await firebaseAuth.firebaseSendEmailVerification(sessionAuth.idToken);

          window.location.href = getRoute('logins', { flow: 'pending_verification' });
        } catch (err) {
          console.error("Profile upgrade linking failed:", err);
          if (err.message && (err.message.includes("USER_NOT_FOUND") || err.message.includes("INVALID_ID_TOKEN"))) {
            await uiManager.showCustomAlert("Your session has expired or your guest profile was removed on the server. Redirecting to start...");
            await storage.clear();
            window.location.href = getRoute('start');
            return;
          }
          uiManager.showError('profileUpgradeErrorMsg', err.message || "Failed to upgrade profile.");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register / Link Profile';
        }
      };
    }
  }

  const btnSignOut = document.getElementById('btn-profile-signout');
  if (btnSignOut) {
    btnSignOut.onclick = async () => {
      const confirmSignOut = await uiManager.showCustomConfirm("Would you like to sign out? This will clear local configuration.");
      if (confirmSignOut) {
        try {
          await firebaseDb.updatePresence(state.qiko_user_id, 0, state.qiko_token);
        } catch (e) {
          console.error(e);
        }
        await storage.clear();
        window.location.href = getRoute('start');
      }
    };
  }

  const btnDelete = document.getElementById('btn-profile-delete');
  if (btnDelete) {
    btnDelete.onclick = async () => {
      const confirmDelete = await uiManager.showCustomConfirm("Are you sure you want to permanently delete your Qiko profile and database records? This action is irreversible.");
      if (confirmDelete) {
        btnDelete.disabled = true;
        btnDelete.textContent = 'Deleting...';

        try {
          await firebaseDb.deleteUserProfile(state.qiko_user_id, state.qiko_token);
          await firebaseDb.deleteQikoIdMapping(state.qiko_id, state.qiko_token);

          if (state.qiko_email) {
            const emailHash = await firebaseDb.hashEmail(state.qiko_email);
            await firebaseDb.deleteEmailMapping(emailHash, state.qiko_token);
          }

          if (isRegistered && state.qiko_token) {
            await firebaseAuth.firebaseDeleteAccount(state.qiko_token);
          }

          await storage.clear();
          await uiManager.showCustomAlert("Your Qiko profile has been permanently deleted.");
          window.location.href = getRoute('start');
        } catch (err) {
          console.error("Failed to delete account:", err);
          await uiManager.showCustomAlert(`Failed to delete profile completely: ${err.message}`);
          btnDelete.disabled = false;
          btnDelete.textContent = 'Delete Profile';
        }
      }
    };
  }
}

function initConnectTab(state, uiManager, switchHomeScene) {
  const myIdInput = document.getElementById('connect-my-id');
  if (myIdInput) myIdInput.value = state.qiko_id || '';

  const btnCopyMyId = document.getElementById('btn-connect-copy-my-id');
  if (btnCopyMyId) {
    btnCopyMyId.onclick = () => {
      const tooltip = document.getElementById('connect-copy-tooltip');
      copyToClipboard(state.qiko_id, tooltip);
    };
  }

  const btnCopyLink = document.getElementById('btn-copy-magic-link');
  if (btnCopyLink) {
    btnCopyLink.onclick = () => {
      const inviteUrl = `https://qiko-invite.vercel.app/?id=${state.qiko_id}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        const oldText = btnCopyLink.textContent;
        btnCopyLink.textContent = "Invite Link Copied!";
        btnCopyLink.style.borderColor = "var(--color-primary)";
        setTimeout(() => {
          btnCopyLink.textContent = oldText;
          btnCopyLink.style.borderColor = "";
        }, 2000);
      });
    };
  }

  const btnApply = document.getElementById('btn-connect-apply');
  if (btnApply) {
    btnApply.onclick = async () => {
      const inputEl = document.getElementById('connect-input-id');
      if (!inputEl) return;

      let targetId = inputEl.value.trim();
      if (!targetId) return;

      uiManager.clearError('connectErrorMsg');

      btnApply.disabled = true;
      btnApply.textContent = 'Adding...';

      const success = await addConnection(targetId, state, uiManager, async (addedId) => {
        inputEl.value = '';
        await selectPartner(addedId, state, uiManager, switchHomeScene);
      });

      btnApply.disabled = false;
      btnApply.textContent = 'Add +';
    };
  }
}
