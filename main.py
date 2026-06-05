import json
import shutil
import asyncio
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, BackgroundTasks, Form, UploadFile, File, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from config import UPLOADS_DIR
from db import init_db, save_capture, update_capture, get_captures, get_surfaceable, mark_surfaced, mark_done, get_all_embeddings, get_captures_by_ids
from lm import process_text, process_link, process_image, embed, find_related
from surface import pick

app = FastAPI()
UPLOADS_DIR.mkdir(exist_ok=True)


@app.on_event("startup")
async def startup():
    init_db()


# ── capture endpoints ──────────────────────────────────────────────────────────

@app.post("/capture/text")
async def capture_text(background_tasks: BackgroundTasks, content: str = Form(...)):
    cid = save_capture("text", raw=content)
    background_tasks.add_task(_process, cid, "text", content=content)
    return {"id": cid, "status": "captured"}


@app.post("/capture/link")
async def capture_link(background_tasks: BackgroundTasks, url: str = Form(...)):
    cid = save_capture("link", raw=url, source_url=url)
    background_tasks.add_task(_process, cid, "link", url=url)
    return {"id": cid, "status": "captured"}


@app.post("/capture/image")
async def capture_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: str = Form(""),
):
    dest = UPLOADS_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    cid = save_capture("image", raw=description or None, file_path=str(dest))
    background_tasks.add_task(_process, cid, "image", file_path=str(dest), description=description)
    return {"id": cid, "status": "captured"}


# ── uploads ───────────────────────────────────────────────────────────────────

@app.get("/uploads/{filename:path}")
async def serve_upload(filename: str):
    path = UPLOADS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path)


# ── read endpoints ─────────────────────────────────────────────────────────────

@app.get("/captures")
async def list_captures(limit: int = 50):
    return get_captures(limit)


@app.get("/captures/{capture_id}/related")
async def related_captures(capture_id: int):
    from db import get_all_embeddings
    import json, sqlite3
    from config import DB_PATH
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT related_ids FROM captures WHERE id=?", (capture_id,)).fetchone()
        if not row:
            return []
        ids = json.loads(row["related_ids"] or "[]")
        if not ids:
            return []
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(f"SELECT * FROM captures WHERE id IN ({placeholders})", ids).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


# ── surface endpoints ──────────────────────────────────────────────────────────

@app.get("/surface")
async def surface(mode: str = None, n: int = 3):
    candidates = get_surfaceable()
    items = pick(candidates, n=n, mode=mode)
    for item in items:
        related_ids = json.loads(item.get("related_ids") or "[]")
        item["related"] = get_captures_by_ids(related_ids)
        item.pop("embedding", None)
    return items


@app.post("/events")
async def log_event(request: Request):
    data = await request.json()
    with __import__('sqlite3').connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO events (capture_id, event, value, created_at) VALUES (?, ?, ?, datetime('now','localtime'))",
            (data.get("capture_id"), data.get("event"), str(data.get("value", "")))
        )
    return {"status": "ok"}


@app.post("/surface/{capture_id}/done")
async def surface_done(capture_id: int):
    mark_done(capture_id)
    return {"status": "done"}


@app.post("/surface/{capture_id}/skip")
async def surface_skip(capture_id: int):
    mark_surfaced(capture_id)
    return {"status": "skipped"}


# ── background processing ──────────────────────────────────────────────────────

async def _process(cid: int, type: str, **kwargs):
    loop = asyncio.get_event_loop()
    try:
        if type == "text":
            result = await loop.run_in_executor(None, process_text, kwargs["content"])

        elif type == "link":
            page_text = await _fetch_text(kwargs["url"])
            result = await loop.run_in_executor(None, process_link, kwargs["url"], page_text)

        elif type == "image":
            result = await loop.run_in_executor(None, process_image, kwargs["file_path"], kwargs.get("description", ""))

        else:
            return

        summary = result.get("summary") or ""
        emb = await loop.run_in_executor(None, embed, summary)
        all_embs = get_all_embeddings()
        related = find_related(emb, all_embs, exclude_id=cid)
        update_capture(cid, summary, result.get("tags", []), result.get("intent"), emb, related)

    except Exception as e:
        print(f"[process error] {e}")


async def _fetch_text(url: str) -> str:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)[:4000]
    except Exception:
        return ""


app.mount("/", StaticFiles(directory="static", html=True), name="static")
