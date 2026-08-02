document.getElementById('refresh-btn').addEventListener('click', () => {
  const btn = document.getElementById('refresh-btn');
  const statusEl = document.getElementById('refresh-status');
  btn.disabled = true;
  statusEl.textContent = '⏳ Actualisation en cours...';
  chrome.runtime.sendMessage({ type: 'PULL_FROM_SHEET' }, (resp) => {
    btn.disabled = false;
    if (chrome.runtime.lastError) {
      statusEl.textContent = '❌ Erreur : ' + chrome.runtime.lastError.message;
      return;
    }
    if (resp && resp.ok) {
      statusEl.textContent = '✅ Données actualisées.';
    } else {
      statusEl.textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
