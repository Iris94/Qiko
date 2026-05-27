export function getRoute(routeName, params = {}) {
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  const searchParams = new URLSearchParams(params).toString();
  const querySuffix = searchParams ? `?${searchParams}` : '';
  
  if (isExtension) {
    switch (routeName) {
      case 'start': 
        return chrome.runtime.getURL(`index.html${querySuffix}`);
      case 'logins': 
        return chrome.runtime.getURL(`screens/logins.html${querySuffix}`);
      case 'dashboard': 
        return chrome.runtime.getURL(`screens/dashboard.html${querySuffix}`);
      default: 
        return chrome.runtime.getURL('index.html');
    }
  } else {
    switch (routeName) {
      case 'start': return `/chat${querySuffix}`;
      case 'logins': return `/chat/logins${querySuffix}`;
      case 'dashboard': return `/chat/dashboard${querySuffix}`;
      default: return `/chat`;
    }
  }
}
