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

        let promptText;
        
        if (instagramData.isVideo) {
            promptText = `
Bạn là AI có khả năng phân tích nội dung xuất sắc.
Dưới đây là một bài viết dạng VIDEO/REELS trên Instagram:
- URL: ${instagramData.url}
- Lượt thích: ${instagramData.likesCount}
- Caption Gốc: ${instagramData.caption}

Nhiệm vụ của bạn là:
1. Đọc và hiểu toàn bộ nội dung từ Caption Gốc. Bức ảnh đính kèm chỉ là ảnh đại diện (thumbnail) của Video do hệ thống tự động chụp.
2. Dịch Caption gốc.
3. Không bắt buộc phải trích xuất chữ viết trong Video (vì AI không xem được video chạy).
4. Dựa 100% vào Caption Gốc và hình ảnh đại diện để "chế biến", viết lại nội dung theo đúng yêu cầu của người dùng.

<QuyTắcCốtLõi>
${skillInstructions}
</QuyTắcCốtLõi>

${customPrompt ? `\n<YêuCầuĐặcBiệtCủaNgườiDùng>\n${customPrompt}\nLƯU Ý QUAN TRỌNG: Hãy thực hiện nghiêm ngặt yêu cầu phần này. Nếu có bộ lọc và nội dung ảnh Không Phù Hợp, hãy set "is_skipped": true.\n</YêuCầuĐặcBiệtCủaNgườiDùng>\n` : ''}

BẮT BUỘC TRẢ VỀ DỮ LIỆU BẰNG ĐỊNH DẠNG JSON. 
VÍ DỤ ĐỊNH DẠNG TRẢ VỀ (Cho Video):
{
  "is_skipped": false,
  "translated_caption": "Đây là nội dung bài viết...",
  "original_image_text": "Bài viết dạng Video, không trích xuất chữ.",
  "translated_image_text": "Bài viết dạng Video, không dịch chữ trên video.",
  "reworked_image_text": "Slide 1: ...\\nSlide 2: ..."
}

TRƯỜNG DỮ LIỆU CẦN TRẢ VỀ:
{
  "is_skipped": boolean, // true nếu KHÔNG thoả mãn <YêuCầuĐặcBiệtCủaNgườiDùng>
  "translated_caption": "...", // Caption đã dịch sang tiếng Việt
  "original_image_text": "...", // Điền đúng câu: "Bài viết dạng Video, không hỗ trợ trích xuất chữ."
  "translated_image_text": "...", // Điền đúng câu: "Bài viết dạng Video, không hỗ trợ dịch chữ trên màn hình."
  "reworked_image_text": "..." // Tổng hợp từ Caption Gốc để viết lại thành nội dung mới
}
Ngôn ngữ sử dụng trong giá trị JSON phải tuân thủ yêu cầu.
`;
        } else {
            promptText = `
Bạn là AI có khả năng thị giác máy tính xuất sắc.
Dưới đây là một bài viết Instagram:
- URL: ${instagramData.url}
- Lượt thích: ${instagramData.likesCount}
- Caption Gốc: ${instagramData.caption}

Nhiệm vụ của bạn là:
1. Đọc và dịch Caption Gốc.
2. Nhìn vào các ảnh được cung cấp, lấy chính xác nội dung text trong ảnh. PHẢI CÓ TIỀN TỐ phân định rõ ràng như "Ảnh 1: ...", "Ảnh 2: ...".
3. Dịch text trong ảnh. Trình bày rõ ràng theo từng ảnh (ví dụ: "Ảnh 1: ...", "Ảnh 2: ...").
4. Tổng hợp thông tin từ CẢ "Caption Gốc" VÀ "Text trong tất cả các ảnh" để tái cấu trúc, viết lại nội dung theo yêu cầu của người dùng.

<QuyTắcCốtLõi>
${skillInstructions}
</QuyTắcCốtLõi>

${customPrompt ? `\n<YêuCầuĐặcBiệtCủaNgườiDùng>\n${customPrompt}\nLƯU Ý QUAN TRỌNG: Hãy thực hiện nghiêm ngặt yêu cầu phần này. Nếu có bộ lọc và nội dung ảnh Không Phù Hợp, hãy set "is_skipped": true.\n</YêuCầuĐặcBiệtCủaNgườiDùng>\n` : ''}

BẮT BUỘC TRẢ VỀ DỮ LIỆU BẰNG ĐỊNH DẠNG JSON. 
Đối với phần 'original_image_text' và 'translated_image_text', bạn PHẢI liệt kê theo từng ảnh. Mỗi ảnh chỉ ghi nhãn 'Ảnh X:' MỘT LẦN DUY NHẤT ở đầu, sau đó là toàn bộ nội dung của ảnh đó. Không lặp lại nhãn cho từng dòng.

VÍ DỤ ĐỊNH DẠNG TRẢ VỀ:
{
  "is_skipped": false,
  "translated_caption": "Đây là nội dung bài viết...",
  "original_image_text": "Ảnh 1: Nội dung dòng 1\\ndòng 2\\ndòng 3\\nẢnh 2: Nội dung ảnh 2...",
  "translated_image_text": "Ảnh 1: Bản dịch dòng 1\\ndòng 2\\ndòng 3\\nẢnh 2: Bản dịch ảnh 2...",
  "reworked_image_text": "Slide 1: ...\\nSlide 2: ..."
}

TRƯỜNG DỮ LIỆU CẦN TRẢ VỀ:
{
  "is_skipped": boolean, // true nếu KHÔNG thoả mãn <YêuCầuĐặcBiệtCủaNgườiDùng>
  "translated_caption": "...", // Caption đã dịch sang tiếng Việt
  "original_image_text": "...", // Chữ gốc TRÊN TỪNG ẢNH (Chỉ ghi 'Ảnh X:' 1 lần ở đầu mỗi ảnh, các dòng sau xuống dòng tự nhiên)
  "translated_image_text": "...", // Chữ dịch TRÊN TỪNG ẢNH (Chỉ ghi 'Ảnh X:' 1 lần ở đầu mỗi ảnh, các dòng sau xuống dòng tự nhiên)
  "reworked_image_text": "..." // Tổng hợp từ Caption Gốc + Toàn bộ ảnh để viết lại nội dung mới
}
Ngôn ngữ sử dụng trong giá trị JSON phải tuân thủ yêu cầu của người dùng.
`;
        }
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
