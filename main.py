from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import asyncio
import time
import shutil
from sse_starlette.sse import EventSourceResponse

from backend.downloader import get_media_info, download_media_task, progress_store, DOWNLOADS_DIR

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

class URLRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    type: str 
    quality: Optional[str] = None
    lang: Optional[str] = None

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

def cleanup_old_files():
    """
    Cleans up temp downloads directory based on file age and disk free space.
    Removes files older than 1 hour, and forces cleanup if free space < 2GB.
    """
    try:
        now = time.time()
        
        # Check free space on the drive where DOWNLOADS_DIR resides
        total, used, free = shutil.disk_usage(DOWNLOADS_DIR)
        free_gb = free / (2**30)
        critical_space = free_gb < 2.0
        
        # Collect files with their modification times
        files_info = []
        for root, dirs, files in os.walk(DOWNLOADS_DIR, topdown=False):
            for name in files:
                fpath = os.path.join(root, name)
                mtime = os.stat(fpath).st_mtime
                files_info.append((fpath, mtime))
                
                # Delete files older than 1 hour or if space is critical
                if mtime < now - 3600 or critical_space:
                    try:
                        os.remove(fpath)
                    except:
                        pass
            
            # Remove empty directories
            for name in dirs:
                dpath = os.path.join(root, name)
                try:
                    if not os.listdir(dpath):
                        os.rmdir(dpath)
                except:
                    pass
                    
        # Cleanup progress_store to prevent memory leaks (remove entries older than 1 hr based on creation time, 
        # but since we don't store creation time, we just rely on clearing it upon download. 
        # For abandoned tasks, we'll implement a basic age check if needed later.)
        # Actually, let's add timestamp to progress_store later or just wipe completed tasks periodically
        # We will delete the progress_store entry explicitly upon file download to prevent memory leaks.

    except Exception as e:
        print("Cleanup error:", e)

@app.post("/api/info")
def get_info(req: URLRequest):
    info = get_media_info(req.url)
    if "error" in info:
        raise HTTPException(status_code=400, detail=info["error"])
    return info

@app.post("/api/download")
def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    # Run cleanup in background on every new download request
    background_tasks.add_task(cleanup_old_files)
    
    task_id = str(uuid.uuid4())
    download_media_task(task_id, req.url, req.type, req.quality, req.lang)
    return {"task_id": task_id}

@app.get("/api/progress/{task_id}")
async def get_progress(request: Request, task_id: str):
    async def event_generator():
        last_data = None
        while True:
            if await request.is_disconnected():
                break

            data = progress_store.get(task_id, {"status": "pending"})
            
            # SSE Optimization: Only yield if data actually changed
            if data != last_data:
                last_data = data.copy()
                yield {
                    "event": "message",
                    "id": task_id,
                    "retry": 15000,
                    "data": data
                }
                
            if data.get("status") in ["completed", "error"]:
                break
                
            await asyncio.sleep(0.2)
            
    return EventSourceResponse(event_generator())

@app.get("/api/download_file/{task_id}")
def download_file(task_id: str):
    # Security Validation: Ensure task_id is a valid UUID
    try:
        uuid_obj = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID format")

    data = progress_store.get(task_id)
    if not data or data.get("status") != "completed":
        raise HTTPException(status_code=404, detail="File not ready or task not found")
        
    file_path = data.get("file_path")
    filename = data.get("filename")
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    # Schedule memory cleanup of this task id via a simple background task would be ideal,
    # but since FileResponse locks the file on Windows until it's sent, we only delete the progress_store entry.
    # The file itself will be handled by the cleanup_old_files() chronologically.
    
    # Clean memory to prevent memory leak
    del progress_store[task_id]
        
    return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')

if __name__ == "__main__":
    import uvicorn
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    uvicorn.run(app, host="0.0.0.0", port=8000)
