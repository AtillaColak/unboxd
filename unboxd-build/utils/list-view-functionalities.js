/**
 * Filter out marked movies from the list (already gone through by the user).
 * @param {Array} movies - Array of movie objects to be filtered.
 * @returns {Array<Object>} Filtered array of movies that are not marked.
 */
function excludeMarked(movies){
    return movies.filter(movie => !movie.isMarked);
}

function SortyBy(){
    // rating, year, genre, popularity. 
    // taxonomy for genre ids: https://www.themoviedb.org/talk/5daf6eb0ae36680011d7e6ee
    // TODO
}

function filtrationPipeline(movies){
    // TODO by default: initialize, synch, exclude marked, sort by popularity, and format. 
}