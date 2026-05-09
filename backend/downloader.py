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

# --- دالة جلب المعلومات مع دعم التوكنات (CSIR) ---
def get_media_info(url: str, po_token: str = None, visitor_data: str = None):
    # لا حاجة لـ static_ffmpeg.add_paths() هنا لأننا نقلناها لـ main.py للسرعة
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'logger': MyLogger(),
        'ffmpeg_location': shutil.which('ffmpeg'),
        'cookiefile': 'cookies.txt', # تأكد من وجود الملف في مجلد المشروع
        'player_client': ['android', 'web_safari'],
        'user_agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web_safari'],
                'formats': 'duplicate,missing_pot',
                # حقن توكنات الهوية من المتصفح لفك الحظر
                'po_token': [po_token] if po_token else [],
                'visitor_data': [visitor_data] if visitor_data else []
            }
        }
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            if 'entries' in info:
                # Playlist
                playlist_title = info.get('title', 'Playlist')
                videos = []
                for idx, entry in enumerate(info['entries']):
                    videos.append({
                        'title': entry.get('title', f'Video {idx+1}'),
                        'url': entry.get('url'),
                        'id': entry.get('id')
                    })
                return {
                    'type': 'playlist',
                    'title': playlist_title,
                    'videos': videos,
                    'qualities': ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
                    'audio_options': ['best'],
                    'subtitles': []
                }
            else:
                # Single video
                title = info.get('title', 'Video')
                thumbnail = info.get('thumbnail')
                
                formats = info.get('formats', [])
                video_heights = set()
                for f in formats:
                    h = f.get('height')
                    if f.get('vcodec') != 'none' and h:
                        video_heights.add(int(h))
                
                video_qualities = [f"{h}p" for h in sorted(list(video_heights))]
                if not video_qualities: video_qualities = ['best']
                
                sub_dict = info.get('subtitles', {})
                auto_sub_dict = info.get('automatic_captions', {})
                all_subs = set(list(sub_dict.keys()) + list(auto_sub_dict.keys()))
                
                return {
                    'type': 'video',
                    'title': title,
                    'thumbnail': thumbnail,
                    'qualities': video_qualities,
                    'audio_options': ['best'],
                    'subtitles': sorted(list(all_subs))
                }
        except Exception as e:
            real_err = str(e)
            print(f"❌ YouTube API Error: {real_err}") # سيظهر في سجلات ريلواي
            
            friendly_err = "خطأ في الرابط أو حظر مؤقت"
            if "private" in real_err.lower(): friendly_err = "الفيديو خاص"
            elif "bot" in real_err.lower() or "confirm your age" in real_err.lower():
                friendly_err = "يوتيوب اكتشف نشاطاً آلياً، يرجى المحاولة لاحقاً"
            
            return {"error": friendly_err}

# --- دالة مهمة التحميل مع دعم التوكنات ---
def download_media_task(task_id: str, url: str, dl_type: str, quality: str, lang: str = None, po_token: str = None, visitor_data: str = None):
    output_dir = os.path.join(DOWNLOADS_DIR, task_id)
    os.makedirs(output_dir, exist_ok=True)
    
    def hook_wrapper(d):
        if d['status'] == 'downloading':
            percent = d.get('_percent_str', '0%').replace('\x1b[1m', '').replace('\x1b[0m', '').strip()
            progress_store[task_id] = {
                "status": "downloading",
                "percent": percent,
                "speed": d.get('_speed_str', '0KiB/s').strip(),
                "eta": d.get('_eta_str', 'Unknown').strip(),
                "filename": os.path.basename(d.get('filename', ''))
            }
        elif d['status'] == 'finished':
            progress_store[task_id] = {"status": "processing", "percent": "100%", "filename": "Finalizing..."}

    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title).100s.%(ext)s'),
        'cookiefile': 'cookies.txt',
        'logger': MyLogger(),
        'progress_hooks': [hook_wrapper],
        'quiet': False,
        'windowsfilenames': True,
        'player_client': ['android', 'web_safari'],
        'user_agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web_safari'],
                'formats': 'duplicate,missing_pot',
                'po_token': [po_token] if po_token else [],
                'visitor_data': [visitor_data] if visitor_data else []
            }
        }
    }

    # ضبط الجودة
    if dl_type == 'video':
        height = quality.replace('p', '') if quality != 'best' else '2160'
        ydl_opts['format'] = f'bestvideo[height<={height}]+bestaudio/best[height<={height}]/best'
        ydl_opts['merge_output_format'] = 'mp4'
    elif dl_type == 'audio':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}]
    elif dl_type == 'subtitle':
        ydl_opts.update({'skip_download': True, 'writesubtitles': True, 'writeautomaticsub': True, 'subtitleslangs': [lang] if lang else ['en']})

    def run_download():
        progress_store[task_id] = {"status": "starting", "percent": "0%"}
        video_title = "Unknown Title"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_data = ydl.extract_info(url, download=True) # التحميل مباشرة
                video_title = info_data.get('title', 'Unknown Title')
                
            files = os.listdir(output_dir)
            if not files:
                raise Exception("No files generated")

            if len(files) > 1 or "playlist" in url:
                zip_filename = f"playlist_{task_id[:8]}.zip"
                zip_path = os.path.join(DOWNLOADS_DIR, zip_filename)
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for f in files:
                        zipf.write(os.path.join(output_dir, f), sanitize_filename(f))
                progress_store[task_id] = {"status": "completed", "file_path": zip_path, "filename": zip_filename}
            else:
                final_name = f"{task_id[:8]}_{sanitize_filename(files[0])}"
                final_path = os.path.join(DOWNLOADS_DIR, final_name)
                os.rename(os.path.join(output_dir, files[0]), final_path)
                progress_store[task_id] = {"status": "completed", "file_path": final_path, "filename": files[0]}
                
            log_download("Railway_Server", task_id, url, video_title, dl_type, quality, True)
            shutil.rmtree(output_dir, ignore_errors=True)
            
        except Exception as e:
            print(f"❌ Download Failed: {e}")
            log_download("Railway_Server", task_id, url, video_title, dl_type, quality, False, str(e))
            progress_store[task_id] = {"status": "error", "error": str(e)}
            shutil.rmtree(output_dir, ignore_errors=True)

    executor.submit(run_download)
