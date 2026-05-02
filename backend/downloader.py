import yt_dlp
import os
import zipfile
import threading
import shutil
import re
import platform
import static_ffmpeg
from concurrent.futures import ThreadPoolExecutor

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

def get_media_info(url: str):
    static_ffmpeg.add_paths()
    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extract_flat': 'in_playlist',
        'logger': MyLogger(),
        'ffmpeg_location': shutil.which('ffmpeg')
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
                    # For playlists we might not know exactly without fetching each, provide a generous list
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
                audio_qualities = set()
                
                for f in formats:
                    h = f.get('height')
                    if f.get('vcodec') != 'none' and h:
                        video_heights.add(int(h))
                    if f.get('acodec') != 'none':
                        audio_qualities.add("best")
                
                # Dynamic qualities based on actual available resolutions
                video_qualities = [f"{h}p" for h in sorted(list(video_heights))]
                if not video_qualities:
                    video_qualities = ['best']
                
                subtitles = []
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
            err_msg = str(e).lower()
            friendly_err = "خطأ غير معروف في الرابط"
            if "private video" in err_msg:
                friendly_err = "هذا الفيديو خاص (Private)"
            elif "unsupported url" in err_msg:
                friendly_err = "الرابط غير مدعوم أو غير صحيح"
            elif "sign in" in err_msg:
                friendly_err = "هذا الفيديو يتطلب تسجيل دخول لعرضه"
            return {"error": friendly_err}

def download_media_task(task_id: str, url: str, dl_type: str, quality: str, lang: str = None):
    output_dir = os.path.join(DOWNLOADS_DIR, task_id)
    os.makedirs(output_dir, exist_ok=True)
    
    def hook_wrapper(d):
        if d['status'] == 'downloading':
            percent_str = d.get('_percent_str', '0.0%').strip()
            speed_str = d.get('_speed_str', '0KiB/s').strip()
            eta_str = d.get('_eta_str', 'Unknown').strip()
            filename = os.path.basename(d.get('filename', ''))
            
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            percent_str = ansi_escape.sub('', percent_str)
            speed_str = ansi_escape.sub('', speed_str)
            eta_str = ansi_escape.sub('', eta_str)
            
            progress_store[task_id] = {
                "status": "downloading",
                "percent": percent_str,
                "speed": speed_str,
                "eta": eta_str,
                "filename": filename
            }
        elif d['status'] == 'finished':
            progress_store[task_id] = {
                "status": "processing",
                "percent": "100%",
                "speed": "0KiB/s",
                "eta": "0s",
                "filename": "Merging/Finalizing..."
            }

    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'logger': MyLogger(),
        'progress_hooks': [hook_wrapper],
        'quiet': False,
        'windowsfilenames': True
    }
    
    local_ffmpeg = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if platform.system() == "Windows" and os.path.exists(os.path.join(local_ffmpeg, "ffmpeg.exe")):
        ydl_opts['ffmpeg_location'] = local_ffmpeg
    elif platform.system() != "Windows" and os.path.exists(os.path.join(local_ffmpeg, "ffmpeg")) and os.path.isfile(os.path.join(local_ffmpeg, "ffmpeg")):
        ydl_opts['ffmpeg_location'] = local_ffmpeg

    if dl_type == 'video':
        if quality == 'best':
            ydl_opts['format'] = 'bestvideo+bestaudio/best'
        else:
            height = quality.replace('p', '')
            ydl_opts['format'] = f'bestvideo[height<={height}]+bestaudio/best'
        ydl_opts['merge_output_format'] = 'mp4'
    
    elif dl_type == 'audio':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
    
    elif dl_type == 'subtitle':
        ydl_opts['skip_download'] = True
        ydl_opts['writesubtitles'] = True
        ydl_opts['writeautomaticsub'] = True
        if lang:
            ydl_opts['subtitleslangs'] = [lang]
        else:
            ydl_opts['subtitleslangs'] = ['en']

    is_playlist = False
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': 'in_playlist'}) as ydl_check:
            info_check = ydl_check.extract_info(url, download=False)
            if info_check and 'entries' in info_check:
                is_playlist = True
                ydl_opts['outtmpl'] = os.path.join(output_dir, '%(playlist_index)s - %(title)s.%(ext)s')
    except:
        pass

    def run_download():
        progress_store[task_id] = {"status": "starting", "percent": "0%", "speed": "", "eta": "", "filename": ""}
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            files = os.listdir(output_dir)
            if not files:
                progress_store[task_id] = {"status": "error", "error": "لم يتم تحميل أي ملفات. قد لا توجد ترجمات متاحة."}
                return

            if len(files) > 1 or is_playlist:
                zip_filename = f"playlist_{task_id[:8]}.zip"
                zip_path = os.path.join(DOWNLOADS_DIR, zip_filename)
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for root, dirs, f in os.walk(output_dir):
                        for file in f:
                            file_path = os.path.join(root, file)
                            # Sanitize file names inside zip
                            safe_name = sanitize_filename(file)
                            zipf.write(file_path, safe_name)
                progress_store[task_id] = {"status": "completed", "file_path": zip_path, "filename": zip_filename}
            else:
                original_file = files[0]
                safe_file = sanitize_filename(original_file)
                # Ensure unique final name
                final_name = f"{task_id[:8]}_{safe_file}"
                file_path = os.path.join(output_dir, original_file)
                final_path = os.path.join(DOWNLOADS_DIR, final_name)
                
                os.rename(file_path, final_path)
                progress_store[task_id] = {"status": "completed", "file_path": final_path, "filename": safe_file}
                
            shutil.rmtree(output_dir, ignore_errors=True)
            
        except Exception as e:
            err_msg = str(e).lower()
            friendly_err = "حدث خطأ أثناء التحميل: " + str(e)
            if "private video" in err_msg:
                friendly_err = "هذا الفيديو خاص (Private)"
            elif "ffmpeg is not installed" in err_msg:
                friendly_err = "أداة دمج الفيديو (FFmpeg) غير موجودة"
            
            progress_store[task_id] = {"status": "error", "error": friendly_err}
            try:
                shutil.rmtree(output_dir, ignore_errors=True)
            except:
                pass

    # Submit task to the thread pool instead of creating unbounded threads
    executor.submit(run_download)
