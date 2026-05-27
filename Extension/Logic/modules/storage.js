export const storage = {
  get: async (keys) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    } else {
      const safeParse = (val) => {
        if (val === null) return null;
        try {
          return JSON.parse(val);
        } catch (e) {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return val;
        }
      };

      const result = {};
      if (typeof keys === 'string') {
        const val = localStorage.getItem(keys);
        if (val !== null) {
          result[keys] = safeParse(val);
        }
      } else if (Array.isArray(keys)) {
        for (const k of keys) {
          const val = localStorage.getItem(k);
          if (val !== null) {
            result[k] = safeParse(val);
          }
        }
      } else if (typeof keys === 'object' && keys !== null) {
        for (const [k, defaultVal] of Object.entries(keys)) {
          const val = localStorage.getItem(k);
          result[k] = val !== null ? safeParse(val) : defaultVal;
        }
      }
      return result;
    }
  },
  set: async (items) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, resolve);
      });
    } else {
      for (const [k, v] of Object.entries(items)) {
        const strVal = typeof v === 'string' ? v : JSON.stringify(v);
        localStorage.setItem(k, strVal);
      }
    }
  },
  remove: async (key) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve);
      });
    } else {
      localStorage.removeItem(key);
    }
  },
  clear: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.clear(resolve);
      });
    } else {
      localStorage.clear();
    }
  }
};
