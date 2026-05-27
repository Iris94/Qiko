import { CONFIG } from '../../../Logic/config.js';
import * as firebaseAuth from '../../../Logic/firebase-auth.js';
import * as firebaseDb from '../../../Logic/firebase-db.js';
import * as uiManager from './ui-manager.js';
import * as chatEngine from '../../../Logic/chat-engine.js';

let tempGeneratedId = null;
let tempRegisterEmail = '';
let tempRegisterPassword = '';
let tempRegisterUsername = '';
let tempUid = null;
let tempToken = null;
let tempRefreshToken = null;

const storage = {
  get: async (keys) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    } else {
      const safeParse = (val) => {
        if (val === null) return null;
        try {
          return JSON.parse(val);
        } catch (e) {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        }
      };

      const result = {};
      if (typeof keys === 'string') {
        const val = localStorage.getItem(keys);
        if (val !== null) {
          result[keys] = safeParse(val);
        }
      } else if (Array.isArray(keys)) {
        for (const k of keys) {
          const val = localStorage.getItem(k);
          if (val !== null) {
            result[k] = safeParse(val);
          }
        }
      } else if (typeof keys === 'object' && keys !== null) {
        for (const [k, defaultVal] of Object.entries(keys)) {
          const val = localStorage.getItem(k);
          result[k] = val !== null ? safeParse(val) : defaultVal;
        }
      }
      return result;
    }
  },
  set: async (items) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, resolve);
      });
    } else {
      for (const [k, v] of Object.entries(items)) {
        const strVal = typeof v === 'string' ? v : JSON.stringify(v);
        localStorage.setItem(k, strVal);
      }
    }
  },
  remove: async (key) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve);
      });
    } else {
      localStorage.removeItem(key);
    }
  },
  clear: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.clear(resolve);
      });
    } else {
      localStorage.clear();
    }
  }
};


async function initThemeSwitcher() {
  const state = await storage.get('qiko_theme');
  const currentTheme = state.qiko_theme || 'system';
  applyTheme(currentTheme);

  document.querySelectorAll('.theme-select-dropdown').forEach(select => {
    select.addEventListener('change', async (e) => {
      const selectedValue = e.target.value;
      applyTheme(selectedValue);
      await storage.set({ qiko_theme: selectedValue });
    });
  });

  const btnThemeToggle = document.getElementById('sidebar-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', async () => {
      const s = await storage.get('qiko_theme');
      const current = s.qiko_theme || 'system';
      
      let nextTheme = 'light';
      if (current === 'light') {
        nextTheme = 'dark';
      } else if (current === 'dark') {
        nextTheme = 'system';
      }
      
      applyTheme(nextTheme);
      await storage.set({ qiko_theme: nextTheme });
    });
  }
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  document.querySelectorAll('.theme-select-dropdown').forEach(select => {
    select.value = theme;
  });

  const themeIcon = document.getElementById('theme-icon-svg');
  if (themeIcon) {
    let effectiveDark = false;
    if (theme === 'dark') {
      effectiveDark = true;
    } else if (theme === 'system') {
      effectiveDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (effectiveDark) {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
      themeIcon.setAttribute('title', 'Dark Theme (Click to toggle)');
    } else {
      themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
      themeIcon.setAttribute('title', 'Light Theme (Click to toggle)');
    }
  }
}

function copyToClipboard(text, tooltipElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (tooltipElement) {
      tooltipElement.textContent = "Copied!";
      tooltipElement.classList.add("show-tip");
      setTimeout(() => {
        tooltipElement.classList.remove("show-tip");
        tooltipElement.textContent = "Copy";
      }, 1500);
    }
  }).catch(err => {
    console.error("Failed to copy to clipboard: ", err);
  });
}

function injectFooters() {
  const footerString = "© Qiko 2026 &bull; v0.1 &bull; P2P ENCRYPTED";
  document.querySelectorAll('.footer-text').forEach(el => {
    el.innerHTML = footerString;
  });
}

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  document.querySelectorAll('.status-badge').forEach(badge => {
    if (isOnline) {
      badge.className = 'status-badge';
      badge.innerHTML = '<span class="status-dot"></span> Connected';
    } else {
      badge.className = 'status-badge disconnected';
      badge.innerHTML = '<span class="status-dot"></span> Disconnected';
    }
  });
}

function generateQikoId(sequence) {
  const uuid = crypto.randomUUID();
  const parts = uuid.split('-');
  return `qx-${parts[1]}-${parts[2]}-${sequence}`;
}

async function saveIdentityToFirebase(qikoId, uid, email, username, token) {
  const emailHash = await firebaseDb.hashEmail(email);
  await firebaseDb.saveEmailMapping(emailHash, qikoId, uid, token);
  await firebaseDb.saveQikoIdMapping(qikoId, uid, token);
  const userProfile = {
    qiko_id: qikoId,
    email: email,
    username: username || "",
    current_peer_id: "",
    contacts: []
  };
  await firebaseDb.saveUserProfile(uid, userProfile, token);
}

async function initStartScreen() {
  const pending = await storage.get('qiko_pending_verification');
  if (pending.qiko_pending_verification) {
    window.location.href = "/chat/logins?flow=pending_verification";
    return;
  }

  const state = await storage.get(['qiko_user_id', 'qiko_id']);
  if (state.qiko_user_id) {
    window.location.href = `/chat/dashboard?id=${encodeURIComponent(state.qiko_id || state.qiko_user_id)}`;
    return;
  }

  const btnCreateId = document.getElementById('btn-create-id');
  if (btnCreateId) {
    btnCreateId.addEventListener('click', () => {
      window.location.href = "/chat/logins?flow=create";
    });
  }

  const btnSignId = document.getElementById('btn-sign-id');
  if (btnSignId) {
    btnSignId.addEventListener('click', () => {
      window.location.href = "/chat/logins?flow=signin";
    });
  }
}

async function initLoginsScreen() {
  const urlParams = new URLSearchParams(window.location.search);
  let flow = urlParams.get('flow');

  if (flow === 'pending_verification') {
    uiManager.showSubScreen('screenLoading');
    const pending = await storage.get('qiko_pending_verification');
    if (!pending.qiko_pending_verification) {
      window.location.href = "../index.html";
      return;
    }

    let data;
    try {
      data = JSON.parse(pending.qiko_pending_verification);
    } catch (e) {
      await storage.remove('qiko_pending_verification');
      window.location.href = "../index.html";
      return;
    }

    tempGeneratedId = data.qiko_id;
    tempUid = data.uid;
    tempToken = data.token;
    tempRefreshToken = data.refreshToken;
    tempRegisterEmail = data.email;
    tempRegisterUsername = data.username;

    const emailDisplay = document.getElementById('sent-code-email');
    if (emailDisplay) emailDisplay.textContent = tempRegisterEmail;

    const btnVerifyBack = document.getElementById('btn-verification-back');
    if (btnVerifyBack) {
      btnVerifyBack.textContent = data.flow === 'upgrade' ? "Back to Chat" : "Back to Profile Setup";
    }

    uiManager.showSubScreen('screenVerification');
  } else if (flow === 'create') {
    uiManager.showSubScreen('screenLoading');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = "Securing your connection...";
    
    try {
      const anonymousSession = await firebaseAuth.firebaseSignInAnonymously();
      tempUid = anonymousSession.uid;
      tempToken = anonymousSession.idToken;
      tempRefreshToken = anonymousSession.refreshToken;

      const count = await firebaseDb.fetchAndIncrementUserCount(tempToken);
      const generatedId = generateQikoId(count);
      tempGeneratedId = generatedId;
      
      const idInput = document.getElementById('generated-id-input');
      if (idInput) idInput.value = generatedId;

      uiManager.showSubScreen('screenProfileSetup');
    } catch (err) {
      console.error("Failed to generate ID:", err);
      await uiManager.showCustomAlert("Failed to initialize Qiko ID. Check database connection rules.");
      window.location.href = "../index.html";
    }
  } else if (flow === 'signin') {
    uiManager.showSubScreen('screenSignIn');
  } else if (flow === 'upgrade') {
    uiManager.showSubScreen('screenLoading');
    const existing = await storage.get(['qiko_id', 'qiko_user_id', 'qiko_token']);
    if (!existing.qiko_user_id || !existing.qiko_id) {
      window.location.href = "../index.html";
      return;
    }
    tempGeneratedId = existing.qiko_id;
    tempUid = existing.qiko_user_id;
    tempToken = existing.qiko_token;

    const idInput = document.getElementById('generated-id-input');
    if (idInput) idInput.value = tempGeneratedId;

    const btnSetupBack = document.getElementById('btn-setup-back');
    if (btnSetupBack) {
      btnSetupBack.textContent = "Back to Chat";
      btnSetupBack.onclick = (e) => {
        e.preventDefault();
        window.location.href = `/chat/dashboard?id=${encodeURIComponent(tempGeneratedId)}`;
      };
    }

    const btnSetupSkip = document.getElementById('btn-setup-skip');
    if (btnSetupSkip) btnSetupSkip.classList.add('hide');

    uiManager.showSubScreen('screenProfileSetup');
  } else {
    window.location.href = "/chat";
  }

  const btnCopyId = document.getElementById('btn-copy-id');
  if (btnCopyId) {
    btnCopyId.addEventListener('click', () => {
      const idInput = document.getElementById('generated-id-input');
      const tooltip = document.getElementById('copy-tooltip');
      if (idInput) {
        copyToClipboard(idInput.value, tooltip);
      }
    });
  }

  const btnSetupBack = document.getElementById('btn-setup-back');
  if (btnSetupBack && flow !== 'upgrade') {
    btnSetupBack.addEventListener('click', () => {
      window.location.href = "../index.html";
    });
  }

  const btnSetupSkip = document.getElementById('btn-setup-skip');
  if (btnSetupSkip && flow !== 'upgrade') {
    btnSetupSkip.addEventListener('click', async () => {
      btnSetupSkip.disabled = true;
      btnSetupSkip.textContent = 'Generating...';
      try {
        const userProfile = {
          qiko_id: tempGeneratedId,
          email: "",
          username: "Guest",
          current_peer_id: "",
          contacts: []
        };
        await firebaseDb.saveQikoIdMapping(tempGeneratedId, tempUid, tempToken);
        await firebaseDb.saveUserProfile(tempUid, userProfile, tempToken);

        const guestState = {
          qiko_user_id: tempUid,
          qiko_email: '',
          qiko_username: 'Guest',
          qiko_registered: false,
          qiko_id: tempGeneratedId,
          qiko_token: tempToken,
          qiko_refresh_token: tempRefreshToken
        };
        await storage.set(guestState);
        window.location.href = `/chat/dashboard?id=${encodeURIComponent(tempGeneratedId)}`;
      } catch (err) {
        console.error("Anonymous sign in failed:", err);
        await uiManager.showCustomAlert("Failed to initialize Guest session. Try again.");
        btnSetupSkip.disabled = false;
        btnSetupSkip.textContent = 'Continue';
      }
    });
  }

  const formProfileSetup = document.getElementById('form-profile-setup');
  if (formProfileSetup) {
    formProfileSetup.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('setup-email').value.trim();
      const password = document.getElementById('setup-password').value;
      const username = document.getElementById('setup-username').value.trim();
      
      uiManager.clearError('setupErrorMsg');

      const btnReg = document.getElementById('btn-register');
      btnReg.disabled = true;
      btnReg.textContent = 'Initializing...';

      try {
        const emailHash = await firebaseDb.hashEmail(email);
        const inUse = await firebaseDb.isEmailRegistered(emailHash, tempToken);
        if (inUse) {
          throw new Error("This email is already registered. Please sign in instead.");
        }

        tempRegisterEmail = email;
        tempRegisterPassword = password;
        tempRegisterUsername = username;

        let sessionAuth;
        if (flow === 'upgrade') {
          sessionAuth = await firebaseAuth.firebaseLinkEmail(tempToken, email, password);
        } else {
          sessionAuth = await firebaseAuth.firebaseSignUpWithEmail(email, password);
        }

        tempUid = sessionAuth.uid;
        tempToken = sessionAuth.idToken;
        tempRefreshToken = sessionAuth.refreshToken;

        const pendingData = {
          flow: flow === 'upgrade' ? 'upgrade' : 'create',
          uid: tempUid,
          qiko_id: tempGeneratedId,
          email: tempRegisterEmail,
          username: tempRegisterUsername || 'Guest',
          token: tempToken,
          refreshToken: tempRefreshToken
        };

        await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });
        
        await firebaseAuth.firebaseSendEmailVerification(tempToken);

        const emailDisplay = document.getElementById('sent-code-email');
        if (emailDisplay) emailDisplay.textContent = tempRegisterEmail;

        const btnVerifyBack = document.getElementById('btn-verification-back');
        if (btnVerifyBack) {
          btnVerifyBack.textContent = flow === 'upgrade' ? "Back to Chat" : "Back to Profile Setup";
        }

        uiManager.showSubScreen('screenVerification');
      } catch (err) {
        console.error("Profile Setup Failed:", err);
        uiManager.showError('setupErrorMsg', err.message || "Failed to initialize profile. Try again.");
      } finally {
        btnReg.disabled = false;
        btnReg.textContent = 'Register';
      }
    });
  }

  const btnVerifySubmit = document.getElementById('btn-verify-submit');
  if (btnVerifySubmit) {
    btnVerifySubmit.addEventListener('click', async () => {
      btnVerifySubmit.disabled = true;
      btnVerifySubmit.textContent = 'Checking...';
      uiManager.clearError('verificationErrorMsg');

      try {
        const user = await firebaseAuth.firebaseGetUserData(tempToken);
        if (!user.emailVerified) {
          throw new Error("Email address not verified yet. Please click verification link in your inbox.");
        }

        // Save mappings
        const emailHash = await firebaseDb.hashEmail(tempRegisterEmail);
        await firebaseDb.saveQikoIdMapping(tempGeneratedId, tempUid, tempToken);
        await firebaseDb.saveEmailMapping(emailHash, tempGeneratedId, tempUid, tempToken);

        const userProfile = {
          qiko_id: tempGeneratedId,
          email: tempRegisterEmail,
          username: tempRegisterUsername || 'Guest',
          current_peer_id: "",
          contacts: []
        };
        
        if (flow === 'upgrade') {
          const existingContacts = await firebaseDb.getContacts(tempUid, tempToken);
          userProfile.contacts = existingContacts;
        }

        await firebaseDb.saveUserProfile(tempUid, userProfile, tempToken);

        const activeState = {
          qiko_user_id: tempUid,
          qiko_email: tempRegisterEmail,
          qiko_username: tempRegisterUsername || 'Guest',
          qiko_registered: true,
          qiko_id: tempGeneratedId,
          qiko_token: tempToken,
          qiko_refresh_token: tempRefreshToken
        };
        await storage.set(activeState);
        await storage.remove('qiko_pending_verification');

        await uiManager.showCustomAlert("Profile setup completed successfully!");
        window.location.href = `/chat/dashboard?id=${encodeURIComponent(tempGeneratedId)}`;
      } catch (err) {
        console.error("Verification confirmation check failed:", err);
        uiManager.showError('verificationErrorMsg', err.message || "Failed to confirm verification.");
        btnVerifySubmit.disabled = false;
        btnVerifySubmit.textContent = 'I have verified my email';
      }
    });
  }

  const btnResend = document.getElementById('btn-resend-verification');
  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      btnResend.disabled = true;
      btnResend.textContent = 'Sending...';
      uiManager.clearError('verificationErrorMsg');

      try {
        await firebaseAuth.firebaseSendEmailVerification(tempToken);
        await uiManager.showCustomAlert("Verification email resent. Please check spam folder too.");
      } catch (err) {
        console.error("Resending verification email failed:", err);
        uiManager.showError('verificationErrorMsg', err.message || "Failed to resend verification link.");
      } finally {
        btnResend.disabled = false;
        btnResend.textContent = 'Resend verification email';
      }
    });
  }

  const btnVerifyBack = document.getElementById('btn-verification-back');
  if (btnVerifyBack) {
    btnVerifyBack.addEventListener('click', async () => {
      if (flow === 'upgrade') {
        await storage.remove('qiko_pending_verification');
        window.location.href = `/chat/dashboard?id=${encodeURIComponent(tempGeneratedId)}`;
      } else {
        const confirmed = await uiManager.showCustomConfirm("Going back will clear your pending credentials. Are you sure?");
        if (!confirmed) return;

        uiManager.showSubScreen('screenLoading');
        try {
          await firebaseAuth.firebaseUnlinkEmail(tempToken);
          await storage.remove('qiko_pending_verification');
          
          const idInput = document.getElementById('generated-id-input');
          if (idInput) idInput.value = tempGeneratedId;

          uiManager.showSubScreen('screenProfileSetup');
        } catch (err) {
          console.error("Rollback of registration failed:", err);
          await storage.remove('qiko_pending_verification');
          window.location.href = "../index.html";
        }
      }
    });
  }

  const formSignIn = document.getElementById('form-sign-in');
  if (formSignIn) {
    formSignIn.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      
      uiManager.clearError('signinErrorMsg');

      const btnSignInSubmit = document.getElementById('btn-signin-submit');
      btnSignInSubmit.disabled = true;
      btnSignInSubmit.textContent = 'Signing in...';

      try {
        const sessionAuth = await firebaseAuth.firebaseSignInWithEmail(email, password);
        const uid = sessionAuth.uid;
        const token = sessionAuth.idToken;
        const refreshToken = sessionAuth.refreshToken;

        const userProfile = await firebaseDb.getUserProfile(uid, token);
        if (!userProfile || !userProfile.qiko_id) {
          throw new Error("Unable to retrieve Qiko ID associated with this account.");
        }

        const activeState = {
          qiko_user_id: uid,
          qiko_email: email,
          qiko_username: userProfile.username || 'Guest',
          qiko_registered: true,
          qiko_id: userProfile.qiko_id,
          qiko_token: token,
          qiko_refresh_token: refreshToken
        };
        await storage.set(activeState);

        window.location.href = `/chat/dashboard?id=${encodeURIComponent(userProfile.qiko_id)}`;
      } catch (err) {
        console.error("Sign in failed:", err);
        uiManager.showError('signinErrorMsg', err.message || "Invalid credentials. Try again.");
      } finally {
        btnSignInSubmit.disabled = false;
        btnSignInSubmit.textContent = 'Sign In';
      }
    });
  }

  const btnBackToStart = document.getElementById('btn-back-to-start');
  if (btnBackToStart) {
    btnBackToStart.addEventListener('click', () => {
      window.location.href = "/chat";
    });
  }
}

async function initDashboardScreen() {
  const state = await storage.get(['qiko_user_id', 'qiko_email', 'qiko_username', 'qiko_id', 'qiko_registered', 'qiko_token', 'qiko_refresh_token']);
  if (!state.qiko_user_id) {
    window.location.href = "../index.html";
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

  async function lookupProfileByQikoId(qikoId) {
    try {
      const uid = await firebaseDb.getUidByQikoId(qikoId, state.qiko_token);
      if (!uid) return null;
      const profile = await firebaseDb.getUserProfile(uid, state.qiko_token);
      return profile;
    } catch (err) {
      console.error("Failed to lookup profile for Qiko ID:", qikoId, err);
      return null;
    }
  }

  async function loadAndRenderContacts() {
    try {
      const contacts = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);
      const resolved = [];
      
      for (const contactId of contacts) {
        let displayName = contactId;
        let isOnline = false;
        
        const profile = await lookupProfileByQikoId(contactId);
        if (profile) {
          displayName = (profile.username && profile.username !== 'Guest') ? profile.username : contactId;
          const lastSeen = profile.last_seen || 0;
          isOnline = (Date.now() - lastSeen) < 120000;
        }
        resolved.push({ id: contactId, displayName, isOnline });
      }
      
      uiManager.renderContacts(resolved, state.qiko_active_partner, async (selectedPartnerId) => {
        state.qiko_active_partner = selectedPartnerId;
        await storage.set({ qiko_active_partner: selectedPartnerId });
        
        const chatPartnerName = document.getElementById('chat-partner-name');
        if (chatPartnerName) {
          const selectedContact = resolved.find(c => c.id === selectedPartnerId);
          const nameToDisplay = selectedContact ? selectedContact.displayName : selectedPartnerId;
          chatPartnerName.textContent = `— ${nameToDisplay} —`;
        }
        
        const historyKey = `qiko_history_${selectedPartnerId}`;
        const historyData = await storage.get(historyKey);
        const history = historyData[historyKey] || [];
        uiManager.renderChatLog(history, state.qiko_id);
      });
    } catch (err) {
      console.error("Failed to load and render contacts:", err);
    }
  }

  async function selectPartner(partnerId) {
    state.qiko_active_partner = partnerId;
    if (btnNavHome && sceneHome) {
      switchScene(btnNavHome, sceneHome);
    }
    await loadAndRenderContacts();

    const chatPartnerName = document.getElementById('chat-partner-name');
    if (chatPartnerName) {
      chatPartnerName.textContent = `— ${partnerId} —`;
      const profile = await lookupProfileByQikoId(partnerId);
      if (profile) {
        const nameToUse = profile.username && profile.username !== 'Guest' ? profile.username : partnerId;
        chatPartnerName.textContent = `— ${nameToUse} —`;
      }
    }

    const historyKey = `qiko_history_${partnerId}`;
    const historyData = await storage.get(historyKey);
    const history = historyData[historyKey] || [];
    uiManager.renderChatLog(history, state.qiko_id);
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ qiko_popup_open: true });
  }

  // Initialize Chat Engine (PeerJS)
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // Chrome Extension context: Offscreen Document manages PeerJS WebRTC
    chrome.runtime.sendMessage({ type: 'CHECK_OFFSCREEN' });
  } else {
    // Fallback context: Initialize PeerJS in-page
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
            
            // Auto-add to contacts if not already present
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
            
            await loadAndRenderContacts();
            
            if (state.qiko_active_partner === senderId) {
              uiManager.renderChatLog(history, state.qiko_id);
            } else if (!state.qiko_active_partner) {
              await selectPartner(senderId);
            }
          }
        },
        onConnectionStateChange: (peerId, status, err) => {
          console.log(`P2P Status with ${peerId}:`, status);
          loadAndRenderContacts();
        }
      });
    } catch (err) {
      console.error("Failed to initialize PeerJS chat engine in-page:", err);
    }
  }

  const activePartnerRes = await storage.get('qiko_active_partner');
  if (activePartnerRes.qiko_active_partner) {
    await selectPartner(activePartnerRes.qiko_active_partner);
  } else {
    await loadAndRenderContacts();
  }

  if (btnNavHome) {
    btnNavHome.addEventListener('click', async () => {
      switchScene(btnNavHome, sceneHome);
      await loadAndRenderContacts();
    });
  }
  if (btnNavProfile) {
    btnNavProfile.addEventListener('click', () => {
      switchScene(btnNavProfile, sceneProfile);
      initProfileTab(state);
    });
  }
  if (btnNavConnect) {
    btnNavConnect.addEventListener('click', () => {
      switchScene(btnNavConnect, sceneConnect);
      initConnectTab(state);
    });
  }

  const btnConnectHeader = document.getElementById('btn-connect');
  if (btnConnectHeader) {
    btnConnectHeader.addEventListener('click', () => {
      switchScene(btnNavConnect, sceneConnect);
      initConnectTab(state);
    });
  }

  // Remove Connection Handler
  const btnRemoveConn = document.getElementById('btn-remove-connection');
  if (btnRemoveConn) {
    btnRemoveConn.addEventListener('click', async () => {
      const partnerId = state.qiko_active_partner;
      if (!partnerId) return;

      const confirmed = await uiManager.showCustomConfirm(`Are you sure you want to remove the connection with ${partnerId}?`);
      if (!confirmed) return;

      btnRemoveConn.disabled = true;
      btnRemoveConn.textContent = 'Removing...';

      try {
        const contacts = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);
        const newList = contacts.filter(id => id !== partnerId);
        await firebaseDb.updateContacts(state.qiko_user_id, newList, state.qiko_token);

        state.qiko_active_partner = null;
        await storage.remove('qiko_active_partner');

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

        await loadAndRenderContacts();
        await uiManager.showCustomAlert(`Successfully removed ${partnerId} from contacts.`);
      } catch (err) {
        console.error("Failed to remove connection:", err);
        await uiManager.showCustomAlert(err.message || "Failed to remove connection.");
      } finally {
        btnRemoveConn.disabled = false;
        btnRemoveConn.textContent = 'Remove';
      }
    });
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

      // Success: Save message to history and render
      const historyKey = `qiko_history_${partnerId}`;
      const historyData = await storage.get(historyKey);
      const history = historyData[historyKey] || [];
      history.push(sentMsg);
      if (history.length > 100) history.shift();
      await storage.set({ [historyKey]: history });
      uiManager.renderChatLog(history, state.qiko_id);

    } catch (err) {
      console.warn("P2P transmission failed (peer offline):", err);

      // Show temporary warning in UI without persisting to storage
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

  // Chrome Storage listener for background updates
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.qiko_user_id && !changes.qiko_user_id.newValue) {
        window.location.href = "/chat";
        return;
      }
      if (changes.qiko_token) {
        state.qiko_token = changes.qiko_token.newValue;
      }
      if (changes.qiko_refresh_token) {
        state.qiko_refresh_token = changes.qiko_refresh_token.newValue;
      }
      if (changes.qiko_contacts_updated) {
        await loadAndRenderContacts();
      }

      // Auto-select active partner if a message is received while none is active
      if (!state.qiko_active_partner) {
        const historyKeyPrefix = 'qiko_history_';
        for (const key of Object.keys(changes)) {
          if (key.startsWith(historyKeyPrefix)) {
            const changedSenderId = key.substring(historyKeyPrefix.length);
            if (changedSenderId) {
              await selectPartner(changedSenderId);
              break;
            }
          }
        }
      }

      if (changes.qiko_active_partner && changes.qiko_active_partner.newValue) {
        await selectPartner(changes.qiko_active_partner.newValue);
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

  // Presence / Pinging every 60s
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

function initProfileTab(state) {
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
              initProfileTab(state);
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
            window.location.href = "/chat/logins?flow=pending_verification";
          }
        }
      }).catch(async (err) => {
        console.warn("Failed to check user info on profile tab load:", err.message || err);
        if (err.message && err.message.includes("INVALID_ID_TOKEN")) {
          await storage.remove('qiko_token');
          state.qiko_token = null;
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

          window.location.href = "/chat/logins?flow=pending_verification";
        } catch (err) {
          console.error("Profile upgrade linking failed:", err);
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
        window.location.href = "/chat";
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
          window.location.href = "/chat";
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

function initConnectTab(state) {
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

      try {
        if (targetId.includes('@')) {
          const emailHash = await firebaseDb.hashEmail(targetId);
          const resolvedQikoId = await firebaseDb.getQikoIdByEmail(emailHash, state.qiko_token);
          if (!resolvedQikoId) {
            throw new Error(`No user found registered with email: ${targetId}`);
          }
          targetId = resolvedQikoId;
        }

        if (targetId === state.qiko_id) {
          throw new Error("You cannot add your own Qiko ID/email.");
        }

        const targetUid = await firebaseDb.getUidByQikoId(targetId, state.qiko_token);
        if (!targetUid) {
          throw new Error(`User not found with Qiko ID: ${targetId}`);
        }

        const contactsList = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);

        if (contactsList.length >= 5) {
          throw new Error("You can only have a maximum of 5 contacts currently. Please remove an existing connection first.");
        }

        if (contactsList.includes(targetId)) {
          throw new Error(`Connection ${targetId} is already in your contacts.`);
        }

        contactsList.push(targetId);
        await firebaseDb.updateContacts(state.qiko_user_id, contactsList, state.qiko_token);

        inputEl.value = '';
        await uiManager.showCustomAlert(`Successfully added ${targetId} to your contacts!`);

        state.qiko_active_partner = targetId;
        await storage.set({ qiko_active_partner: targetId });
        window.location.href = `/chat/dashboard?id=${encodeURIComponent(state.qiko_id || '')}`;
      } catch (err) {
        console.error("Failed to add connection:", err);
        uiManager.showError('connectErrorMsg', err.message || "Failed to add connection.");
      } finally {
        btnApply.disabled = false;
        btnApply.textContent = 'Add +';
      }
    };
  }
}

function initPasswordToggles() {
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      } else {
        input.type = 'password';
        btn.innerHTML = `<svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    };
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
    chrome.runtime.connect({ name: "qiko_popup" });
  }
  initPasswordToggles();
  await initThemeSwitcher();
  injectFooters();
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  const path = window.location.pathname;

  const pending = await storage.get('qiko_pending_verification');
  if (pending.qiko_pending_verification && !path.includes('/logins')) {
    window.location.href = "/chat/logins?flow=pending_verification";
    return;
  }

  if (path.includes('/dashboard')) {
    initDashboardScreen();
  } else if (path.includes('/logins')) {
    initLoginsScreen();
  } else {
    initStartScreen();
  }
});
