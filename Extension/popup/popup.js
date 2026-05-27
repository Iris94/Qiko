import * as uiManager from '../lib/ui-manager.js';
import { storage } from '../Logic/modules/storage.js';
import { getRoute } from '../Logic/modules/routing.js';
import {
  initThemeSwitcher,
  injectFooters,
  updateConnectionStatus
} from '../Logic/modules/utils.js';
import {
  initStartScreen,
  initLoginsScreen
} from '../Logic/modules/auth-flows.js';
import {
  initDashboardScreen
} from '../Logic/modules/dashboard-flows.js';

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
    window.location.href = getRoute('logins', { flow: 'pending_verification' });
    return;
  }

  if (path.includes('/dashboard')) {
    await initDashboardScreen(uiManager);
  } else if (path.includes('/logins')) {
    await initLoginsScreen(uiManager);
  } else {
    await initStartScreen(uiManager);
  }
});
