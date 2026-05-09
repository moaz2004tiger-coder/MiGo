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
        disconnect: "انقطع الاتصال بالخادم أثناء التحميل",
        preparing: "جاري تجهيز الملف...",
        // ── YouTube session panel ──
        ytTitle: "يوتيوب يحتاج جلستك",
        ytDesc: "خوادم Railway محجوبة من يوتيوب. الحل: انسخ كوكيز جلستك من متصفحك وألصقها أدناه. لا كلمة مرور — فقط رمز الجلسة.",
        ytCookieLabel: "الصق كوكيز يوتيوب هنا:",
        ytPlaceholder: "SAPISID=Abc123...; __Secure-3PAPISID=Xyz...; SID=...; SSID=...; HSID=...",
        ytSavedOk: "✅ تم الحفظ",
        ytSaveBtn: "حفظ",
        ytHowToggle: "كيف أحصل على الكوكيز؟ (خطوات بالتفصيل)",
        ytSteps: [
            "افتح <strong>youtube.com</strong> في متصفحك وتأكد من تسجيل الدخول.",
            "اضغط <kbd>F12</kbd> لفتح أدوات المطوّر (DevTools).",
            "اذهب إلى تبويب <strong>Application</strong> (أو Storage في Firefox).",
            "من القائمة الجانبية اختر <strong>Cookies ← https://www.youtube.com</strong>.",
            "ابحث عن هذه الأسماء وانسخ <em>Name</em> و <em>Value</em> لكل منها:",
            "<code>SAPISID &nbsp; __Secure-1PAPISID &nbsp; __Secure-3PAPISID<br>SID &nbsp; SSID &nbsp; HSID &nbsp; APISID &nbsp; LOGIN_INFO</code>",
            "الصقها بهذه الصيغة: <code>NAME=VALUE; NAME2=VALUE2</code>",
        ],
        ytWarning: "⚠️ هذه المعلومات تُستخدم فقط لتحميل الفيديو المطلوب ولا تُخزَّن على الخادم."
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
        // ── YouTube session panel ──
        ytTitle: "YouTube session required",
        ytDesc: "Railway servers are blocked by YouTube. Fix: copy your session cookies from this browser and paste them below. No password is ever sent — just your session token.",
        ytCookieLabel: "Paste your YouTube cookies here:",
        ytPlaceholder: "SAPISID=Abc123...; __Secure-3PAPISID=Xyz...; SID=...; SSID=...; HSID=...",
        ytSavedOk: "✅ Saved",
        ytSaveBtn: "Save",
        ytHowToggle: "How do I get the cookies? (step-by-step)",
        ytSteps: [
            "Open <strong>youtube.com</strong> and make sure you are logged in.",
            "Press <kbd>F12</kbd> to open DevTools.",
            "Go to the <strong>Application</strong> tab (Storage in Firefox).",
            "In the sidebar select <strong>Cookies → https://www.youtube.com</strong>.",
            "Find these cookie names and copy the <em>Name</em> and <em>Value</em> of each:",
            "<code>SAPISID &nbsp; __Secure-1PAPISID &nbsp; __Secure-3PAPISID<br>SID &nbsp; SSID &nbsp; HSID &nbsp; APISID &nbsp; LOGIN_INFO</code>",
            "Paste them as: <code>NAME=VALUE; NAME2=VALUE2</code>",
        ],
        ytWarning: "⚠️ These are used only for this download and are never stored on the server."
    }
};

// ─── Welcome modal ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const modal         = document.getElementById('welcome-modal');
    const closeBtn      = document.getElementById('close-modal');
    const understandBtn = document.getElementById('understand-btn');

    if (modal && !sessionStorage.getItem('migo_welcome_shown'))
        modal.classList.remove('hidden');

    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
        sessionStorage.setItem('migo_welcome_shown', 'true');
    };

    closeBtn?.addEventListener('click', closeModal);
    understandBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
});

// ─── State ────────────────────────────────────────────────────────────────────
let currentLang    = 'ar';
let currentInfo    = null;
let es             = null;
let reconnectAttempts = 0;
const MAX_RECONNECT   = 3;

// Cookies the user has pasted — persisted for the whole session
let ytCookieString = sessionStorage.getItem('migo_yt_cookies') || '';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
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

// ─── Language ─────────────────────────────────────────────────────────────────
langBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    applyLanguage();
});

function applyLanguage() {
    const d = dict[currentLang];
    document.documentElement.lang = currentLang;
    document.documentElement.dir  = d.dir;

    document.getElementById('title-text').innerText         = d.title;
    document.getElementById('subtitle-text').innerText      = d.subtitle;
    urlInput.placeholder                                     = d.placeholder;
    document.getElementById('fetch-btn-text').innerText     = d.fetchBtn;
    document.getElementById('loading-text').innerText       = d.loading;
    document.getElementById('type-label').innerText         = d.typeLabel;
    document.getElementById('opt-video').innerText          = d.optVideo;
    document.getElementById('opt-audio').innerText          = d.optAudio;
    document.getElementById('opt-subtitle').innerText       = d.optSubtitle;
    document.getElementById('quality-label').innerText      = d.qualityLabel;
    document.getElementById('download-btn-text').innerText  = d.downloadBtn;
    document.getElementById('progress-title').innerText     = d.progressTitle;
    langBtn.innerText = d.langSwitch;

    if (currentInfo) {
        document.getElementById('media-type').innerText =
            currentInfo.type === 'playlist' ? d.playlist : d.video;
        updateQualityDropdown();
    }

    const panel = document.getElementById('yt-session-panel');
    if (panel && !panel.classList.contains('hidden')) renderYtPanel();
}

// ─── YouTube URL detection ────────────────────────────────────────────────────
function isYouTube(url) {
    return /youtube\.com|youtu\.be/i.test(url);
}

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

// ─── YouTube session panel ────────────────────────────────────────────────────
function renderYtPanel() {
    const d     = dict[currentLang];
    const panel = document.getElementById('yt-session-panel');
    if (!panel) return;

    const stepsHtml = d.ytSteps
        .map(s => `<li>${s}</li>`)
        .join('');

    panel.innerHTML = `
        <div class="yt-header">
            <span class="yt-icon">▶</span>
            <div>
                <strong class="yt-title">${d.ytTitle}</strong>
                <p class="yt-desc">${d.ytDesc}</p>
            </div>
        </div>

        <label class="yt-label">${d.ytCookieLabel}</label>
        <div class="yt-input-row">
            <textarea id="yt-cookie-ta"
                class="yt-textarea"
                rows="3"
                placeholder="${d.ytPlaceholder}"
                spellcheck="false">${ytCookieString}</textarea>
            <button id="yt-save-btn" class="neon-btn small yt-save-btn">${d.ytSaveBtn}</button>
        </div>
        <span id="yt-save-status" class="yt-save-status ${ytCookieString ? 'visible' : ''}">
            ${ytCookieString ? d.ytSavedOk : ''}
        </span>

        <details class="yt-details">
            <summary>${d.ytHowToggle}</summary>
            <ol class="yt-steps-list">${stepsHtml}</ol>
            <p class="yt-warning">${d.ytWarning}</p>
        </details>
    `;

    document.getElementById('yt-save-btn').addEventListener('click', saveCookies);
    document.getElementById('yt-cookie-ta').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCookies(); }
    });
}

function saveCookies() {
    const d      = dict[currentLang];
    const ta     = document.getElementById('yt-cookie-ta');
    const status = document.getElementById('yt-save-status');
    if (!ta) return;
    ytCookieString = ta.value.trim();
    sessionStorage.setItem('migo_yt_cookies', ytCookieString);
    if (status) {
        status.innerText = ytCookieString ? d.ytSavedOk : '';
        status.classList.toggle('visible', !!ytCookieString);
    }
}

// ─── Fetch info ───────────────────────────────────────────────────────────────
urlInput.addEventListener('keypress', e => { if (e.key === 'Enter') fetchInfo(); });
fetchBtn.addEventListener('click', fetchInfo);

async function fetchInfo() {
    const url = urlInput.value.trim();
    if (!url) { showError(dict[currentLang].errEmpty); return; }

    // Grab latest textarea value before fetching
    const ta = document.getElementById('yt-cookie-ta');
    if (ta && ta.value.trim()) ytCookieString = ta.value.trim();

    urlInput.disabled = true;
    fetchBtn.disabled = true;
    hideError();
    mediaInfo.classList.add('hidden');
    progressContainer.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');

    try {
        const payload = { url };
        if (isYouTube(url) && ytCookieString) payload.cookies = ytCookieString;

        const res  = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to fetch data';
            if (Array.isArray(msg))           msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            else if (typeof msg !== 'string') msg = JSON.stringify(msg);
            throw new Error(msg);
        }
        currentInfo = data;
        populateInfo();
    } catch (err) {
        showError(dict[currentLang].errFetch + ': ' + err.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        urlInput.disabled = false;
        fetchBtn.disabled = false;
    }
}

function populateInfo() {
    document.getElementById('media-title').innerText =
        currentInfo.title;
    document.getElementById('media-type').innerText =
        currentInfo.type === 'playlist'
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
    let options =
        type === 'video'    ? currentInfo.qualities :
        type === 'audio'    ? (currentInfo.audio_options?.length ? currentInfo.audio_options : ['best']) :
        type === 'subtitle' ? currentInfo.subtitles : [];

    if (!options || !options.length) {
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

// ─── Download ─────────────────────────────────────────────────────────────────
dlBtn.addEventListener('click', async () => {
    const url     = urlInput.value.trim();
    const type    = dlType.value;
    const quality = type === 'subtitle' ? ''              : dlQuality.value;
    const lang    = type === 'subtitle' ? dlQuality.value : '';
    if (!url) return;

    // Final grab of textarea before sending
    const ta = document.getElementById('yt-cookie-ta');
    if (ta && ta.value.trim()) ytCookieString = ta.value.trim();

    hideError();
    dlBtn.disabled     = true;
    urlInput.disabled  = true;
    dlType.disabled    = true;
    dlQuality.disabled = true;
    document.getElementById('download-btn-text').innerText = dict[currentLang].preparing;

    try {
        const payload = { url, type, quality, lang };
        if (isYouTube(url) && ytCookieString) payload.cookies = ytCookieString;

        const res  = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            let msg = data.detail || 'Failed to start download';
            if (Array.isArray(msg))           msg = msg.map(e => e.msg || JSON.stringify(e)).join(', ');
            else if (typeof msg !== 'string') msg = JSON.stringify(msg);
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

// ─── SSE progress ─────────────────────────────────────────────────────────────
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

    es.onmessage = event => {
        reconnectAttempts = 0;
        const data = JSON.parse(event.data);

        if (data.status === 'downloading' || data.status === 'processing') {
            progressContainer.classList.remove('hidden');
            document.getElementById('progress-bar-fill').style.width = data.percent;
            document.getElementById('stat-percent').innerText  = data.percent;
            document.getElementById('stat-speed').innerText    = data.speed    || '0 KiB/s';
            document.getElementById('stat-eta').innerText      = data.eta      || '0s';
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

// ─── Initial language ─────────────────────────────────────────────────────────
const browserLang = navigator.language || navigator.userLanguage;
if (!browserLang.startsWith('ar')) currentLang = 'en';
applyLanguage();
