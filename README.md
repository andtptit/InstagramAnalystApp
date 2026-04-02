# Instagram Content Analyst App (V7.0 PRO)

Đây là ứng dụng toàn diện giúp tự động cào dữ liệu (scraping), phân tích nội dung bài viết trên Instagram bằng AI Vision (Google Gemini), và tự động hóa dữ liệu lên Google Sheets.

## 🚀 Tính năng mới phiên bản V7.0
- **Model Selector:** Tuyển chọn các dòng Model Gemini mới nhất (2.5, 2.0, 3.0, Pro, Flash Lite).
- **Bộ lọc thông minh (Discovery):** 
    - Lọc theo số lượng Tim (Likes).
    - Lọc theo số lượng ảnh tối thiểu trong bài (Slides).
    - Tùy chọn chỉ lấy bài viết Carousel (bỏ qua Reels/Single Post).
- **Cấu trúc lưu trữ 9 cột:** Hỗ trợ tách bạch nội dung gốc và nội dung dịch (Caption & Text trên ảnh).
- **Giao diện tối ưu:** Thẻ kết quả cố định kích thước, hỗ trợ thanh cuộn riêng biệt cho từng bài.

## 💻 Yêu cầu hệ thống & Khuyên dùng
**Khuyên dùng:** Nên chạy ứng dụng tại **Local (máy tính cá nhân)** thay vì Server Cloud để:
1. Tránh bị Instagram chặn IP (IP nhà riêng uy tín hơn IP Data Center).
2. Có thể xem trực tiếp quá trình trình duyệt ảo hoạt động (`headless: false`).

**Yêu cầu:**
1. **Node.js** (Phiên bản v18.x trở lên).
2. **Cảnh báo:** Cần có tài khoản Google Cloud và tạo API Key cho Gemini AI.

## 🛠️ Hướng dẫn Cài đặt & Khởi chạy

### Bước 1: Cài đặt thư viện
```bash
npm install
npx playwright install
```

### Bước 2: Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc:
```env
GEMINI_API_KEY=AIzaSy... (API Key của bạn)
PORT=3000
```

### Bước 3: Khởi chạy
```bash
node server.js
```
Truy cập: `http://localhost:3000`

## 📊 Hướng dẫn sử dụng Giao diện Web
1. **Mục 1 (Discovery):** Nhập Profile URL, chỉnh số Tim và số Ảnh cần lọc. Bấm "Yêu cầu Bot cào".
2. **Mục 2:** Danh sách URL đạt chuẩn sẽ tự động hiện ra.
3. **Mục 3:** Chọn Model Gemini bạn muốn dùng và nhập Prompt (hoặc dùng Prompt mẫu có sẵn).
4. **Kết quả:** Theo dõi "Live Log" ở dưới và xem kết quả phân tích hiện ra ở bên phải.

## 📑 Cấu hình Google Sheets
Ứng dụng sẽ đẩy dữ liệu vào Sheet theo 9 cột:
`STT` | `Url Kênh` | `Url bài gốc` | `Số lượt tim` | `Caption gốc` | `Caption đã dịch` | `Nội dung ảnh gốc` | `Nội dung ảnh gốc đã dịch` | `Nội dung ảnh làm lại`
