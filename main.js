require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getInstagramData } = require('./scraper');
const { analyzeAndSummarize } = require('./ai_service');
const ExcelJS = require('exceljs');

async function main() {
    console.log("=========================================");
    console.log("🚀 STANDALONE INSTAGRAM CONTENT ANALYST");
    console.log("=========================================\n");

    // Lấy URL từ tham số dòng lệnh
    const url = process.argv[2];

    if (!url || !url.includes('instagram.com')) {
        console.error("❌ Lỗi: Vui lòng cung cấp URL Instagram hợp lệ.");
        console.log("Sử dụng: node main.js <URL_INSTAGRAM>");
        process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        console.error("❌ Lỗi: Bạn cần điền GEMINI_API_KEY vào file .env trước khi chạy.");
        process.exit(1);
    }

    try {
        // Bước 1: Trích xuất dữ liệu thô
        console.log("⏳ BƯỚC 1: Cào dữ liệu từ Instagram...");
        const rawData = await getInstagramData(url);
        
        console.log("\n✅ Dữ liệu thô thu được:");
        console.log(`- Lượt thích: ${rawData.likesCount}`);
        console.log(`- Số lượng slide: ${rawData.totalSlidesFound}`);
        
        // Bước 2: Phân tích và tóm tắt bằng AI
        console.log("\n⏳ BƯỚC 2: AI đang phân tích và dịch nội dung...");
        const summary = await analyzeAndSummarize(rawData);

        // Bước 3: Lưu và hiển thị kết quả
        console.log("\n✅ Đã xử lý xong! Đang xuất báo cáo...");
        
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `report_${timestamp}.md`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, summary, 'utf8');

        // BƯỚC 4: Lưu vào Excel (Version 2)
        console.log("📊 BƯỚC 4: Đang cập nhật file Excel dữ liệu...");
        const excelPath = path.join(__dirname, 'data.xlsx');
        const workbook = new ExcelJS.Workbook();
        let worksheet;

        if (fs.existsSync(excelPath)) {
            await workbook.xlsx.readFile(excelPath);
            worksheet = workbook.getWorksheet('History');
        } else {
            worksheet = workbook.addWorksheet('History');
            worksheet.columns = [
                { header: 'Thời gian', key: 'timestamp', width: 20 },
                { header: 'URL', key: 'url', width: 40 },
                { header: 'Lượt thích', key: 'likes', width: 15 },
                { header: 'Số lượng ảnh', key: 'slides', width: 15 },
                { header: 'Tóm tắt ngắn', key: 'summary', width: 60 }
            ];
            // Định dạng header
            worksheet.getRow(1).font = { bold: true };
        }

        // Tạo tóm tắt ngắn từ kết quả AI (lấy 100 ký tự đầu hoặc dòng đầu tiên)
        const shortSummary = summary.split('\n')[0].substring(0, 150) + "...";

        worksheet.addRow({
            timestamp: new Date().toLocaleString('vi-VN'),
            url: url,
            likes: rawData.likesCount,
            slides: rawData.totalSlidesFound,
            summary: shortSummary
        });

        await workbook.xlsx.writeFile(excelPath);

        console.log(`\n🎉 THÀNH CÔNG!`);
        console.log(`Báo cáo đã được lưu tại: ${filePath}`);
        console.log("\n--- KẾT QUẢ TÓM TẮT ---");
        console.log(summary);

    } catch (error) {
        console.error(`\n❌ THẤT BẠI: ${error.message}`);
    }
}

main();
