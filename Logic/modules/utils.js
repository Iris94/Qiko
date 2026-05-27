import { storage } from './storage.js';
import * as firebaseDb from '../firebase-db.js';

export async function initThemeSwitcher() {
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

export function applyTheme(theme) {
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

export function copyToClipboard(text, tooltipElement) {
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

export function injectFooters() {
  const footerString = "© Qiko 2026 &bull; v0.1 &bull; P2P ENCRYPTED";
  document.querySelectorAll('.footer-text').forEach(el => {
    el.innerHTML = footerString;
  });
}

export function updateConnectionStatus() {
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

export function generateQikoId() {
  const uuid = crypto.randomUUID();
  const parts = uuid.split('-');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString(10);
  return `qx-${parts[1]}-${parts[2]}-${randomSuffix}`;
}

export async function saveIdentityToFirebase(qikoId, uid, email, username, token) {
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
