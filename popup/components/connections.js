export function mountConnections(container, { onInvite, onJoin } = {}) {
  const root = document.createElement('div');
  root.className = 'connect-selection-section';

  const title = document.createElement('h2');
  title.textContent = 'Connections';
  title.className = 'section-title';
  root.appendChild(title);

  const btnWrap = document.createElement('div');
  btnWrap.className = 'connections-buttons';

  const inviteBtn = document.createElement('button');
  inviteBtn.type = 'button';
  inviteBtn.className = 'btn btn-invite';
  inviteBtn.innerHTML = `<img src="icons/ui/add_icon.svg" alt="add" class="icon"> Invite`;
  const inviteHandler = () => onInvite && onInvite();
  inviteBtn.addEventListener('click', inviteHandler);

  const joinBtn = document.createElement('button');
  joinBtn.type = 'button';
  joinBtn.className = 'btn btn-join';
  joinBtn.innerHTML = `<img src="icons/ui/receive_icon.svg" alt="receive" class="icon"> Join`;
  const joinHandler = () => onJoin && onJoin();
  joinBtn.addEventListener('click', joinHandler);

  btnWrap.appendChild(inviteBtn);
  btnWrap.appendChild(joinBtn);
  root.appendChild(btnWrap);

  container.appendChild(root);

  return {
    destroy() {
      inviteBtn.removeEventListener('click', inviteHandler);
      joinBtn.removeEventListener('click', joinHandler);
      root.remove();
    }
  };
}

