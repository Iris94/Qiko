export async function getUserEmail() {
  try {
    const userEmail = await chrome.identity.getProfileUserInfo({
      accountStatus: "ANY",
    });
    
    if (userEmail && userEmail.email) {
      return { 
        success: true, 
        email: userEmail.email,
      };
    } else {
      return { 
        success: false, 
        email: null 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      email: null, 
      error: error.message 
    };
  }
}
