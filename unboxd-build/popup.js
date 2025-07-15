document.getElementById('sync-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'sync' }, (resp) => {
    document.getElementById('popup-status').textContent = resp.status;
  });
});
