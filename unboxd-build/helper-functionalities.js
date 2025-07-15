/**
 * collect the movie's data from its letterboxd page. Rating, like and view count, poster, genres and themes. as a fallback later use TMDB data.
 */
async function fetchMovieDetails(movieName, year, overview){
  const slug = await formatMovieName(movieName, year, overview);
  const url  = `https://letterboxd.com/film/${slug}/`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const html = await res.text();

  // parse into a DOM
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');


  let movieId = null;
  for (const script of doc.querySelectorAll('script[type="text/javascript"]')) {
    const txt = script.textContent;
    const m = txt.match(/viewingable\.uid\s*=\s*['"]film:(\d+)['"]/);
    if (m) {
      movieId = parseInt(m[1], 10);
      break;
    }
  }
  if (movieId === null) {
    console.warn('Could not find movieId in __BXD_DATA block');
  }


  // 1) JSON-LD block
  const script = doc.querySelector('script[type="application/ld+json"]');
  if (!script) {
    throw new Error('No JSON-LD block found');
  }
  // strip comments and parse
  const rawJson = script.textContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  const meta = JSON.parse(rawJson);

  const posterUrl     = meta.image || null;
  const averageRating = meta.aggregateRating?.ratingValue != null
    ? parseFloat(meta.aggregateRating.ratingValue)
    : null;
  const ratingCount   = meta.aggregateRating?.ratingCount != null
    ? parseInt(meta.aggregateRating.ratingCount, 10)
    : null;

  // 2) Genres & Themes
  const genres = [];
  const themes = [];
  // find each <h3> under #tab-genres
  doc.querySelectorAll('#tab-genres h3').forEach(h3 => {
    const heading = h3.textContent.trim();
    // the next sibling is the <div class="text-sluglist">
    const listDiv = h3.nextElementSibling;
    if (!listDiv) return;
    // collect each <a.text-slug>
    const items = Array.from(listDiv.querySelectorAll('a.text-slug'))
      .map(a => a.textContent.trim());

    if (heading === 'Genres') {
      genres.push(...items);
    } else if (heading === 'Themes') {
      themes.push(...items.filter(t => t !== 'Show All…'));
    }
  });

  return {
    movieName,
    movieId,
    slug,
    url,
    posterUrl,
    genres,
    themes,
    averageRating,
    ratingCount,
  };
}

/**
 * smart adjusting the movie names too match Letterboxd's format
 */
async function formatMovieName(name, year, referenceOverview) {
  const normalizeName = n => n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .trim()
    .toLowerCase();

  const slug1 = normalizeName(name);
  const slug2 = `${slug1}-${year}`;

  const urls = [
    { slug: slug1, url: `https://letterboxd.com/film/${slug1}/` },
    { slug: slug2, url: `https://letterboxd.com/film/${slug2}/` }
  ];


  let bestMatch = null;
  let bestScore = -Infinity;
  for (const { slug, url } of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      console.log("Fetched properly")

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Use the actual selector to get the visible description
      const descEl = doc.querySelector(
        '#film-page-wrapper > div.col-17 > section.section.col-10.col-main > section > div.review.body-text.-prose.-hero.prettify > div'
      );
      const overview = descEl?.textContent?.trim() || '';

      if (overview) {
        console.log("Fetched overview: " + overview)
        const score = getSimilarityScore(referenceOverview, overview);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = slug;
        }
      }
    } catch (err) {
      console.warn(`Error fetching or parsing ${url}:`, err);
    }
  }

  return bestMatch ?? slug1; // Fallback to default
}

function getSimilarityScore(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\W+/));
  const wordsB = new Set(b.toLowerCase().split(/\W+/));
  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }
  return matches;
}