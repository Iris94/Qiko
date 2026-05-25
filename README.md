# Qiko Monorepo

Welcome to the unified **Qiko** monorepo. This codebase merges the Qiko Browser Extension and the Qiko Web Application into a single repository, sharing core business logic to ensure consistency and eliminate code duplication.

---

## 📂 Repository Structure

* **`Logic/`**: The core shared codebase containing framework-agnostic modules:
  * Firebase Authentication (`firebase-auth.js`) & Realtime Database drivers (`firebase-db.js`)
  * PeerJS WebRTC P2P Chat engine (`chat-engine.js`)
  * Global configs (`config.js`), constants (`constants.js`), and minified PeerJS (`peerjs.min.js`)
* **`Extension/`**: The Chrome Extension frontend (HTML, CSS, assets, and service worker).
* **`Web/`**: The standalone Astro-based Web App frontend.

---

## 🛠️ Development Workflows & Scripts

All commands should be executed from the **root directory** of the repository:

### 1. Synchronize Shared Logic (For Chrome Extension)
Chrome extensions cannot reference files outside of their root directory due to browser security restrictions. To solve this, we use a synchronization script to copy the shared `Logic/` folder into `Extension/Logic/`:

* **One-time sync**:
  ```bash
  npm run sync-logic
  ```
* **Real-time watcher (recommended during development)**:
  ```bash
  npm run watch-logic
  ```
  *Keep this script running in the background. Any modifications you make under `Logic/` will automatically sync to `Extension/Logic/` in real-time.*

### 2. Standalone Web App
The Astro Web App compiles and bundles relative imports out-of-the-box:

* **Install dependencies** (first time only):
  ```bash
  npm install --prefix Web
  ```
* **Run local development server** (`http://localhost:4321`):
  ```bash
  npm run dev:web
  ```
* **Build production assets**:
  ```bash
  npm run build:web
  ```

---

## 🧩 How to Load the Chrome Extension

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `Extension/` subdirectory inside this repository.
