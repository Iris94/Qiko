

/**
 * Creates HTML string for receiver component
 * @param {Object} receiverData - Receiver data (name, status, avatar, etc.)
 * @returns {string} HTML string
 */
export function createReceiverHTML(receiverData) {
  return `
    <div class="receiver" data-id="${receiverData.id}">
      <img src="${receiverData.avatar || 'default-avatar.png'}" alt="${receiverData.name}" />
      <h3>${receiverData.name}</h3>
      <p class="status ${receiverData.status}">${receiverData.status}</p>
    </div>
  `;
}
