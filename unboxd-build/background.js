const GLOBAL_KEYS = {
  LAST_WATCHED: 'lastWatchedMovieId',
  LAST_WATCHLISTED: 'lastWatchlistedMovieId',
  MOVIES: 'movies'
};

async function seedUnboxdDefaults() {
  let initialMovies = [];
  let movies = [];
  try {
    const url  = chrome.runtime.getURL('movies.json');
    const res  = await fetch(url);
    initialMovies = await res.json();
    movies = initialMovies.map(movie => {
      return {
        title: movie.title,
        overview: movie.overview,
        year: movie.release_date ? movie.release_date.slice(0, 4) : undefined
      };
    });
  } catch (e) {
    console.warn('Could not load bundled movies.json, defaulting to []', e);
  }

  await chrome.storage.local.set({
    [GLOBAL_KEYS.LAST_WATCHED]: -1,
    [GLOBAL_KEYS.LAST_WATCHLISTED]: -1,
    [GLOBAL_KEYS.MOVIES]: movies,
    "isSessionActive": true
  });
}

// On first install, seed global defaults
chrome.runtime.onInstalled.addListener(seedUnboxdDefaults);

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'LETTERBOXD_INIT') {
    const newUsername = msg.username;
    const newCsrfToken = msg.csrfToken;

    if (!newUsername || !newCsrfToken) {
      console.warn('LETTERBOXD_INIT missing username or csrfToken');
      return;
    }

    let store = await chrome.storage.local.get([
      "activeUsername",
      "active_csrfToken"
    ]);

    const prevUsername = store.activeUsername;
    const prevCsrfToken = store.active_csrfToken;

    if(!store.activeUsername || !store.active_csrfToken){
      await chrome.storage.local.set({
        "activeUsername": newUsername,
        "active_csrfToken": newCsrfToken
      });
    }

    const isSameUser = newUsername === prevUsername && newCsrfToken === prevCsrfToken;

    if (!isSameUser && prevUsername) {
      const keysToRemove = [
        `${prevUsername}_lastSynced`,
        `${prevUsername}_lastWatchedMovieId`,
        `${prevUsername}_lastWatchlistedMovieId`,
        `${prevUsername}_movies`, 
        "loggedMovies"
      ];
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Unboxd: Cleared data for previous user ${prevUsername}`);
      await chrome.storage.local.set({
        "activeUsername": newUsername,
        "active_csrfToken": newCsrfToken
      });
    }

    const lastSyncedKey    = `${newUsername}_lastSynced`;
    const watchedKey       = `${newUsername}_lastWatchedMovieId`;
    const watchlistedKey   = `${newUsername}_lastWatchlistedMovieId`;
    const moviesKey        = `${newUsername}_movies`;

    store = await chrome.storage.local.get([
      lastSyncedKey, watchedKey, watchlistedKey, moviesKey
    ]);

    const watchedId = store[watchedKey] ?? -1;
    const watchlistedId = store[watchlistedKey] ?? -1;
    const lastSynced = store[lastSyncedKey];
    const now = new Date();

    let doSync = true;

    if (lastSynced) {
      const lastSyncDate = new Date(lastSynced);
      const hoursPassed = (now - lastSyncDate) / (1000 * 60 * 60); // ms → hours

      doSync = hoursPassed >= 12;
    }

    if(doSync){
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'RUN_SYNC',
        username: newUsername,
        lastWatchedId: watchedId,
        lastWatchlistedId: watchlistedId
      });
    }
  }

  if (msg.type === "RESET_UNBOXD") {
    // Step 1: Wipe ALL local storage
    await chrome.storage.local.clear();

    // Step 2: Run the initial seeding logic again
    await seedUnboxdDefaults();

    // Step 3: Optionally notify the user via toast
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: "RESET_COMPLETE",
        message: "Unboxd has been fully reset."
      });
    }
  }

  if (msg.type === 'SYNC_RESULTS') {
    const { username, newlyWatched, newlyWatchlisted } = msg;

    // build your storage keys
    const lastSyncedKey    = `${username}_lastSynced`;
    const watchedKey       = `${username}_lastWatchedMovieId`;
    const watchlistedKey   = `${username}_lastWatchlistedMovieId`;
    const moviesKey        = `${username}_movies`;

    // pull existing data
    const store = await chrome.storage.local.get([
      lastSyncedKey, watchedKey, watchlistedKey, moviesKey, GLOBAL_KEYS.MOVIES
    ]);

    let updatedMovies = (store[moviesKey] ?? store[GLOBAL_KEYS.MOVIES]); 
    updatedMovies = updatedMovies.filter(movie => {
      // Filter out newly watched and watchlisted movies
      return !newlyWatched.some(m => m.title === movie.title) &&
             !newlyWatchlisted.some(m => m.title === movie.title);
    });

    // determine the new “last” IDs
    const newLastWatched = newlyWatched.length
      ? newlyWatched[0].filmId
      : (store[watchedKey] ?? -1);
    const newLastWatchlisted = newlyWatchlisted.length
      ? newlyWatchlisted[0].filmId
      : (store[watchlistedKey] ?? -1);

    // persist!
    await chrome.storage.local.set({
      [lastSyncedKey]:    new Date().toISOString(),
      [watchedKey]:       newLastWatched,
      [watchlistedKey]:   newLastWatchlisted,
      [moviesKey]:        updatedMovies
    });

    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'SYNC_COMPLETE',
      username: username,
      newWatchedLength: newlyWatched.length,
      newWatchlistedLength: newlyWatchlisted.length
    });
  }
});

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === 'FETCH_RANDOM_MOVIE') {
    const { activeUsername } = await chrome.storage.local.get('activeUsername');
    if (!activeUsername) {
      console.warn('No activeUsername in storage!');
      return;
    }

    // 3b) load their movie list (or fall back to the global one)
    const moviesKey = `${activeUsername}_movies`;
    const store = await chrome.storage.local.get([moviesKey, GLOBAL_KEYS.MOVIES]);
    const pool = store[moviesKey] ?? store[GLOBAL_KEYS.MOVIES] ?? [];
    if (!pool.length) {
      console.warn('No movies to pick from!');
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "UNBOXD_COMPLETED"
      })
      return;
    }

    // 3c) pick 20 movies at random
    const shuffled = pool.slice().sort(() => 0.5 - Math.random());
    const choice = shuffled.slice(0, 50);

    // 3d) send it back into the content script in the same tab
    //     sender.tab.id will be defined because this message came from a content script
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'RANDOM_MOVIE',
      movie: choice
    });
  }
});


chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'REMOVE_MOVIE') {
    const movieToRemove = msg.movie;
    chrome.storage.local.get(null, (store) => {
      const username = store.activeUsername;
      const moviesKey = `${username}_movies`;

      let movieList = store[moviesKey] || [];

      movieList = movieList.filter(m =>
        m.title !== movieToRemove.title
      );

      chrome.storage.local.set({ [moviesKey]: movieList }, () => {
        console.log(`Removed "${movieToRemove.title}" from ${username}_movies`);
      });
    });
    
    let loggedMovies = await chrome.storage.local.get("loggedMovies"); 
    let movies = loggedMovies["loggedMovies"] ?? 0; 
    movies++; 
    chrome.storage.local.set({
      "loggedMovies": movies 
    })
  }
});
