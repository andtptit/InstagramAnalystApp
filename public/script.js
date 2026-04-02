// 1. CHIA SẺ LOG LÊN TERMINAL (SSE)
const liveLog = document.getElementById('liveLog');
const btnClearLog = document.getElementById('btnClearLog');

const eventSource = new EventSource('/api/logs');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const p = document.createElement('p');
    p.className = `log-line ${data.type}`;
    p.innerHTML = `<span class="time">[${data.timestamp}]</span> ${escapeHTML(data.message)}`;
    liveLog.appendChild(p);
    liveLog.scrollTop = liveLog.scrollHeight;
};

btnClearLog.addEventListener('click', () => {
    liveLog.innerHTML = '<p class="log-line info">Đã dọn dẹp Log Box.</p>';
});

// ==========================================
// 1.5. LOGIC MODAL CÀI ĐẶT & LOCAL STORAGE
// ==========================================
const btnSettings = document.getElementById('btnSettings');
const btnCloseModal = document.getElementById('btnCloseModal');
const settingsModal = document.getElementById('settingsModal');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const saveStatus = document.getElementById('saveStatus');

const gsheetIdInput = document.getElementById('gsheetId');
const gsheetNameInput = document.getElementById('gsheetName');
const gsheetJsonKeyInput = document.getElementById('gsheetJsonKey');

// Load từ LocalStorage khi khởi động
if (localStorage.getItem('gsheetId')) gsheetIdInput.value = localStorage.getItem('gsheetId');
if (localStorage.getItem('gsheetName')) gsheetNameInput.value = localStorage.getItem('gsheetName');
if (localStorage.getItem('gsheetJsonKey')) gsheetJsonKeyInput.value = localStorage.getItem('gsheetJsonKey');

btnSettings.addEventListener('click', () => settingsModal.classList.add('active'));
btnCloseModal.addEventListener('click', () => settingsModal.classList.remove('active'));
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

btnSaveSettings.addEventListener('click', () => {
    localStorage.setItem('gsheetId', gsheetIdInput.value.trim());
    localStorage.setItem('gsheetName', gsheetNameInput.value.trim());
    localStorage.setItem('gsheetJsonKey', gsheetJsonKeyInput.value.trim());
    
    saveStatus.style.display = 'block';
    setTimeout(() => { saveStatus.style.display = 'none'; }, 3000);
});

// 2. LOGIC NÚT "FILTER" (KHÁM PHÁ)
document.getElementById('btnFilter').addEventListener('click', async () => {
    const urlsText = document.getElementById('urlInput').value.trim();
    const limit = parseInt(document.getElementById('limitInput').value) || 5;
    const minLikes = parseInt(document.getElementById('minLikesInput').value) || 0;
    const minImages = parseInt(document.getElementById('minImagesInput').value) || 4;
    const onlyCarousel = document.getElementById('onlyCarouselInput').checked;

    if (!urlsText) return alert('Vui lòng nhập Profile URL!');
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    const btn = document.getElementById('btnFilter');
    btn.disabled = true;
    btn.innerText = '⏳ Đang quét Profile...';

    const approvedUrlList = document.getElementById('approvedUrlList');

    for (let url of urls) {
        if (url.includes('/p/') || url.includes('/reel/')) {
            // Nhập tay url bài viết cụ thể -> tự động vứt qua danh sách đạt
            approvedUrlList.value += (approvedUrlList.value ? '\n' : '') + url;
            continue;
        }

        try {
            const res = await fetch('/api/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileUrl: url, limit, minLikes, minImages, onlyCarousel })
            });
            const data = await res.json();
            
            if (data.success && data.urls.length > 0) {
                const currentText = approvedUrlList.value.trim();
                const newUrls = data.urls.join('\n');
                approvedUrlList.value = currentText ? currentText + '\n' + newUrls : newUrls;
            }
        } catch(e) { console.error('Lỗi khi fetch discover API', e); }
    }

    btn.disabled = false;
    btn.innerText = '🔍 Yêu cầu Bot cào và Lọc URL';
});

// 3. LOGIC NÚT "AGENTIC" (VISION AI MẮT THẦN)
document.getElementById('btnRun').addEventListener('click', async () => {
    const urlsText = document.getElementById('approvedUrlList').value.trim();
    const customPrompt = document.getElementById('customPrompt').value.trim();

    if (!urlsText) return alert('Không có URL nào Đạt Chuẩn để chạy. Hãy click nút Cáo ở trên hoặc dán tay URL vào ô thứ 2!');

    let urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    urls = [...new Set(urls)]; // Bỏ trùng lặp

    const btn = document.getElementById('btnRun');
    btn.disabled = true;
    btn.innerText = '🤖 Đang chạy Mắt thần (Tránh tắt tab)...';

    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer.querySelector('.empty-state')) {
        resultsContainer.innerHTML = '';
    }

    for (let idx = 0; idx < urls.length; idx++) {
        const url = urls[idx];
        
        // Lấy cấu hình Google Sheets
        const gsheetId = document.getElementById('gsheetId').value.trim();
        const gsheetName = document.getElementById('gsheetName').value.trim();
        const gsheetJsonKey = document.getElementById('gsheetJsonKey').value.trim();
        
        const gsheetConfig = gsheetId && gsheetJsonKey ? {
            spreadsheetId: gsheetId,
            sheetName: gsheetName,
            jsonKey: gsheetJsonKey
        } : null;

        const profileUrl = document.getElementById('urlInput').value.trim().split('\n')[0];
        const modelName = document.getElementById('modelSelect').value;

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, customPrompt, gsheetConfig, profileUrl, modelName })
            });

            const data = await response.json();
            if (data.success && !data.skipped) {
                renderResult(data.result);
            }
        } catch (err) {
            console.error('Lỗi khi fetch analyze API', err);
        }
    }

    btn.disabled = false;
    btn.innerText = '🤖 KÍCH HOẠT QUY TRÌNH MẮT THẦN CHỤP ẢNH';
});

// HÀM HỖ TRỢ HIỂN THỊ KẾT QUẢ AI
function renderResult(result) {
    const resultsContainer = document.getElementById('resultsContainer');
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // Phân biệt Video / Image
    const mediaInfo = result.isVideo ? '🎬 Video/Reel' : `📸 ${result.slides} Slides (Ảnh)`;

    card.innerHTML = `
        <h3><a href="${result.url}" target="_blank" style="color: inherit; text-decoration: underline;">${result.url.substring(0, 45)}...</a></h3>
        <div class="result-meta">
            <span>❤️ ${result.likes} Likes</span>
            <span>${mediaInfo}</span>
        </div>
        <div class="result-content">${escapeHTML(result.summary)}</div>
    `;
    resultsContainer.insertBefore(card, resultsContainer.firstChild);
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag)
    );
}
