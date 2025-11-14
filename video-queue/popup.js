const STORAGE_KEY = 'savedLinks';
const AUTO_SAVE_KEY = 'autoSaveEnabled';

const elements = {
  saveTabs: document.getElementById('saveTabs'),
  exportCsv: document.getElementById('exportCsv'),
  clearList: document.getElementById('clearList'),
  linksList: document.getElementById('linksList'),
  savedCount: document.getElementById('savedCount'),
  autoSaveToggle: document.getElementById('autoSaveToggle')
};

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

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
  if (!Array.isArray(links) || !links.length) {
    elements.savedCount.textContent = '0 enlaces guardados';
    return;
  }

  const fragment = document.createDocumentFragment();
  links.forEach((link, index) => {
    const item = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.textContent = `${index + 1}. ${link}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    item.appendChild(anchor);
    fragment.appendChild(item);
  });

  elements.linksList.appendChild(fragment);
  elements.savedCount.textContent = `${links.length} enlace${links.length === 1 ? '' : 's'} guardado${links.length === 1 ? '' : 's'}`;
}

function getStored(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(items));
  });
}

function setStored(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

async function loadState() {
  await sendMessage({ type: 'ensureDefaults' }).catch(() => {});
  const data = await getStored([STORAGE_KEY, AUTO_SAVE_KEY]);
  renderLinks(Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : []);
  elements.autoSaveToggle.checked = Boolean(data[AUTO_SAVE_KEY]);
}

async function saveCurrentTabs() {
  const tabs = await queryTabs({ currentWindow: true });
  const urls = tabs.map((tab) => tab.url).filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url));
  if (!urls.length) {
    return;
  }

  const existing = await getStored([STORAGE_KEY]);
  const stored = Array.isArray(existing[STORAGE_KEY]) ? existing[STORAGE_KEY] : [];
  const unique = new Set(stored);
  const additions = [];

  urls.forEach((url) => {
    if (!unique.has(url)) {
      unique.add(url);
      additions.push(url);
    }
  });

  if (!additions.length) {
    return;
  }

  const updated = [...stored, ...additions];
  await setStored({ [STORAGE_KEY]: updated });
  renderLinks(updated);
}

async function exportCsv() {
  const data = await getStored([STORAGE_KEY]);
  const links = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  if (!links.length) {
    return;
  }

  const rows = [['Indice', 'URL'], ...links.map((link, index) => [index + 1, link])];
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
  await setStored({ [STORAGE_KEY]: [] });
  renderLinks([]);
}

async function toggleAutoSave(event) {
  const enabled = event.target.checked;
  elements.autoSaveToggle.disabled = true;
  try {
    await sendMessage({ type: 'setAutoSave', enabled });
  } catch (error) {
    event.target.checked = !enabled;
  } finally {
    elements.autoSaveToggle.disabled = false;
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes[STORAGE_KEY]) {
    renderLinks(changes[STORAGE_KEY].newValue || []);
  }

  if (changes[AUTO_SAVE_KEY]) {
    elements.autoSaveToggle.checked = Boolean(changes[AUTO_SAVE_KEY].newValue);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  elements.saveTabs.addEventListener('click', saveCurrentTabs);
  elements.exportCsv.addEventListener('click', exportCsv);
  elements.clearList.addEventListener('click', clearList);
  elements.autoSaveToggle.addEventListener('change', toggleAutoSave);
});
