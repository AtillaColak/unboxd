# unboxd
## W slogan
A Letterboxd browser extension to make the retrospective film logging process painless. Something like this is especially annoying if you are new to the app and you have a ton of movies you've watched and would've liked already logged in your newly created account. Given that's an impossibly arbitrary ideal, **unboxd** is as close to it as any solution could get. 

## Features
- Seamless Auth: existing Letterboxd session—no extra login required.
- Sync: Fetches new ratings via `https://letterboxd.com/{username}/films/by/date/page/{N}/` and tracks only new entries since last sync.
- Resrospective logging: Shuffles a pool of popular films (pulled from TMDb) and presents *N* (default 5) unrated titles each day.
- **OPTIONAL?**: simple gamification. progress and levels achieved through logging n number of movies. 

By the time of writing this documentation, I will likely make the extension a Letterboxd HTML injection script that would add a widget to the app header. Widget opens up a modal with the above functionalities. 
Probably **offline-first storage** where top-10k movies from some open-source movie database are saved at `chrome.local.storage`. A column like `isRated` to eliminate the ones the user has already rated. Maybe a lookup table of `ratedMovieIds`?

The logging will be handled by simulating Letterboxd backend api calls with the user's session token (will have to look at the Letterboxd auth in more detail). 

Structure probably: 
```bash
unboxd/
├── manifest.json         # Chrome MV3 manifest
├── background.js         # Service worker: daily scheduler, storage cleanup
├── contentScript.js      # UI injection, DOM interactions, request replay
├── options.html          # (Optional) Settings: daily count, themes
├── popup.html            # Manual sync & quick overview
├── styles/
│   └── widget.css        # Letterboxd-style widget styling
├── assets/
│   └── icons/            # Extension icons
└── utils/
    ├── letterboxdApi.js  # Incremental fetch helpers & CSRF token grabbers
    └── tmdbApi.js        # TMDb popular-movies wrapper

Tasks are rated from 1-5 on difficulty and time it'd take to complete. 

## TODO - MUST
# Have an ending failsfe. if no more movies to fetch from, display a message. "Thank you for choosing Unboxd. You're a true cinephile". With a nice screen like achievement. 

* fix the logo and finalize the webstore-related design implications (4). 
* TODO: hover effect to the buttons 
* TODO: limit the themes to 5. 
## TODO - SHOULD
* improve the popup html, have it the control center (toggling on/off the icon injection.). (3). 


## TODO - COULD
* Some form of stats for how many logged etc. this would be shown on the popup, maybe some simple gamification. (3)
* The movie modal should not resize after clicking next. Maybe add a loading circle in the next button after clicking (instead of going back to the original state). 

## TODO - WAY LATER
* Show the messages + ui updates before the result of the API call. Better user experience.
* Have some kind of reset functionality. (2)
* on the modal show the language of the movie (two-letter system to full movie name ({flag_icon}) resolver) (1). 
* Optimixe the code. (TRY PREFETCHING IMAGE URLS ETC to see if it improves the user experience, OR make sure smart naming is called once per movie since it's costly.)
* Comment, modluarize, make more readable, and document the code 
* Test the extension and have failsafe alternatives. (For instance if a fetch doesn't work, still have a solution). 



## DONE