const form = document.getElementById("query_form");
form.addEventListener('submit', function(e) { submit_form(e) });
let isDownloading = false;

function submit_form(e) {
    e.preventDefault();

    const yt_query = document.getElementById("yt_query");

    const loadingBar = document.getElementById("loading-bar");
    const btn = document.getElementById("search_btn");

    loadingBar.classList.remove("hidden");

    btn.classList.add("cursor-not-allowed");
    btn.disabled = true;

    fetch("/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            query: yt_query.value.trim(),
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);
        
        if (data.status == "success") {
            render_results(data.results);
        }
        else {
            alert("Failed");
        };

        loadingBar.classList.add("hidden");

        btn.classList.remove("cursor-not-allowed");
        btn.disabled = false;

        history.pushState(null, "", `/search/${yt_query.value.trim()}`)
    })
}

function render_results(results) {
    const res_root = document.getElementById("search_results");
    let songInfo = {
        "title" : "",
        "artist" : "",
        "album" : "",
        "cover" : ""
    };

    res_root.innerHTML = '<p class="text-xl font-light text-center mb-6">Search Results:</p>';

    results.forEach(res => {
        if (res[3] == 0) return;

        const element = document.createElement("div");
        element.className = "search_result_item flex items-center gap-8 bg-white rounded-md shadow-ms w-full py-4 px-2 cursor-pointer";

        element.innerHTML = `
            <div class="bg-white rounded-md shadow-ms w-full py-4 px-2 cursor-pointer">
                <div class="flex items-center justify-between pr-1 ">
                    <div class="flex items-center gap-8">
                        <p class="bg-[#fa0000] px-2 py-1 h-7 rounded-sm text-white text-[11px]">${res[3]}</p>

                        <div class="flex flex-col justify-center">
                            <p class="text-[19px] font-light">${res[1]}</p>
                            <p class="text-[15px] font-bold">${res[2]}</p>
                        </div>
                    </div>
                    
                    <button class="download_blank bg-[#fa0000] p-2 rounded-sm text-white cursor-pointer">
                        <i data-lucide="download"></i> 
                    </button>
                </div>
                    
                <div class="search_result_info scale-y-0 hidden mt-3 pt-5 border-t border-[#cccccc]">
                    <!-- Search -->
                    <div class="w-full block">
                        <input value="${res[4]}" class="bg-[#fafafacc] w-full h-[45px] py-2 px-2 border border-black rounded-sm" type="text" id="search-bar" autocomplete="off" placeholder="Search for song info">
                        <div id="search-results"></div>
                    </div>
                </div>
            </div>
        `;

        // Search Tags
        element.querySelector("#search-bar").addEventListener("input", function(e) { searchTrack(e.target.value) });

        function searchTrack(text) {
            if (text.length == 0) {
                const searchResults = element.querySelector("#search-results");
                searchResults.classList.remove("show");
                return;
            }
                
            fetch(`https://api.deezer.com/search/track?q=${text}`)
            .then(res => res.json())
            .then(data => {
                const searchResults = element.querySelector("#search-results");
                searchResults.innerHTML = '';

                if (data.data.length == 0) {
                    searchResults.innerHTML = `
                        <div class="py-4 text-center">
                            <h2 class="text-lg">No Result for "${text}"</h2>
                        </div>
                    `;
                    return;
                }

                for (let i = 0; i < 4; i++) {
                    let result = document.createElement("div");
                    result.className = "relative mb-1 flex items-center justify-between py-1 px-3";

                    result.innerHTML = `
                        <div class="flex items-center">
                            <div class="relative w-[60px] h-[60px] mr-3 aspect-square" ><img class="w-full h-full" src="${data.data[i].album.cover_medium}" alt=""></div>

                            <div class="flex flex-col justify-center gap-1/2">
                                <span class="result-texts-title">${data.data[i].title}</span>
                                
                                <div class="flex gap-2">
                                    <span>${data.data[i].artist.name}</span>
                                    <p>•</p>
                                    <span>${data.data[i].album.title}</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-3 status_parent hidden">
                            <p class="text-sm hidden md:block">Downloading...</p>
                            <div class="status w-8 h-8 rounded-full text-white cursor-pointer"></div>
                        </div>
                    `;

                    result.addEventListener('click', function(e) {
                        e.stopPropagation();

                        songInfo.title = data.data[i].title;
                        songInfo.artist = data.data[i].artist.name;
                        songInfo.album = data.data[i].album.title;
                        songInfo.cover = data.data[i].album.cover_medium;

                        if (!isDownloading) {
                            download_taged(res[0], data.data[i].title, data.data[i].artist.name, data.data[i].album.title, data.data[i].album.cover_xl, result);
                            result.querySelector(".status_parent").classList.remove("hidden");
                        }
                        else alert("Wait for current download to finish!");
                    });

                    searchResults.append(result);
                }
            })
        }

        // Open Info
        element.addEventListener("click", function() {
            element.querySelector(".search_result_info").classList.remove("scale-y-0", "hidden");
            element.querySelector(".search_result_info").classList.add("scale-y-100");

            searchTrack(res[4]);
        });

        res_root.appendChild(element);
    });

    lucide.createIcons();
}

function download_taged(id, title, artist, album, cover, result) {
    if (isDownloading) {
        alert("Wait for current download to finish!");
        return;
    }

    else {
        isDownloading = true;

        fetch("/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                video_id: id,
                title: title,
                artist : artist,
                album: album,
                cover: cover
            })
        })
        .then(res => res.json())
        .then(data => {
            const link = document.createElement("a");
            link.href = data.url;
            link.download = data.url.replace("/static/downloads/", "/");
            
            link.click();

            console.log(data);

            result.querySelector(".status_parent").classList.add("hidden");

            isDownloading = false;
        })
    }
}

