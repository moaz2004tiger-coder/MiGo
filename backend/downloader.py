import yt_dlp
import os
import zipfile
import threading
import shutil
import re
import platform
import static_ffmpeg
from concurrent.futures import ThreadPoolExecutor
from database import log_download

DOWNLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "temp_downloads"))

# Global dictionary to hold progress for SSE
progress_store = {}

# Thread pool for concurrency management
MAX_CONCURRENT_DOWNLOADS = 5
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_DOWNLOADS)

class MyLogger(object):
    def debug(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        print("ERROR:", msg)

def sanitize_filename(filename: str) -> str:
    # Allow Arabic, English letters, numbers, spaces, dots, and dashes.
    return re.sub(r'[^\w\-\.\s\u0600-\u06FF]', '_', filename).strip()

# دالة جلب المعلومات تعتمد الآن كلياً على CSIR
def get_media_info(url: str, po_token: str = None, visitor_data: str = None):
    # نترك yt-dlp يستخدم الـ User-Agent الافتراضي والـ player_client الافتراضي
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'logger': MyLogger(),
        'ffmpeg_location': shutil.which('ffmpeg'),
        # تم إلغاء الكوكيز اليدوية بناءً على طلبك
        'extractor_args': {
            'youtube': {
                # الاعتماد الحصري على التوكنات الممررة من جهة العميل
                'po_token': [po_token] if po_token else [],
                'visitor_data': [visitor_data] if visitor_data else []
            }
        }
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            if 'entries' in info:
                # Playlist logic
                playlist_title = info.get('title', 'Playlist')
                videos = []
                for idx, entry in enumerate(info['entries']):
                    if entry:
                        videos.append({
                            'title': entry.get('title', f'Video {idx+1}'),
                            'url': entry.get('url'),
                            'id': entry.get('id')
                        })
                return {
                    'type': 'playlist',
                    'title': playlist_title,
                    'videos': videos,
                    'qualities': ['360p', '480p', '720p', '1080p'],
                    'audio_options': ['best'],
                    'subtitles': []
                }
            else:
                # Single video logic
                formats = info.get('formats', [])
                video_heights = sorted(list(set(int(f.get('height')) for f in formats if f.get('height'))))
                
                return {
                    'type': 'video',
                    'title': info.get('title', 'Video'),
                    'thumbnail': info.get('thumbnail'),
                    'qualities': [f"{h}p" for h in video_heights] if video_heights else ['best'],
                    'audio_options': ['best'],
                    'subtitles': sorted(list(set(info.get('subtitles', {}).keys())))
                }
        except Exception as e:
            print(f"❌ CSIR Fetch Error: {str(e)}")
            return {"error": "خطأ في جلب البيانات، يرجى المحاولة لاحقاً"}

# دالة التحميل مع تحسين الـ Cleanup والالتزام بـ CSIR
def download_media_task(task_id: str, url: str, dl_type: str, quality: str, lang: str = None, po_token: str = None, visitor_data: str = None):
    output_dir = os.path.join(DOWNLOADS_DIR, task_id)
    os.makedirs(output_dir, exist_ok=True)
    
    def hook_wrapper(d):
        if d['status'] == 'downloading':
            percent_str = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', d.get('_percent_str', '0%'))
            progress_store[task_id] = {
                "status": "downloading",
                "percent": percent_str.strip(),
                "speed": d.get('_speed_str', '0KiB/s').strip(),
                "eta": d.get('_eta_str', 'Unknown').strip(),
                "filename": os.path.basename(d.get('filename', ''))
            }
        elif d['status'] == 'finished':
            progress_store[task_id] = {"status": "processing", "percent": "100%", "filename": "Finalizing..."}

    # Format Selector مرن لضمان التحميل في حال عدم توفر جودة معينة
    if dl_type == 'video':
        h = quality.replace('p', '') if quality != 'best' else '1080'
        format_str = f'bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/best[height<={h}]/best'
    elif dl_type == 'audio':
        format_str = 'bestaudio/best'
    else:
        format_str = 'best'

    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title).100s.%(ext)s'),
        'format': format_str,
        'logger': MyLogger(),
        'progress_hooks': [hook_wrapper],
        'ffmpeg_location': shutil.which('ffmpeg'),
        'extractor_args': {
            'youtube': {
                'po_token': [po_token] if po_token else [],
                'visitor_data': [visitor_data] if visitor_data else []
            }
        }
    }

    if dl_type == 'audio':
        ydl_opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}]

    def run_download():
        video_title = "Unknown"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_data = ydl.extract_info(url, download=True)
                video_title = info_data.get('title', 'Unknown Title')
                
            files = os.listdir(output_dir)
            if not files:
                raise Exception("No files generated")

            # منطق ضغط الملفات أو نقلها
            if len(files) > 1 or "playlist" in url.lower():
                zip_filename = f"playlist_{task_id[:8]}.zip"
                zip_path = os.path.join(DOWNLOADS_DIR, zip_filename)
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for root, dirs, f in os.walk(output_dir):
                        for file in f:
                            zipf.write(os.path.join(root, file), sanitize_filename(file))
                progress_store[task_id] = {"status": "completed", "file_path": zip_path, "filename": zip_filename}
            else:
                final_name = f"{task_id[:8]}_{sanitize_filename(files[0])}"
                final_path = os.path.join(DOWNLOADS_DIR, final_name)
                os.rename(os.path.join(output_dir, files[0]), final_path)
                progress_store[task_id] = {"status": "completed", "file_path": final_path, "filename": files[0]}
                
            log_download("Railway", task_id, url, video_title, dl_type, quality, True)
            
        except Exception as e:
            print(f"❌ CSIR Download Failed: {str(e)}")
            log_download("Railway", task_id, url, video_title, dl_type, quality, False, str(e))
            progress_store[task_id] = {"status": "error", "error": str(e)}
        finally:
            # نظام Cleanup محسن يضمن مسح المجلدات المؤقتة دائماً
            shutil.rmtree(output_dir, ignore_errors=True)

    executor.submit(run_download)
