(async () => {

  let sessionStatus = await chrome.storage.local.get(["isSessionActive"]);
  
  function removeUnboxdUI() {
    document.querySelector('#unboxd-launcher')?.closest('li')?.remove();
    document.querySelector('#unboxd-overlay')?.remove();
    document.querySelector('#unboxd-modal')?.remove();
  }

  // Helper to inject Unboxd nav item
  function injectUnboxdLauncher() {
    const navList = document.querySelector(
      '#header > section > div.react-component > div > nav > ul'
    );
    if (!navList || document.querySelector('#unboxd-launcher')) return;

    const li = document.createElement('li');
    li.classList.add('navitem', 'unboxd-navitem');

    const link = document.createElement('a');
    link.id = 'unboxd-launcher';
    link.href = '#';
    link.classList.add('unboxd-navlink');
    link.setAttribute('aria-label', 'Open Unboxd widget');
    link.innerHTML = `
  <svg id="Layer_2" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 89.96 89.96">
    <defs>
      <style>
        .cls-1 {
          fill: #2C343F;
        }

        .cls-2 {
          fill: #40bcf4;
        }

        .cls-3 {
          fill: #01e054;
        }

        .cls-4 {
          fill: #ff8000;
        }
      </style>
    </defs>
    <g id="Layer_1-2" data-name="Layer 1">
      <g>
        <rect class="cls-1" width="89.96" height="89.96" rx="4.71" ry="4.71"/>
        <g>
          <rect class="cls-4" x="35.77" width="18.43" height="19.15"/>
          <rect class="cls-3" x="35.77" y="18.43" width="18.43" height="19.72"/>
          <polygon class="cls-2" points="54.19 65.73 44.98 56.52 35.77 65.73 35.77 36.85 54.19 36.85 54.19 65.73"/>
        </g>
      </g>
    </g>
  </svg>
    `;

    li.appendChild(link);
    navList.appendChild(li);

    link.addEventListener('click', openModal);
  }

  function openModal() {
    chrome.runtime.sendMessage({type: 'FETCH_RANDOM_MOVIE'});

    const overlay = document.createElement('div');
    overlay.id = 'unboxd-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.id = 'unboxd-modal';
    modal.innerHTML = `
      <h2 style="color:#fff"><strong>un<span style="color:#ff8000">b</span><span style="color:#01e054">o</span><span style="color:#40bcf4">x</span>d</strong></h2>      
      <div id="unboxd-list">Loading…</div>
      <div id="unboxd-buttons-set"> 
        <button id="unboxd-close">Close [×]</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('unboxd-close').addEventListener('click', () => {
      overlay.remove();
      modal.remove();
    });
  }

  const signInLabel = document.querySelector(
    '#header > section > div.react-component > div > nav > ul > li.navitem.sign-in-menu > a > span.label'
  );

  const isSignedIn = signInLabel ? signInLabel.textContent.trim().toLowerCase() !== 'sign in' : true;

  if (isSignedIn && sessionStatus["isSessionActive"]) { 
    injectUnboxdLauncher();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.isSessionActive) {
      const newValue = changes.isSessionActive.newValue;
      if (newValue) {
        injectUnboxdLauncher();
      } else {
        removeUnboxdUI();
      }
    }
  });
})();

const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// 2) Listen for the credentials
window.addEventListener('message', event => {
  // only accept messages from our injected script
  if (event.source !== window
      || event.origin !== window.location.origin
      || event.data.source !== 'LETTERBOXD_CREDENTIALS') {
    return;
  }

  const { username, csrfToken } = event.data;
  

  // 3) Forward to background
  chrome.runtime.sendMessage({
    type: 'LETTERBOXD_INIT',
    username,
    csrfToken
  });
});

let movies = [];
let currentIndex = 0;

// called whenever you want to display movies[currentIndex]
async function showMovie(i) {
  
  const movie = movies[i];
  const listEl = document.getElementById('unboxd-list');
  const modal  = document.getElementById('unboxd-modal');
  const store = await chrome.storage.local.get(['active_csrfToken']);
  const csrfToken = store.active_csrfToken;

  if (!csrfToken) {
    return alert("CSRF token missing.");
  }

  try {
    chrome.runtime.sendMessage({
      type: 'REMOVE_MOVIE',
      movie: movie
    });
    
    const details = await fetchMovieDetails(movie.title, movie.year, movie.overview);
    const requiredFields = [
      'movieName', 'movieId', 'slug',
      'posterUrl', 'url', 'genres', 'averageRating', "ratingCount"
    ];
    const hasAllRequired = requiredFields.every(key => details[key] && details[key] !== '');

    if (!hasAllRequired || details["genres"].length == 0) {
      console.warn(`Skipping movie "${movie.title}" due to missing fields.`);
      currentIndex++;
      if (currentIndex < movies.length) {
        return showMovie(currentIndex);
      } else {
        return chrome.runtime.sendMessage({ type: 'FETCH_RANDOM_MOVIE' });
      }
    }
    // update header & store movieId
    modal.querySelector('h2').innerHTML = `<a href="${details.url}" target="_blank" rel="noopener">${movie.title} (${movie.year})</a>`;
    modal.dataset.movieId = details.movieId;

    // rebuild the buttons set (close + actions + next)
    modal.querySelector('#unboxd-buttons-set').innerHTML = `
      <button id="unboxd-close">Close [×]</button>
      <div class="actions">
        <button id="btn-watchlist" class="btn btn-watchlist">＋ Watchlist</button>
        <button id="btn-next-movie" class="btn btn-next-movie">Next →</button>
      </div>
    `;
    // wire close
    document.getElementById('unboxd-close').onclick = () => {
      document.getElementById('unboxd-overlay').remove();
      modal.remove();
    };

    // wire next
    document.getElementById('btn-next-movie').onclick = () => {
      const nextBtn = document.getElementById('btn-next-movie');

      // Replace text with spinner
      nextBtn.innerHTML = `<span class="spinner"></span>`;
      nextBtn.disabled = true;

      currentIndex++;
      if (currentIndex < movies.length) {
        showMovie(currentIndex);
      } else {
        chrome.runtime.sendMessage({ type: 'FETCH_RANDOM_MOVIE' });
      }
    };
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "image";
    preloadLink.href = details.posterUrl;
    document.head.appendChild(preloadLink);

    listEl.innerHTML = `
      <div class="unboxd-card">
        <div class="poster-container">
          <img src="${details.posterUrl}" alt="${details.movieName}" class="film-poster"/>
        </div>
        <div class="film-info">
          <div class="rating-block">
            <span class="avg-rating">${details.averageRating?.toFixed(1) || '–'}</span>
            <span class="stars">${'★'.repeat(Math.round(details.averageRating || 0))}</span>
            <span class="rating-count">(${details.ratingCount || 0} ratings)</span>
          </div>
            <p class="overview">${movie.overview ? (movie.overview.split(' ').length > 40 ? movie.overview.split(' ').slice(0, 40).join(' ') + '...' : movie.overview) : 'No description available.'}</p>
          <div class="sluglists">
            <div class="genres">Genres: ${details.genres.map(g =>
              `<a href="https://letterboxd.com/films/genre/${g}/" target="_blank">${g}</a>`
            ).join(', ')}</div>
            <div class="themes">Themes: ${details.themes.length > 0 ? details.themes.map(t =>
              `<a>${t}</a>`
            ).join(', ') : '-'}</div>
          </div>
            Rate:
            <div class="rating-widget" id="rating-widget">
              ${[0,1,2,3,4].map(i => `
                <span class="star-input" data-index="1">
                  <svg class="star-bg" viewBox="0 -0.5 33 33"><polygon points="27.865 31.83 17.615 26.209 7.462 32.009 9.553 20.362 0.99 12.335 12.532 10.758 17.394 0 22.436 10.672 34 12.047 25.574 20.22"> </polygon></svg>
                  <svg class="star-fg" viewBox="0 -0.5 33 33"><polygon points="27.865 31.83 17.615 26.209 7.462 32.009 9.553 20.362 0.99 12.335 12.532 10.758 17.394 0 22.436 10.672 34 12.047 25.574 20.22"> </polygon></svg>
                </span>
              `).join('')}
            </div>
        </div>
      </div>
    `;

    const widget = document.getElementById('rating-widget');
    const stars  = widget.querySelectorAll('.star-input');
    let currentRating = 0;

    function paintStars(rating) {
      stars.forEach((star, i) => {
        star.classList.remove('full', 'half');
        const idx = i + 1;
        if (rating >= idx) {
          star.classList.add('full');
        } else if (rating >= idx - 0.5) {
          star.classList.add('half');
        }
      });
    }

    widget.addEventListener('mousemove', e => {
      const rect = widget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let hoverRating = Math.min(5, Math.max(0, (x / rect.width) * 5));
      hoverRating = Math.round(hoverRating * 2) / 2;
      paintStars(hoverRating);
    });

    widget.addEventListener('mouseleave', () => {
      paintStars(currentRating);
    });

    widget.addEventListener('click', async e => {
      const rect = widget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let newRating = Math.min(5, Math.max(0, (x / rect.width) * 5));
      currentRating = Math.round(newRating * 2) / 2;
      paintStars(currentRating);
      // select components having the css clas star-fg and change the fill color to #f5c518
      widget.querySelectorAll('.star-fg').forEach(fg => {
        fg.style.fill = '#f5c518'; // Gold
      });

      console.log(`Rating: ${currentRating}`);

      const slug = `https://letterboxd.com/s/film:${details.movieId}/rate/`;

      const ratingValue = Math.round(currentRating * 2);

      const resp = await fetch(slug, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `__csrf=${encodeURIComponent(csrfToken)}&rating=${ratingValue}`
      });


      if (!resp.ok) {
        console.error(await resp.text());
        return alert(`Could not rate the movie. Please try again later :(`);
      }
    });

    // 3) Wire up the buttons
    let isCurrentlyWatchlisted = false; 
    let action = 'add-to-watchlist'; // default action
    const watchlistBtn = document.getElementById('btn-watchlist');
    watchlistBtn.addEventListener('click', async () => {
      const modal     = document.getElementById('unboxd-modal');
      const movieName = modal.querySelector('.film-poster').alt;

      let slug = details.slug;
      // Build the endpoint URL
      const url = `https://letterboxd.com/film/${slug}/${action}/`;

      // Fire the POST
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `__csrf=${encodeURIComponent(csrfToken)}`
      });

      // Update UI
      if (isCurrentlyWatchlisted) {
        watchlistBtn.textContent = '＋ Watchlist';
        watchlistBtn.classList.remove('done');
        isCurrentlyWatchlisted = false;
        action = 'add-to-watchlist';
      } else {
        watchlistBtn.textContent = '✓ Watchlisted';
        watchlistBtn.classList.add('done');
        isCurrentlyWatchlisted = true;
        action = 'remove-from-watchlist'; 
      }
    });

  } catch (err) {
    console.warn(err);
    currentIndex++;
    if (currentIndex < movies.length) {
      showMovie(currentIndex);
    } else {
      chrome.runtime.sendMessage({type:'FETCH_RANDOM_MOVIE'});
    }
  }
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'RANDOM_MOVIE') {
    movies = msg.movie;
    currentIndex = 0;
    if (!movies || !movies.length) {
      console.log('BUG');
      chrome.runtime.sendMessage({type:'FETCH_RANDOM_MOVIE'});
    } else {
      showMovie(0);
    }
  }
  if (msg.type === 'RUN_SYNC'){
    const { username, lastWatchedId, lastWatchlistedId } = msg;

    // We can use `fetch` + `DOMParser` here:
    const newlyWatched    = await collectNewlyWatched(lastWatchedId, username);
    const newlyWatchlisted = await collectNewlyWatchlisted(lastWatchlistedId, username);

    console.log(`Sync complete for ${username}: +${newlyWatched.length} watched, +${newlyWatchlisted.length} watchlisted.`);

    // Send the results back to the SW for storage:
    chrome.runtime.sendMessage({
      type: 'SYNC_RESULTS',
      username: username,
      newlyWatched,
      newlyWatchlisted
    });
  }
  if (msg.type === "SYNC_COMPLETE") {
    console.log("SYNC_COMPLETE MESSAGE RECEIVED")
    const { username, newWatchedLength, newWatchlistedLength } = msg;

    // Build alert container
    const container = document.createElement('div');
    container.className = 'unboxd-sync-toast';
    container.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 162.84 187.16">
            <defs>
              <style>
                .cls-1 { fill: #2c343f; }
                .cls-2 { fill: #40bcf4; }
                .cls-3 { fill: #01e054; }
                .cls-4 { fill: #ff8000; }
              </style>
            </defs>
            <g>
              <circle class="cls-4" cx="98.57" cy="95.65" r="19.97"/>
              <circle class="cls-3" cx="55.27" cy="57.5" r="19.97"/>
              <circle class="cls-2" cx="98.57" cy="19.97" r="19.97"/>
              <path class="cls-1" d="M161.46,76.35l-35.06,35.06v71.04c0,2.6-2.11,4.71-4.71,4.71H41.15c-2.6,0-4.71-2.11-4.71-4.71v-71.04L1.38,76.35c-1.84-1.83-1.84-4.82,0-6.65l9.25-9.25c1.84-1.84,4.82-1.84,6.65,0l36.76,36.75h54.77l36.75-36.75c1.84-1.84,4.82-1.84,6.65,0l9.25,9.25c1.84,1.83,1.84,4.82,0,6.65Z"/>
            </g>
          </svg>
        </div>
        <div class="toast-message">
          <strong>Sync Complete! Enjoy unboxd</strong><br>
          ${newWatchedLength} new watched and ${newWatchlistedLength} new watchlisted movies for <b>${username}</b>.
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      container.remove();
    }, 7000);
  }

  if (msg.type === "RESET_COMPLETE") {
    console.log("HERE"); 
    let container = document.querySelector('.unboxd-sync-toast');

    if (!container) {
      // Create new toast if it doesn't exist
      container = document.createElement('div');
      container.className = 'unboxd-sync-toast';
      document.body.appendChild(container);
    }

    // Always update the toast's contents
    container.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 162.84 187.16">
            <defs>
              <style>
                .cls-1 { fill: #2c343f; }
                .cls-2 { fill: #40bcf4; }
                .cls-3 { fill: #01e054; }
                .cls-4 { fill: #ff8000; }
              </style>
            </defs>
            <g>
              <circle class="cls-4" cx="98.57" cy="95.65" r="19.97"/>
              <circle class="cls-3" cx="55.27" cy="57.5" r="19.97"/>
              <circle class="cls-2" cx="98.57" cy="19.97" r="19.97"/>
              <path class="cls-1" d="M161.46,76.35l-35.06,35.06v71.04c0,2.6-2.11,4.71-4.71,4.71H41.15c-2.6,0-4.71-2.11-4.71-4.71v-71.04L1.38,76.35c-1.84-1.83-1.84-4.82,0-6.65l9.25-9.25c1.84-1.84,4.82-1.84,6.65,0l36.76,36.75h54.77l36.75-36.75c1.84-1.84,4.82-1.84,6.65,0l9.25,9.25c1.84,1.83,1.84,4.82,0,6.65Z"/>
            </g>
          </svg>
        </div>
        <div class="toast-message">
          <strong>unboxd reset!</strong><br>
          Refresh the page to continue enjoying unboxd.
        </div>
      </div>
    `;


    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      container.remove();
    }, 7000);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_LOGIN_STATUS") {
    const signInLabel = document.querySelector(
      '#header > section > div.react-component > div > nav > ul > li.navitem.sign-in-menu > a > span.label'
    );

    const isSignedIn = signInLabel
      ? signInLabel.textContent.trim().toLowerCase() !== 'sign in'
      : true;

    sendResponse({ loggedIn: isSignedIn });
  }
});

// event li
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UNBOXD_COMPLETED") {
    if (document.querySelector('#unboxd-completion-overlay')) return; // prevent duplicates

    const existingOverlay = document.querySelector('#unboxd-overlay');
    if (!existingOverlay) {
      console.warn('No #unboxd-overlay element found!');
      return;
    }

    // Change the ID so we can style it differently and detect it's the completion overlay
    existingOverlay.id = 'unboxd-completion-overlay';
    document.querySelector('#unboxd-modal')?.remove();
    existingOverlay.innerHTML = `
      <div class="unboxd-celebration">
        <h1 class="unboxd-title">🎉 All Done!</h1>
        <p class="unboxd-message">
          Thank you for choosing <strong>un<span style="color:#ff8000">b</span><span style="color:#01e054">o</span><span style="color:#40bcf4">x</span>d</strong>.<br>
          You're a true <span class="highlight">cinephile</span>.
        </p>
        <button class="unboxd-close-btn">Close</button>
        <canvas id="confetti-canvas"></canvas>
      </div>
    `;

    // Add style only if not present yet
    if (!document.getElementById('unboxd-completion-style')) {
      const style = document.createElement('style');
      style.id = 'unboxd-completion-style';
      style.textContent = `
        #unboxd-completion-overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 23, 28, 0.96);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }

        .unboxd-celebration {
          text-align: center;
          padding: 2rem;
          max-width: 400px;
          position: relative;
        }

        .unboxd-title {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: #ff8000;
        }

        .unboxd-message {
          font-size: 1.1rem;
          color: #ccc;
          margin-bottom: 2rem;
        }

        .highlight {
          color: #40bcf4;
          font-weight: bold;
        }

        .unboxd-close-btn {
          background: #ff8000;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          color: white;
          border-radius: 5px;
          cursor: pointer;
        }

        .unboxd-close-btn:hover {
          background: #e67300;
        }

        #confetti-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    // Close button handler: revert changes on close
    existingOverlay.querySelector('.unboxd-close-btn').addEventListener('click', () => {
      existingOverlay.id = 'unboxd-overlay';
      existingOverlay.innerHTML = '';
      document.querySelector('#unboxd-overlay')?.remove();
      document.querySelector('#unboxd-modal')?.remove();
    });

    importConfettiAndRun();
  }
});
