const STORAGE_KEY = 'savedLinks';
const AUTO_SAVE_KEY = 'autoSaveEnabled';

async function getStoredValues(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(items));
  });
}

async function setStoredValues(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

async function ensureDefaults() {
  const data = await getStoredValues([STORAGE_KEY, AUTO_SAVE_KEY]);
  const updates = {};
  if (!Array.isArray(data[STORAGE_KEY])) {
    updates[STORAGE_KEY] = [];
  }
  if (typeof data[AUTO_SAVE_KEY] !== 'boolean') {
    updates[AUTO_SAVE_KEY] = false;
  }
  if (Object.keys(updates).length) {
    await setStoredValues(updates);
  }
}

async function appendLinks(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return false;
  }

  const validUrls = urls.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
  if (!validUrls.length) {
    return false;
  }

  const { [STORAGE_KEY]: stored = [] } = await getStoredValues([STORAGE_KEY]);
  const unique = new Set(stored);
  let changed = false;

  for (const url of validUrls) {
    if (!unique.has(url)) {
      unique.add(url);
      stored.push(url);
      changed = true;
    }
  }

  if (changed) {
    await setStoredValues({ [STORAGE_KEY]: stored });
  }

  return changed;
}

async function handleAutoSave(tab) {
  if (!tab || !tab.url) {
    return;
  }

  const { [AUTO_SAVE_KEY]: autoSaveEnabled = false } = await getStoredValues([AUTO_SAVE_KEY]);
  if (!autoSaveEnabled) {
    return;
  }

  await appendLinks([tab.url]);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.tabs.onCreated.addListener((tab) => {
  handleAutoSave(tab);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    handleAutoSave(tab);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'setAutoSave') {
    const enabled = Boolean(message.enabled);
    setStoredValues({ [AUTO_SAVE_KEY]: enabled }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message?.type === 'ensureDefaults') {
    ensureDefaults().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  return undefined;
});
