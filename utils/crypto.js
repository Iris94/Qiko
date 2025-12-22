
export function generate128BitKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isValidKey(key) {
  // basic check: base64url with expected length (22 characters for 16-byte -> base64url)
  if (!key || typeof key !== 'string') return false;
  return /^[A-Za-z0-9_-]{22}$/.test(key);
}
