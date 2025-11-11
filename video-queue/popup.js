const listEl = document.querySelector('#list');
const statsEl = document.querySelector('#stats');
const autoToggle = document.querySelector('#autoToggle');
const saveAllBtn = document.querySelector('#saveAll');
const exportBtn = document.querySelector('#exportCsv');
const clearAllBtn = document.querySelector('#clearAll');
const tpl = document.querySelector('#itemTpl');

function fmtDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ''; }
}

function escapeCsvCell(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function render(links, auto) {
  autoToggle.checked = !!auto;
  statsEl.textContent = `${links.length} enlaces guardados`;
  listEl.innerHTML = '';

  for (const l of links) {
    const node = tpl.content.cloneNode(true);
    const fav = node.querySelector('.favicon');
    const a = node.querySelector('.title');
    const sub = node.querySelector('.sub');
    const delBtn = node.querySelector('.delBtn');

    fav.src = l.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(l.host)}&sz=32`;
    a.href = l.url;
    a.textContent = l.title || l.url;
    sub.textContent = `${l.host} • ${fmtDate(l.savedAt)}`;

    delBtn.addEventListener('click', async () => {
      await sendMsg({ type: 'DELETE_LINK', url: l.url });
      await bootstrap();
    });

    listEl.appendChild(node);
  }
}

function sendMsg(msg) { return chrome.runtime.sendMessage(msg); }

async function bootstrap() {
  const { auto, links } = await sendMsg({ type: 'GET_STATE' });
  render(links, auto);
}

saveAllBtn.addEventListener('click', async () => {
  saveAllBtn.disabled = true;
  await sendMsg({ type: 'SAVE_ALL' });
  await bootstrap();
  saveAllBtn.disabled = false;
});

autoToggle.addEventListener('change', async () => {
  await sendMsg({ type: 'SET_AUTO', value: autoToggle.checked });
});

exportBtn.addEventListener('click', async () => {
  const { links } = await sendMsg({ type: 'GET_STATE' });
  const header = ['title','url','host','savedAt'];
  const rows = links.map(l => [
    escapeCsvCell(l.title),
    escapeCsvCell(l.url),
    escapeCsvCell(l.host),
    escapeCsvCell(new Date(l.savedAt).toISOString())
  ].join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  await chrome.downloads.download({ url: dataUrl, filename: 'video-queue.csv', saveAs: true });
});

clearAllBtn.addEventListener('click', async () => {
  if (!confirm('¿Borrar TODOS los enlaces guardados? Esta acción no se puede deshacer.')) return;
  await sendMsg({ type: 'CLEAR_ALL' });
  await bootstrap();
});

bootstrap();
