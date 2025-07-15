const input = document.getElementById('daily-count');
const save = document.getElementById('save-btn');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('dailyCount', ({ dailyCount }) => {
    input.value = dailyCount || 5;
  });
});

save.addEventListener('click', () => {
  const val = parseInt(input.value, 10) || 5;
  chrome.storage.sync.set({ dailyCount: val }, () => {
    alert('Settings saved');
  });
});
