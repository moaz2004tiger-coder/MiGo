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
        completed: "اكتمل التجهيز! جاري بدء التنزيل...",
        dlError: "خطأ في التحميل: ",
        disconnect: "انقطع الاتصال بالخادم نهائياً أثناء التحميل",
        preparing: "جاري تجهيز الملف...",
        // YouTube cookie UI
        ytBannerTitle: "يوتيوب يحتاج جلستك",
        ytBannerBody: "الخادم محجوب من يوتيوب. لكن يمكنك تجاوز ذلك بمشاركة جلستك من متصفحك مباشرةً — آمن تماماً ولا يُرسَل أي كلمة مرور.",
        ytStep1: "افتح يوتيوب في هذا المتصفح وتأكد أنك مسجّل الدخول.",
        ytStep2: "اضغط الزر أدناه لاستخراج بيانات الجلسة تلقائياً.",
        ytExtractBtn: "استخراج بيانات الجلسة",
        ytExtractDone: "✅ تم الاستخراج — يمكنك الآن التحميل",
        ytExtractFail: "تعذّر الاستخراج التلقائي. الرجاء نسخ الكوكيز يدوياً.",
        ytManualLabel: "أو الصق كوكيز يوتيوب يدوياً:",
        ytManualPlaceholder: "VISITOR_INFO1_LIVE=xxx; YSC=yyy; SAPISID=zzz ...",
        ytManualSaved: "✅ تم الحفظ",
        ytHowTitle: "كيف أحصل على الكوكيز يدوياً؟",
        ytHowSteps: [
            "افتح youtube.com في متصفحك وتأكد من تسجيل الدخول.",
            "اضغط F12 لفتح أدوات المطور.",
            "اذهب إلى Application → Cookies → https://www.youtube.com",
            "انسخ القيم الكاملة لـ: SAPISID, __Secure-3PAPISID, SID, SSID, HSID",
            "الصقها بالصيغة: NAME=VALUE; NAME2=VALUE2"
        ]
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
        completed: "Ready! Starting download...",
        dlError: "Download error: ",
        disconnect: "Lost connection to server during download",
        preparing: "Preparing file...",
        // YouTube cookie UI
        ytBannerTitle: "YouTube session required",
        ytBannerBody: "The server is blocked by YouTube. You can bypass this by sharing your session from this browser — no password is ever sent.",
        ytStep1: "Make sure you are logged into YouTube in this browser.",
        ytStep2: "Click the button below to extract your session automatically.",
        ytExtractBtn: "Extract session data",
        ytExtractDone: "✅ Extracted — you can now start the download",
        ytExtractFail: "Auto-extraction failed. Please paste cookies manually.",
        ytManualLabel: "Or paste your YouTube cookies manually:",
        ytManualPlaceholder: "VISITOR_INFO1_LIVE=xxx; YSC=yyy; SAPISID=zzz ...",
        ytManualSaved: "✅ Saved",
        ytHowTitle: "How to get cookies manually?",
        ytHowSteps: [
            "Open youtube.com and make sure you are logged in.",
            "Press F12 to open DevTools.",
            "Go to Application → Cookies → https://www.youtube.com",
            "Copy the full values for: SAPISID, __Secure-3PAPISID, SID, SSID, HSID",
            "Paste them as: NAME=VALUE; NAME2=VALUE2"
        ]
    }
};

// ─── Welcome modal ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const modal      = document.getElementById('welcome-modal');
    const closeBtn   = document.getElementById('close-modal');
    const understandBtn = document.getElementById('understand-btn');

    if (modal && !sessionStorage.getItem('migo_welcome_shown')) {
        modal.classList.remove('hidden');
    }

    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
        sessionStorage.setItem('migo_welcome_shown', 'true');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (understandBtn) understandBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
});

// ─── State ───────────────────────────────────────────────────────────────────
let currentLang    = 'ar';
let currentInfo    = null;
let es             = null;
let reconnectAttempts = 0;
const MAX_RECONNECT   = 3;

// Stored YouTube cookies entered/extracted by the user this session
let ytCookieString = '';

// ─── DOM references ───────────────────────────────────────────────────────────
const urlInput          = document.getElementById('url-input');
const fetchBtn          = document.getElementById('fetch-btn');
const langBtn           = document.getElementById('lang-btn');
const loadingSpinner    = document.getElementById('loading-spinner');
const mediaInfo         = document.getElementById('media-info');
const errorMsg          = document.getElementById('error-message');
const dlType            = document.getElementById('download-type');
const dlQuality         = document.getElementById('download-quality');
const dlBtn             = document.getElementById('download-btn');
const progressContainer = document.getElementById('progress-container');

// ─── Language toggle ──────────────────────────────────────────────────────────
langBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    applyLanguage();
});

function applyLanguage() {
    const d = dict[currentLang];
    document.documentElement.lang = currentLang;
    document.documentElement.dir  = d.dir;

    document.getElementById('title-text').innerText    = d.title;
    document.getElementById('subtitle-text').innerText = d.subtitle;
    urlInput.placeholder = d.placeholder;
    document.getElementById('fetch-btn-text').innerText    = d.fetchBtn;
    document.getElementById('loading-text').innerText      = d.loading;
    document.getElementById('type-label').innerText        = d.typeLabel;
    document.getElementById('opt-video').innerText         = d.optVideo;
    document.getElementById('opt-audio').innerText         = d.optAudio;
    document.getElementById('opt-subtitle').innerText      = d.optSubtitle;
    document.getElementById('quality-label').innerText     = d.qualityLabel;
    document.getElementById('download-btn-text').innerText = d.downloadBtn;
    document.getElementById('progress-title').innerText    = d.progressTitle;
    langBtn.innerText = d.langSwitch;

    if (currentInfo) {
        document.getElementById('media-type').innerText =
            currentInfo.type === 'playlist' ? d.playlist : d.video;
        updateQualityDropdown();
    }

    // Re-render the YouTube panel if it is visible
    const ytPanel = document.getElementById('yt-session-panel');
    if (ytPanel && !ytPanel.classList.contains('hidden')) {
        renderYtPanel();
    }
}

// ─── URL detection helpers ────────────────────────────────────────────────────
function isYouTube(url) {
    return /youtube\.com|youtu\.be/i.test(url);
}

// Show/hide the YT session panel whenever the URL field changes
urlInput.addEventListener('input', () => {
    const panel = document.getElementById('yt-session-panel');
    if (!panel) return;
    if (isYouTube(urlInput.value.trim())) {
        panel.classList.remove('hidden');
        renderYtPanel();
    } else {
        panel.classList.add('hidden');
    }
});

// ─── Render the YouTube session panel ────────────────────────────────────────
function renderYtPanel() {
    const d     = dict[currentLang];
    const panel = document.getElementById('yt-session-panel');
    if (!panel) return;

    panel.innerHTML = `
        <div class="yt-banner">
            <div class="yt-banner-icon">▶</div>
            <div class="yt-banner-text">
                <strong>${d.ytBannerTitle}</strong>
                <p>${d.ytBannerBody}</p>
            </div>
        </div>

        <div class="yt-steps">
            <div class="yt-step">${d.ytStep1}</div>
            <div class="yt-step">${d.ytStep2}</div>
        </div>

        <button id="yt-extract-btn" class="neon-btn small yt-extract-btn">
            ${d.ytExtractBtn}
        </button>
        <span id="yt-extract-status" class="yt-status"></span>

        <div class="yt-manual-section">
            <label class="yt-manual-label">${d.ytManualLabel}</label>
            <div class="yt-manual-row">
                <textarea id="yt-manual-input"
                    class="yt-cookie-input"
                    rows="2"
                    placeholder="${d.ytManualPlaceholder}"
                    spellcheck="false">${ytCookieString}</textarea>
                <button id="yt-manual-save" class="neon-btn small">&nbsp;↵&nbsp;</button>
            </div>
            <span id="yt-manual-status" class="yt-status"></span>
        </div>

        <details class="yt-how-details">
            <summary>${d.ytHowTitle}</summary>
            <ol class="yt-how-list">
                ${d.ytHowSteps.map(s => `<li>${s}</li>`).join('')}
            </ol>
        </details>
    `;

    // Bind extract button
    document.getElementById('yt-extract-btn').addEventListener('click', attemptAutoExtract);

    // Bind manual save button
    document.getElementById('yt-manual-save').addEventListener('click', saveManualCookies);

    // Live-save on textarea change
    document.getElementById('yt-manual-input').addEventListener('change', saveManualCookies);
}

// ─── Auto-extract: reads document.cookie (non-HttpOnly cookies only) ─────────
// For HttpOnly cookies the user must paste manually, but this captures
// whatever the current page context can see (helpful for cross-site embeds).
function attemptAutoExtract() {
    const d      = dict[currentLang];
    const raw    = document.cookie;          // non-HttpOnly cookies on this origin
    const status = document.getElementById('yt-extract-status');

    if (raw && raw.trim().length > 0) {
        ytCookieString = raw;
        const ta = document.getElementById('yt-manual-input');
        if (ta) ta.value = raw;
        status.innerText  = d.ytExtractDone;
        status.className  = 'yt-status success';
    } else {
        status.innerText  = d.ytExtractFail;
        status.className  = 'yt-status warn';
    }
}

// ─── Manual cookie save ───────────────────────────────────────────────────────
function saveManualCookies() {
    const d      = dict[currentLang];
    const ta     = document.getElementById('yt-manual-input');
    const status = document.getElementById('yt-manual-status');
    if (!ta) return;
    ytCookieString = ta.value.trim();
    if (ytCookieString) {
        status.innerText = d.ytManualSaved;
        status.className = 'yt-status success';
    }
}

// ─── Fetch info ───────────────────────────────────────────────────────────────
urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchInfo(); });
fetchBtn.addEventListener('click', fetchInfo);

async function fetchInfo() {
    const url = urlInput.value.trim();
    if (!url) { showError(dict[currentLang].errEmpty); return; }

    urlInput.disabled = true;
    fetchBtn.disabled = true;

    hideError();
    mediaInfo.classList.add('hidden');
    progressContainer.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');

    try {
        const res  = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to fetch data';
            if (Array.isArray(msg))            msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            else if (typeof msg !== 'string')   msg = JSON.stringify(msg);
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
    typeBadge.innerText = currentInfo.type === 'playlist'
        ? dict[currentLang].playlist
        : dict[currentLang].video;

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

    if (type === 'video')         options = currentInfo.qualities;
    else if (type === 'audio')  { options = currentInfo.audio_options; if (!options || !options.length) options = ['best']; }
    else if (type === 'subtitle') options = currentInfo.subtitles;

    if (!options || options.length === 0) {
        const opt = document.createElement('option');
        opt.value = ''; opt.innerText = dict[currentLang].notAvailable;
        dlQuality.appendChild(opt);
        dlBtn.disabled = true;
        return;
    }

    dlBtn.disabled = false;
    options.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val; opt.innerText = val;
        dlQuality.appendChild(opt);
    });
}

function showError(msg) { errorMsg.innerText = msg; errorMsg.classList.remove('hidden'); }
function hideError()    { errorMsg.classList.add('hidden'); }

// ─── Start download ───────────────────────────────────────────────────────────
dlBtn.addEventListener('click', async () => {
    const url     = urlInput.value.trim();
    const type    = dlType.value;
    const quality = type === 'subtitle' ? "" : dlQuality.value;
    const lang    = type === 'subtitle' ? dlQuality.value : "";
    if (!url) return;

    // Read any saved manual cookies from the textarea (latest value)
    const taManual = document.getElementById('yt-manual-input');
    if (taManual && taManual.value.trim()) ytCookieString = taManual.value.trim();

    hideError();
    dlBtn.disabled     = true;
    urlInput.disabled  = true;
    dlType.disabled    = true;
    dlQuality.disabled = true;
    document.getElementById('download-btn-text').innerText = dict[currentLang].preparing;

    try {
        const payload = { url, type, quality, lang };

        // Attach cookies only for YouTube URLs
        if (isYouTube(url) && ytCookieString) {
            payload.cookies = ytCookieString;
        }

        const res  = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to start download';
            if (Array.isArray(msg))            msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            else if (typeof msg !== 'string')   msg = JSON.stringify(msg);
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
    dlBtn.disabled     = false;
    urlInput.disabled  = false;
    dlType.disabled    = false;
    dlQuality.disabled = false;
    document.getElementById('download-btn-text').innerText = dict[currentLang].downloadBtn;
}

// ─── SSE progress stream ──────────────────────────────────────────────────────
function startProgressStream(taskId) {
    if (reconnectAttempts === 0) {
        document.getElementById('progress-bar-fill').style.width = '0%';
        document.getElementById('stat-percent').innerText  = '0%';
        document.getElementById('stat-speed').innerText    = '0 KiB/s';
        document.getElementById('stat-eta').innerText      = '0s';
        document.getElementById('progress-filename').innerText = '';
    }

    if (es) es.close();
    es = new EventSource(`/api/progress/${taskId}`);

    es.onmessage = (event) => {
        reconnectAttempts = 0;
        const data = JSON.parse(event.data);

        if (data.status === 'downloading' || data.status === 'processing') {
            progressContainer.classList.remove('hidden');
            document.getElementById('progress-bar-fill').style.width = data.percent;
            document.getElementById('stat-percent').innerText  = data.percent;
            document.getElementById('stat-speed').innerText    = data.speed   || '0 KiB/s';
            document.getElementById('stat-eta').innerText      = data.eta     || '0s';
            document.getElementById('progress-filename').innerText = data.filename || '';
        }

        if (data.status === 'completed') {
            es.close();
            document.getElementById('progress-bar-fill').style.width = '100%';
            document.getElementById('stat-percent').innerText  = '100%';
            document.getElementById('progress-filename').innerText = dict[currentLang].completed;
            window.location.href = `/api/download_file/${taskId}`;
            setTimeout(enableInputs, 2000);
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
            setTimeout(() => startProgressStream(taskId), 2000);
        } else {
            showError(dict[currentLang].disconnect);
            enableInputs();
        }
    };
}

// ─── Initial language detection ───────────────────────────────────────────────
const browserLang = navigator.language || navigator.userLanguage;
if (!browserLang.startsWith('ar')) currentLang = 'en';
applyLanguage();
