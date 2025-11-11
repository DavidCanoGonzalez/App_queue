// Video Queue Saver — background (service worker)
const STORAGE_KEY = 'links';
const AUTO_KEY = 'autoSave';

function hostname(h) { return (h || '').replace(/^www\./, ''); }

function isVideoUrl(url) {
  try {
    const u = new URL(url);
    const h = hostname(u.hostname);
    const p = u.pathname;

    // Plataformas comunes (MVP). Ajusta/añade según necesites.
    if (h.endsWith('youtube.com') && (p === '/watch' || p.startsWith('/shorts'))) return true;
    if (h === 'youtu.be') return true;
    if (h.endsWith('twitch.tv') && (/^\/videos\//.test(p) || /^\/clip\//.test(p) || /^\/[A-Za-z0-9_]+$/.test(p))) return true; // canal o vídeo/clip
    if (h.endsWith('vimeo.com') && /^\/\d+/.test(p)) return true;
    if (h.endsWith('tiktok.com') && /\/video\//.test(p)) return true;
    if ((h.endsWith('x.com') || h.endsWith('twitter.com')) && /\/status\/\d+/.test(p)) return true;
    if (h.endsWith('facebook.com') && (p.startsWith('/watch') || /\/videos\//.test(p))) return true;
    if (h.endsWith('dailymotion.com') && /\/video\//.test(p)) return true;
    if (h.endsWith('kick.com') && /\/video\//.test(p)) return true;
    if (h.endsWith('reddit.com') && /\/comments\//.test(p)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

async function getLinks() {
  const data = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
  return data[STORAGE_KEY] || [];
}
async function setLinks(links) { await chrome.storage.local.set({ [STORAGE_KEY]: links }); }

async function getAuto() {
  const data = await chrome.storage.local.get({ [AUTO_KEY]: false });
  return !!data[AUTO_KEY];
}
async function setAuto(v) { await chrome.storage.local.set({ [AUTO_KEY]: !!v }); }

async function saveTab(tab) {
  if (!tab || !tab.url || !isVideoUrl(tab.url)) return false;
  const links = await getLinks();
  if (links.some(l => l.url === tab.url)) return false; // dedupe por URL exacta
  const entry = {
    url: tab.url,
    title: tab.title || '',
    favicon: tab.favIconUrl || '',
    host: hostname(new URL(tab.url).hostname),
    savedAt: Date.now(),
    // mantenemos 'watched' por compatibilidad, pero ya no se usa en la UI
    watched: false
  };
  await setLinks([entry, ...links]); // prepend
  return true;
}

async function saveAllVideoTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let saved = 0;
  for (const t of tabs) if (await saveTab(t)) saved++;
  return saved;
}

async function removeLink(url) {
  const links = await getLinks();
  const filtered = links.filter(l => l.url !== url);
  await setLinks(filtered);
}

async function clearAll() { await setLinks([]); }

// Atajos de teclado
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save_video_tabs') {
    await saveAllVideoTabs();
  } else if (command === 'toggle_auto_save') {
    const cur = await getAuto();
    await setAuto(!cur);
  }
});

// Auto-guardado al navegar
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // solo frame principal
  const auto = await getAuto();
  if (!auto) return;
  const tab = await chrome.tabs.get(details.tabId);
  await saveTab(tab);
});

// Mensajería con el popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'SAVE_ALL') {
      const saved = await saveAllVideoTabs();
      sendResponse({ saved });
    } else if (msg?.type === 'GET_STATE') {
      const [auto, links] = await Promise.all([getAuto(), getLinks()]);
      sendResponse({ auto, links });
    } else if (msg?.type === 'SET_AUTO') {
      await setAuto(msg.value);
      sendResponse({ ok: true });
    } else if (msg?.type === 'DELETE_LINK') {
      await removeLink(msg.url);
      sendResponse({ ok: true });
    } else if (msg?.type === 'CLEAR_ALL') {
      await clearAll();
      sendResponse({ ok: true });
    }
  })();
  return true; // respuesta async
});
