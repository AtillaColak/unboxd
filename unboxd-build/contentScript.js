(() => {

  const signInLabel = document.querySelector(
    '#header > section > div.react-component > div > nav > ul > li.navitem.sign-in-menu > a > span.label'
  );

  if (signInLabel && signInLabel.textContent.trim().toLowerCase() === 'sign in') {
    console.log('Unboxd: User is not signed in. Extension disabled.');
    return;
  }

  // exact LI in the main nav where “Films” lives
  const navList = document.querySelector(
    '#header > section > div.react-component > div > nav > ul'
  );
  if (!navList) return;

  // 1) Make a new LI
  const li = document.createElement('li');
  li.classList.add('navitem', 'unboxd-navitem');

  // create our launcher link
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

  // 4a) Append at end:
  navList.appendChild(li);

  link.addEventListener('click', openModal);

  function openModal() {
    // overlay
    chrome.runtime.sendMessage({type: 'FETCH_RANDOM_MOVIE'});

    const overlay = document.createElement('div');
    overlay.id = 'unboxd-overlay';
    document.body.appendChild(overlay);

    // modal
    const modal = document.createElement('div');
    modal.id = 'unboxd-modal';
    modal.innerHTML = `
      <h2>Unboxd</h2>
      <div id="unboxd-list">Loading…</div>
      <div id="unboxd-buttons-set"> 
        <button id="unboxd-close">Close [×]</button>
      </div>
        `;
    document.body.appendChild(modal);

    document
      .getElementById('unboxd-close')
      .addEventListener('click', () => {
        overlay.remove();
        modal.remove();
      });

  }
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

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type !== 'RUN_SYNC') return;
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
});

let movies = [];
let currentIndex = 0;

// called whenever you want to display movies[currentIndex]
async function showMovie(i) {
  const movie = movies[i];
  const listEl = document.getElementById('unboxd-list');
  const modal  = document.getElementById('unboxd-modal');
  listEl.innerHTML = `<div class="unboxd-loading">Loading movie details…</div>`;
  modal.querySelector('h2').textContent = `Loading…`;

  try {
    const details = await fetchMovieDetails(movie.title, movie.year, movie.overview);
    const requiredFields = [
      'movieName', 'movieId', 'slug',
      'posterUrl', 'url', 'genres', 'averageRating', "ratingCount"
    ];
    const hasAllRequired = requiredFields.every(key => details[key] && details[key] !== '');

    if (!hasAllRequired) {
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
      currentIndex++;
      if (currentIndex < movies.length) {
        showMovie(currentIndex);
      } else {
        chrome.runtime.sendMessage({type:'FETCH_RANDOM_MOVIE'});
      }
    };

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
          <p class="overview">${movie.overview || 'No description available.'}</p>
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
      paintStars(currentRating); // restore previous
    });

    widget.addEventListener('click', e => {
      const rect = widget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let newRating = Math.min(5, Math.max(0, (x / rect.width) * 5));
      currentRating = Math.round(newRating * 2) / 2;
      paintStars(currentRating);
      console.log(currentRating);
    });

    // 3) Wire up the buttons
    let isCurrentlyWatchlisted = false; 
    let action = 'add-to-watchlist'; // default action
    const watchlistBtn = document.getElementById('btn-watchlist');
    watchlistBtn.addEventListener('click', async () => {
      const modal     = document.getElementById('unboxd-modal');
      const movieId   = modal.dataset.movieId;
      const movieName = modal.querySelector('.film-poster').alt;

      let slug = await formatMovieName(movieName, movie.year, movie.overview);

      // pull CSRF & user (username only for message)
      const store     = await chrome.storage.local.get(['activeUsername','active_csrfToken']);
      const { activeUsername, active_csrfToken: csrfToken } = store;
      if (!csrfToken) {
        return alert("CSRF token missing, please try again later.");
      }

      // Build the endpoint URL
      const url = `https://letterboxd.com/film/${slug}/${action}/`;

      // Fire the POST
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: `__csrf=${encodeURIComponent(csrfToken)}`
      });

      if (!resp.ok) {
        console.error(await resp.text());
        return alert(`❌ Could not ${isCurrentlyWatchlisted ? 'remove from' : 'add to'} watchlist.`);
      }

      // Update UI
      if (isCurrentlyWatchlisted) {
        watchlistBtn.textContent = '＋ Watchlist';
        watchlistBtn.classList.remove('done');
        isCurrentlyWatchlisted = false;
        action = 'add-to-watchlist';
        alert(`Removed "${movieName}" from ${activeUsername}’s watchlist.`);
      } else {
        watchlistBtn.textContent = '✓ Watchlisted';
        watchlistBtn.classList.add('done');
        isCurrentlyWatchlisted = true;
        action = 'remove-from-watchlist'; 
        alert(`Added "${movieName}" to ${activeUsername}’s watchlist.`);
      }
    });

    // NEXT MOVIE BUTTON.
    document.getElementById('btn-next-movie').onclick = () => {
      currentIndex++;
      if (currentIndex < movies.length) {
        showMovie(currentIndex);
      } else {
        chrome.runtime.sendMessage({type:'FETCH_RANDOM_MOVIE'});
      }
    };

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
});
