require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const EventEmitter = require('events');
const { getInstagramData, discoverPosts } = require('./scraper');
const { analyzeAndSummarize } = require('./ai_service');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. CHUYỂN HƯỚNG CONSOLE LOG TỚI SSE
// ==========================================
const logEmitter = new EventEmitter();
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    logEmitter.emit('log', { type: 'info', message: msg, timestamp: new Date().toLocaleTimeString('vi-VN') });
};

console.error = function(...args) {
    originalError.apply(console, args);
    let msg = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    logEmitter.emit('log', { type: 'error', message: `❌ ERR: ${msg}`, timestamp: new Date().toLocaleTimeString('vi-VN') });
};

// SSE Endpoint (Gửi Log thời gian thực xuống Client)
app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendLog = (logData) => {
        res.write(`data: ${JSON.stringify(logData)}\n\n`);
    };

    logEmitter.on('log', sendLog);

    // Dọn dẹp listener khi ngắt kết nối
    req.on('close', () => {
        logEmitter.removeListener('log', sendLog);
    });
});

// ==========================================
// 2. LOGIC LƯU EXCEL
// ==========================================
async function saveToExcel(url, rawData, summaryObj) {
    try {
        const excelPath = path.join(__dirname, 'data.xlsx');
        const workbook = new ExcelJS.Workbook();
        let worksheet;

        if (fs.existsSync(excelPath)) {
            await workbook.xlsx.readFile(excelPath);
            worksheet = workbook.getWorksheet('AnalysisHistory');
        } else {
            worksheet = workbook.addWorksheet('AnalysisHistory');
            worksheet.columns = [
                { header: 'Thời gian', key: 'timestamp', width: 20 },
                { header: 'URL', key: 'url', width: 40 },
                { header: 'Lượt thích', key: 'likes', width: 15 },
                { header: 'Số lượng ảnh', key: 'slides', width: 15 },
                { header: 'Tóm tắt', key: 'summary', width: 80 }
            ];
            worksheet.getRow(1).font = { bold: true };
        }

        const shortSummary = (summaryObj.reworked_image_text || "").split('\n').filter(l => l.trim()).join(' ').substring(0, 200) + "...";

        worksheet.addRow({
            timestamp: new Date().toLocaleString('vi-VN'),
            url: url,
            likes: rawData.likesCount,
            slides: rawData.totalSlidesFound,
            summary: shortSummary
        });

        await workbook.xlsx.writeFile(excelPath);
    } catch (e) {
        console.error("Lỗi khi lưu Excel:", e);
    }
}
async function saveToGoogleSheets(gsheetConfig, url, rawData, summaryObj, profileUrl) {
    if (!gsheetConfig || !gsheetConfig.spreadsheetId || !gsheetConfig.jsonKey) {
        return console.log("[Google Sheets] Bỏ qua lưu Cloud vì chưa cấu hình.");
    }

    try {
        console.log(`[Google Sheets] Đang kết nối tới Sheet ID: ${gsheetConfig.spreadsheetId}...`);
        
        let credentials;
        try {
            credentials = typeof gsheetConfig.jsonKey === 'string' ? JSON.parse(gsheetConfig.jsonKey) : gsheetConfig.jsonKey;
        } catch(e) {
            return console.error("[Google Sheets] Lỗi Verify JSON Key: Định dạng không hợp lệ.");
        }

        const serviceAccountAuth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(gsheetConfig.spreadsheetId, serviceAccountAuth);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByTitle[gsheetConfig.sheetName || 'Sheet1'] || doc.sheetsByIndex[0];
        console.log(`[Google Sheets] Đang ghi dữ liệu vào Tab: ${sheet.title}`);

        // Đảm bảo Header đúng format
        await sheet.setHeaderRow(['STT', 'Url Kênh', 'Url bài viết gốc', 'Số lượt tim', 'Caption gốc', 'Caption đã dịch', 'Nội dung ảnh gốc', 'Nội dung ảnh gốc đã dịch', 'Nội dung ảnh làm lại']);

        // Tính toán STT (Lấy số dòng hiện tại)
        const rows = await sheet.getRows();
        const stt = rows.length + 1;

        await sheet.addRow({
            'STT': stt,
            'Url Kênh': rawData.authorUrl || profileUrl || "N/A",
            'Url bài viết gốc': url,
            'Số lượt tim': rawData.likesCount,
            'Caption gốc': rawData.caption || "N/A",
            'Caption đã dịch': summaryObj.translated_caption || "N/A",
            'Nội dung ảnh gốc': summaryObj.original_image_text || "N/A",
            'Nội dung ảnh gốc đã dịch': summaryObj.translated_image_text || "N/A",
            'Nội dung ảnh làm lại': summaryObj.reworked_image_text || "N/A"
        });

        console.log(`[Google Sheets] ✅ Đã đẩy 1 dòng dữ liệu lên Cloud thành công!`);
    } catch (err) {
        console.error(`[Google Sheets] Lỗi kết nối API: ${err.message}`);
    }
}


// ==========================================
// 3. ENDPOINT API QUẢN LÝ
// ==========================================

// Endpoint Discovery (Chế độ quét & lọc Tim tĩnh)
app.post('/api/discover', async (req, res) => {
    const { profileUrl, limit, minLikes, minImages, onlyCarousel } = req.body;
    if (!profileUrl) return res.status(400).json({ success: false, error: 'Thiếu Profile URL' });

    try {
        console.log(`\n================================`);
        console.log(`[Khám Phá] Bắt đầu quét Profile: ${profileUrl}`);
        console.log(`[Khám Phá] Điều kiện: Max ${limit || 20} bài | Min ${minLikes || 0} Tim | Min ${minImages || 4} Ảnh | Chỉ Carousel: ${onlyCarousel !== false}`);
        console.log(`================================`);
        
        const urls = await discoverPosts(profileUrl, limit || 20, minLikes || 0, minImages || 4, onlyCarousel !== false);
        
        console.log(`[Khám Phá] Hoàn tất. Lọc thành công ${urls.length} bài đạt chuẩn!`);
        res.json({ success: true, urls });
    } catch(err) {
        console.error(`[API Lỗi Khám Phá] ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint Analyze (Chế độ Phân tích Vision AI)
app.post('/api/analyze', async (req, res) => {
    const { url, customPrompt, gsheetConfig, profileUrl, modelName } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'Thiếu URL' });

    try {
        console.log(`\n[Phân Tích] Chuẩn bị trích xuất URL: ${url}`);
        const rawData = await getInstagramData(url);
        
        console.log(`[Mắt Thần] Gửi tài nguyên cho AI xử lý Tóm tắt & Dịch Thuật (Model: ${modelName || 'gemini-2.5-flash'})...`);
        const summaryObj = await analyzeAndSummarize(rawData, customPrompt, modelName || 'gemini-2.5-flash');

        // Xử lý SKIP từ logic Prompt
        if (summaryObj.is_skipped) {
            console.log(`[Mắt Thần] AI quyết định SKIP bài viết do không thỏa mãn yêu cầu nội dung!`);
            return res.json({
                success: true,
                skipped: true,
                result: { url: url, message: "Bài viết bị loại (SKIP) vì Không phù hợp nội dung." }
            });
        }
        
        const summaryText = `**1. Caption (Dịch):**\n${summaryObj.translated_caption}\n\n**2. Ảnh Gốc (Text trích xuất):**\n${summaryObj.original_image_text}\n\n**3. Ảnh Gốc (Dịch):**\n${summaryObj.translated_image_text}\n\n**4. Kết Quả Slide Tóm Tắt:**\n${summaryObj.reworked_image_text}`;

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        fs.writeFileSync(path.join(outputDir, `web_report_${Date.now()}.md`), summaryText, 'utf8');

        console.log(`[Lưu Dữ Liệu] Đang ghi đè lịch sử vào file Excel...`);
        await saveToExcel(url, rawData, summaryObj);

        if (gsheetConfig) {
            console.log(`[Lưu Dữ Liệu Cloud] Đang đẩy lên Google Sheets...`);
            await saveToGoogleSheets(gsheetConfig, url, rawData, summaryObj, profileUrl);
        }

        console.log(`[Hoàn Tất] Đã hoàn thành xử lý bài viết gốc.`);

        res.json({
            success: true,
            skipped: false,
            result: {
                url: url,
                likes: rawData.likesCount,
                slides: rawData.totalSlidesFound,
                isVideo: rawData.isVideo,
                summary: summaryText
            }
        });

    } catch (err) {
        console.error(`[Lỗi Phân Tích] ${url}: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 HỆ THỐNG AGENTIC ANALYST PRO V5 ĐANG KHỞI CHẠY (Port: ${PORT})`);
});
