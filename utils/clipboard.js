export async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // fallback: create textarea
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (e) {
      console.error('clipboard failed', e);
      return false;
    }
  }
}

export async function readFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (err) {
    console.error('readFromClipboard failed', err);
    throw err;
  }
}
