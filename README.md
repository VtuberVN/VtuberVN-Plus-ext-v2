# VtuberVN Star (Browser Extension v2)

Tiện ích mở rộng chính thức cho nền tảng [VtuberVN](https://vtuberhub.vn), tối ưu trải nghiệm xem livestream, video và tương tác YouTube trực tiếp trên nền tảng web.

---

## 🌟 Tính Năng Chính

- **Khung Live Chat Kính Mờ (Glassmorphic Chat)**: Tự động mở khung chat cho stream trực tiếp và stream đã kết thúc trên trang Watch và Multiview.
- **Tương tác YouTube Trực tiếp**: Nhấn Thích (Like), Đăng ký kênh (Subscribe) và gửi bình luận trực tiếp từ giao diện VtuberVN.
- **Cầu nối Sóng Nhạc (Audio Visualizer Bridge)**: Trích xuất và truyền dữ liệu FFT âm thanh từ YouTube player sang bộ hiển thị sóng nhạc của VtuberVN.
- **Nút Chuyển Nhanh trên YouTube**: Tự động thêm nút "Xem trên VtuberVN" vào thanh tác vụ video YouTube (Ctrl + Click để mở Multiview).
- **Thu thập Số liệu Thời gian thực (Crowdsourcing Telemetry)**: Hỗ trợ đồng bộ CCV và lượt thích thực tế về hệ thống hiển thị của website.
- **Tùy chỉnh Nhanh (Options Popup)**: Bảng cài đặt trên thanh công cụ cho phép bật/tắt các tính năng, điều chỉnh FPS sóng nhạc và chuyển đổi ngôn ngữ (VI/EN).

---

## 🚀 Cài Đặt Trình Duyệt

### 1. Chrome / Edge / Brave / Cốc Cốc
1. Mở trang quản lý tiện ích: `chrome://extensions/` (hoặc `edge://extensions/`).
2. Bật công tắc **Developer mode (Chế độ cho nhà phát triển)** ở góc trên bên phải.
3. Cài đặt theo 1 trong 2 cách:
   - **File .CRX**: Kéo thả file `vtubervn-plus-v2-v2.0.2.crx` vào trình duyệt và chọn *Add extension*.
   - **File .ZIP**: Giải nén file `vtubervn-plus-v2-v2.0.2-chrome.zip`, nhấn **Load unpacked (Tải tiện ích đã giải nén)** và chọn thư mục vừa giải nén.

### 2. Mozilla Firefox
1. Mở trang `about:addons`.
2. Nhấn vào biểu tượng bánh răng ⚙️ ở góc phải &rarr; chọn **Install Add-on From File...**.
3. Chọn file `vtubervn-plus-v2-v2.0.2.xpi`.

---

## 💻 Hướng Dẫn Phát Triển & Đóng Gói (Developer Guide)

### Yêu cầu
- Node.js >= 18.0.0
- Yarn hoặc NPM

### Cài đặt dependencies
```bash
yarn install
```

### Chạy Development Mode (Hot Reload)
```bash
# Cho trình duyệt Chromium (Chrome, Edge, Brave...)
yarn dev:chrome

# Cho Firefox
yarn dev:firefox
```
Sau đó load thư mục `dist_chrome` hoặc `dist_firefox` vào trình duyệt.

### Đóng gói Production Release (Không chứa dữ liệu mật / Không localhost)
```bash
# Đóng gói bản Production (CRX, ZIP, XPI)
yarn pack

# Đóng gói cả bản Production và Development
yarn package:all
```
Các gói phát hành đầu ra sẽ được lưu tại thư mục `packages/prod/`.

---

## 🔒 Quyền Riêng Tư & Bảo Mật

- Tiện ích chạy hoàn toàn cục bộ trên trình duyệt của người dùng.
- Mọi thao tác tương tác YouTube (Like, Subscribe, Comment) được gửi trực tiếp đến API của YouTube thông qua phiên đăng nhập hiện hành của trình duyệt.
- Không thu thập mật khẩu, cookie riêng tư hay thông tin cá nhân. Mã nguồn mở minh bạch 100%.

---

## 📄 Bản Quyền

Phát triển bởi đội ngũ **VtuberVN**. Giấy phép [MIT](LICENSE).
