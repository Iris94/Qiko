import { callApi } from './api-client.js';
import { AUTH_ENDPOINTS } from './api-endpoints.js';
import { CONFIG } from './config.js';

/**
 * Refreshes an expired Firebase ID token using a refresh token.
 *
 * @param {string} refreshToken
 * @returns {Promise<{idToken: string, refreshToken: string}>}
 */
export async function firebaseRefreshToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${CONFIG.FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  if (!response.ok) {
    const err = new Error('Token refresh failed');
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token
  };
}

/**
 * Signs in anonymously to Firebase Auth.
 * Used to bootstrap guest profile creation and authorize initial database operations.
 *
 * @returns {Promise<{uid: string, idToken: string, refreshToken: string}>}
 */
export async function firebaseSignInAnonymously() {
  const data = await callApi(AUTH_ENDPOINTS.signUp(), 'POST', {
    returnSecureToken: true
  });
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

/**
 * Registers a new email/password user with Firebase Auth.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid: string, idToken: string, refreshToken: string}>}
 */
export async function firebaseSignUpWithEmail(email, password) {
  const data = await callApi(AUTH_ENDPOINTS.signUp(), 'POST', {
    email: email,
    password: password,
    returnSecureToken: true
  });
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

/**
 * Links email/password credentials to an existing anonymous session user.
 *
 * @param {string} idToken - Active guest session ID token.
 * @param {string} email - Email address to link.
 * @param {string} password - Password to set.
 * @returns {Promise<{uid: string, idToken: string, refreshToken: string}>}
 */
export async function firebaseLinkEmail(idToken, email, password) {
  const data = await callApi(AUTH_ENDPOINTS.update(), 'POST', {
    idToken: idToken,
    email: email,
    password: password,
    returnSecureToken: true
  });
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

/**
 * Unlinks the password provider from a user account (e.g. rolls back verification registration).
 *
 * @param {string} idToken
 * @returns {Promise<any>}
 */
export async function firebaseUnlinkEmail(idToken) {
  return await callApi(AUTH_ENDPOINTS.update(), 'POST', {
    idToken: idToken,
    deleteProvider: ['password']
  });
}

/**
 * Triggers an email verification link to be sent out to the user's email address.
 *
 * @param {string} idToken
 * @returns {Promise<any>}
 */
export async function firebaseSendEmailVerification(idToken) {
  return await callApi(AUTH_ENDPOINTS.sendOobCode(), 'POST', {
    requestType: 'VERIFY_EMAIL',
    idToken: idToken
  });
}

/**
 * Retrieves the user record metadata from Firebase Auth (to verify email status).
 *
 * @param {string} idToken
 * @returns {Promise<Object>}
 */
export async function firebaseGetUserData(idToken) {
  const data = await callApi(AUTH_ENDPOINTS.lookup(), 'POST', {
    idToken: idToken
  });
  if (!data.users || data.users.length === 0) {
    throw new Error('User record not found on authentication server.');
  }
  return data.users[0];
}

/**
 * Signs in a user using their email address and password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{uid: string, idToken: string, refreshToken: string}>}
 */
export async function firebaseSignInWithEmail(email, password) {
  const data = await callApi(AUTH_ENDPOINTS.signInWithPassword(), 'POST', {
    email: email,
    password: password,
    returnSecureToken: true
  });
  return {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken
  };
}

/**
 * Permanently deletes the user account from Firebase Auth.
 *
 * @param {string} idToken
 * @returns {Promise<any>}
 */
export async function firebaseDeleteAccount(idToken) {
  return await callApi(AUTH_ENDPOINTS.deleteAccount(), 'POST', {
    idToken: idToken
  });
}
