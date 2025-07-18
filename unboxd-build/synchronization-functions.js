
async function collectFullWatchedMovies(username = 'att1lathehun') {
  let newMovies = [];
  console.log("Initial load, collecting all watched movies.");

  // 1) Fetch page 1 to discover maxPage
  const firstUrl = `https://letterboxd.com/${username}/films/by/date/page/1/`;
  const firstRes = await fetch(firstUrl);
  if (!firstRes.ok) {
    console.warn(`Failed to fetch page 1: ${firstRes.status}`);
    return newMovies;
  }
  const firstHtml = await firstRes.text();
  const parser = new DOMParser();
  const doc    = parser.parseFromString(firstHtml, 'text/html');

  // detect how many pages exist
  const unseenLi   = doc.querySelector('li.paginate-page.unseen-pages');
  if (unseenLi && unseenLi.nextElementSibling) {
  const anchor = unseenLi.nextElementSibling.querySelector('a');
  maxPage = anchor
      ? parseInt(anchor.textContent.trim(), 10)
      : 1;
  } else {
    maxPage = 1;
  }

  // 2) Process page 1’s items
  doc
  .querySelectorAll('li.poster-container > div.really-lazy-load')
  .forEach(div => {
      const img    = div.querySelector('img');
      const title  = img?.alt || '';
      const filmId = parseInt(div.getAttribute('data-film-id'), 10);
      newMovies.push({ title, filmId });
  });
  console.log(`Processed page 1, found ${newMovies.length} movies so far.`);

  // 3) Fetch & process pages 2 → maxPage
  for (page = 2; page <= maxPage; page++) {
    const url = `https://letterboxd.com/${username}/films/by/date/page/${page}/`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Page ${page} returned status ${res.status}, stopping.`);
      break;
    }
    const html = await res.text();
    const pageDoc = parser.parseFromString(html, 'text/html');

    pageDoc
      .querySelectorAll('li.poster-container > div.really-lazy-load')
      .forEach(div => {
      const img    = div.querySelector('img');
      const title  = img?.alt || '';
      const filmId = parseInt(div.getAttribute('data-film-id'), 10);
      newMovies.push({ title, filmId });
    });
    console.log(`Processed page ${page}, found ${newMovies.length} movies so far.`);
  }

  return newMovies;
}

/**
 * process the newly logged movies html page by page, until the lastMovieId is reached. return the newly logged movies. 
 * @param {Number} lastMovieId 
 * @return {Promise<Array>} - Returns a promise that resolves to an array of newly logged movie titles.
 */
async function collectNewlyWatched(lastMovieId, username = 'att1lathehun') {
  let page = 1;
  let maxPage = Infinity;
  const parser = new DOMParser();  
  const newMovies = [];
  if (lastMovieId === -1) return collectFullWatchedMovies(username);  // synchronize all watched movies, first sync. 

  let foundLast = false;
  while (page <= maxPage && !foundLast) {
    const url = `https://letterboxd.com/${username}/films/by/date/page/${page}/`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Page ${page} returned status ${res.status}, stopping.`);
      break;
    }
    const html = await res.text();
    const doc  = parser.parseFromString(html, 'text/html');

    // detect maxPage on first iteration
    if (maxPage === Infinity) {
      const unseenLi = doc.querySelector('li.paginate-page.unseen-pages');
      if (unseenLi && unseenLi.nextElementSibling) {
        const a = unseenLi.nextElementSibling.querySelector('a');
        if (a) maxPage = parseInt(a.textContent.trim(), 10);
      } else {
        maxPage = 1;
      }
    }

    // Grab every film “poster-container” on this page
    for (const div of doc.querySelectorAll('li.poster-container > div[data-film-id]')) {
      const filmId = parseInt(div.getAttribute('data-film-id'), 10);
      if (filmId === lastMovieId) {
        foundLast = true;
        break;
      }
      const img   = div.querySelector('img');
      const title = img?.alt || '';
      newMovies.push({ title, filmId });
    }

    page++;
    console.log(`Processed page ${page - 1}, found ${newMovies.length} movies so far.`);
  }

  return newMovies;
}

async function collectFullWatchlistedMovies(username = 'att1lathehun') {
  const parser = new DOMParser();
  const allMovies = [];

  async function fetchAndScrape(page = 1) {
    const url = `https://letterboxd.com/${username}/watchlist/page/${page}/`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed to fetch page ${page}: ${res.status}`);
      return;
    }

    const html = await res.text();
    const doc = parser.parseFromString(html, 'text/html');

    // Scrape current page
    const posterDivs = doc.querySelectorAll('li.poster-container > div[data-film-id]');
    posterDivs.forEach(div => {
      const img = div.querySelector('img');
      const title = img?.alt || '';
      const filmId = parseInt(div.getAttribute('data-film-id'), 10);
      if (filmId && title) {
        allMovies.push({ title, filmId });
      }
    });

    console.log(`Page ${page}: collected ${posterDivs.length} movies, total: ${allMovies.length}`);

    // Check for next page
    const currentPageLi = doc.querySelector('li.paginate-page.paginate-current');
    const nextLi = currentPageLi?.nextElementSibling;
    const hasNext = nextLi?.querySelector('a');

    if (hasNext) {
      await fetchAndScrape(page + 1); // recurse
    }
  }

  // Start with page 1
  await fetchAndScrape(1);
  return allMovies;
}


/**
 * process the newly watchlisted movies html page by page, until the lastMovieId is reached. return the newly logged movies. 
 */
async function collectNewlyWatchlisted(lastWatchlistId, username = 'att1lathehun') {
  if (lastWatchlistId === -1) {
    return collectFullWatchlistedMovies(username); // synchronize all watched movies, first sync. 
  }

  const parser = new DOMParser();
  const newMovies = [];

  async function scrapePage(page = 1) {
    const url = `https://letterboxd.com/${username}/watchlist/page/${page}/`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Page ${page} returned status ${res.status}, stopping.`);
      return;
    }

    const html = await res.text();
    const doc = parser.parseFromString(html, 'text/html');

    const posters = doc.querySelectorAll('li.poster-container > div[data-film-id]');
    for (const div of posters) {
      const filmId = parseInt(div.getAttribute('data-film-id'), 10);
      if (filmId === lastWatchlistId) {
        return true; // stop signal
      }
      const img = div.querySelector('img');
      const title = img?.alt || '';
      newMovies.push({ title, filmId });
    }

    // See if there's a next page
    const currentPageLi = doc.querySelector('li.paginate-page.paginate-current');
    const nextLi = currentPageLi?.nextElementSibling;
    const hasNext = nextLi?.querySelector('a');

    if (hasNext) {
      return await scrapePage(page + 1); // recurse
    }

    return false; // no more pages
  }

  await scrapePage(1);
  return newMovies;
}
