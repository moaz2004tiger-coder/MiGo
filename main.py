from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import asyncio
import time
import shutil
import json
from sse_starlette.sse import EventSourceResponse

from backend.downloader import get_media_info, download_media_task, progress_store, DOWNLOADS_DIR
from database import init_db

try:
    init_db()
    print("✅ تم ربط قاعدة بيانات PostgreSQL بنجاح")
except Exception as e:
    print(f"❌ فشل الاتصال بقاعدة البيانات: {e}")

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")


class URLRequest(BaseModel):
    url:     str
    cookies: Optional[str] = None   # user can also supply cookies at the info-fetch stage


class DownloadRequest(BaseModel):
    url:     str
    type:    str
    quality: Optional[str] = None
    lang:    Optional[str] = None
    cookies: Optional[str] = None


@app.get("/")
def read_root():
    return FileResponse("static/index.html")


def cleanup_old_files():
    try:
        now = time.time()
        _, _, free = shutil.disk_usage(DOWNLOADS_DIR)
        critical   = (free / 2**30) < 0.3

        for root, dirs, files in os.walk(DOWNLOADS_DIR, topdown=False):
            for name in files:
                fpath = os.path.join(root, name)
                if os.stat(fpath).st_mtime < now - 3600 or critical:
                    try: os.remove(fpath)
                    except: pass
            for name in dirs:
                dpath = os.path.join(root, name)
                try:
                    if not os.listdir(dpath): os.rmdir(dpath)
                except: pass
    except Exception as e:
        print("Cleanup error:", e)


@app.post("/api/info")
def get_info(req: URLRequest):
    # Pass user cookies to info fetch so YouTube returns data without blocking
    info = get_media_info(req.url, cookies=req.cookies)
    if "error" in info:
        raise HTTPException(status_code=400, detail=info["error"])
    return info


@app.post("/api/download")
def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(cleanup_old_files)
    task_id = str(uuid.uuid4())
    download_media_task(task_id, req.url, req.type, req.quality, req.lang, req.cookies)
    return {"task_id": task_id}


@app.get("/api/progress/{task_id}")
async def get_progress(request: Request, task_id: str):
    async def event_generator():
        last_data = None
        while True:
            if await request.is_disconnected():
                break
            data = progress_store.get(task_id, {"status": "pending"})
            if data != last_data:
                last_data = data.copy()
                yield {
                    "event": "message",
                    "id":    task_id,
                    "retry": 15000,
                    "data":  json.dumps(data),
                }
            if data.get("status") in ["completed", "error"]:
                break
            await asyncio.sleep(0.2)
    return EventSourceResponse(event_generator())


@app.get("/api/download_file/{task_id}")
def download_file(task_id: str):
    try:
        uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    data = progress_store.get(task_id)
    if not data or data.get("status") != "completed":
        raise HTTPException(status_code=404, detail="File not ready or task not found")

    file_path = data.get("file_path")
    filename  = data.get("filename")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    del progress_store[task_id]
    return FileResponse(path=file_path, filename=filename,
                        media_type='application/octet-stream')


if __name__ == "__main__":
    import uvicorn
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
