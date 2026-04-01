require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeAndSummarize(instagramData, customPrompt = "") {
    try {
        console.log("Đang tải hướng dẫn Skill...");
        // Đọc nội dung Skill
        const skillPath = path.join(__dirname, 'skills', 'instagram_content_analyst.md');
        const skillInstructions = fs.readFileSync(skillPath, 'utf8');

        // Khởi tạo model (Tài khoản của bạn sử dụng thế hệ 2.5 mới nhất)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        console.log(`Đang phân tích trực quan qua AI Vision với ${instagramData.images.length} hình ảnh...`);

        const promptText = `
Bạn là một AI phân tích nội dung chuyên nghiệp có khả năng thị giác máy tính. Hãy tuân thủ tuyệt đối các quy tắc sau:

<QuyTắcMặcĐịnh>
${skillInstructions}
</QuyTắcMặcĐịnh>

${customPrompt ? `\n<YêuCầuĐặcBiệtCủaNgườiDùng>\n${customPrompt}\nLƯU Ý QUAN TRỌNG: Hãy ƯU TIÊN THỰC HIỆN các yêu cầu trong phần này. Nếu yêu cầu lọc mà bài không thỏa mãn, hãy trả lời đúng 1 chữ: SKIP.\n</YêuCầuĐặcBiệtCủaNgườiDùng>\n` : ''}

Dưới đây là DỮ LIỆU CƠ BẢN:
- URL: ${instagramData.url}
- Lượt thích: ${instagramData.likesCount}
- Tổng slides: ${instagramData.totalSlidesFound}

Dưới đây là các HÌNH ẢNH screenshot của bài viết. Hãy "nhìn" nội dung trên ảnh, trích xuất văn bản và tóm tắt.
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

        return responseText;

    } catch (error) {
        console.error("Lỗi trong quá trình xử lý AI:", error.message);
        throw error;
    }
}

module.exports = {
    analyzeAndSummarize
};
