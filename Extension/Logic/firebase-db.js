import { callApi } from './api-client.js';
import { DB_ENDPOINTS } from './api-endpoints.js';

/**
 * Hash a string using SHA-256 (Web Crypto API).
 *
 * @param {string} str
 * @returns {Promise<string>} Hex representation of the hash.
 */
export async function hashSHA256(str) {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize and hash email address for secure lookup and uniqueness checking.
 *
 * @param {string} email
 * @returns {Promise<string>} Hex hashed email.
 */
export async function hashEmail(email) {
  return await hashSHA256(email.trim().toLowerCase());
}

/**
 * Fetch a user profile record from RTDB.
 *
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(uid, token) {
  return await callApi(DB_ENDPOINTS.user(uid), 'GET', null, token);
}

/**
 * Save user profile record to RTDB (creates or fully updates).
 *
 * @param {string} uid
 * @param {Object} profileData
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function saveUserProfile(uid, profileData, token) {
  return await callApi(DB_ENDPOINTS.user(uid), 'PUT', profileData, token);
}

/**
 * Partially update/patch user profile fields in RTDB.
 *
 * @param {string} uid
 * @param {Object} partialData
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function patchUserProfile(uid, partialData, token) {
  return await callApi(DB_ENDPOINTS.user(uid), 'PATCH', partialData, token);
}

/**
 * Check if a normalized email address is already registered in RTDB.
 *
 * @param {string} emailHash
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function isEmailRegistered(emailHash, token) {
  const data = await callApi(DB_ENDPOINTS.emailHash(emailHash), 'GET', null, token);
  return data !== null;
}

/**
 * Look up the Qiko ID associated with a hashed email.
 *
 * @param {string} emailHash
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function getQikoIdByEmail(emailHash, token) {
  const data = await callApi(DB_ENDPOINTS.emailHash(emailHash), 'GET', null, token);
  return data ? data.qiko_user_id : null;
}

/**
 * Register a mapping between hashed email and Qiko ID / Firebase UID.
 *
 * @param {string} emailHash
 * @param {string} qikoId
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function saveEmailMapping(emailHash, qikoId, uid, token) {
  return await callApi(DB_ENDPOINTS.emailHash(emailHash), 'PUT', { qiko_user_id: qikoId, uid: uid }, token);
}

/**
 * Remove email mapping from RTDB.
 *
 * @param {string} emailHash
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function deleteEmailMapping(emailHash, token) {
  return await callApi(DB_ENDPOINTS.emailHash(emailHash), 'DELETE', null, token);
}

/**
 * Register a mapping between Qiko ID and Firebase UID.
 *
 * @param {string} qikoId
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function saveQikoIdMapping(qikoId, uid, token) {
  return await callApi(DB_ENDPOINTS.qikoId(qikoId), 'PUT', uid, token);
}

/**
 * Remove Qiko ID registry entry.
 *
 * @param {string} qikoId
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function deleteQikoIdMapping(qikoId, token) {
  return await callApi(DB_ENDPOINTS.qikoId(qikoId), 'DELETE', null, token);
}

/**
 * Transaction-like fetch-and-increment global registered user counter.
 *
 * @param {string} token
 * @returns {Promise<number>} The updated user count.
 */
export async function fetchAndIncrementUserCount(token) {
  const currentCount = await callApi(DB_ENDPOINTS.userCount(), 'GET', null, token);
  const count = currentCount === null ? 0 : Number(currentCount);
  const nextCount = count + 1;
  await callApi(DB_ENDPOINTS.userCount(), 'PUT', nextCount, token);
  return nextCount;
}

/**
 * Update the user's presence/last_seen timestamp.
 *
 * @param {string} uid
 * @param {number} timestamp - Epoch milliseconds or 0 (offline).
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function updatePresence(uid, timestamp, token) {
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/last_seen.json`;
  return await callApi(url, 'PUT', timestamp, token);
}

/**
 * Delete the entire user profile record.
 *
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function deleteUserProfile(uid, token) {
  return await callApi(DB_ENDPOINTS.user(uid), 'DELETE', null, token);
}

/**
 * Look up the Firebase UID mapped to a specific Qiko ID.
 *
 * @param {string} qikoId
 * @param {string} token
 * @returns {Promise<string|null>} The Firebase UID or null if not found.
 */
export async function getUidByQikoId(qikoId, token) {
  return await callApi(DB_ENDPOINTS.qikoId(qikoId), 'GET', null, token);
}

/**
 * Retrieve contacts array for a specific user.
 *
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<Array<string>>}
 */
export async function getContacts(uid, token) {
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/contacts.json`;
  const data = await callApi(url, 'GET', null, token);
  return data || [];
}

/**
 * Update/Overwrite contacts list for a user.
 *
 * @param {string} uid
 * @param {Array<string>} contactsList
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function updateContacts(uid, contactsList, token) {
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/contacts.json`;
  return await callApi(url, 'PUT', contactsList, token);
}

/**
 * Register active peer ID in Firebase presence list.
 *
 * @param {string} uid
 * @param {string} peerId
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function registerPresence(uid, peerId, token) {
  const cleanPeerId = peerId.replace(/-ext-.*$/, '').replace(/-web-.*$/, '');
  const clientKey = peerId.substring(cleanPeerId.length + 1).replace(/[^a-zA-Z0-9-_]/g, '_');
  
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/presence/${clientKey}.json`;
  return await callApi(url, 'PUT', {
    peerId: peerId,
    lastSeen: Date.now()
  }, token);
}

/**
 * Remove active peer ID from Firebase presence list.
 *
 * @param {string} uid
 * @param {string} peerId
 * @param {string} token
 * @returns {Promise<any>}
 */
export async function unregisterPresence(uid, peerId, token) {
  const cleanPeerId = peerId.replace(/-ext-.*$/, '').replace(/-web-.*$/, '');
  const clientKey = peerId.substring(cleanPeerId.length + 1).replace(/[^a-zA-Z0-9-_]/g, '_');
  
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/presence/${clientKey}.json`;
  return await callApi(url, 'DELETE', null, token);
}

/**
 * Retrieve all active peer IDs for a user based on active presence.
 *
 * @param {string} uid
 * @param {string} token
 * @returns {Promise<Array<string>>}
 */
export async function getActivePeers(uid, token) {
  const url = `${DB_ENDPOINTS.user(uid).replace('.json', '')}/presence.json`;
  const presenceData = await callApi(url, 'GET', null, token);
  if (!presenceData) return [];
  
  const now = Date.now();
  const activePeers = [];
  for (const val of Object.values(presenceData)) {
    if (val && val.peerId && (now - val.lastSeen < 5 * 60 * 1000)) {
      activePeers.push(val.peerId);
    }
  }
  return activePeers;
}
