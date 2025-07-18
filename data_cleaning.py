import pandas as pd
from datetime import datetime
import json

df = pd.read_json("movies.json")
print(f"Total movies: {len(df)}")

# DATA CLEANING AND PREPROCESSING 
df = df.drop(columns=["original_title", "popularity", "video", "adult", "backdrop_path", "genre_ids"])
today = datetime.today().date()
mask_date = pd.to_datetime(df["release_date"], errors="coerce").dt.date <= today
mask_basic = (df["vote_count"] >= 100) & (df["vote_average"] >= 5.0)

mask_lang = (df["original_language"] == "en")
mask_pop1 = (df["vote_count"] >= 10000) & (df["vote_average"] >= 7.5)
mask_pop2 = (df["vote_count"] >= 5000)  & (df["vote_average"] >= 8.0)
mask_pop  = mask_pop1 | mask_pop2

# combine everything with &
full_mask = mask_date & mask_basic & (mask_lang | mask_pop)

df = df[full_mask]
print(f"Filtered movies: {len(df)}")

# EXPORT
df.to_csv("movies.csv", index=False, encoding="utf-8")
df = pd.read_csv("movies.csv")
df = df.drop(columns=["id", "poster_path", "vote_average", "vote_count"])
movies_json = df.to_dict(orient="records")
with open("movies.json", "w", encoding="utf-8") as f:
    json.dump(movies_json, f, ensure_ascii=False, indent=4)