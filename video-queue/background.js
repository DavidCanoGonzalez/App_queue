/* global chrome */

const STORAGE_KEY = 'savedLinks';

function normalizeEntry(entry) {
  if (entry && typeof entry === 'object') {
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (url) {
      return { url, title: title || url };
    }
  }

  if (typeof entry === 'string' && entry.trim()) {
    const value = entry.trim();
    return { url: value, title: value };
  }

  return null;
}

function ensureDefaults() {
  chrome.storage.local.get([STORAGE_KEY], (data) => {
    const stored = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    const normalized = stored.map((entry) => normalizeEntry(entry)).filter(Boolean);
    if (!stored.length || stored.length !== normalized.length) {
      chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

// Ejecutamos la normalización también cuando el service worker se inicie de
// nuevo (por ejemplo, al recargar la extensión en modo desarrollador) para que
// los datos viejos se actualicen sin necesidad de reinstalarla.
ensureDefaults();
