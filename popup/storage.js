
export async function saveSession(session) {

  try {
    await chrome.storage.local.set({ quiko_session: session });
  } catch (err) {
    console.error('saveSession failed', err);
  }
}

export async function getSession() {
  try {
    const data = await chrome.storage.local.get('quiko_session');
    return data.quiko_session || null;
  } catch (err) {
    console.error('getSession failed', err);
    return null;
  }
}

export async function removeSession() {
  try {
    await chrome.storage.local.remove('quiko_session');
  } catch (err) {
    console.error('removeSession failed', err);
  }
}
