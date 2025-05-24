# main.py
import os
import random
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

# CORS: разрешаем все источники только для GET-запросов под /b/*
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Шаблоны и статика
templates = Jinja2Templates(directory="templates")


def get_random_gif(static_folder: str = "static") -> str:
    if not os.path.isdir(static_folder):
        raise HTTPException(status_code=500, detail=f"Папка '{static_folder}' не найдена.")
    gifs = [f for f in os.listdir(static_folder) if f.lower().endswith(".gif")]
    if not gifs:
        raise HTTPException(status_code=500, detail=f"В папке '{static_folder}' нет .gif файлов.")
    chosen = random.choice(gifs)
    # возвращаем URL, соответствующий mounted StaticFiles
    return f"/static/{chosen}"


@app.get("/b/res/{thread_id}.html", response_class=HTMLResponse)
async def return_thread(request: Request, thread_id: str):
    random_gif = get_random_gif()
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "threadid": thread_id, "random_gif": random_gif}
    )


@app.get("/b/catalog.json", response_class=JSONResponse)
async def return_catalog():
    catalog = {
        "advert_mobile_image": "/banners/E9WC9JVmAvlltNZY.jpeg",
        "advert_mobile_link": "/banners/E9WC9JVmAvlltNZY/",
        "advert_top_image": "/banners/YVFsyF1jc9orwfCP.jpeg",
        "advert_top_link": "/banners/YVFsyF1jc9orwfCP/",
        "board": {
            "bump_limit": 500,
            "category": "Разное",
            "default_name": "Аноним",
            "enable_dices": False,
            "enable_flags": False,
            "enable_icons": False,
            "enable_likes": False,
            "enable_names": False,
            "enable_oekaki": False,
            "enable_posting": True,
            "enable_sage": True,
            "enable_shield": False,
            "enable_subject": False,
            "enable_thread_tags": False,
            "enable_trips": False,
            "file_types": ["jpg", "png", "gif", "webm", "sticker", "mp4",
                           "youtube", "webp", "webp", "webp", "webp", "webp"],
            "id": "b",
            "info": "",
            "info_outer": "бред",
            "max_comment": 15000,
            "max_files_size": 40960,
            "max_pages": 10,
            "name": "Бред",
            "threads_per_page": 21
        },
        "board_banner_image": "/ololo/spc_3.gif",
        "board_banner_link": "spc",
        "filter": "standart",
        "threads": []
    }

    downloads_root = "downloads"
    for subdir in sorted(os.listdir(downloads_root)):
        dir_path = os.path.join(downloads_root, subdir)
        if not os.path.isdir(dir_path) or not subdir.isdigit():
            continue

        json_filename = f"{subdir}.json"
        full_path = os.path.join(dir_path, json_filename)
        if not os.path.isfile(full_path):
            continue

        with open(full_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        thread = data["threads"][0]
        op = thread["posts"][0]

        entry = {
            "banned": thread.get("banned", 0),
            "board": catalog["board"]["id"],
            "closed": thread.get("closed", 0),
            "comment": op.get("comment", ""),
            "date": op.get("date", ""),
            "email": op.get("email", ""),
            "endless": thread.get("endless", 0),
            "files": op.get("files", []),
            "files_count": len(op.get("files", [])),
            "lasthit": thread.get("lasthit", op.get("timestamp")),
            "name": op.get("name", catalog["board"]["default_name"]),
            "num": op.get("num"),
            "op": op.get("op", 0),
            "parent": op.get("parent", 0),
            "posts_count": thread.get("posts_count", 1),
            "sticky": thread.get("sticky", 0),
            "subject": op.get("subject", ""),
            "tags": op.get("tags", ""),
            "timestamp": op.get("timestamp"),
            "trip": op.get("trip", ""),
            "views": thread.get("views", 0),
        }
        catalog["threads"].append(entry)

    return catalog


@app.get("/b/catalog.html", response_class=HTMLResponse)
async def serve_catalog(request: Request):
    return templates.TemplateResponse("catalog.html", {"request": request})

# Для запуска: uvicorn saync_main:app --host 0.0.0.0 --port 8080 --reload
