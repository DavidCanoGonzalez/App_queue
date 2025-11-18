const STORAGE_KEY = 'savedLinks';
const AUTO_SAVE_KEY = 'autoSaveEnabled';

function normalizeEntry(entry) {
  if (entry && typeof entry === 'object') {
    const url = typeof entry.url === 'string' ? entry.url : '';
    const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title : url;
    if (url) {
      return { url, title: title || url };
    }
  }

  if (typeof entry === 'string' && entry.trim()) {
    return { url: entry, title: entry };
  }

  return null;
}

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
  } else {
    const normalized = data[STORAGE_KEY].map((entry) => normalizeEntry(entry)).filter(Boolean);
    if (normalized.length !== data[STORAGE_KEY].length || (normalized[0] && typeof data[STORAGE_KEY][0] !== 'object')) {
      updates[STORAGE_KEY] = normalized;
    }
  }
  if (typeof data[AUTO_SAVE_KEY] !== 'boolean') {
    updates[AUTO_SAVE_KEY] = false;
  }
  if (Object.keys(updates).length) {
    await setStoredValues(updates);
  }
}

async function appendEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return false;
  }

  const normalized = entries
    .map((entry) => {
      const normalizedEntry = normalizeEntry(entry);
      if (!normalizedEntry || !/^https?:\/\//i.test(normalizedEntry.url)) {
        return null;
      }
      if (!normalizedEntry.title) {
        normalizedEntry.title = normalizedEntry.url;
      }
      return normalizedEntry;
    })
    .filter(Boolean);

  if (!normalized.length) {
    return false;
  }

  const { [STORAGE_KEY]: stored = [] } = await getStoredValues([STORAGE_KEY]);
  const unique = new Set(
    stored
      .map((entry) => normalizeEntry(entry))
      .filter(Boolean)
      .map((entry) => entry.url)
  );
  let changed = false;

  const updatedStored = stored
    .map((entry) => normalizeEntry(entry))
    .filter(Boolean);

  for (const entry of normalized) {
    if (!unique.has(entry.url)) {
      unique.add(entry.url);
      updatedStored.push(entry);
      changed = true;
    }
  }

  if (changed) {
    await setStoredValues({ [STORAGE_KEY]: updatedStored });
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

  await appendEntries([{ url: tab.url, title: tab.title || tab.url }]);
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
