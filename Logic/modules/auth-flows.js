import { storage } from './storage.js';
import { getRoute } from './routing.js';
import * as firebaseAuth from '../firebase-auth.js';
import * as firebaseDb from '../firebase-db.js';
import { copyToClipboard, generateQikoId, saveIdentityToFirebase } from './utils.js';

let tempGeneratedId = null;
let tempRegisterEmail = '';
let tempRegisterPassword = '';
let tempRegisterUsername = '';
let tempUid = null;
let tempToken = null;
let tempRefreshToken = null;

export async function initStartScreen(uiManager) {
  const pending = await storage.get('qiko_pending_verification');
  if (pending.qiko_pending_verification) {
    window.location.href = getRoute('logins', { flow: 'pending_verification' });
    return;
  }

  const state = await storage.get(['qiko_user_id', 'qiko_id']);
  if (state.qiko_user_id) {
    window.location.href = getRoute('dashboard', { id: state.qiko_id || state.qiko_user_id });
    return;
  }

  const btnCreateId = document.getElementById('btn-create-id');
  if (btnCreateId) {
    btnCreateId.addEventListener('click', () => {
      window.location.href = getRoute('logins', { flow: 'create' });
    });
  }

  const btnSignId = document.getElementById('btn-sign-id');
  if (btnSignId) {
    btnSignId.addEventListener('click', () => {
      window.location.href = getRoute('logins', { flow: 'signin' });
    });
  }
}

export async function initLoginsScreen(uiManager) {
  const urlParams = new URLSearchParams(window.location.search);
  let flow = urlParams.get('flow');

  if (flow === 'pending_verification') {
    uiManager.showSubScreen('screenLoading');
    const pending = await storage.get('qiko_pending_verification');
    if (!pending.qiko_pending_verification) {
      window.location.href = getRoute('start');
      return;
    }

    let data;
    try {
      data = JSON.parse(pending.qiko_pending_verification);
    } catch (e) {
      await storage.remove('qiko_pending_verification');
      window.location.href = getRoute('start');
      return;
    }

    tempGeneratedId = data.qiko_id;
    tempUid = data.uid;
    tempToken = data.token;
    tempRefreshToken = data.refreshToken;
    tempRegisterEmail = data.email;
    tempRegisterUsername = data.username;

    const emailDisplay = document.getElementById('sent-code-email');
    if (emailDisplay) emailDisplay.textContent = tempRegisterEmail;

    const btnVerifyBack = document.getElementById('btn-verification-back');
    if (btnVerifyBack) {
      btnVerifyBack.textContent = data.flow === 'upgrade' ? "Back to Chat" : "Back to Profile Setup";
    }

    uiManager.showSubScreen('screenVerification');
  } else if (flow === 'create') {
    uiManager.showSubScreen('screenLoading');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = "Securing your connection...";
    
    try {
      const anonymousSession = await firebaseAuth.firebaseSignInAnonymously();
      tempUid = anonymousSession.uid;
      tempToken = anonymousSession.idToken;
      tempRefreshToken = anonymousSession.refreshToken;

      const generatedId = generateQikoId();
      tempGeneratedId = generatedId;
      
      const idInput = document.getElementById('generated-id-input');
      if (idInput) idInput.value = generatedId;

      uiManager.showSubScreen('screenProfileSetup');
    } catch (err) {
      console.error("Failed to generate ID:", err);
      await uiManager.showCustomAlert("Failed to initialize Qiko ID. Check database connection rules.");
      window.location.href = getRoute('start');
    }
  } else if (flow === 'signin') {
    uiManager.showSubScreen('screenSignIn');
  } else if (flow === 'upgrade') {
    uiManager.showSubScreen('screenLoading');
    const existing = await storage.get(['qiko_id', 'qiko_user_id', 'qiko_token']);
    if (!existing.qiko_user_id || !existing.qiko_id) {
      window.location.href = getRoute('start');
      return;
    }
    tempGeneratedId = existing.qiko_id;
    tempUid = existing.qiko_user_id;
    tempToken = existing.qiko_token;

    const idInput = document.getElementById('generated-id-input');
    if (idInput) idInput.value = tempGeneratedId;

    const btnSetupBack = document.getElementById('btn-setup-back');
    if (btnSetupBack) {
      btnSetupBack.textContent = "Back to Chat";
      btnSetupBack.onclick = (e) => {
        e.preventDefault();
        window.location.href = getRoute('dashboard', { id: tempGeneratedId });
      };
    }

    const btnSetupSkip = document.getElementById('btn-setup-skip');
    if (btnSetupSkip) btnSetupSkip.classList.add('hide');

    uiManager.showSubScreen('screenProfileSetup');
  } else {
    window.location.href = getRoute('start');
  }

  const btnCopyId = document.getElementById('btn-copy-id');
  if (btnCopyId) {
    btnCopyId.addEventListener('click', () => {
      const idInput = document.getElementById('generated-id-input');
      const tooltip = document.getElementById('copy-tooltip');
      if (idInput) {
        copyToClipboard(idInput.value, tooltip);
      }
    });
  }

  const btnSetupBack = document.getElementById('btn-setup-back');
  if (btnSetupBack && flow !== 'upgrade') {
    btnSetupBack.addEventListener('click', () => {
      window.location.href = getRoute('start');
    });
  }

  const btnSetupSkip = document.getElementById('btn-setup-skip');
  if (btnSetupSkip && flow !== 'upgrade') {
    btnSetupSkip.addEventListener('click', async () => {
      btnSetupSkip.disabled = true;
      btnSetupSkip.textContent = 'Generating...';
      try {
        const userProfile = {
          qiko_id: tempGeneratedId,
          email: "",
          username: "Guest",
          current_peer_id: "",
          contacts: []
        };
        await firebaseDb.saveQikoIdMapping(tempGeneratedId, tempUid, tempToken);
        await firebaseDb.saveUserProfile(tempUid, userProfile, tempToken);

        const guestState = {
          qiko_user_id: tempUid,
          qiko_email: '',
          qiko_username: 'Guest',
          qiko_registered: false,
          qiko_id: tempGeneratedId,
          qiko_token: tempToken,
          qiko_refresh_token: tempRefreshToken
        };
        await storage.set(guestState);
        window.location.href = getRoute('dashboard', { id: tempGeneratedId });
      } catch (err) {
        console.error("Anonymous sign in failed:", err);
        await uiManager.showCustomAlert("Failed to initialize Guest session. Try again.");
        btnSetupSkip.disabled = false;
        btnSetupSkip.textContent = 'Continue';
      }
    });
  }

  const formProfileSetup = document.getElementById('form-profile-setup');
  if (formProfileSetup) {
    formProfileSetup.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('setup-email').value.trim();
      const password = document.getElementById('setup-password').value;
      const username = document.getElementById('setup-username').value.trim();
      
      uiManager.clearError('setupErrorMsg');

      const btnReg = document.getElementById('btn-register');
      btnReg.disabled = true;
      btnReg.textContent = 'Initializing...';

      try {
        const emailHash = await firebaseDb.hashEmail(email);
        const inUse = await firebaseDb.isEmailRegistered(emailHash, tempToken);
        if (inUse) {
          throw new Error("This email is already registered. Please sign in instead.");
        }

        tempRegisterEmail = email;
        tempRegisterPassword = password;
        tempRegisterUsername = username;

        let sessionAuth;
        if (flow === 'upgrade') {
          sessionAuth = await firebaseAuth.firebaseLinkEmail(tempToken, email, password);
        } else {
          sessionAuth = await firebaseAuth.firebaseSignUpWithEmail(email, password);
        }

        tempUid = sessionAuth.uid;
        tempToken = sessionAuth.idToken;
        tempRefreshToken = sessionAuth.refreshToken;

        const pendingData = {
          flow: flow === 'upgrade' ? 'upgrade' : 'create',
          uid: tempUid,
          qiko_id: tempGeneratedId,
          email: tempRegisterEmail,
          username: tempRegisterUsername || 'Guest',
          token: tempToken,
          refreshToken: tempRefreshToken
        };

        await storage.set({ qiko_pending_verification: JSON.stringify(pendingData) });
        
        await firebaseAuth.firebaseSendEmailVerification(tempToken);

        const emailDisplay = document.getElementById('sent-code-email');
        if (emailDisplay) emailDisplay.textContent = tempRegisterEmail;

        const btnVerifyBack = document.getElementById('btn-verification-back');
        if (btnVerifyBack) {
          btnVerifyBack.textContent = flow === 'upgrade' ? "Back to Chat" : "Back to Profile Setup";
        }

        uiManager.showSubScreen('screenVerification');
      } catch (err) {
        console.error("Profile Setup Failed:", err);
        uiManager.showError('setupErrorMsg', err.message || "Failed to initialize profile. Try again.");
      } finally {
        btnReg.disabled = false;
        btnReg.textContent = 'Register';
      }
    });
  }

  const btnVerifySubmit = document.getElementById('btn-verify-submit');
  if (btnVerifySubmit) {
    btnVerifySubmit.addEventListener('click', async () => {
      btnVerifySubmit.disabled = true;
      btnVerifySubmit.textContent = 'Checking...';
      uiManager.clearError('verificationErrorMsg');

      try {
        const user = await firebaseAuth.firebaseGetUserData(tempToken);
        if (!user.emailVerified) {
          throw new Error("Email address not verified yet. Please click verification link in your inbox.");
        }

        // Save mappings
        const emailHash = await firebaseDb.hashEmail(tempRegisterEmail);
        await firebaseDb.saveQikoIdMapping(tempGeneratedId, tempUid, tempToken);
        await firebaseDb.saveEmailMapping(emailHash, tempGeneratedId, tempUid, tempToken);

        const userProfile = {
          qiko_id: tempGeneratedId,
          email: tempRegisterEmail,
          username: tempRegisterUsername || 'Guest',
          current_peer_id: "",
          contacts: []
        };
        
        if (flow === 'upgrade') {
          const existingContacts = await firebaseDb.getContacts(tempUid, tempToken);
          userProfile.contacts = existingContacts;
        }

        await firebaseDb.saveUserProfile(tempUid, userProfile, tempToken);

        const activeState = {
          qiko_user_id: tempUid,
          qiko_email: tempRegisterEmail,
          qiko_username: tempRegisterUsername || 'Guest',
          qiko_registered: true,
          qiko_id: tempGeneratedId,
          qiko_token: tempToken,
          qiko_refresh_token: tempRefreshToken
        };
        await storage.set(activeState);
        await storage.remove('qiko_pending_verification');

        await uiManager.showCustomAlert("Profile setup completed successfully!");
        window.location.href = getRoute('dashboard', { id: tempGeneratedId });
      } catch (err) {
        console.error("Verification confirmation check failed:", err);
        uiManager.showError('verificationErrorMsg', err.message || "Failed to confirm verification.");
        btnVerifySubmit.disabled = false;
        btnVerifySubmit.textContent = 'I have verified my email';
      }
    });
  }

  const btnResend = document.getElementById('btn-resend-verification');
  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      btnResend.disabled = true;
      btnResend.textContent = 'Sending...';
      uiManager.clearError('verificationErrorMsg');

      try {
        await firebaseAuth.firebaseSendEmailVerification(tempToken);
        await uiManager.showCustomAlert("Verification email resent. Please check spam folder too.");
      } catch (err) {
        console.error("Resending verification email failed:", err);
        uiManager.showError('verificationErrorMsg', err.message || "Failed to resend verification link.");
      } finally {
        btnResend.disabled = false;
        btnResend.textContent = 'Resend verification email';
      }
    });
  }

  const btnVerifyBack = document.getElementById('btn-verification-back');
  if (btnVerifyBack) {
    btnVerifyBack.addEventListener('click', async () => {
      if (flow === 'upgrade') {
        await storage.remove('qiko_pending_verification');
        window.location.href = getRoute('dashboard', { id: tempGeneratedId });
      } else {
        const confirmed = await uiManager.showCustomConfirm("Going back will clear your pending credentials. Are you sure?");
        if (!confirmed) return;

        uiManager.showSubScreen('screenLoading');
        try {
          await firebaseAuth.firebaseUnlinkEmail(tempToken);
          await storage.remove('qiko_pending_verification');
          
          const idInput = document.getElementById('generated-id-input');
          if (idInput) idInput.value = tempGeneratedId;

          uiManager.showSubScreen('screenProfileSetup');
        } catch (err) {
          console.error("Rollback of registration failed:", err);
          await storage.remove('qiko_pending_verification');
          window.location.href = getRoute('start');
        }
      }
    });
  }

  const formSignIn = document.getElementById('form-sign-in');
  if (formSignIn) {
    formSignIn.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;
      
      uiManager.clearError('signinErrorMsg');

      const btnSignInSubmit = document.getElementById('btn-signin-submit');
      btnSignInSubmit.disabled = true;
      btnSignInSubmit.textContent = 'Signing in...';

      try {
        const sessionAuth = await firebaseAuth.firebaseSignInWithEmail(email, password);
        const uid = sessionAuth.uid;
        const token = sessionAuth.idToken;
        const refreshToken = sessionAuth.refreshToken;

        const userProfile = await firebaseDb.getUserProfile(uid, token);
        if (!userProfile || !userProfile.qiko_id) {
          throw new Error("Unable to retrieve Qiko ID associated with this account.");
        }

        const activeState = {
          qiko_user_id: uid,
          qiko_email: email,
          qiko_username: userProfile.username || 'Guest',
          qiko_registered: true,
          qiko_id: userProfile.qiko_id,
          qiko_token: token,
          qiko_refresh_token: refreshToken
        };
        await storage.set(activeState);

        window.location.href = getRoute('dashboard', { id: userProfile.qiko_id });
      } catch (err) {
        console.error("Sign in failed:", err);
        uiManager.showError('signinErrorMsg', err.message || "Invalid credentials. Try again.");
      } finally {
        btnSignInSubmit.disabled = false;
        btnSignInSubmit.textContent = 'Sign In';
      }
    });
  }

  const btnBackToStart = document.getElementById('btn-back-to-start');
  if (btnBackToStart) {
    btnBackToStart.addEventListener('click', () => {
      window.location.href = getRoute('start');
    });
  }
}
