import { CONFIG } from './config.js';

/**
 * Firebase Identity Toolkit REST APIs for authentication flows.
 * These endpoints require the Firebase API Key as a query parameter.
 */
export const AUTH_ENDPOINTS = {
  /**
   * Creates a new user account.
   * Can be anonymous (if body has returnSecureToken: true) or standard email/password registration.
   */
  signUp: () => `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.FIREBASE_API_KEY}`,

  /**
   * Links anonymous credentials with an email/password provider,
   * or updates account attributes like unlinking a provider.
   */
  update: () => `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${CONFIG.FIREBASE_API_KEY}`,

  /**
   * Sends out-of-band verification emails (e.g., verification code or link).
   */
  sendOobCode: () => `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CONFIG.FIREBASE_API_KEY}`,

  /**
   * Retrieves account metadata of the currently authenticated session (e.g. checks emailVerified).
   */
  lookup: () => `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${CONFIG.FIREBASE_API_KEY}`,

  /**
   * Logs a user in with their email address and password.
   */
  signInWithPassword: () => `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.FIREBASE_API_KEY}`,

  /**
   * Permanently deletes the authenticated user account from Firebase Auth.
   */
  deleteAccount: () => `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${CONFIG.FIREBASE_API_KEY}`
};

/**
 * Firebase Realtime Database relative paths and builders.
 * Append ?auth=${token} to authorize REST read/write operations.
 */
export const DB_ENDPOINTS = {
  /**
   * Read, write, patch, or delete user-specific settings and metadata.
   * Path: /users/{uid}.json
   */
  user: (uid) => `${CONFIG.FIREBASE_DB_URL}/users/${uid}.json`,

  /**
   * Map Qiko ID to Firebase UID, or check if a Qiko ID is already in use.
   * Path: /qiko_ids/{qikoId}.json
   */
  qikoId: (qikoId) => `${CONFIG.FIREBASE_DB_URL}/qiko_ids/${qikoId}.json`,

  /**
   * Map SHA-256 hashed email to UID to prevent duplicate registrations and support lookup.
   * Path: /emails/{emailHash}.json
   */
  emailHash: (emailHash) => `${CONFIG.FIREBASE_DB_URL}/emails/${emailHash}.json`,

  /**
   * Access or increment the global counter of registered users.
   * Path: /user_count.json
   */
  userCount: () => `${CONFIG.FIREBASE_DB_URL}/user_count.json`
};

/**
 * External custom web/Vercel endpoints.
 */
export const EXTERNAL_ENDPOINTS = {
  /**
   * Magic invite link builder for onboarding connections.
   */
  magicInviteLink: (qikoId) => `https://qiko-invite.vercel.app/?id=${qikoId}`
};
