// ===================================================
// CONFIGURAZIONE
// ===================================================
const REPO_OWNER = 'ferrets6';
const REPO_NAME  = 'cvmd-cri';
const FILE_PATH  = 'README.md';
const BRANCH     = 'main';

// Hash SHA-256 della password di accesso.
//
// Per impostare la tua password:
//   1. Scegli una password
//   2. Calcola il suo SHA-256 in esadecimale:
//      - Linux/Mac:  echo -n "latuapassword" | sha256sum
//      - Windows PS: (Get-FileHash -Algorithm SHA256 -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes("latuapassword")))).Hash.ToLower()
//      - Online:     cerca "sha256 online calculator" e incolla la password
//   3. Sostituisci il valore qui sotto con l'hash ottenuto (stringa di 64 caratteri hex)
//
// SICUREZZA: se il repo e' privato, questo file non e' pubblicamente visibile.
// Se il repo e' pubblico, l'hash e' visibile ma SHA-256 di una password forte
// e' computazionalmente inattaccabile tramite brute force.
const PASSWORD_HASH = 'ac12c9b6379fecc1b808eee44cd66ef558b11a35c03510c911f4777ff7f93cc2';

// ===================================================
// AUTENTICAZIONE
// ===================================================
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkPassword() {
  const input = document.getElementById('password-input');
  const errEl = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-btn');

  if (!input.value) return;
  btn.disabled    = true;
  btn.textContent = 'Verifica...';

  const hash = await sha256(input.value);

  if (hash === PASSWORD_HASH) {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('editor-app').style.display = 'flex';
    // Ripristina token dalla sessione (se era stato salvato in precedenza)
    const saved = sessionStorage.getItem('gh_editor_token');
    if (saved) {
      document.getElementById('github-token').value = saved;
      markTokenBar(true);
    }
    loadReadme();
  } else {
    errEl.style.display = 'block';
    input.value = '';
    input.focus();
    btn.disabled    = false;
    btn.textContent = 'Accedi';
  }
}

// ===================================================
// GITHUB TOKEN
// ===================================================
function persistToken() {
  const token = document.getElementById('github-token').value.trim();
  if (token) {
    sessionStorage.setItem('gh_editor_token', token);
    markTokenBar(true);
  } else {
    sessionStorage.removeItem('gh_editor_token');
    markTokenBar(false);
  }
}

function markTokenBar(ok) {
  document.getElementById('token-bar').classList.toggle('token-ok', ok);
}

function getToken() {
  return (
    sessionStorage.getItem('gh_editor_token') ||
    document.getElementById('github-token').value.trim()
  );
}

// ===================================================
// CARICAMENTO README.md
// ===================================================
let currentFileSha = null;

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
    setStatus('CV caricato correttamente.', 'success');
  } catch (err) {
    setStatus('Errore nel caricamento: ' + err.message, 'error');
  }
}

// ===================================================
// ANTEPRIMA
// ===================================================
let previewVisible = false;
let previewTimer   = null;

function togglePreview() {
  previewVisible = !previewVisible;
  document.getElementById('preview-pane').classList.toggle('hidden', !previewVisible);
  document.getElementById('btn-preview').classList.toggle('active', previewVisible);
  if (previewVisible) updatePreview();
}

function onEditorInput() {
  // Aggiorna l'anteprima con un breve ritardo per non bloccare la digitazione
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 200);
}

function updatePreview() {
  if (!previewVisible) return;
  const md = document.getElementById('markdown-input').value;
  document.getElementById('preview-content').innerHTML = marked.parse(md);
}

// ===================================================
// LEGENDA
// ===================================================
let legendVisible = false;

function toggleLegend() {
  legendVisible = !legendVisible;
  document.getElementById('legend-section').classList.toggle('open', legendVisible);
  document.getElementById('btn-legend').classList.toggle('active', legendVisible);
}

// ===================================================
// SALVATAGGIO (commit diretto via GitHub API)
// ===================================================
async function saveChanges() {
  const token = getToken();
  if (!token) {
    setStatus('Inserisci il GitHub Token prima di salvare.', 'error');
    document.getElementById('github-token').focus();
    return;
  }
  if (!currentFileSha) {
    setStatus('Il file non risulta caricato. Ricarica la pagina.', 'error');
    return;
  }

  const content = document.getElementById('markdown-input').value;
  setStatus('Salvataggio in corso...', 'loading');

  try {
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
    // Aggiorna lo SHA locale per consentire salvataggi successivi nella stessa sessione
    currentFileSha = data.content.sha;
    setStatus(
      'CV salvato. La GitHub Action aggiornera\' il sito automaticamente (di solito in 1-2 minuti).',
      'success'
    );
  } catch (err) {
    setStatus('Errore nel salvataggio: ' + err.message, 'error');
  }
}

// ===================================================
// UTILITA'
// ===================================================
function setStatus(msg, type) {
  const bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className   = type || '';
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
