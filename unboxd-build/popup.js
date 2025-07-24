// CLICK EVENT LISTENERS
document.getElementById('toggle-ext').addEventListener('click', async () => {
  const checkbox = document.getElementById('toggle-ext');
  const store = await chrome.storage.local.get(["isSessionActive"]);

  const newState = !store["isSessionActive"];
  await chrome.storage.local.set({ "isSessionActive": newState });

  checkbox.checked = newState;
});

document.getElementById("sync-btn").addEventListener('click', async () => {
  chrome.runtime.sendMessage({
    type: 'RESET_UNBOXD'
  });
});

// DOM EVENT LISTENERS
document.addEventListener('DOMContentLoaded', async () => {
  const checkbox = document.getElementById('toggle-ext');
  const store = await chrome.storage.local.get(["isSessionActive"]);

  checkbox.checked = !!store["isSessionActive"];
});

document.addEventListener('DOMContentLoaded', async () => {
  const checkbox = document.getElementById('toggle-ext');
  const store = await chrome.storage.local.get(["isSessionActive"]);
  checkbox.checked = !!store["isSessionActive"];

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;
  if (activeTab === "instructions") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab.url;

    if (!url || !url.includes("letterboxd.com")) {
      renderStatusMessage("Unboxd only works on Letterboxd.com pages.", "warning");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "CHECK_LOGIN_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        renderStatusMessage("Unboxd only works on Letterboxd when the page is fully loaded.", "warning");
        return;
      }

      if (!response?.loggedIn) {
        renderStatusMessage("Please log in to Letterboxd to use Unboxd.", "info");
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  await renderStats();
});

// HELPER FUNCTIONS 
function renderStatusMessage(text, type) {
  const contentContainer = document.getElementById('popup-content');

  const iconColor = type === "warning" ? "#ff8000" : "#40bcf4"; // orange or blue
  const icon = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="${iconColor}" viewBox="0 0 24 24" width="20" height="20">
      <path d="M1 21h22L12 2 1 21zM12 16v-4h1v4h-1zm0 2h1v1h-1v-1z"/>
    </svg>`;

  contentContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; background-color: #1d2128; padding: 1rem; border-radius: 8px; color: #ccc;">
      <div>${icon}</div>
      <div style="font-size: 0.95rem;">${text}</div>
    </div>
  `;
}

async function renderStats() {
  const statsBox = document.getElementById('unboxd-stats');
  const store = await chrome.storage.local.get(["loggedMovies"]);

  const loggedCount = store.loggedMovies ?? 0;

  statsBox.innerHTML = `
    <div class="unboxd-stats-widget">
      <div class="stat">
        <div class="stat-label">🎬 Logged</div>
        <div class="stat-value">${loggedCount}</div>
      </div>
    </div>
  `;
}

// UI UPDATES
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-tab");

    tabButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    tabContents.forEach(tab => {
      if (tab.id === target) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  });
});
