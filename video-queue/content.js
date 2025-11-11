// content.js — Detector genérico de vídeo en la página
(function () {
  let lastNotifiedUrl = null;

  function hasVideo() {
    // 1) Video HTML5 visible o en el DOM
    if (document.querySelector('video')) return true;
    if (document.querySelector('source[type^="video/"]')) return true;
    if (document.querySelector('link[as="video"], link[type^="video/"]')) return true;

    // 2) Metadatos sociales que suelen indicar reproductor
    if (document.querySelector('meta[property="og:video"], meta[property="og:video:url"]')) return true;
    if (document.querySelector('meta[name="twitter:player"], meta[property="twitter:player"]')) return true;

    return false;
  }

  function notifyIfNeeded() {
    if (location.href === lastNotifiedUrl) return;
    if (!hasVideo()) return;
    lastNotifiedUrl = location.href;
    chrome.runtime.sendMessage({ type: 'PAGE_VIDEO_PRESENT' });
  }

  // Primer chequeo
  const startNotify = () => setTimeout(notifyIfNeeded, 800);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startNotify();
  } else {
    document.addEventListener('DOMContentLoaded', startNotify, { once: true });
  }
  window.addEventListener('load', startNotify, { once: true });

  // Si algún <video> empieza a reproducir, avisamos
  document.addEventListener('play', (ev) => {
    if (ev.target && ev.target.tagName === 'VIDEO') notifyIfNeeded();
  }, true);

  // Responder a detecciones explícitas desde el background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'DETECT_VIDEO') {
      sendResponse({ hasVideo: hasVideo() });
      return true;
    }
  });
})();
