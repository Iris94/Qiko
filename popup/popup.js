import { CONFIG } from '../config.js';

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
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        const val = localStorage.getItem(k);
        if (val === 'true') result[k] = true;
        else if (val === 'false') result[k] = false;
        else result[k] = val;
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
        localStorage.setItem(k, v);
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

function showCustomAlert(message) {
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

function showCustomConfirm(message) {
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

async function hashSHA256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashEmail(email) {
  return hashSHA256(email.trim().toLowerCase());
}

function generateQikoId(sequence) {
  const uuid = crypto.randomUUID();
  const parts = uuid.split('-');
  return `qx-${parts[1]}-${parts[2]}-${sequence}`;
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

function showSubScreen(screenId) {
  const screens = ['screen-loading', 'screen-profile-setup', 'screen-verification', 'screen-sign-in'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.remove('hide');
      } else {
        el.classList.add('hide');
      }
    }
  });
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

async function firebaseSignInAnonymously() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Anonymous registration failed.");
  }
  const data = await response.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

async function firebaseSignUpWithEmail(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      password: password,
      returnSecureToken: true
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Firebase registration failed.");
  }
  const data = await response.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

async function firebaseLinkEmail(idToken, email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: idToken,
      email: email,
      password: password,
      returnSecureToken: true
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to link email credential.");
  }
  const data = await response.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

async function firebaseSendEmailVerification(idToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "VERIFY_EMAIL",
      idToken: idToken
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to trigger verification email.");
  }
  return await response.json();
}

async function firebaseGetUserData(idToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: idToken })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to fetch user verification details.");
  }
  const data = await response.json();
  if (!data.users || data.users.length === 0) {
    throw new Error("User record not found.");
  }
  return data.users[0];
}

async function firebaseSignInWithEmail(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      password: password,
      returnSecureToken: true
    })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to authenticate credentials.");
  }
  const data = await response.json();
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

async function firebaseDeleteAccount(idToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: idToken })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to delete credentials from Authentication server.");
  }
  return await response.json();
}

async function fetchAndIncrementUserCount() {
  const url = `${CONFIG.FIREBASE_DB_URL}/user_count.json`;
  
  const getResponse = await fetch(url);
  if (!getResponse.ok) {
    throw new Error(`Failed to retrieve user count: ${getResponse.statusText}`);
  }
  const currentCount = await getResponse.json();
  const count = currentCount === null ? 0 : Number(currentCount);
  
  const nextCount = count + 1;
  
  const putResponse = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextCount)
  });
  
  if (!putResponse.ok) {
    throw new Error(`Failed to update user count: ${putResponse.statusText}`);
  }
  
  return nextCount;
}

async function isEmailRegistered(emailHash) {
  const url = `${CONFIG.FIREBASE_DB_URL}/emails/${emailHash}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Database check failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data !== null;
}

async function saveIdentityToFirebase(qikoId, uid, email, username) {
  const emailHash = await hashEmail(email);
  
  const emailUrl = `${CONFIG.FIREBASE_DB_URL}/emails/${emailHash}.json`;
  const emailRes = await fetch(emailUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qiko_user_id: qikoId, uid: uid })
  });
  if (!emailRes.ok) {
    throw new Error("Failed to register email mapping in database.");
  }
  
  const idUrl = `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${qikoId}.json`;
  const idRes = await fetch(idUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(uid)
  });
  if (!idRes.ok) {
    throw new Error("Failed to register Qiko ID registry in database.");
  }
  
  const userUrl = `${CONFIG.FIREBASE_DB_URL}/users/${uid}.json`;
  const userProfile = {
    qiko_id: qikoId,
    email: email,
    username: username || "",
    current_peer_id: "",
    contacts: []
  };
  const userRes = await fetch(userUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userProfile)
  });
  if (!userRes.ok) {
    throw new Error("Failed to save profile credentials in database.");
  }
}

async function saveGuestProfileToFirebase(qikoId, uid) {
  const idUrl = `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${qikoId}.json`;
  const idRes = await fetch(idUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(uid)
  });
  if (!idRes.ok) {
    throw new Error("Failed to register Guest Qiko ID in database.");
  }

  const userUrl = `${CONFIG.FIREBASE_DB_URL}/users/${uid}.json`;
  const userProfile = {
    qiko_id: qikoId,
    email: "",
    username: "Guest",
    current_peer_id: "",
    contacts: []
  };
  const userRes = await fetch(userUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userProfile)
  });
  if (!userRes.ok) {
    throw new Error("Failed to save Guest profile details.");
  }
}

async function initStartScreen() {
  const pending = await storage.get('qiko_pending_verification');
  if (pending.qiko_pending_verification) {
    window.location.href = "screens/logins.html?flow=pending_verification";
    return;
  }

  const state = await storage.get(['qiko_user_id']);
  if (state.qiko_user_id) {
    window.location.href = "screens/dashboard.html";
    return;
  }

  const btnCreateId = document.getElementById('btn-create-id');
  if (btnCreateId) {
    btnCreateId.addEventListener('click', () => {
      window.location.href = "screens/logins.html?flow=create";
    });
  }

  const btnSignId = document.getElementById('btn-sign-id');
  if (btnSignId) {
    btnSignId.addEventListener('click', () => {
      window.location.href = "screens/logins.html?flow=signin";
    });
  }
}

async function initLoginsScreen() {
  const urlParams = new URLSearchParams(window.location.search);
  let flow = urlParams.get('flow');

  if (flow === 'pending_verification') {
    showSubScreen('screen-loading');
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

    showSubScreen('screen-verification');
  } else if (flow === 'create') {
    showSubScreen('screen-loading');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = "Securing your connection...";
    
    try {
      const count = await fetchAndIncrementUserCount();
      const generatedId = generateQikoId(count);
      tempGeneratedId = generatedId;
      
      const idInput = document.getElementById('generated-id-input');
      if (idInput) idInput.value = generatedId;

      showSubScreen('screen-profile-setup');
    } catch (err) {
      console.error("Failed to generate ID:", err);
      await showCustomAlert("Failed to initialize Qiko ID. Check database connection rules.");
      window.location.href = "../index.html";
    }
  } else if (flow === 'signin') {
    showSubScreen('screen-sign-in');
  } else if (flow === 'upgrade') {
    showSubScreen('screen-loading');
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
        window.location.href = "dashboard.html";
      };
    }

    const btnSetupSkip = document.getElementById('btn-setup-skip');
    if (btnSetupSkip) btnSetupSkip.classList.add('hide');

    showSubScreen('screen-profile-setup');
  } else {
    window.location.href = "../index.html";
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
        const anonymousSession = await firebaseSignInAnonymously();
        await saveGuestProfileToFirebase(tempGeneratedId, anonymousSession.uid);

        const guestState = {
          qiko_user_id: anonymousSession.uid,
          qiko_email: '',
          qiko_username: 'Guest',
          qiko_registered: false,
          qiko_id: tempGeneratedId,
          qiko_token: anonymousSession.idToken,
          qiko_refresh_token: anonymousSession.refreshToken
        };
        await storage.set(guestState);
        window.location.href = "dashboard.html";
      } catch (err) {
        console.error("Anonymous sign in failed:", err);
        await showCustomAlert("Failed to initialize Guest session. Try again.");
        btnSetupSkip.disabled = false;
        btnSetupSkip.textContent = 'Continue without registering';
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
      const errorMsgEl = document.getElementById('setup-error-msg');

      if (errorMsgEl) {
        errorMsgEl.classList.add('hide');
        errorMsgEl.textContent = '';
      }

      const btnReg = document.getElementById('btn-register');
      btnReg.disabled = true;
      btnReg.textContent = 'Initializing...';

      try {
        const emailHash = await hashEmail(email);
        const inUse = await isEmailRegistered(emailHash);
        if (inUse) {
          throw new Error("This email is already registered. Please sign in instead.");
        }

        tempRegisterEmail = email;
        tempRegisterPassword = password;
        tempRegisterUsername = username;

        let sessionAuth;
        if (flow === 'upgrade') {
          sessionAuth = await firebaseLinkEmail(tempToken, email, password);
        } else {
          sessionAuth = await firebaseSignUpWithEmail(email, password);
        }

        tempUid = sessionAuth.uid;
        tempToken = sessionAuth.idToken;
        tempRefreshToken = sessionAuth.refreshToken;

        const pendingData = {
          flow: flow === 'upgrade' ? 'upgrade' : 'create',
          uid: tempUid,
          token: tempToken,
          refreshToken: tempRefreshToken,
          email: tempRegisterEmail,
          username: tempRegisterUsername,
          qiko_id: tempGeneratedId
        };
        await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });

        await firebaseSendEmailVerification(tempToken);

        const emailDisplay = document.getElementById('sent-code-email');
        if (emailDisplay) emailDisplay.textContent = email;

        showSubScreen('screen-verification');
        
      } catch (err) {
        console.error("Registration initiation failed: ", err);
        if (errorMsgEl) {
          errorMsgEl.textContent = err.message || "An error occurred. Please try again.";
          errorMsgEl.classList.remove('hide');
        }
      } finally {
        btnReg.disabled = false;
        btnReg.textContent = 'Register';
      }
    });
  }

  const btnVerifyBack = document.getElementById('btn-verification-back');
  if (btnVerifyBack) {
    btnVerifyBack.addEventListener('click', async () => {
      await storage.remove('qiko_pending_verification');

      const guest = await storage.get('qiko_user_id');
      if (guest.qiko_user_id) {
        window.location.href = "dashboard.html";
      } else {
        showSubScreen('screen-profile-setup');
      }
    });
  }

  const btnResend = document.getElementById('btn-resend-verification');
  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      btnResend.disabled = true;
      btnResend.textContent = 'Sending...';
      try {
        await firebaseSendEmailVerification(tempToken);
        await showCustomAlert("Verification link resent! Please check your email inbox.");
      } catch (err) {
        await showCustomAlert(err.message || "Failed to resend. Please try again shortly.");
      } finally {
        btnResend.disabled = false;
        btnResend.textContent = 'Resend verification email';
      }
    });
  }

  const btnVerifySubmit = document.getElementById('btn-verify-submit');
  if (btnVerifySubmit) {
    btnVerifySubmit.addEventListener('click', async () => {
      const errorMsgEl = document.getElementById('verification-error-msg');

      if (errorMsgEl) {
        errorMsgEl.classList.add('hide');
        errorMsgEl.textContent = '';
      }

      btnVerifySubmit.disabled = true;
      btnVerifySubmit.textContent = 'Checking verification...';

      try {
        const details = await firebaseGetUserData(tempToken);
        
        if (!details.emailVerified) {
          throw new Error("Your email address is not verified yet. Please check your inbox and click the verification link.");
        }

        await saveIdentityToFirebase(tempGeneratedId, tempUid, tempRegisterEmail, tempRegisterUsername);

        const sessionState = {
          qiko_user_id: tempUid,
          qiko_email: tempRegisterEmail,
          qiko_username: tempRegisterUsername || 'Guest',
          qiko_registered: true,
          qiko_id: tempGeneratedId,
          qiko_token: tempToken,
          qiko_refresh_token: tempRefreshToken
        };
        await storage.set(sessionState);

        await storage.remove('qiko_pending_verification');

        window.location.href = "dashboard.html";
      } catch (err) {
        console.error("Verification verification failed: ", err);
        if (errorMsgEl) {
          errorMsgEl.textContent = err.message || "Failed to verify. Make sure you clicked the email link.";
          errorMsgEl.classList.remove('hide');
        }
        btnVerifySubmit.disabled = false;
        btnVerifySubmit.textContent = 'I have verified my email';
      }
    });
  }

  const btnBackToStart = document.getElementById('btn-back-to-start');
  if (btnBackToStart) {
    btnBackToStart.addEventListener('click', () => {
      window.location.href = "../index.html";
    });
  }

  const formSignIn = document.getElementById('form-sign-in');
  if (formSignIn) {
    formSignIn.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;
      const errorMsgEl = document.getElementById('signin-error-msg');

      if (errorMsgEl) {
        errorMsgEl.classList.add('hide');
        errorMsgEl.textContent = '';
      }

      const btnSubmit = document.getElementById('btn-signin-submit');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Signing In...';
      }

      try {
        const sessionAuth = await firebaseSignInWithEmail(email, password);
        
        const userUrl = `${CONFIG.FIREBASE_DB_URL}/users/${sessionAuth.uid}.json`;
        const profileRes = await fetch(userUrl);
        if (!profileRes.ok) {
          throw new Error("Failed to retrieve user profile from database.");
        }
        let profile = await profileRes.json();
        if (!profile) {
          const count = await fetchAndIncrementUserCount();
          const newQikoId = generateQikoId(count);
          await saveIdentityToFirebase(newQikoId, sessionAuth.uid, email, "Guest");
          profile = {
            qiko_id: newQikoId,
            email: email,
            username: "Guest"
          };
        }
        
        const signInState = {
          qiko_user_id: sessionAuth.uid,
          qiko_email: email,
          qiko_username: profile.username || 'Guest',
          qiko_registered: true,
          qiko_id: profile.qiko_id,
          qiko_token: sessionAuth.idToken,
          qiko_refresh_token: sessionAuth.refreshToken
        };

        await storage.set(signInState);
        window.location.href = "dashboard.html";
      } catch (err) {
        console.error("Authentication failed: ", err);
        if (errorMsgEl) {
          errorMsgEl.textContent = err.message || "Failed to sign in. Please verify credentials.";
          errorMsgEl.classList.remove('hide');
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Sign In';
        }
      }
    });
  }
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
        const errorMsg = document.getElementById('profile-edit-error-msg');
        const saveBtn = document.getElementById('btn-profile-save');

        if (successMsg) successMsg.style.display = 'none';
        if (errorMsg) {
          errorMsg.classList.add('hide');
          errorMsg.textContent = '';
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const nextEmail = emailInput.value.trim();
        const nextUsername = usernameInput.value.trim();

        try {
          const userUrl = `${CONFIG.FIREBASE_DB_URL}/users/${state.qiko_user_id}.json`;
          const patchRes = await fetch(userUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: nextEmail, username: nextUsername })
          });
          if (!patchRes.ok) throw new Error("Failed to update profile nodes in DB.");

          const emailHash = await hashEmail(nextEmail);
          const emailUrl = `${CONFIG.FIREBASE_DB_URL}/emails/${emailHash}.json`;
          await fetch(emailUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qiko_user_id: state.qiko_id, uid: state.qiko_user_id })
          });

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
          if (errorMsg) {
            errorMsg.textContent = err.message || "Failed to update profile details.";
            errorMsg.classList.remove('hide');
          }
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      };
    }
  } else {
    if (formEdit) formEdit.classList.add('hide');
    if (formUpgrade) formUpgrade.classList.remove('hide');

    if (formUpgrade) {
      formUpgrade.onsubmit = async (e) => {
        e.preventDefault();
        const errorMsg = document.getElementById('profile-upgrade-error-msg');
        const submitBtn = document.getElementById('btn-profile-upgrade-submit');

        if (errorMsg) {
          errorMsg.classList.add('hide');
          errorMsg.textContent = '';
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Linking...';

        const email = document.getElementById('profile-upgrade-email').value.trim();
        const password = document.getElementById('profile-upgrade-password').value;
        const username = document.getElementById('profile-upgrade-username').value.trim();

        try {
          const emailHash = await hashEmail(email);
          const inUse = await isEmailRegistered(emailHash);
          if (inUse) {
            throw new Error("This email is already registered. Please sign in instead.");
          }

          const sessionAuth = await firebaseLinkEmail(state.qiko_token, email, password);

          const pendingData = {
            flow: 'upgrade',
            uid: state.qiko_user_id,
            token: sessionAuth.idToken,
            email: email,
            username: username,
            qiko_id: state.qiko_id
          };
          await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });

          await firebaseSendEmailVerification(sessionAuth.idToken);

          window.location.href = "logins.html?flow=pending_verification";

        } catch (err) {
          console.error("Profile upgrade linking failed:", err);
          if (errorMsg) {
            errorMsg.textContent = err.message || "Failed to upgrade profile.";
            errorMsg.classList.remove('hide');
          }
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
      const confirmSignOut = await showCustomConfirm("Would you like to sign out? This will clear local configuration.");
      if (confirmSignOut) {
        try {
          const url = `${CONFIG.FIREBASE_DB_URL}/users/${state.qiko_user_id}/last_seen.json?auth=${state.qiko_token}`;
          await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: "0"
          });
        } catch (e) {
          console.error(e);
        }
        await storage.clear();
        window.location.href = "../index.html";
      }
    };
  }

  const btnDelete = document.getElementById('btn-profile-delete');
  if (btnDelete) {
    btnDelete.onclick = async () => {
      const confirmDelete = await showCustomConfirm("Are you sure you want to permanently delete your Qiko profile and database records? This action is irreversible.");
      if (confirmDelete) {
        btnDelete.disabled = true;
        btnDelete.textContent = 'Deleting...';

        try {
          const userUrl = `${CONFIG.FIREBASE_DB_URL}/users/${state.qiko_user_id}.json`;
          await fetch(userUrl, { method: "DELETE" });

          const idUrl = `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${state.qiko_id}.json`;
          await fetch(idUrl, { method: "DELETE" });

          if (state.qiko_email) {
            const emailHash = await hashEmail(state.qiko_email);
            const emailUrl = `${CONFIG.FIREBASE_DB_URL}/emails/${emailHash}.json`;
            await fetch(emailUrl, { method: "DELETE" });
          }

          if (isRegistered && state.qiko_token) {
            await firebaseDeleteAccount(state.qiko_token);
          }

          await storage.clear();
          await showCustomAlert("Your Qiko profile has been permanently deleted.");
          window.location.href = "../index.html";

        } catch (err) {
          console.error("Failed to delete account:", err);
          await showCustomAlert(`Failed to delete profile completely: ${err.message}`);
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
      const errorMsg = document.getElementById('connect-error-msg');
      if (!inputEl) return;

      const targetId = inputEl.value.trim();
      if (!targetId) return;

      if (errorMsg) {
        errorMsg.classList.add('hide');
        errorMsg.textContent = '';
      }

      btnApply.disabled = true;
      btnApply.textContent = 'Adding...';

      try {
        if (targetId === state.qiko_id) {
          throw new Error("You cannot add your own Qiko ID.");
        }

        const lookupUrl = `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${targetId}.json`;
        const res = await fetch(lookupUrl);
        if (!res.ok) throw new Error("Database lookups failed.");
        const targetUid = await res.json();

        if (!targetUid) {
          throw new Error(`User not found with Qiko ID: ${targetId}`);
        }

        const contactsUrl = `${CONFIG.FIREBASE_DB_URL}/users/${state.qiko_user_id}/contacts.json`;
        const contactsRes = await fetch(contactsUrl);
        let contactsList = [];
        if (contactsRes.ok) {
          const list = await contactsRes.json();
          contactsList = list || [];
        }

        if (contactsList.includes(targetId)) {
          throw new Error(`Qiko ID ${targetId} is already in your contacts.`);
        }

        contactsList.push(targetId);

        const updateRes = await fetch(contactsUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactsList)
        });
        if (!updateRes.ok) throw new Error("Failed to update contacts database.");

        inputEl.value = '';
        await showCustomAlert(`Successfully added ${targetId} to your contacts!`);

      } catch (err) {
        console.error("Failed to add connection:", err);
        if (errorMsg) {
          errorMsg.textContent = err.message || "Failed to add connection.";
          errorMsg.classList.remove('hide');
        }
      } finally {
        btnApply.disabled = false;
        btnApply.textContent = 'Add +';
      }
    };
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

  if (btnNavHome) {
    btnNavHome.addEventListener('click', () => switchScene(btnNavHome, sceneHome));
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

  const activeChatsBar = document.getElementById('active-chats-bar');
  const activeChatsList = document.getElementById('active-chats-list');
  const chatEmptyState = document.getElementById('chat-empty-state');
  const chatMainSection = document.getElementById('chat-main-section');
  const chatPartnerName = document.getElementById('chat-partner-name');
  const chatLog = document.getElementById('chat-messages-log');

  function renderChatLog(messages) {
    if (!chatLog) return;
    chatLog.innerHTML = '';

    if (messages.length === 0) {
      chatLog.innerHTML = `
        <div class="msg-time">System</div>
        <div class="msg-bubble received">No messages yet. Send a message to start chatting!</div>
      `;
      return;
    }

    let lastTime = null;
    messages.forEach(msg => {
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (lastTime !== timeStr) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = timeStr;
        chatLog.appendChild(timeDiv);
        lastTime = timeStr;
      }

      const bubble = document.createElement('div');
      bubble.className = `msg-bubble ${msg.received ? 'received' : 'sent'}`;
      bubble.textContent = msg.text;
      chatLog.appendChild(bubble);
    });

    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function lookupProfileByQikoId(qikoId) {
    try {
      const idRes = await fetch(`${CONFIG.FIREBASE_DB_URL}/qiko_ids/${qikoId}.json`);
      if (!idRes.ok) return null;
      const uid = await idRes.json();
      if (!uid) return null;

      const userRes = await fetch(`${CONFIG.FIREBASE_DB_URL}/users/${uid}.json`);
      if (!userRes.ok) return null;
      const user = await userRes.json();
      return user;
    } catch (err) {
      console.error("Failed to lookup profile for Qiko ID:", qikoId, err);
      return null;
    }
  }

  async function renderContacts() {
    try {
      const contactsUrl = `${CONFIG.FIREBASE_DB_URL}/users/${state.qiko_user_id}/contacts.json`;
      const res = await fetch(contactsUrl);
      if (!res.ok) throw new Error("Failed to load contacts.");
      const contacts = await res.json() || [];

      if (contacts.length === 0) {
        if (activeChatsBar) activeChatsBar.classList.add('hide');
        if (chatMainSection) chatMainSection.classList.add('hide');
        if (chatEmptyState) {
          chatEmptyState.classList.remove('hide');
          const emptyTitle = chatEmptyState.querySelector('.empty-title');
          const emptySubtitle = chatEmptyState.querySelector('.empty-subtitle');
          if (emptyTitle) emptyTitle.textContent = "No connections currently";
          if (emptySubtitle) emptySubtitle.textContent = "Add them by clicking connect button or by clicking + button in sidebar.";
        }
      } else {
        if (activeChatsBar) activeChatsBar.classList.remove('hide');
        if (activeChatsList) activeChatsList.innerHTML = '';
        if (chatMainSection) chatMainSection.classList.add('hide');
        if (chatEmptyState) {
          chatEmptyState.classList.remove('hide');
          const emptyTitle = chatEmptyState.querySelector('.empty-title');
          const emptySubtitle = chatEmptyState.querySelector('.empty-subtitle');
          if (emptyTitle) emptyTitle.textContent = "Choose Connection";
          if (emptySubtitle) emptySubtitle.textContent = "Select a contact from the bar above to start direct messaging.";
        }

        contacts.forEach((contactId, index) => {
          const itemContainer = document.createElement('div');
          itemContainer.className = 'chat-contact-item';
          if (state.qiko_active_partner === contactId) {
            itemContainer.classList.add('active');
          }

          const circle = document.createElement('div');
          const colorClass = `circle-pastel-${(index % 5) + 1}`;
          circle.className = `chat-circle ${colorClass}`;

          const indicator = document.createElement('span');
          indicator.className = 'online-indicator';
          circle.appendChild(indicator);

          const nameLabel = document.createElement('span');
          nameLabel.className = 'chat-contact-name';

          let initial = 'C';
          let displayName = contactId;
          if (contactId.startsWith('qx-')) {
            const parts = contactId.split('-');
            if (parts.length > 1 && parts[1]) {
              initial = parts[1][0].toUpperCase();
              displayName = contactId.slice(0, 12);
            }
          } else {
            initial = contactId[0].toUpperCase();
            displayName = contactId.slice(0, 12);
          }

          const initialText = document.createTextNode(initial);
          circle.appendChild(initialText);
          nameLabel.textContent = displayName;

          itemContainer.appendChild(circle);
          itemContainer.appendChild(nameLabel);

          lookupProfileByQikoId(contactId).then(profile => {
            if (profile) {
              const nameToUse = profile.username && profile.username !== 'Guest' ? profile.username : contactId;
              let finalInitial = 'C';
              if (nameToUse.startsWith('qx-')) {
                const parts = nameToUse.split('-');
                if (parts.length > 1 && parts[1]) {
                  finalInitial = parts[1][0].toUpperCase();
                }
              } else {
                finalInitial = nameToUse[0].toUpperCase();
              }
              if (circle.childNodes.length > 1) {
                circle.childNodes[1].textContent = finalInitial;
              }

              let labelName = nameToUse;
              if (labelName.length > 12) {
                labelName = labelName.slice(0, 12) + '...';
              }
              nameLabel.textContent = labelName;

              const lastSeen = profile.last_seen || 0;
              const isOnline = (Date.now() - lastSeen) < 120000;
              if (isOnline) {
                indicator.classList.add('online');
              } else {
                indicator.classList.remove('online');
              }

              if (state.qiko_active_partner === contactId && chatPartnerName) {
                chatPartnerName.textContent = `— ${nameToUse} —`;
              }
            }
          }).catch(err => console.error("Error looking up contact profile:", err));

          itemContainer.addEventListener('click', async () => {
            document.querySelectorAll('.chat-contact-item').forEach(c => c.classList.remove('active'));
            itemContainer.classList.add('active');

            state.qiko_active_partner = contactId;
            await storage.set({ qiko_active_partner: contactId });

            if (chatPartnerName) {
              const currentLabelText = nameLabel.textContent;
              chatPartnerName.textContent = `— ${currentLabelText} —`;
            }

            if (chatEmptyState) chatEmptyState.classList.add('hide');
            if (chatMainSection) chatMainSection.classList.remove('hide');

            const historyKey = `qiko_history_${contactId}`;
            const historyData = await storage.get(historyKey);
            const history = historyData[historyKey] || [];
            renderChatLog(history);
          });

          if (activeChatsList) {
            activeChatsList.appendChild(itemContainer);
          }
        });
      }
    } catch (e) {
      console.error("Contacts rendering error:", e);
    }
  }

  await renderContacts();

  if (btnNavHome) {
    btnNavHome.addEventListener('click', async () => {
      switchScene(btnNavHome, sceneHome);
      await renderContacts();
    });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.qiko_user_id && !changes.qiko_user_id.newValue) {
      window.location.href = "../index.html";
      return;
    }
    if (changes.qiko_token) {
      state.qiko_token = changes.qiko_token.newValue;
    }
    if (changes.qiko_refresh_token) {
      state.qiko_refresh_token = changes.qiko_refresh_token.newValue;
    }
    if (changes.qiko_contacts_updated) {
      renderContacts();
    }

    const activePartner = state.qiko_active_partner;
    if (activePartner) {
      const historyKey = `qiko_history_${activePartner}`;
      if (changes[historyKey]) {
        renderChatLog(changes[historyKey].newValue || []);
      }
    }
  });

  window.addEventListener('unload', () => {
    storage.remove('qiko_active_partner');
  });

  const btnSend = document.getElementById('btn-send-message');
  const inputMessage = document.getElementById('chat-message-input');

  const sendMessageFunc = async () => {
    if (!inputMessage) return;
    const msgText = inputMessage.value.trim();
    if (!msgText) return;

    const partnerId = state.qiko_active_partner;
    if (!partnerId) return;

    inputMessage.value = '';

    const historyKey = `qiko_history_${partnerId}`;
    const timestamp = Date.now();

    try {
      const historyData = await storage.get(historyKey);
      const history = historyData[historyKey] || [];
      
      history.push({
        sender: state.qiko_id,
        text: msgText,
        timestamp: timestamp,
        received: false
      });
      if (history.length > 100) {
        history.shift();
      }
      await storage.set({ [historyKey]: history });
      renderChatLog(history);

      const lookupUrl = `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${partnerId}.json`;
      const lookupRes = await fetch(lookupUrl);
      if (!lookupRes.ok) throw new Error("Database lookup failed.");
      const recipientUid = await lookupRes.json();
      if (!recipientUid) throw new Error("Recipient does not exist.");

      const inboxUrl = `${CONFIG.FIREBASE_DB_URL}/inbox/${recipientUid}.json?auth=${state.qiko_token}`;
      const payload = {
        sender_id: state.qiko_id,
        text: msgText,
        timestamp: timestamp
      };

      const postRes = await fetch(inboxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!postRes.ok) throw new Error("Failed to write to queue.");

    } catch (err) {
      console.error("Message delivery failed:", err);
      const historyData = await storage.get(historyKey);
      const history = historyData[historyKey] || [];
      history.push({
        sender: 'System',
        text: `Error: Message delivery failed. Recipient may be offline.`,
        timestamp: Date.now(),
        received: true
      });
      if (history.length > 100) {
        history.shift();
      }
      await storage.set({ [historyKey]: history });
      renderChatLog(history);
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
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
    chrome.runtime.connect({ name: "qiko_popup" });
  }
  await initThemeSwitcher();
  injectFooters();
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  const path = window.location.pathname;

  const pending = await storage.get('qiko_pending_verification');
  if (pending.qiko_pending_verification && !path.endsWith('logins.html')) {
    window.location.href = path.includes('/screens/') ? 'logins.html?flow=pending_verification' : 'screens/logins.html?flow=pending_verification';
    return;
  }

  if (path.endsWith('dashboard.html')) {
    initDashboardScreen();
  } else if (path.endsWith('logins.html')) {
    initLoginsScreen();
  } else {
    initStartScreen();
  }
});
