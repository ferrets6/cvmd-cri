// ===================================================
// CONFIGURAZIONE
// ===================================================
const REPO_OWNER = 'ferrets6';
const REPO_NAME  = 'cvmd-cri';
const FILE_PATH  = 'README.md';
const BRANCH     = 'main';

// ===================================================
// AUTENTICAZIONE TOKEN GITHUB
// ===================================================
async function checkToken(token) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    }
  );

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    const msg = (data.message || '').toLowerCase();
    if (msg.includes('expired') || msg.includes('token has expired')) {
      throw new Error('scaduto');
    }
    throw new Error('non valido o scaduto');
  }

  if (!res.ok) {
    throw new Error('non valido o scaduto');
  }

  const data = await res.json();
  if (!data.permissions || !data.permissions.push) {
    throw new Error(`mancano i permessi di scrittura sul repo ${REPO_NAME}`);
  }

  return true;
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-error');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

function showAuthGate(errorMsg) {
  document.getElementById('loading-gate').style.display = 'none';
  document.getElementById('auth-gate').style.display = 'flex';
  if (errorMsg) showAuthError(errorMsg);
}

function enterEditor() {
  document.getElementById('loading-gate').style.display = 'none';
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('editor-app').style.display = 'flex';
  loadReadme();
}

async function loginWithToken() {
  const input = document.getElementById('token-input');
  const btn   = document.getElementById('auth-btn');

  const token = input.value.trim();
  if (!token) return;

  btn.disabled    = true;
  btn.textContent = 'Verifica...';
  document.getElementById('auth-error').style.display = 'none';

  try {
    await checkToken(token);
    sessionStorage.setItem('gh_editor_token', token);
    enterEditor();
  } catch (err) {
    showAuthError('Token ' + err.message + '.');
    btn.disabled    = false;
    btn.textContent = 'Entra';
  }
}

async function initAuth() {
  const saved = sessionStorage.getItem('gh_editor_token');
  if (!saved) {
    showAuthGate();
    return;
  }
  try {
    await checkToken(saved);
    enterEditor();
  } catch (err) {
    sessionStorage.removeItem('gh_editor_token');
    showAuthGate('Sessione non valida: token ' + err.message + '. Inserisci di nuovo il token.');
  }
}

document.addEventListener('DOMContentLoaded', initAuth);

// ===================================================
// HAMBURGER MENU
// ===================================================
function toggleMenu() {
  document.getElementById('toolbar-menu').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('toolbar-menu').classList.remove('open');
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('toolbar-menu');
  const btn  = document.getElementById('btn-menu');
  if (menu && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.remove('open');
  }
});

// ===================================================
// GITHUB TOKEN
// ===================================================
function getToken() {
  return sessionStorage.getItem('gh_editor_token') || '';
}

// ===================================================
// CARICAMENTO README.md
// ===================================================
let currentFileSha = null;
let textChanged    = false;

async function loadReadme() {
  setStatus('Caricamento del CV...', 'loading');
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      { headers }
    );
    if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);

    const data = await res.json();
    currentFileSha = data.sha;
    const content = base64ToUtf8(data.content.replace(/\n/g, ''));
    document.getElementById('markdown-input').value = content;
    updatePreview();
    textChanged = false;
    updateSaveButton();
    setStatus('CV caricato correttamente.', 'success');
  } catch (err) {
    setStatus('Errore nel caricamento: ' + err.message, 'error');
  }
}

// ===================================================
// ANTEPRIMA
// ===================================================
let previewVisible   = false;
let previewFullscreen = false;
let previewTimer     = null;

function setFsBtn(isFullscreen) {
  const btn = document.getElementById('btn-preview-fs');
  if (window.innerWidth <= 640) {
    btn.textContent = isFullscreen ? '⤡' : '⤢';
    btn.title       = isFullscreen ? 'Riduci' : 'Allarga';
  } else {
    btn.textContent = isFullscreen ? 'Riduci' : 'Allarga';
    btn.title       = '';
  }
}

function setSplit(pct) {
  pct = Math.max(10, Math.min(90, pct));
  if (Math.abs(pct - 50) < 2) pct = 50;
  document.getElementById('editor-pane').style.flex = `0 0 ${pct}%`;
  sessionStorage.setItem('editor_split', pct);
}

function togglePreview() {
  previewVisible = !previewVisible;
  const pane    = document.getElementById('preview-pane');
  const resizer = document.getElementById('preview-resizer');

  pane.classList.toggle('hidden', !previewVisible);
  document.getElementById('btn-preview').classList.toggle('active', previewVisible);

  if (previewVisible) {
    const isMobile = window.innerWidth <= 640;
    const previewScroll = document.getElementById('preview-scroll');
    if (isMobile) {
      previewFullscreen = true;
      document.getElementById('editor-pane').style.display = 'none';
      resizer.style.display = 'none';
      previewScroll.classList.add('preview-centered');
      setFsBtn(true);
    } else {
      previewFullscreen = false;
      document.getElementById('editor-pane').style.display = '';
      resizer.style.display = '';
      previewScroll.classList.remove('preview-centered');
      setFsBtn(false);
      const saved = parseFloat(sessionStorage.getItem('editor_split') || '50');
      setSplit(saved);
    }
    updatePreview();
  } else {
    previewFullscreen = false;
    document.getElementById('editor-pane').style.display = '';
    document.getElementById('editor-pane').style.flex = '';
    document.getElementById('preview-scroll').classList.remove('preview-centered');
    resizer.style.display = 'none';
  }
}

function togglePreviewFullscreen() {
  previewFullscreen = !previewFullscreen;
  const editorPane    = document.getElementById('editor-pane');
  const resizer       = document.getElementById('preview-resizer');
  const previewScroll = document.getElementById('preview-scroll');

  if (previewFullscreen) {
    editorPane.style.display = 'none';
    resizer.style.display = 'none';
    previewScroll.classList.add('preview-centered');
    setFsBtn(true);
  } else {
    editorPane.style.display = '';
    resizer.style.display = '';
    previewScroll.classList.remove('preview-centered');
    setFsBtn(false);
    const saved = parseFloat(sessionStorage.getItem('editor_split') || '50');
    setSplit(saved);
  }
}

// Resize drag
(function () {
  const resizer = document.getElementById('preview-resizer');
  let dragging = false;

  function startDrag(e) {
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    if (e.cancelable) e.preventDefault();
  }

  function onDrag(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const workArea = document.getElementById('work-area');
    const rect = workArea.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    if (Math.abs(pct - 50) < 3) {
      resizer.classList.add('snap');
    } else {
      resizer.classList.remove('snap');
    }
    setSplit(pct);
  }

  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging', 'snap');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  resizer.addEventListener('mousedown', startDrag);
  resizer.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
})();

function onEditorInput() {
  textChanged = true;
  updateSaveButton();
  // Aggiorna l'anteprima con un breve ritardo per non bloccare la digitazione
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 200);
}

function updatePreview() {
  if (!previewVisible) return;
  const md = document.getElementById('markdown-input').value;
  document.getElementById('preview-content').innerHTML = marked.parse(md);
  if (previewPhotoUrl) {
    document.querySelectorAll('#preview-content img').forEach(img => {
      if (img.src.includes('profile.png')) img.src = previewPhotoUrl;
    });
  }
}

// ===================================================
// LEGENDA
// ===================================================
let legendVisible = false;

function toggleLegend() {
  legendVisible = !legendVisible;
  document.getElementById('legend-section').classList.toggle('open', legendVisible);
  document.getElementById('btn-legend-toggle').textContent = legendVisible ? '✕' : '▲';
  document.getElementById('btn-legend').classList.toggle('active', legendVisible);
}

// ===================================================
// SALVATAGGIO (commit diretto via GitHub API)
// ===================================================
// ===================================================
// STATO BOTTONE SALVA
// ===================================================
function updateSaveButton() {
  const btn        = document.getElementById('btn-save');
  if (!btn) return;
  const hasChanges = textChanged || photoChanged;
  const hasToken   = !!getToken();

  if (!hasChanges) {
    btn.disabled = true;
    btn.title    = 'Nessuna modifica da salvare';
  } else if (!hasToken) {
    btn.disabled = true;
    btn.title    = 'Inserisci il Token GitHub per salvare';
  } else {
    btn.disabled = false;
    btn.title    = '';
  }
}

async function saveChanges() {
  if (!textChanged && !photoChanged) return;

  setStatus('Salvataggio in corso...', 'loading');
  try {
    if (photoChanged) {
      await uploadFileToGitHub(
        'assets/profile.png', confirmedProfileBlob,
        'Aggiornamento foto profilo tramite editor web'
      );
      await uploadFileToGitHub(
        'assets/og-image.png', confirmedOgBlob,
        'Aggiornamento og-image tramite editor web'
      );
      confirmedProfileBlob = null;
      confirmedOgBlob      = null;
      photoChanged         = false;
    }

    if (textChanged) {
      if (!currentFileSha) {
        setStatus('Il file non risulta caricato. Ricarica la pagina.', 'error');
        return;
      }
      const token   = getToken();
      const content = document.getElementById('markdown-input').value;
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
          },
          body: JSON.stringify({
            message: 'Aggiornamento CV tramite editor web',
            content: utf8ToBase64(content),
            sha: currentFileSha,
            branch: BRANCH,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      currentFileSha = data.content.sha;
      textChanged    = false;
    }

    if (previewPhotoUrl) {
      URL.revokeObjectURL(previewPhotoUrl);
      previewPhotoUrl = null;
    }
    document.getElementById('btn-restore-photo').style.display = 'none';
    updateSaveButton();
    setStatus(
      'Modifiche salvate. La GitHub Action aggiornerà il sito automaticamente (1-2 minuti).',
      'success'
    );
  } catch (err) {
    setStatus('Errore nel salvataggio: ' + err.message, 'error');
  }
}

// ===================================================
// CAMBIO FOTO PROFILO
// ===================================================
const MAX_PROFILE_SIZE = 300;
const OG_WIDTH = 1200, OG_HEIGHT = 630;

let photoChanged         = false;
let confirmedProfileBlob = null;
let confirmedOgBlob      = null;
let previewProfileBlob   = null;
let previewOgBlob        = null;
let previewPhotoUrl      = null; // object URL del blob confermato, per l'anteprima

function cropToCircle(img) {
  const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
  const size    = Math.min(srcSize, MAX_PROFILE_SIZE);
  const canvas  = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const srcX = (img.naturalWidth  - srcSize) / 2;
  const srcY = (img.naturalHeight - srcSize) / 2;
  ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
  return canvas;
}

function generateOgCanvas(profileCanvas) {
  const canvas  = document.createElement('canvas');
  canvas.width  = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, OG_WIDTH, 0);
  grad.addColorStop(0, '#155799');
  grad.addColorStop(1, '#159957');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  const px = Math.round((OG_WIDTH  - profileCanvas.width)  / 2);
  const py = Math.round((OG_HEIGHT - profileCanvas.height) / 2);
  ctx.drawImage(profileCanvas, px, py);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function onPhotoSelected(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const img = new Image();
  img.onload = async () => {
    const profileCanvas = cropToCircle(img);
    const ogCanvas      = generateOgCanvas(profileCanvas);

    previewProfileBlob = await canvasToBlob(profileCanvas);
    previewOgBlob      = await canvasToBlob(ogCanvas);

    // Mostra anteprima nel modal
    const previewCanvas = document.getElementById('photo-preview-canvas');
    previewCanvas.width  = profileCanvas.width;
    previewCanvas.height = profileCanvas.height;
    previewCanvas.getContext('2d').drawImage(profileCanvas, 0, 0);
    document.getElementById('photo-modal').classList.add('open');
  };
  img.src = URL.createObjectURL(file);
}

function cancelPhoto() {
  document.getElementById('photo-modal').classList.remove('open');
  previewProfileBlob = null;
  previewOgBlob      = null;
}

function confirmPhoto() {
  if (previewPhotoUrl) URL.revokeObjectURL(previewPhotoUrl);
  previewPhotoUrl      = URL.createObjectURL(previewProfileBlob);
  confirmedProfileBlob = previewProfileBlob;
  confirmedOgBlob      = previewOgBlob;
  previewProfileBlob   = null;
  previewOgBlob        = null;
  photoChanged         = true;
  document.getElementById('photo-modal').classList.remove('open');
  document.getElementById('btn-restore-photo').style.display = '';
  updatePreview();
  updateSaveButton();
}

function restorePhoto() {
  if (previewPhotoUrl) {
    URL.revokeObjectURL(previewPhotoUrl);
    previewPhotoUrl = null;
  }
  confirmedProfileBlob = null;
  confirmedOgBlob      = null;
  photoChanged         = false;
  document.getElementById('btn-restore-photo').style.display = 'none';
  updatePreview();
  updateSaveButton();
}

async function getFileSha(path) {
  const headers = { Accept: 'application/vnd.github+json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    { headers }
  );
  if (!res.ok) return null;
  return (await res.json()).sha;
}

async function uploadFileToGitHub(path, blob, message) {
  const token = getToken();
  if (!token) throw new Error('Token GitHub mancante.');
  const b64  = await blobToBase64(blob);
  const sha  = await getFileSha(path);
  const body = { message, content: b64, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
}

// ===================================================
// UTILITA'
// ===================================================
let toastTimer = null;

function setStatus(msg, type) {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);

  if (!msg) {
    toast.style.display = 'none';
    return;
  }

  toast.textContent = msg;
  toast.className   = type || '';
  toast.style.display = '';

  if (type !== 'loading') {
    const delay = type === 'error' ? 6000 : 4000;
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, delay);
  }
}

// Converte una stringa UTF-8 in Base64 (gestisce correttamente accenti e caratteri non-ASCII)
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

// Converte Base64 in stringa UTF-8
function base64ToUtf8(b64) {
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
