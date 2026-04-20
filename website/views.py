from flask import Blueprint, render_template, jsonify, request
from yt_dlp import YoutubeDL
import requests
import yt_dlp
import os
import re
from mutagen.id3 import (
    ID3,
    APIC,
    ID3NoHeaderError,
    TPE1,
    TIT2,
    TALB,
    TDRC,
)

views = Blueprint('views', __name__)

@views.route("/")
def home():
    return render_template("index.html")

@views.route("/about")
def about():
    return "About Us"

@views.route("/donate")
def donate():
    return "Donate"

@views.route("/how-to-use")
def help():
    return "How To Use"

@views.route("/search/<query>")
def search_page(query):
    results = search_youtube(query, 10)
    return render_template("search.html", query=query, results=results)

@views.route("/search", methods=['POST'])
def search():
    query = request.json.get("query")
    results = search_youtube(query, 10)
   
    return jsonify({
            "status" : "success",
            "results" : results
        })

@views.route("/download", methods=['POST'])
def download():
    video_id = request.json.get("video_id")
    title = request.json.get("title")
    artist = request.json.get("artist")
    album = request.json.get("album")
    cover = request.json.get("cover")

    video = download_video(video_id, title, artist, album, cover)

    return jsonify({
        "status" : "success",
        "url" : f"/static/downloads/{video}"
    })

### Search ###
def search_youtube(query, max_results):
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,  
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)

    results = []
    for entry in info['entries']:
        video_id = entry['id']
        title = entry['title']
        author = entry['channel']
        title_clean = clean_title(entry['title'])

        try :
            duration = entry['duration']
        except KeyError:
            duration = 0

        results.append((video_id, title, author, seconds_minutes(duration), title_clean))

    return results

### Download Song ###
def download_video(video_id, title, artist, album, cover):
    url = f"https://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": "website/static/downloads/%(title)s.%(ext)s",
        "js_runtime": "node",
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }

    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
        info = ydl.extract_info(url, download=False)

        for file in os.listdir("website/static/downloads/"):
            if file == info["title"] + ".mp3":
                try:
                    os.rename(("website/static/downloads/" + file), clean_title("website/static/downloads/" + file))
                except FileNotFoundError:
                    print(f"Error: The file '{file}' was not found.")
                except FileExistsError:
                    print(f"Error: The destination file '{file}' already exists.")
                except Exception as e:
                    print(f"An unexpected error occurred while renaming the file '{file}' : {e}")

                path = (clean_title(info["title"] + ".mp3"))
            
                try:
                    tags = ID3("website/static/downloads/" + path)
                except ID3NoHeaderError:
                    tags = ID3()

                tags.setall("TPE1", [TPE1(encoding=3, text=artist)])
                tags.setall("TIT2", [TIT2(encoding=3, text=title)])
                tags.setall("TALB", [TALB(encoding=3, text=album)])

                # Cover art
                cover_url = cover
                cover_data = download_cover(cover_url)

                tags.delall("APIC")
                tags.add(
                    APIC(
                        encoding=3,
                        mime="image/jpeg",
                        type=3,
                        desc="Cover",
                        data=cover_data,
                    )
                )

                tags.save("website/static/downloads/" + path)

                return path

### Download Cover ###
def download_cover(url: str):
    img = requests.get(url, timeout=10)
    img.raise_for_status()
    return img.content

### Rename ###
def clean_title(title: str) -> str:
    # Remove bracketed content: ( ... ) and [ ... ]
    title = re.sub(r"\([^)]*\)", "", title)
    title = re.sub(r"\[[^\]]*\]", "", title)

    # Remove common YouTube junk words
    junk_words = [
        "official audio",
        "official video",
        "official music video",
        "official lyric video",
        "lyrics",
        "lyric video",
        "visualizer",
        "hd",
        "4k",
    ]

    for word in junk_words:
        title = re.sub(word, "", title, flags=re.IGNORECASE)

    # Remove emojis and non-standard characters
    title = re.sub(
        r"["
        r"\U0001F600-\U0001F64F"  # emoticons
        r"\U0001F300-\U0001F5FF"  # symbols & pictographs
        r"\U0001F680-\U0001F6FF"  # transport & map
        r"\U0001F1E0-\U0001F1FF"  # flags
        r"\U00002700-\U000027BF"
        r"\U000024C2-\U0001F251"
        r"]+",
        "",
        title,
    )

    # Normalize whitespace
    title = re.sub(r"\s+", " ", title).strip()

    return title

### Convert ###
def seconds_minutes(seconds) -> str:
    minutes = int(seconds) // 60
    remaining_seconds = int(seconds) % 60
    if (remaining_seconds < 10):
        remaining_seconds = "0" + str(remaining_seconds)

    return f"{minutes}:{remaining_seconds}"

