# Qiko Chat - Refactoring & Architecture Implementation Report (v2)

**Goal:** Transform the monolithic codebase into a clean, modular ES6 architecture, introduce true WebRTC (PeerJS) Peer-to-Peer messaging via the Chrome Offscreen API, centralize theme management, and implement custom dynamic in-page notifications.

---

### Step 1: Mapping and Centralization of Constants (Enums & Endpoints)
**Status:** Completed
- **`lib/constants.js`:** Defined all DOM IDs and classes as unified enums (`DOM_IDS`). Hardcoded strings are eliminated from code logic.
- **`lib/api-endpoints.js`:** Extracted and documented all Firebase RTDB and Identity Toolkit endpoints.

### Step 2: Universal API Wrapper (DRY)
**Status:** Completed
- **`lib/api-client.js`:** Created a robust API client with a `callApi` method that handles JSON parsing, headers, and structured error handling automatically.

### Step 3: Decoupling Firebase Logic
**Status:** Completed
- **`lib/firebase-auth.js`:** Modularized methods for anonymous login, email registration, email verification, and account upgrading/linking. All actions use the `callApi` helper.
- **`lib/firebase-db.js`:** Handles database operations such as Qiko ID creation, presence tracking (`last_seen`), and contact synchronization.

### Step 4: UI Manager (Dedicated Module)
**Status:** Completed
- **`lib/ui-manager.js`:** Isolated DOM manipulations.
- Implemented custom confirmation and alert modals that adapt to the active theme.
- Dynamic rendering of active contacts, chat logs, status indicators (online/offline), and auto-scroll behavior.

### Step 5: WebRTC (PeerJS) & Offscreen API Background Engine
**Status:** Completed
- **`offscreen.html` & `offscreen.js`:** Created an offscreen document since Chrome Service Workers do not support WebRTC APIs directly (e.g. `RTCPeerConnection`). PeerJS connection runs persistently in the background 24/7.
- **`lib/chat-engine.js`:** Communication layer between the extension popup and the background offscreen context.
- Implemented signaling for connection establishment, message transfer, state tracking, and automatic reconnection.

### Step 6: P2P Presence & Ping
**Status:** Completed
- Uses Firebase RTDB for active presence pinging every 60 seconds.
- If the partner's `last_seen` timestamp is within 120 seconds, a green online indicator dot is rendered. Otherwise, the partner is shown as offline.

### Step 7: Smart Notifications (Webpage Toast & Fallback)
**Status:** Completed
- **`content.js`:** Injected custom toast notifications into the active web tab. Features retrowave/cyberpunk styling aligned with the Nord theme.
  - Clicking the toast triggers an `'OPEN_POPUP'` message to the background script to open the extension popup.
  - Toast auto-dismisses after 6 seconds with a smooth slide-out animation.
- **`background.js` Fallback:** If the active tab is a restricted browser system page (e.g., `chrome://extensions/`) where script injection is blocked, the service worker falls back to a standard system notification (`chrome.notifications.create`).

### Step 8: Dynamic Nord Theme for Notifications
**Status:** Completed
- `background.js` forwards the active theme (light, dark, or system) from `chrome.storage.local`.
- `content.js` resolves this and dynamically applies the corresponding colors from the Nord theme:
  - **Dark Nord:** Background `#2e3440`, accent `#88c0d0`, text `#eceff4`, muted text `#d8dee9`.
  - **Light Nord:** Background `#eceff4`, accent `#5e81ac`, text `#2e3440`, muted text `#4c566a`.
- Full support for system-wide dark/light mode detection (`prefers-color-scheme`) when the theme is configured to "System".
