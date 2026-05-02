const dict = {
    ar: {
        title: "MiGo",
        subtitle: "حمل الفيديوهات، الصوتيات، والترجمات من جميع المنصات",
        placeholder: "ضع رابط الفيديو أو قائمة التشغيل هنا واضغط Enter...",
        fetchBtn: "جلب البيانات",
        loading: "جاري جلب البيانات...",
        typeLabel: "نوع التحميل",
        optVideo: "فيديو (صوت وصورة)",
        optAudio: "صوت فقط",
        optSubtitle: "ترجمة",
        qualityLabel: "الجودة / اللغة",
        downloadBtn: "بدء التحميل",
        progressTitle: "حالة التحميل",
        errEmpty: "الرجاء إدخال رابط صحيح",
        errFetch: "حدث خطأ أثناء جلب البيانات",
        langSwitch: "English",
        dir: "rtl",
        playlist: "قائمة تشغيل",
        video: "فيديو",
        notAvailable: "غير متاح",
        completed: "اكتمل التحميل! جاري بدء التنزيل...",
        dlError: "خطأ في التحميل: ",
        disconnect: "انقطع الاتصال بالخادم نهائياً أثناء التحميل"
    },
    en: {
        title: "MiGo",
        subtitle: "Download Videos, Audio, and Subtitles from any platform",
        placeholder: "Paste video or playlist URL here and press Enter...",
        fetchBtn: "Fetch Data",
        loading: "Fetching data...",
        typeLabel: "Download Type",
        optVideo: "Video (with Audio)",
        optAudio: "Audio Only",
        optSubtitle: "Subtitle",
        qualityLabel: "Quality / Language",
        downloadBtn: "Start Download",
        progressTitle: "Download Status",
        errEmpty: "Please enter a valid URL",
        errFetch: "Error fetching data",
        langSwitch: "العربية",
        dir: "ltr",
        playlist: "Playlist",
        video: "Video",
        notAvailable: "Not Available",
        completed: "Completed! Starting download...",
        dlError: "Download error: ",
        disconnect: "Lost connection to server during download"
    }
};

let currentLang = 'ar';
let currentInfo = null;
let es = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;

const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const langBtn = document.getElementById('lang-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const mediaInfo = document.getElementById('media-info');
const errorMsg = document.getElementById('error-message');

const dlType = document.getElementById('download-type');
const dlQuality = document.getElementById('download-quality');
const dlBtn = document.getElementById('download-btn');
const progressContainer = document.getElementById('progress-container');

langBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    applyLanguage();
});

function applyLanguage() {
    const d = dict[currentLang];
    document.documentElement.lang = currentLang;
    document.documentElement.dir = d.dir;
    
    document.getElementById('title-text').innerText = d.title;
    document.getElementById('subtitle-text').innerText = d.subtitle;
    urlInput.placeholder = d.placeholder;
    document.getElementById('fetch-btn-text').innerText = d.fetchBtn;
    document.getElementById('loading-text').innerText = d.loading;
    document.getElementById('type-label').innerText = d.typeLabel;
    document.getElementById('opt-video').innerText = d.optVideo;
    document.getElementById('opt-audio').innerText = d.optAudio;
    document.getElementById('opt-subtitle').innerText = d.optSubtitle;
    document.getElementById('quality-label').innerText = d.qualityLabel;
    document.getElementById('download-btn-text').innerText = d.downloadBtn;
    document.getElementById('progress-title').innerText = d.progressTitle;
    langBtn.innerText = d.langSwitch;
    
    if (currentInfo) {
        document.getElementById('media-type').innerText = currentInfo.type === 'playlist' ? d.playlist : d.video;
        updateQualityDropdown();
    }
}

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchInfo();
    }
});

fetchBtn.addEventListener('click', fetchInfo);

async function fetchInfo() {
    const url = urlInput.value.trim();
    if (!url) {
        showError(dict[currentLang].errEmpty);
        return;
    }
    
    // Disable inputs to prevent multiple fetches
    urlInput.disabled = true;
    fetchBtn.disabled = true;
    
    hideError();
    mediaInfo.classList.add('hidden');
    progressContainer.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    
    try {
        const res = await fetch('/api/info', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ url })
        });
        
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to fetch data';
            if (Array.isArray(msg)) {
                msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            } else if (typeof msg !== 'string') {
                msg = JSON.stringify(msg);
            }
            throw new Error(msg);
        }
        
        currentInfo = data;
        populateInfo();
    } catch (err) {
        showError(dict[currentLang].errFetch + ": " + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        urlInput.disabled = false;
        fetchBtn.disabled = false;
    }
}

function populateInfo() {
    document.getElementById('media-title').innerText = currentInfo.title;
    
    const typeBadge = document.getElementById('media-type');
    typeBadge.innerText = currentInfo.type === 'playlist' ? dict[currentLang].playlist : dict[currentLang].video;
        
    const thumb = document.getElementById('media-thumb');
    if (currentInfo.thumbnail) {
        thumb.src = currentInfo.thumbnail;
        thumb.classList.remove('hidden');
    } else {
        thumb.classList.add('hidden');
    }
    
    dlType.value = 'video';
    updateQualityDropdown();
    
    mediaInfo.classList.remove('hidden');
}

dlType.addEventListener('change', updateQualityDropdown);

function updateQualityDropdown() {
    dlQuality.innerHTML = '';
    const type = dlType.value;
    
    let options = [];
    if (type === 'video') {
        options = currentInfo.qualities;
    } else if (type === 'audio') {
        options = currentInfo.audio_options;
        if(!options || options.length === 0) options = ['best'];
    } else if (type === 'subtitle') {
        options = currentInfo.subtitles;
    }
    
    if (!options || options.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = dict[currentLang].notAvailable;
        dlQuality.appendChild(opt);
        dlBtn.disabled = true;
        return;
    }
    
    dlBtn.disabled = false;
    options.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.innerText = val;
        dlQuality.appendChild(opt);
    });
}

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.classList.remove('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
}

dlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const type = dlType.value;
    const quality = type === 'subtitle' ? "" : dlQuality.value;
    const lang = type === 'subtitle' ? dlQuality.value : "";
    
    if (!url) return;
    
    hideError();
    dlBtn.disabled = true;
    urlInput.disabled = true;
    dlType.disabled = true;
    dlQuality.disabled = true;
    
    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ url, type, quality, lang })
        });
        
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to start download';
            if (Array.isArray(msg)) {
                msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            } else if (typeof msg !== 'string') {
                msg = JSON.stringify(msg);
            }
            throw new Error(msg);
        }
        
        reconnectAttempts = 0;
        startProgressStream(data.task_id);
    } catch (err) {
        showError(err.message);
        enableInputs();
    }
});

function enableInputs() {
    dlBtn.disabled = false;
    urlInput.disabled = false;
    dlType.disabled = false;
    dlQuality.disabled = false;
}

function startProgressStream(taskId) {
    progressContainer.classList.remove('hidden');
    
    if (reconnectAttempts === 0) {
        document.getElementById('progress-bar-fill').style.width = '0%';
        document.getElementById('stat-percent').innerText = '0%';
        document.getElementById('stat-speed').innerText = '0 KiB/s';
        document.getElementById('stat-eta').innerText = '0s';
        document.getElementById('progress-filename').innerText = '';
    }
    
    if (es) {
        es.close();
    }
    
    es = new EventSource(`/api/progress/${taskId}`);
    
    es.onmessage = (event) => {
        reconnectAttempts = 0; // Reset on success
        const data = JSON.parse(event.data);
        
        if (data.status === 'downloading' || data.status === 'processing') {
            document.getElementById('progress-bar-fill').style.width = data.percent;
            document.getElementById('stat-percent').innerText = data.percent;
            document.getElementById('stat-speed').innerText = data.speed || '0 KiB/s';
            document.getElementById('stat-eta').innerText = data.eta || '0s';
            document.getElementById('progress-filename').innerText = data.filename || '';
        }
        
        if (data.status === 'completed') {
            es.close();
            document.getElementById('progress-bar-fill').style.width = '100%';
            document.getElementById('stat-percent').innerText = '100%';
            document.getElementById('progress-filename').innerText = dict[currentLang].completed;
            
            window.location.href = `/api/download_file/${taskId}`;
            
            setTimeout(() => {
                enableInputs();
            }, 2000);
        }
        
        if (data.status === 'error') {
            es.close();
            showError(dict[currentLang].dlError + data.error);
            enableInputs();
        }
    };
    
    es.onerror = () => {
        es.close();
        if (reconnectAttempts < MAX_RECONNECT) {
            reconnectAttempts++;
            setTimeout(() => {
                startProgressStream(taskId);
            }, 2000);
        } else {
            showError(dict[currentLang].disconnect);
            enableInputs();
        }
    };
}

const browserLang = navigator.language || navigator.userLanguage;
if (!browserLang.startsWith('ar')) {
    currentLang = 'en';
}
applyLanguage();
