import { writeToClipboard, readFromClipboard } from '../../utils/clipboard.js';
import { saveSession } from '../storage.js';

export function mountJoin(container, { onBack } = {}) {
  const root = document.createElement('div');
  root.className = 'join-section';

  const title = document.createElement('h2');
  title.textContent = 'Join a session';
  title.className = 'section-title';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Paste the key you received.';
  desc.className = 'desc';
  root.appendChild(desc);

  const form = document.createElement('div');
  form.className = 'join-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'join-key-input';
  input.placeholder = 'Paste key here';

  const controls = document.createElement('div');
  controls.className = 'join-controls';

  const pasteBtn = document.createElement('button');
  pasteBtn.type = 'button';
  pasteBtn.className = 'btn btn-paste';
  pasteBtn.innerHTML = `<img src="icons/ui/copy_icon.svg" alt="paste" class="icon"> Paste`;

  const connectBtn = document.createElement('button');
  connectBtn.type = 'button';
  connectBtn.className = 'btn btn-connect';
  connectBtn.innerHTML = `<img src="icons/ui/receive_icon.svg" alt="connect" class="icon"> Connect`;

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn-back';
  backBtn.textContent = 'Back';

  controls.appendChild(pasteBtn);
  controls.appendChild(connectBtn);
  controls.appendChild(backBtn);

  form.appendChild(input);
  form.appendChild(controls);
  root.appendChild(form);

  const onPaste = async () => {
    try {
      const text = await readFromClipboard();
      input.value = text;
    } catch (err) {
      console.error('Clipboard read failed', err);
    }
  };

  const onConnect = async () => {
    if (!input.value) return;
    connectBtn.disabled = true;

    chrome.runtime.sendMessage({
      target: 'background',
      action: 'connect_to_peer',
      targetId: input.value.trim()
    }, async (response) => {
      connectBtn.disabled = false;
      if (response && response.success) {
        await saveSession({ sessionId: input.value, createdAt: Date.now() });
        connectBtn.textContent = 'Saved';
        setTimeout(() => (connectBtn.innerHTML = `<img src="icons/ui/receive_icon.svg" alt="connect" class="icon"> Connect`), 900);
      } else {
        console.error('Connection failed', response);
        alert('Failed to connect. Is the peer online?');
      }
    });
  };

  const pasteHandler = onPaste;
  const connectHandler = onConnect;
  const backHandler = () => onBack && onBack();

  pasteBtn.addEventListener('click', pasteHandler);
  connectBtn.addEventListener('click', connectHandler);
  backBtn.addEventListener('click', backHandler);

  container.appendChild(root);

  return {
    destroy() {
      pasteBtn.removeEventListener('click', pasteHandler);
      connectBtn.removeEventListener('click', connectHandler);
      backBtn.removeEventListener('click', backHandler);
      root.remove();
    }
  };
}
