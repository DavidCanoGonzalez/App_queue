const STORAGE_KEY = 'savedLinks';
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

const elements = {
  saveTabs: document.getElementById('saveTabs'),
  exportCsv: document.getElementById('exportCsv'),
  clearList: document.getElementById('clearList'),
  linksList: document.getElementById('linksList'),
  savedCount: document.getElementById('savedCount')
};

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tabs);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function renderLinks(links) {
  elements.linksList.innerHTML = '';
  const normalized = Array.isArray(links)
    ? links.map((entry) => normalizeEntry(entry)).filter(Boolean)
    : [];

  if (!normalized.length) {
    elements.savedCount.textContent = '0 enlaces guardados';
    return;
  }

  const fragment = document.createDocumentFragment();
  normalized.forEach((entry, index) => {
    const item = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = entry.url;
    anchor.textContent = entry.title || entry.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    item.appendChild(anchor);
    fragment.appendChild(item);
  });

  elements.linksList.appendChild(fragment);
  elements.savedCount.textContent = `${normalized.length} enlace${normalized.length === 1 ? '' : 's'} guardado${normalized.length === 1 ? '' : 's'}`;
}

function getLinks() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (items) => {
      const stored = Array.isArray(items[STORAGE_KEY]) ? items[STORAGE_KEY] : [];
      resolve(stored.map((entry) => normalizeEntry(entry)).filter(Boolean));
    });
  });
}

function setLinks(links) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: links }, () => resolve());
  });
}

async function loadState() {
  const links = await getLinks();
  renderLinks(links);
}

async function saveCurrentTabs() {
  const tabs = await queryTabs({ currentWindow: true });
  const entries = tabs
    .map((tab) => ({ url: tab.url, title: tab.title || tab.url }))
    .map((entry) => normalizeEntry(entry))
    .filter((entry) => entry && /^https?:\/\//i.test(entry.url));

  if (!entries.length) {
    return;
  }

  const stored = await getLinks();
  const unique = new Set(stored.map((entry) => entry.url));
  const additions = [];

  entries.forEach((entry) => {
    if (!unique.has(entry.url)) {
      unique.add(entry.url);
      additions.push(entry);
    }
  });

  if (!additions.length) {
    return;
  }

  const updated = [...stored, ...additions];
  await setLinks(updated);
  renderLinks(updated);
}

async function exportCsv() {
  const links = await getLinks();
  if (!links.length) {
    return;
  }

  const rows = [['Titulo', 'URL'], ...links.map((link) => [link.title || link.url, link.url])];
  const csvContent = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename: 'video-queue.csv',
    saveAs: true
  }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function clearList() {
  await setLinks([]);
  renderLinks([]);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes[STORAGE_KEY]) {
    renderLinks(changes[STORAGE_KEY].newValue || []);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  elements.saveTabs.addEventListener('click', saveCurrentTabs);
  elements.exportCsv.addEventListener('click', exportCsv);
  elements.clearList.addEventListener('click', clearList);
});
