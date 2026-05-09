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
    # Allow Arabic, English letters, numbers, spaces, dots, and dashes. Replace everything else with '_'
    return re.sub(r'[^\w\-\.\s\u0600-\u06FF]', '_', filename).strip()

# تم تحديث الدالة لاستقبال توكنات الهوية (CSIR)
def get_media_info(url: str, po_token: str = None, visitor_data: str = None):
    static_ffmpeg.add_paths()
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'logger': MyLogger(),
        'ffmpeg_location': shutil.which('ffmpeg'),
        'cookiefile': 'cookies.txt',
        'player_client': ['web'],  # تم التغيير ليتوافق مع توكنات المتصفح
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'extractor_args': {
            'youtube': {
                'player_client': ['web'],
                'formats': 'duplicate,missing_pot',
                # حقن التوكنات لتجاوز الحظر
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
                # Single video
                title = info.get('title', 'Video')
                thumbnail = info.get('thumbnail')
                
                formats = info.get('formats', [])
                video_heights = sorted(list(set(int(f.get('height')) for f in formats if f.get('height'))))
                
                video_qualities = [f"{h}p" for h in video_heights]
                if not video_qualities:
                    video_qualities = ['best']
                
                sub_dict = info.get('subtitles', {})
                auto_sub_dict = info.get('automatic_captions', {})
                all_subs = set(list(sub_dict.keys()) + list(auto_sub_dict.keys()))
                subtitles = sorted(list(all_subs))
                
                return {
                    'type': 'video',
                    'title': title,
                    'thumbnail': thumbnail,
                    'qualities': video_qualities,
                    'audio_options': ['best'],
                    'subtitles': subtitles
                }
        except Exception as e:
            print(f"❌ YouTube API Error: {str(e)}")
            err_msg = str(e).lower()
            friendly_err = "خطأ في الرابط أو حظر مؤقت من يوتيوب"
            if "private video" in err_msg:
                friendly_err = "هذا الفيديو خاص (Private)"
            elif "unsupported url" in err_msg:
                friendly_err = "الرابط غير مدعوم أو غير صحيح"
            return {"error": friendly_err}

# تحديث الدالة لاستقبال التوكنات وتفعيل نظام Cleanup محسن
def download_media_task(task_id: str, url: str, dl_type: str, quality: str, lang: str = None, po_token: str = None, visitor_data: str = None):
    output_dir = os.path.join(DOWNLOADS_DIR, task_id)
    os.makedirs(output_dir, exist_ok=True)
    
    def hook_wrapper(d):
        if d['status'] == 'downloading':
            percent_str = d.get('_percent_str', '0.0%').strip()
            # إزالة أكواد الألوان (ANSI) من النص
            percent_str = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', percent_str)
            
            progress_store[task_id] = {
                "status": "downloading",
                "percent": percent_str,
                "speed": d.get('_speed_str', '0KiB/s').strip(),
                "eta": d.get('_eta_str', 'Unknown').strip(),
                "filename": os.path.basename(d.get('filename', ''))
            }
        elif d['status'] == 'finished':
            progress_store[task_id] = {
                "status": "processing",
                "percent": "100%",
                "filename": "Merging/Finalizing..."
            }

    # منطق اختيار الجودة المرن (Flexible Format Selection)
    if dl_type == 'video':
        h = quality.replace('p', '') if quality != 'best' else '1080'
        # اختيار الجودة المطلوبة أو الأفضل المتاح دون توقف (Fall-back mechanism)
        format_str = f'bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/best[height<={h}]/best'
    elif dl_type == 'audio':
        format_str = 'bestaudio/best'
    else:
        format_str = 'best'

    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title).100s.%(ext)s'),
        'format': format_str,
        'cookiefile': 'cookies.txt',
        'logger': MyLogger(),
        'progress_hooks': [hook_wrapper],
        'quiet': False,
        'windowsfilenames': True,
        'player_client': ['web'],
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'extractor_args': {
            'youtube': {
                'player_client': ['web'],
                'po_token': [po_token] if po_token else [],
                'visitor_data': [visitor_data] if visitor_data else []
            }
        }
    }
    
    local_ffmpeg = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if platform.system() == "Windows" and os.path.exists(os.path.join(local_ffmpeg, "ffmpeg.exe")):
        ydl_opts['ffmpeg_location'] = local_ffmpeg
    elif platform.system() != "Windows" and os.path.exists(os.path.join(local_ffmpeg, "ffmpeg")):
        ydl_opts['ffmpeg_location'] = local_ffmpeg

    if dl_type == 'audio':
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
    
    elif dl_type == 'subtitle':
        ydl_opts.update({
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': [lang] if lang else ['en']
        })

    def run_download():
        progress_store[task_id] = {"status": "starting", "percent": "0%"}
        video_title = "Unknown Title"
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_data = ydl.extract_info(url, download=True)
                video_title = info_data.get('title', 'Unknown Title')
                
            files = os.listdir(output_dir)
            if not files:
                raise Exception("لم يتم تحميل أي ملفات.")

            # التعامل مع قوائم التشغيل أو الملفات المتعددة
            if len(files) > 1 or "playlist" in url.lower():
                zip_filename = f"playlist_{task_id[:8]}.zip"
                zip_path = os.path.join(DOWNLOADS_DIR, zip_filename)
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for root, dirs, f in os.walk(output_dir):
                        for file in f:
                            file_path = os.path.join(root, file)
                            zipf.write(file_path, sanitize_filename(file))
                progress_store[task_id] = {"status": "completed", "file_path": zip_path, "filename": zip_filename}
            else:
                # ملف واحد
                original_file = files[0]
                safe_file = sanitize_filename(original_file)
                final_name = f"{task_id[:8]}_{safe_file}"
                final_path = os.path.join(DOWNLOADS_DIR, final_name)
                os.rename(os.path.join(output_dir, original_file), final_path)
                progress_store[task_id] = {"status": "completed", "file_path": final_path, "filename": safe_file}
                
            log_download("Railway_Server", task_id, url, video_title, dl_type, quality, True)
            
        except Exception as e:
            print(f"❌ Download Error: {str(e)}")
            log_download("Railway_Server", task_id, url, video_title, dl_type, quality, False, str(e))
            progress_store[task_id] = {"status": "error", "error": str(e)}
        finally:
            # نظام Cleanup المحسن: مسح المجلد المؤقت دائماً سواء نجح الطلب أم فشل
            try:
                shutil.rmtree(output_dir, ignore_errors=True)
            except:
                pass

    # تشغيل المهمة في Thread Pool
    executor.submit(run_download)
