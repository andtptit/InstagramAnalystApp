require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeAndSummarize(instagramData, customPrompt = "", modelName = "gemini-2.5-flash") {
    try {
        console.log("Đang tải hướng dẫn Skill...");
        // Đọc nội dung Skill
        const skillPath = path.join(__dirname, 'skills', 'instagram_content_analyst.md');
        const skillInstructions = fs.readFileSync(skillPath, 'utf8');

        // Khởi tạo model dựa trên lựa chọn (Mặc định là 2.5 flash)
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        console.log(`Đang phân tích trực quan qua AI Vision với ${instagramData.images.length} hình ảnh...`);

        const promptText = `
Bạn là AI có khả năng thị giác máy tính xuất sắc.
Dưới đây là một bài viết Instagram:
- URL: ${instagramData.url}
- Lượt thích: ${instagramData.likesCount}
- Caption Gốc: ${instagramData.caption}

Nhiệm vụ của bạn là:
1. Đọc và dịch Caption Gốc.
2. Nhìn vào các ảnh được cung cấp, lấy chính xác nội dung text trong ảnh.
3. Dịch text trong ảnh.
4. Tái cấu trúc, tóm gọn text trong tất cả các ảnh thành các slide (theo yêu cầu của người dùng nếu có).

<QuyTắcCốtLõi>
${skillInstructions}
</QuyTắcCốtLõi>

${customPrompt ? `\n<YêuCầuĐặcBiệtCủaNgườiDùng>\n${customPrompt}\nLƯU Ý QUAN TRỌNG: Hãy thực hiện nghiêm ngặt yêu cầu phần này. Nếu có bộ lọc và nội dung ảnh Không Phù Hợp, hãy set "is_skipped": true.\n</YêuCầuĐặcBiệtCủaNgườiDùng>\n` : ''}

BẮT BUỘC TRẢ VỀ DỮ LIỆU BẰNG ĐỊNH DẠNG JSON VỚI CÁC TRƯỜNG SAU BẰNG TIẾNG VIỆT (TRỪ KHI NGƯỜI DÙNG CÓ YÊU CẦU KHÁC):
{
  "is_skipped": boolean, // true nếu bạn quyết định bỏ qua bài viết này do KHÔNG thoả mãn <YêuCầuĐặcBiệtCủaNgườiDùng>
  "translated_caption": "...", // Caption đã dịch sang tiếng Việt
  "original_image_text": "...", // Toàn bộ chữ viết gốc trên ảnh
  "translated_image_text": "...", // Toàn bộ chữ viết trên ảnh đã được dịch
  "reworked_image_text": "..." // Tóm gọn nội dung ảnh thành các slide hoặc nội dung mới theo yêu cầu
}
Ngôn ngữ sử dụng trong giá trị JSON phải tuân thủ yêu cầu của người dùng.
`;
        const parts = [
            promptText,
            ...(instagramData.images || []).map(img => ({
                inlineData: {
                    data: img.data,
                    mimeType: img.mimeType
                }
            }))
        ];

        const result = await model.generateContent(parts);
        const responseText = result.response.text();

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("Lỗi Parse JSON từ AI:", responseText);
            throw new Error("AI không trả về JSON hợp lệ.");
        }

    } catch (error) {
        console.error("Lỗi trong quá trình xử lý AI:", error.message);
        throw error;
    }
}

module.exports = {
    analyzeAndSummarize
};
