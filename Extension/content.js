chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_TOAST') {
    showToast(message.senderName, message.text, message.theme);
    sendResponse({ success: true });
  }
  return true;
});

function showToast(senderName, text, themeSetting) {
  // Resolve theme setting (light, dark, or system prefers-color-scheme)
  let isDark = false;
  if (themeSetting === 'dark') {
    isDark = true;
  } else if (themeSetting === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Nord Palette Theme Colors
  const colors = isDark ? {
    bg: '#2e3440',
    text: '#eceff4',
    mutedText: '#d8dee9',
    primary: '#88c0d0',
    surface: '#3b4252',
    border: 'rgba(136, 192, 208, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.4)'
  } : {
    bg: '#eceff4',
    text: '#2e3440',
    mutedText: '#4c566a',
    primary: '#5e81ac',
    surface: '#e5e9f0',
    border: 'rgba(94, 129, 172, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.15)'
  };

  let container = document.getElementById('qiko-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'qiko-toast-container';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `qiko-toast ${isDark ? 'qiko-toast-dark' : 'qiko-toast-light'}`;
  Object.assign(toast.style, {
    width: '320px',
    backgroundColor: colors.bg,
    borderLeft: `4px solid ${colors.primary}`,
    borderTop: isDark ? 'none' : `1px solid ${colors.border}`,
    borderRight: isDark ? 'none' : `1px solid ${colors.border}`,
    borderBottom: isDark ? 'none' : `1px solid ${colors.border}`,
    borderRadius: '8px',
    boxShadow: isDark ? '0 8px 30px rgba(0, 0, 0, 0.4)' : '0 8px 30px rgba(0, 0, 0, 0.12)',
    color: colors.text,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'auto',
    animation: 'qiko-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    cursor: 'pointer',
    position: 'relative',
    userSelect: 'none',
    boxSizing: 'border-box'
  });

  // Inject animations & helper classes if not present
  if (!document.getElementById('qiko-toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'qiko-toast-styles';
    styleSheet.innerText = `
      @keyframes qiko-slide-in {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes qiko-fade-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(120%); opacity: 0; }
      }
      .qiko-toast {
        transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
      }
      .qiko-toast:hover {
        transform: translateY(-2px);
      }
      .qiko-toast-dark:hover {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5) !important;
      }
      .qiko-toast-light:hover {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22) !important;
      }
      .qiko-close-btn {
        transition: color 0.2s ease, transform 0.2s ease;
      }
      .qiko-close-btn:hover {
        transform: scale(1.15);
      }
    `;
    document.head.appendChild(styleSheet);
  }

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: '700',
    fontSize: '14px',
    color: colors.primary,
    boxSizing: 'border-box'
  });

  const titleText = document.createElement('span');
  titleText.innerText = `Qiko — ${senderName}`;
  header.appendChild(titleText);

  const closeBtn = document.createElement('span');
  closeBtn.innerText = '×';
  closeBtn.className = 'qiko-close-btn';
  Object.assign(closeBtn.style, {
    cursor: 'pointer',
    fontSize: '20px',
    color: colors.mutedText,
    lineHeight: '0.8',
    padding: '0 4px'
  });
  closeBtn.onmouseenter = () => {
    closeBtn.style.color = colors.primary;
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.color = colors.mutedText;
  };
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    removeToast(toast);
  };
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.innerText = text;
  Object.assign(body.style, {
    fontSize: '13px',
    color: colors.mutedText,
    wordBreak: 'break-word',
    maxHeight: '60px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    webkitLineClamp: '3',
    webkitBoxOrient: 'vertical',
    lineHeight: '1.4',
    boxSizing: 'border-box'
  });

  toast.appendChild(header);
  toast.appendChild(body);

  toast.onclick = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    removeToast(toast);
  };

  container.appendChild(toast);

  const autoTimeout = setTimeout(() => {
    removeToast(toast);
  }, 6000);

  function removeToast(el) {
    clearTimeout(autoTimeout);
    el.style.animation = 'qiko-fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      el.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }
}
