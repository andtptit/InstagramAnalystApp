require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Khởi tạo Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testVisionAPI() {
    try {
        console.log("🚀 Bắt đầu test API Gemini Vision...");
        
        // 1. Chỉ định tên model thế hệ 2.5 (Phù hợp với API Key của bạn)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 2. Đường dẫn đến ảnh test
        // Bạn hãy tải bức ảnh Instagram mẫu, lưu vào thư mục này với tên 'test_image.jpg'
        const imagePath = path.join(__dirname, 'test_image.jpg');
        
        if (!fs.existsSync(imagePath)) {
            console.error(`❌ Không tìm thấy ảnh test tại: ${imagePath}`);
            console.log(`💡 HƯỚNG DẪN: Hãy tải bức ảnh mẫu của bạn về, đổi tên thành 'test_image.jpg' và lưu vào thư mục InstagramAnalystApp.`);
            return;
        }

        // 3. Đọc dữ liệu ảnh chuyển thành Base64
        const imageData = fs.readFileSync(imagePath);
        const imageBase64 = Buffer.from(imageData).toString('base64');

        console.log("✅ Đã load file ảnh! Đang gửi 100% dữ liệu cho Gemini bằng Mắt thần...");

        // 4. Tạo Prompt đa phương thức (Multimodal)
        const promptText = `
Bạn là chuyên gia phân tích nội dung Instagram.
Hãy nhìn vào bức ảnh này và làm 3 việc:
1. Đọc và trả về TẤT CẢ văn bản (chữ) xuất hiện trên ảnh.
2. Mô tả bối cảnh hình ảnh (có những gì trong ảnh).
3. Đóng vai trò là Tóm tắt, tóm tắt điều này thành đúng 2 câu.
`;

        const parts = [
            promptText,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg" // Gửi mimeType phù hợp (jpeg/png/webp)
                }
            }
        ];

        // 5. Giao tiếp API
        const result = await model.generateContent(parts);
        const responseText = result.response.text();

        console.log("\n🎉 --- KẾT QUẢ TỪ GEMINI --- 🎉\n");
        console.log(responseText);
        console.log("\n------------------------------\n");
        console.log("✅ Test thành công! Thư viện và API Key hoạt động hoàn hảo.");

    } catch (error) {
        console.error("\n❌ LỖI TỪ API GEMINI:");
        console.error(error.message);
    }
}

testVisionAPI();
