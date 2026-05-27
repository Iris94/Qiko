import { storage } from './storage.js';
import { getRoute } from './routing.js';
import * as firebaseDb from '../firebase-db.js';

export async function lookupProfileByQikoId(qikoId, token) {
  try {
    const uid = await firebaseDb.getUidByQikoId(qikoId, token);
    if (!uid) return null;
    const profile = await firebaseDb.getUserProfile(uid, token);
    return profile;
  } catch (err) {
    console.error("Failed to lookup profile for Qiko ID:", qikoId, err);
    return null;
  }
}

export async function loadAndRenderContacts(state, uiManager, selectPartnerFn) {
  try {
    const contacts = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);
    const resolved = [];
    
    for (const contactId of contacts) {
      let displayName = contactId;
      let isOnline = false;
      
      const profile = await lookupProfileByQikoId(contactId, state.qiko_token);
      if (profile) {
        displayName = (profile.username && profile.username !== 'Guest') ? profile.username : contactId;
        const lastSeen = profile.last_seen || 0;
        isOnline = (Date.now() - lastSeen) < 120000;
      }
      resolved.push({ id: contactId, displayName, isOnline });
    }
    
    uiManager.renderContacts(resolved, state.qiko_active_partner, async (selectedPartnerId) => {
      state.qiko_active_partner = selectedPartnerId;
      await storage.set({ qiko_active_partner: selectedPartnerId });
      
      const chatPartnerName = document.getElementById('chat-partner-name');
      if (chatPartnerName) {
        const selectedContact = resolved.find(c => c.id === selectedPartnerId);
        const nameToDisplay = selectedContact ? selectedContact.displayName : selectedPartnerId;
        chatPartnerName.textContent = `— ${nameToDisplay} —`;
      }
      
      const historyKey = `qiko_history_${selectedPartnerId}`;
      const historyData = await storage.get(historyKey);
      const history = historyData[historyKey] || [];
      uiManager.renderChatLog(history, state.qiko_id);
    });
  } catch (err) {
    console.error("Failed to load and render contacts:", err);
  }
}

export async function selectPartner(partnerId, state, uiManager, switchSceneCallback) {
  state.qiko_active_partner = partnerId;
  if (switchSceneCallback) {
    switchSceneCallback();
  }
  
  await loadAndRenderContacts(state, uiManager, selectPartner);

  const chatPartnerName = document.getElementById('chat-partner-name');
  if (chatPartnerName) {
    chatPartnerName.textContent = `— ${partnerId} —`;
    const profile = await lookupProfileByQikoId(partnerId, state.qiko_token);
    if (profile) {
      const nameToUse = profile.username && profile.username !== 'Guest' ? profile.username : partnerId;
      chatPartnerName.textContent = `— ${nameToUse} —`;
    }
  }

  const historyKey = `qiko_history_${partnerId}`;
  const historyData = await storage.get(historyKey);
  const history = historyData[historyKey] || [];
  uiManager.renderChatLog(history, state.qiko_id);
}

export async function removeConnection(partnerId, state, uiManager, afterRemoveCallback) {
  const confirmed = await uiManager.showCustomConfirm(`Are you sure you want to remove the connection with ${partnerId}?`);
  if (!confirmed) return false;

  try {
    const contacts = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);
    const newList = contacts.filter(id => id !== partnerId);
    await firebaseDb.updateContacts(state.qiko_user_id, newList, state.qiko_token);

    state.qiko_active_partner = null;
    await storage.remove('qiko_active_partner');
    if (afterRemoveCallback) {
      afterRemoveCallback();
    }
    return true;
  } catch (err) {
    console.error("Failed to remove connection:", err);
    return false;
  }
}

export async function addConnection(targetId, state, uiManager, afterAddCallback) {
  try {
    if (targetId.includes('@')) {
      const emailHash = await firebaseDb.hashEmail(targetId);
      const resolvedQikoId = await firebaseDb.getQikoIdByEmail(emailHash, state.qiko_token);
      if (!resolvedQikoId) {
        throw new Error(`No user found registered with email: ${targetId}`);
      }
      targetId = resolvedQikoId;
    }

    if (targetId === state.qiko_id) {
      throw new Error("You cannot add your own Qiko ID/email.");
    }

    const targetUid = await firebaseDb.getUidByQikoId(targetId, state.qiko_token);
    if (!targetUid) {
      throw new Error(`User not found with Qiko ID: ${targetId}`);
    }

    const contactsList = await firebaseDb.getContacts(state.qiko_user_id, state.qiko_token);

    if (contactsList.length >= 5) {
      throw new Error("You can only have a maximum of 5 contacts currently. Please remove an existing connection first.");
    }

    if (contactsList.includes(targetId)) {
      throw new Error(`Connection ${targetId} is already in your contacts.`);
    }

    contactsList.push(targetId);
    await firebaseDb.updateContacts(state.qiko_user_id, contactsList, state.qiko_token);

    await uiManager.showCustomAlert(`Successfully added ${targetId} to your contacts!`);

    state.qiko_active_partner = targetId;
    await storage.set({ qiko_active_partner: targetId });
    
    if (afterAddCallback) {
      afterAddCallback(targetId);
    }
    return true;
  } catch (err) {
    console.error("Failed to add connection:", err);
    uiManager.showError('connectErrorMsg', err.message || "Failed to add connection.");
    return false;
  }
}
