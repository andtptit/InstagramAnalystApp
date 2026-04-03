require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getInstagramData } = require('./scraper');
const { analyzeAndSummarize } = require('./ai_service');

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

        console.log("\n📦 BƯỚC 4: Hoàn tất lưu dữ liệu local...");

        console.log(`\n🎉 THÀNH CÔNG!`);
        console.log(`Báo cáo đã được lưu tại: ${filePath}`);
        console.log("\n--- KẾT QUẢ TÓM TẮT ---");
        console.log(summary);

    } catch (error) {
        console.error(`\n❌ THẤT BẠI: ${error.message}`);
    }
}

main();
