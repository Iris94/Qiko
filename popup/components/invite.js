import { generate128BitKey } from '../../utils/crypto.js';
import { saveSession } from '../storage.js';
import { writeToClipboard } from '../../utils/clipboard.js';

export function mountInvite(container, { onBack } = {}) {
  const root = document.createElement('div');
  root.className = 'invite-section';

  const title = document.createElement('h2');
  title.textContent = 'Invite a person';
  title.className = 'section-title';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Send this key to the person you want to invite.';
  desc.className = 'desc';
  root.appendChild(desc);

  const form = document.createElement('div');
  form.className = 'invite-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.className = 'invite-key-input';
  input.placeholder = 'Generate a key';

  const controls = document.createElement('div');
  controls.className = 'invite-controls';

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'btn btn-gen';
  genBtn.innerHTML = `<img src="icons/ui/reload_icon.svg" alt="generate" class="icon"> Generate`;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-copy';
  copyBtn.innerHTML = `<img src="icons/ui/copy_icon.svg" alt="copy" class="icon"> Copy`;

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn-back';
  backBtn.textContent = 'Back';

  controls.appendChild(genBtn);
  controls.appendChild(copyBtn);
  controls.appendChild(backBtn);

  form.appendChild(input);
  form.appendChild(controls);
  root.appendChild(form);


  const onGenerate = async () => {
    const key = generate128BitKey();
    input.value = key;
    await saveSession({ sessionId: key, createdAt: Date.now() });
    input.select();
  };

  const onCopy = async () => {
    if (!input.value) return;
    await writeToClipboard(input.value);

    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.innerHTML = `<img src="icons/ui/copy_icon.svg" alt="copy" class="icon"> Copy`), 900);
  };

  const generateHandler = onGenerate;
  const copyHandler = onCopy;
  const backHandler = () => onBack && onBack();

  genBtn.addEventListener('click', generateHandler);
  copyBtn.addEventListener('click', copyHandler);
  backBtn.addEventListener('click', backHandler);

  container.appendChild(root);

  return {
    destroy() {
      genBtn.removeEventListener('click', generateHandler);
      copyBtn.removeEventListener('click', copyHandler);
      backBtn.removeEventListener('click', backHandler);
      root.remove();
    }
  };
}
