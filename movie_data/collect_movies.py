import requests
import json
from time import sleep

#CONFIG
key = "your_api_key"
url = "https://api.themoviedb.org/3/movie/popular"

#top 10k movies

def collect_movies(page_count=500):
    movies = []
    for page in range(1, page_count + 1):
        response = requests.get(url, params={"api_key": key, "page": page})
        if response.status_code == 200:
            data = response.json()
            movies.extend(data['results'])
            sleep(0.25)
            print("Fetched page:", page, "Total movies collected:", len(movies))
        else:
            print(f"Failed to fetch page {page}: {response.status_code}")
            break

    with open('movies.json', 'w') as f:
        json.dump(movies, f, indent=4)

collect_movies(500)