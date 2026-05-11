export function mountMessage(container, { onDisconnect, peerId } = {}) {
  const root = document.createElement('div');
  root.className = 'message-section';

  const header = document.createElement('div');
  header.className = 'chat-header';
  
  const title = document.createElement('h2');
  title.textContent = 'Connected';
  title.className = 'section-title';
  
  const disconnectBtn = document.createElement('button');
  disconnectBtn.type = 'button';
  disconnectBtn.className = 'btn btn-disconnect';
  disconnectBtn.textContent = 'Disconnect';
  
  header.appendChild(title);
  header.appendChild(disconnectBtn);
  root.appendChild(header);

  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'messages-container';
  messagesContainer.style.height = '200px';
  messagesContainer.style.overflowY = 'auto';
  messagesContainer.style.border = '1px solid #ccc';
  messagesContainer.style.marginBottom = '10px';
  messagesContainer.style.padding = '10px';
  messagesContainer.style.display = 'flex';
  messagesContainer.style.flexDirection = 'column';
  messagesContainer.style.gap = '8px';
  
  root.appendChild(messagesContainer);

  const form = document.createElement('div');
  form.className = 'chat-form';
  form.style.display = 'flex';
  form.style.gap = '8px';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-input';
  input.placeholder = 'Type a message...';
  input.style.flex = '1';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-send';
  sendBtn.textContent = 'Send';

  form.appendChild(input);
  form.appendChild(sendBtn);
  root.appendChild(form);

  const addMessage = (text, isMine) => {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.padding = '8px';
    msg.style.borderRadius = '8px';
    msg.style.maxWidth = '80%';
    msg.style.wordBreak = 'break-word';
    
    if (isMine) {
      msg.style.alignSelf = 'flex-end';
      msg.style.backgroundColor = '#007bff';
      msg.style.color = 'white';
    } else {
      msg.style.alignSelf = 'flex-start';
      msg.style.backgroundColor = '#e9ecef';
      msg.style.color = 'black';
    }
    
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  const onSend = () => {
    const text = input.value.trim();
    if (!text) return;
    
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'send_message',
      data: text
    }, (response) => {
      if (response && response.success) {
        addMessage(text, true);
        input.value = '';
      } else {
        alert('Failed to send message');
      }
    });
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({
      target: 'background',
      action: 'disconnect'
    }, () => {
      if (onDisconnect) onDisconnect();
    });
  };
  
  const handleMessage = (message, sender, sendResponse) => {
    if (message.target === 'popup') {
      if (message.action === 'message_received') {
        addMessage(message.data, false);
      } else if (message.action === 'peer_disconnected') {
        if (onDisconnect) onDisconnect();
      }
    }
  };

  sendBtn.addEventListener('click', onSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') onSend();
  });
  disconnectBtn.addEventListener('click', handleDisconnect);
  
  chrome.runtime.onMessage.addListener(handleMessage);

  container.appendChild(root);

  return {
    destroy() {
      sendBtn.removeEventListener('click', onSend);
      disconnectBtn.removeEventListener('click', handleDisconnect);
      chrome.runtime.onMessage.removeListener(handleMessage);
      root.remove();
    }
  };
}
