# SIÊU ĐẶC TẢ HỢP NHẤT HỆ THỐNG ERP QLPT TOÀN DIỆN

Tài liệu này là bản hợp nhất chi tiết từ:

- `implementation_plan.md.resolved`
- `.antigravity/zalo-hotline-rule.md`

Mục tiêu của bản này là gom toàn bộ đặc tả vận hành, phân quyền, chức vụ, Zalo Hotline, Gmail Automation, AI điều phối, lịch trực ca, kho bãi và bảo trì vào một tài liệu thống nhất. Khi triển khai code, phải giữ nguyên hệ role hiện tại của ứng dụng và chỉ thêm lớp chức vụ bên dưới role.

---

## 1. Nguyên Tắc Bất Biến Khi Triển Khai

### 1.1. Giữ nguyên role hiện tại trong code

Ứng dụng hiện tại đã có hệ role cứng dùng cho đăng nhập, sidebar, API permission, giới hạn tài khoản, gán tòa nhà và Zalo permission. Không đổi tên, không tách role mới, không thay thế role hiện có.

Danh sách role phải giữ nguyên:

| Role code | Tên hiển thị | Ý nghĩa |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Quản trị cấp hệ thống, quản lý cài đặt tổng và chủ trọ. |
| `chuNha` | Chủ trọ | Chủ sở hữu vận hành tòa nhà/phòng trọ, toàn quyền trong phạm vi tài sản của mình. |
| `dongChuTro` | Đồng chủ trọ | Người cùng chủ trọ quản lý, chủ yếu có quyền xem hoặc quyền được cấp theo tòa nhà. |
| `quanLy` | Quản lý | Nhóm quản lý vận hành, có thể được cấp quyền theo module/tòa nhà. |
| `nhanVien` | Nhân viên | Nhóm nhân sự thực thi công việc, quyền hạn thấp hơn quản lý. |

### 1.2. Thêm `chucVu` như lớp thông tin con

`chucVu` là trường mới theo tài khoản, dùng để phân loại chức vụ nghiệp vụ của tài khoản `quanLy` hoặc `nhanVien`.

Không dùng `chucVu` để thay `vaiTro`. Tất cả permission hiện tại vẫn dựa trên `vaiTro` và các cờ quyền đã có.

Quy tắc:

- `admin`, `chuNha`, `dongChuTro`: `chucVu = null`.
- `quanLy`: bắt buộc chọn một chức vụ quản lý, mặc định là `quanLyKiemToanBo`.
- `nhanVien`: bắt buộc chọn một chức vụ nhân viên, mặc định là `nhanVienKiemToanBo`.
- Nếu đổi role từ `quanLy`/`nhanVien` sang role khác thì clear `chucVu`.
- Nếu đổi role giữa `quanLy` và `nhanVien` thì phải chọn lại `chucVu` hợp lệ theo role mới.

### 1.3. Chức vụ lưu theo tài khoản

Một tài khoản có một `chucVu` dùng chung cho tất cả tòa nhà được gán. Không lưu chức vụ theo từng tòa nhà trong phiên bản này.

---

## 2. Cấu Trúc Tổ Chức Và Chức Vụ

### 2.1. Phân tầng tổ chức nghiệp vụ

Hệ thống vận hành theo các tầng:

1. **Admin hệ thống**: quản trị nền tảng, cài đặt toàn cục, tạo/chỉnh chủ trọ.
2. **Chủ trọ**: toàn quyền vận hành tòa nhà thuộc sở hữu.
3. **Đồng chủ trọ**: hỗ trợ chủ trọ trong phạm vi được gán.
4. **Quản lý**: nhóm quản lý vận hành, điều phối phòng ban, kiểm tra tiến độ, có quyền module theo cấp.
5. **Nhân viên**: nhóm thực thi nghiệp vụ hằng ngày.

### 2.2. Danh sách chức vụ cho `quanLy`

| Mã `chucVu` đề xuất | Tên hiển thị | Nhóm nghiệp vụ | Ghi chú |
| :--- | :--- | :--- | :--- |
| `giamDoc` | Giám đốc | Điều hành | Có thể xem tổng thể vận hành, nhận báo cáo tổng hợp. |
| `keToanTruong` | Kế toán trưởng | Kế toán | Quản lý hóa đơn, thanh toán, nhắc nợ, báo cáo tài chính. |
| `truongCSKH` | Trưởng CSKH | CSKH | Quản lý tiếp nhận khách, thông báo tòa nhà, xử lý tin khách. |
| `truongHanhChinh` | Trưởng Hành chính | Hành chính | Quản lý hồ sơ, quy trình nội bộ, văn bản/thông báo hành chính. |
| `truongKyThuat` | Trưởng Kỹ thuật | Kỹ thuật | Quản lý bảo trì, sự cố, lịch trực kỹ thuật. |
| `thuKho` | Thủ kho | Kho | Quản lý vật tư, nhập xuất kho, tồn kho tối thiểu. |
| `phoBoPhan` | Phó bộ phận | Điều phối | Hỗ trợ trưởng bộ phận, nhận ủy quyền tác vụ. |
| `phoKT` | Phó KT | Kỹ thuật/Kế toán tùy cấu hình vận hành | Theo yêu cầu nghiệp vụ hiện tại, đặt trong nhóm quản lý. |
| `quanLyKiemToanBo` | Quản lý kiêm toàn bộ | Tổng hợp | Quản lý có thể kiêm nhiều mảng, dùng làm mặc định cho dữ liệu cũ. |

### 2.3. Danh sách chức vụ cho `nhanVien`

| Mã `chucVu` đề xuất | Tên hiển thị | Nhóm nghiệp vụ | Ghi chú |
| :--- | :--- | :--- | :--- |
| `truongCa` | Trưởng ca | Điều phối ca | Nhân viên phụ trách ca trực. |
| `truongCaKT` | Trưởng ca KT | Kỹ thuật/Kế toán tùy cấu hình vận hành | Theo yêu cầu nghiệp vụ hiện tại, đặt trong nhóm nhân viên. |
| `nvKeToan` | NV Kế toán | Kế toán | Nhập liệu hóa đơn, thanh toán, đối soát. |
| `leTan` | Lễ tân | CSKH | Tiếp nhận khách, thông báo, hỗ trợ tuyến đầu. |
| `nvHanhChinh` | NV Hành chính | Hành chính | Hồ sơ, văn bản, hỗ trợ vận hành. |
| `nvKyThuat` | NV Kỹ thuật | Kỹ thuật | Xử lý sự cố, bảo trì, quét QR kỹ thuật. |
| `nvKho` | NV Kho | Kho | Nhập xuất kho, kiểm kê, theo dõi vật tư. |
| `nhanVienKiemToanBo` | Nhân viên kiêm toàn bộ | Tổng hợp | Nhân viên kiêm nhiều việc, dùng làm mặc định cho dữ liệu cũ. |

### 2.4. Quy tắc hiển thị chức vụ

- Trong form tạo/sửa tài khoản:
  - Chọn `Vai trò = Quản lý` thì hiện dropdown chức vụ quản lý.
  - Chọn `Vai trò = Nhân viên` thì hiện dropdown chức vụ nhân viên.
  - Chọn role khác thì ẩn dropdown chức vụ.
- Trong danh sách tài khoản:
  - Hiển thị badge chức vụ cạnh tên người dùng.
  - Badge chức vụ không thay thế badge trạng thái hoạt động.
  - Nếu chưa có `chucVu` nhưng role là `quanLy` hoặc `nhanVien`, hiển thị mặc định tương ứng sau migration.
- Trong sidebar và kiểm quyền:
  - Tiếp tục dùng `vaiTro`.
  - Không mở/ẩn menu dựa trên `chucVu` ở phiên bản này.

---

## 3. Trung Tâm Phân Quyền Tập Trung

### 3.1. Mục tiêu

`/dashboard/phan-quyen` là trung tâm quản lý quyền tập trung trong lộ trình mở rộng. Với code hiện tại, màn hình `Quản lý tài khoản` đang đảm nhiệm một phần việc tạo/sửa role, gán tòa nhà, slot Zalo và quyền module cho quản lý.

Khi triển khai trung tâm phân quyền đầy đủ, phải gom được 3 lớp quyền:

1. **Quyền hệ thống**
   - Role gốc: `admin`, `chuNha`, `dongChuTro`, `quanLy`, `nhanVien`.
   - Chức vụ con: `chucVu` theo `quanLy`/`nhanVien`.
   - Ủy quyền tạo tài khoản theo cấp.
2. **Quyền module**
   - Mỗi module có 3 trạng thái:
     - `hidden`: Ẩn hoàn toàn khỏi giao diện.
     - `viewOnly`: Chỉ xem, không có nút tạo/sửa/xóa.
     - `fullAccess`: Toàn quyền trong phạm vi dữ liệu được gán.
3. **Quyền thông báo**
   - Bật/tắt nhận thông báo Zalo/Email theo sự kiện.
   - Có thể route thông báo theo chủ trọ, quản lý, bộ phận, hoặc chức vụ.

### 3.2. Quyền module lõi

Các module cần đưa vào ma trận quyền:

| Module | Nhóm nghiệp vụ | Trạng thái quyền |
| :--- | :--- | :--- |
| Tòa nhà | Vận hành | Ẩn / Chỉ xem / Toàn quyền |
| Phòng | Vận hành | Ẩn / Chỉ xem / Toàn quyền |
| Khách thuê | CSKH/Hành chính | Ẩn / Chỉ xem / Toàn quyền |
| Hợp đồng | Hành chính/Kế toán | Ẩn / Chỉ xem / Toàn quyền |
| Hóa đơn | Kế toán | Ẩn / Chỉ xem / Toàn quyền |
| Thanh toán | Kế toán | Ẩn / Chỉ xem / Toàn quyền |
| Sự cố | CSKH/Kỹ thuật | Ẩn / Chỉ xem / Toàn quyền |
| Thông báo | CSKH/Hành chính | Ẩn / Chỉ xem / Toàn quyền |
| Zalo | CSKH/Thông báo | Ẩn / Chỉ xem / Toàn quyền |
| Lịch trực ca | Nhân sự/Vận hành | Ẩn / Chỉ xem / Toàn quyền |
| Kho | Kho/Kỹ thuật | Ẩn / Chỉ xem / Toàn quyền |
| Bảo trì/Bảo dưỡng | Kỹ thuật | Ẩn / Chỉ xem / Toàn quyền |
| AI Assistant | Tổng hợp | Ẩn / Chỉ xem / Toàn quyền trong scope |

### 3.3. Quy tắc bảo mật AI

- AI chỉ được trả lời trong phạm vi quyền của tài khoản đang hỏi.
- Dữ liệu context gửi cho AI phải được lọc trước theo:
  - role (`vaiTro`)
  - tòa nhà được gán
  - quyền module
  - trạng thái dữ liệu được phép xem
  - về sau có thể thêm chức vụ (`chucVu`) nếu cần route nghiệp vụ sâu hơn
- Không để AI tự quyết định quyền. Backend phải lọc trước khi gọi AI.

---

## 4. Quy Chế Zalo Hotline Và Ủy Quyền

### 4.1. Ba công tắc quyền hạn gốc

| Công tắc | Phạm vi | Bật | Tắt |
| :--- | :--- | :--- | :--- |
| **Bật Hotline (Đối ngoại)** | Khách thuê nhận/gửi tin qua kênh nào | Khách nhận tin từ Hotline | Khách nhận tin từ Zalo cá nhân người xử lý |
| **Ủy quyền QL (Thông báo - Đối nội)** | Thông báo nội bộ Ting Ting đi về ai | Chuyển thông báo cho Quản lý | Thông báo đổ về máy Chủ trọ |
| **Ủy quyền Hotline (Kỹ thuật)** | Ai chịu trách nhiệm bảo trì/quét QR Hotline | Quản lý chịu trách nhiệm | Chủ trọ chịu trách nhiệm |

### 4.2. Bốn nhóm quyền bắt buộc khi bật ủy quyền quản lý

Khi **Ủy quyền QL** được bật, quản lý nhận việc phải có tối thiểu 4 nhóm quyền:

- Chỉnh sửa Sự cố.
- Chỉnh sửa Hóa đơn.
- Gửi/Chỉnh sửa Thông báo.
- Phê duyệt Yêu cầu.

Nếu thiếu quyền, hệ thống phải:

- Không route toàn bộ việc sang quản lý một cách âm thầm.
- Hiển thị cảnh báo cấu hình quyền chưa đủ.
- Fallback về chủ trọ hoặc cấp có quyền phù hợp.

### 4.3. Tám kịch bản vận hành chuẩn

#### Nhánh A: Ủy quyền Hotline = Bật (Quản lý lo Kỹ thuật)

**A.1. Giao phó toàn diện**

- Điều kiện: Hotline Bật, Ủy quyền QL Bật.
- Khách thuê giao tiếp qua Hotline.
- Hotline báo việc cho quản lý.
- Nếu Hotline hỏng:
  - Hiện báo đỏ trên Web của quản lý.
  - Nếu chủ trọ có Zalo hoạt động, dùng Bot Chủ nhắn nhắc quản lý sửa Hotline.

**A.2. Ủy quyền qua Zalo cá nhân**

- Điều kiện: Hotline Tắt, Ủy quyền QL Bật.
- Quản lý dùng Zalo cá nhân để quản khách.
- Nếu Hotline hỏng ở kênh nội bộ:
  - Hiện báo đỏ trên Web của chủ trọ.
- Nếu Zalo quản lý hỏng:
  - Hotline nhắn nhắc quản lý.
  - Nếu chủ trọ có Zalo hoạt động, dùng Bot Chủ nhắn nhắc quản lý.

**A.3. Chủ trực qua Hotline, quản lý sửa lỗi**

- Điều kiện: Hotline Bật, Ủy quyền QL Tắt.
- Hotline nhắn khách.
- Việc báo về chủ trọ.
- Nếu Hotline hỏng:
  - Hiện báo đỏ trên Web cả chủ trọ và quản lý.
  - Dùng Bot Chủ nhắn nhắc quản lý đi sửa Hotline.

**A.4. Chủ tự làm tất cả**

- Điều kiện: Hotline Tắt, Ủy quyền QL Tắt.
- Chủ trọ dùng Zalo cá nhân quản khách.
- Nếu Zalo Chủ hỏng:
  - Hiện chữ đỏ trên Web cả chủ trọ và quản lý.
- Nếu Hotline còn sống:
  - Hotline nhắn nhắc chủ trọ.
- Nếu quản lý có Zalo:
  - Dùng Bot QL nhắn nhắc chủ trọ.

#### Nhánh B: Ủy quyền Hotline = Tắt (Chủ trọ lo Kỹ thuật)

**B.1. Quản lý làm việc, chủ sửa Hotline**

- Điều kiện: Hotline Bật, Ủy quyền QL Bật.
- Hotline nhắn khách.
- Hotline báo việc cho quản lý.
- Nếu Hotline hỏng:
  - Hiện báo đỏ trên Web cả chủ trọ và quản lý.
  - Chủ trọ tự đi quét mã QR.

**B.2. Quản lý quản khách qua Zalo cá nhân**

- Điều kiện: Hotline Tắt, Ủy quyền QL Bật.
- Quản lý dùng Zalo cá nhân.
- Nếu Zalo Chủ hỏng:
  - Báo đỏ Web Chủ.
- Nếu Zalo QL hỏng:
  - Hotline nhắn nhắc quản lý.

**B.3. Chủ làm tất cả qua Hotline**

- Điều kiện: Hotline Bật, Ủy quyền QL Tắt.
- Hotline nhắn khách.
- Việc báo về chủ trọ.
- Nếu Hotline hỏng:
  - Báo đỏ Web cả hai.
- Nếu quản lý có Zalo:
  - Dùng Bot QL nhắn nhắc chủ trọ đi sửa Hotline.

**B.4. Mô hình truyền thống**

- Điều kiện: Hotline Tắt, Ủy quyền QL Tắt.
- Chủ trọ tự làm tất cả qua Zalo cá nhân.
- Không route việc cho quản lý nếu không có ủy quyền.

### 4.4. Quy tắc fallback

- **Cảnh báo Web**: Chỉ hiện lỗi cho tài khoản đã từng kết nối thành công.
- **Vị trí cảnh báo**: In đậm, màu đỏ, nằm ngay dưới lời chào trang Dashboard Tổng quan.
- **Bắc cầu Zalo**: Luôn ưu tiên dùng Bot đang sống để nhắn tin đôn đốc Bot/tài khoản đang mất kết nối.
- **Trải nghiệm Chủ trọ**: Ưu tiên xem báo cáo qua Web để tránh spam Zalo.
- **Không mất việc**: Khi kênh chính hỏng, sự kiện phải còn trong dashboard/web notification để người có quyền xử lý.

### 4.5. Mở rộng đa hotline theo phòng ban

Hệ thống tương lai hỗ trợ nhiều hotline/bot theo phòng ban:

| Bộ phận | Zalo Hotline | Gmail Automation | Nhiệm vụ chính |
| :--- | :--- | :--- | :--- |
| Giám đốc | Không có hotline riêng mặc định | Email báo cáo tổng hợp | Giám sát toàn bộ, nhận cảnh báo khi bộ phận khác đứt kết nối. |
| Kế toán | Hotline Tài chính | Email hóa đơn/nhắc nợ | Gửi hóa đơn PDF, xác nhận thanh toán, nhắc công nợ. |
| CSKH | Hotline Tiếp tân | Email thông báo tòa nhà | Tiếp nhận sự cố, gửi thông báo bảo trì, phản hồi khách thuê. |
| Kỹ thuật | Hotline Kỹ thuật QR | Email nhật ký bảo trì | Nhận cảnh báo hỏng hóc, xử lý QR, báo cáo hoàn thành. |
| Kho | Zalo Kho | Email đề xuất nhập hàng | Cảnh báo tồn kho thấp, gửi danh sách nhập hàng. |

---

## 5. Gmail Automation

### 5.1. Cấu hình

- Cho phép nhập Email và App Password.
- Không lưu mật khẩu dạng rõ nếu có cơ chế mã hóa/bí mật phù hợp.
- Cấu hình có thể theo chủ trọ hoặc theo bộ phận trong giai đoạn mở rộng.

### 5.2. Tác vụ tự động

- Gửi hóa đơn PDF cho khách thuê.
- Nhắc nợ hóa đơn quá hạn.
- Gửi báo cáo tổng hợp cho giám đốc/quản lý.
- Nhắc lịch bảo trì trước hạn.
- Gửi thông báo khẩn cấp khi sự cố nghiêm trọng.

### 5.3. Nguyên tắc gửi

- Email automation không thay thế thông báo web.
- Khi gửi lỗi, phải ghi log và hiển thị trạng thái lỗi ở dashboard/cấu hình.
- Các job định kỳ phải idempotent, tránh gửi trùng hóa đơn hoặc nhắc nợ quá nhiều lần.

---

## 6. Quản Lý Lịch Trực Ca

### 6.1. Ca làm việc chuẩn

| Mã ca | Tên ca | Thời gian |
| :--- | :--- | :--- |
| `C1` | Sáng | 06:00 - 14:00 |
| `C2` | Chiều | 14:00 - 22:00 |
| `C3` | Đêm | 22:00 - 06:00 |
| `HC` | Hành chính | 08:00 - 17:00 |

### 6.2. Quy tắc phân ca

- Trưởng bộ phận hoặc người được phân quyền tạo lịch trực.
- Giám đốc/quản lý kiêm toàn bộ xem được toàn bộ lịch trong phạm vi tòa nhà được gán.
- Nhân viên chỉ thấy lịch của mình và đồng đội cùng bộ phận nếu được phép.
- Hệ thống cảnh báo khi trùng lịch hoặc quá giờ.

### 6.3. Import Excel

Định dạng gợi ý:

- Cột định danh nhân sự: SĐT hoặc email.
- Cột ngày: 1 đến 31.
- Giá trị trong ô: `C1`, `C2`, `C3`, `HC`, hoặc rỗng.

Quy tắc import:

- Không tạo tài khoản mới âm thầm nếu không tìm thấy SĐT/email.
- Báo lỗi theo từng dòng nếu không map được nhân sự.
- Cho phép preview trước khi ghi dữ liệu.

---

## 7. AI Điều Phối Và Giao Việc

### 7.1. Quy trình sự cố tự động

1. Khách thuê nhắn Zalo CSKH báo hỏng.
2. AI CSKH phản hồi lịch sự: "Dạ em đã nhận tin, đã báo Kỹ thuật."
3. Hệ thống tạo Task Sự cố.
4. Task được gán cho người trực ca hiện tại của bộ phận kỹ thuật.
5. Zalo Bot Kỹ thuật nhắn nhân sự được gán.
6. Nhân sự cập nhật trạng thái xử lý.
7. Khi hoàn thành, hệ thống báo lại khách thuê và cấp quản lý cần nhận.

### 7.2. Giao việc phân tầng

- Giám đốc giao cho trưởng/phó bộ phận.
- Trưởng/phó bộ phận giao cho nhân viên.
- Nhân viên cập nhật tiến độ, ghi chú, ảnh xử lý.
- Chủ trọ vẫn có thể xem toàn bộ việc trong phạm vi tài sản.

### 7.3. Kanban task

Trạng thái cơ bản:

- Chờ tiếp nhận.
- Đang xử lý.
- Tạm hoãn.
- Chờ xác nhận.
- Đã hoàn thành.
- Đã hủy.

Mỗi task cần có:

- Người tạo.
- Người xử lý.
- Tòa nhà/phòng liên quan.
- Mức độ ưu tiên.
- Deadline nếu có.
- Lịch sử thay đổi.

---

## 8. Kho Bãi, Bảo Trì Và Bảo Dưỡng

### 8.1. Quản lý kho

Tính năng chính:

- Danh mục vật tư.
- Nhập kho.
- Xuất kho.
- Tồn kho theo tòa nhà/kho.
- Định mức tồn kho tối thiểu.
- Cảnh báo tồn kho thấp.
- Mã QR vật tư.
- Gợi ý nhập hàng theo nhóm vật tư dùng nhiều.

### 8.2. Phân tích ABC

- Nhóm A: vật tư quan trọng/tần suất dùng cao/giá trị lớn.
- Nhóm B: vật tư trung bình.
- Nhóm C: vật tư ít dùng/giá trị thấp.

AI có thể gợi ý nhập hàng, nhưng quyết định nhập hàng phải do người có quyền phê duyệt.

### 8.3. Bảo trì và bảo dưỡng

Phân biệt:

- **Bảo trì**: xử lý hỏng hóc thực tế.
- **Bảo dưỡng**: lịch kiểm tra định kỳ.

Tính năng:

- Lịch bảo dưỡng thiết bị.
- Gán người phụ trách.
- Nhắc trước hạn.
- Ghi nhận kết quả.
- Trừ vật tư kho khi xử lý.
- Cảnh báo thiết bị hỏng lặp lại.

---

## 9. Triển Khai Kỹ Thuật Cho `chucVu`

### 9.1. Database

Thay đổi Prisma schema:

```prisma
model NguoiDung {
  // ...
  vaiTro String @default("nhanVien")
  chucVu String?
  // ...
}
```

Migration:

```sql
ALTER TABLE "NguoiDung" ADD COLUMN IF NOT EXISTS "chucVu" TEXT;

UPDATE "NguoiDung"
SET "chucVu" = 'quanLyKiemToanBo'
WHERE "vaiTro" = 'quanLy' AND ("chucVu" IS NULL OR "chucVu" = '');

UPDATE "NguoiDung"
SET "chucVu" = 'nhanVienKiemToanBo'
WHERE "vaiTro" = 'nhanVien' AND ("chucVu" IS NULL OR "chucVu" = '');

UPDATE "NguoiDung"
SET "chucVu" = NULL
WHERE "vaiTro" NOT IN ('quanLy', 'nhanVien');
```

### 9.2. Hằng số chức vụ

Tạo danh sách hằng số dùng chung cho API và UI nếu có thể:

```ts
export const CHUC_VU_QUAN_LY = [
  { value: 'giamDoc', label: 'Giám đốc' },
  { value: 'keToanTruong', label: 'Kế toán trưởng' },
  { value: 'truongCSKH', label: 'Trưởng CSKH' },
  { value: 'truongHanhChinh', label: 'Trưởng Hành chính' },
  { value: 'truongKyThuat', label: 'Trưởng Kỹ thuật' },
  { value: 'thuKho', label: 'Thủ kho' },
  { value: 'phoBoPhan', label: 'Phó bộ phận' },
  { value: 'phoKT', label: 'Phó KT' },
  { value: 'quanLyKiemToanBo', label: 'Quản lý kiêm toàn bộ' },
] as const;

export const CHUC_VU_NHAN_VIEN = [
  { value: 'truongCa', label: 'Trưởng ca' },
  { value: 'truongCaKT', label: 'Trưởng ca KT' },
  { value: 'nvKeToan', label: 'NV Kế toán' },
  { value: 'leTan', label: 'Lễ tân' },
  { value: 'nvHanhChinh', label: 'NV Hành chính' },
  { value: 'nvKyThuat', label: 'NV Kỹ thuật' },
  { value: 'nvKho', label: 'NV Kho' },
  { value: 'nhanVienKiemToanBo', label: 'Nhân viên kiêm toàn bộ' },
] as const;
```

### 9.3. API quản lý tài khoản

`GET /api/admin/users`:

- Select thêm `chucVu`.
- Trả `chucVu` trong response từng user.

`POST /api/admin/users`:

- Body nhận thêm `chucVu`.
- Validate:
  - Nếu `role = quanLy`, `chucVu` phải nằm trong danh sách quản lý; nếu thiếu thì dùng `quanLyKiemToanBo`.
  - Nếu `role = nhanVien`, `chucVu` phải nằm trong danh sách nhân viên; nếu thiếu thì dùng `nhanVienKiemToanBo`.
  - Nếu role khác, lưu `chucVu = null`.

`PUT /api/admin/users/[id]`:

- Body nhận thêm `chucVu`.
- Áp dụng cùng validation theo role.
- Khi đổi role, cập nhật `chucVu` theo role mới.

### 9.4. UI quản lý tài khoản

Form tạo:

- Thêm state `chucVu`.
- Khi chọn role:
  - `quanLy`: set default `quanLyKiemToanBo`.
  - `nhanVien`: set default `nhanVienKiemToanBo`.
  - role khác: set `chucVu = ''`.
- Hiện dropdown chức vụ ngay dưới dropdown vai trò.

Form sửa:

- Load `user.chucVu`.
- Nếu user cũ chưa có `chucVu`, hiển thị default theo role.
- Khi đổi role, reset chức vụ theo role mới.

Danh sách:

- Thêm helper `getChucVuLabel(chucVu)`.
- Hiển thị badge chức vụ cạnh tên nếu có.
- Search có thể mở rộng để tìm theo chức vụ.

### 9.5. Không thay đổi trong phiên bản này

- Không đổi sidebar theo `chucVu`.
- Không đổi `checkQuyen` theo `chucVu`.
- Không tách limit số lượng theo chức vụ.
- Không đổi routing Zalo đang dùng theo role/slot.
- Không đổi bảng `ToaNhaNguoiQuanLy` để lưu chức vụ theo từng tòa.

---

## 10. Lộ Trình Triển Khai Tổng Thể

### Giai đoạn 1: Chuẩn hóa role/chức vụ và tài liệu

- Tạo `implementation_plan.merged.md`.
- Thêm `chucVu` vào database.
- Backfill dữ liệu cũ.
- Cập nhật API quản lý tài khoản.
- Cập nhật UI tạo/sửa/hiển thị chức vụ.
- Chạy kiểm thử cơ bản.

### Giai đoạn 2: Trung tâm phân quyền

- Thiết kế ma trận quyền module 3 trạng thái.
- Gom quyền hiện tại của quản lý vào cấu trúc thống nhất.
- Thêm kiểm soát ẩn tab/chỉ xem/toàn quyền.
- Đồng bộ với sidebar và các API mutating.

### Giai đoạn 3: Lịch trực ca

- Tạo bảng/logic ca làm việc.
- UI calendar.
- Import Excel.
- Gán sự cố theo người trực ca.

### Giai đoạn 4: Zalo Hotline đa bộ phận và Gmail Automation

- Áp dụng đầy đủ 3 công tắc quyền hạn.
- Chuẩn hóa 8 kịch bản A/B.
- Thêm fallback web/Zalo.
- Tách hotline theo bộ phận khi cần.
- Thêm email automation và cron jobs.

### Giai đoạn 5: AI điều phối và task workflow

- Tạo task workflow/Kanban.
- AI tiếp nhận sự cố.
- Gán việc theo ca/bộ phận/chức vụ.
- Lọc context AI theo quyền.

### Giai đoạn 6: Kho, bảo trì, bảo dưỡng

- Kho vật tư.
- QR vật tư.
- Tồn kho tối thiểu.
- Bảo trì/bảo dưỡng định kỳ.
- AI cảnh báo thiết bị/vật tư.

---

## 11. Kế Hoạch Kiểm Thử

### 11.1. Kiểm thử kỹ thuật sau khi thêm `chucVu`

Chạy:

```bash
npx prisma generate --config prisma/prisma.config.ts
npx tsc --noEmit
npm run lint
```

### 11.2. Kiểm thử API

- Tạo `quanLy` không gửi `chucVu` -> lưu `quanLyKiemToanBo`.
- Tạo `nhanVien` không gửi `chucVu` -> lưu `nhanVienKiemToanBo`.
- Tạo `quanLy` với `chucVu = phoKT` -> hợp lệ.
- Tạo `nhanVien` với `chucVu = phoKT` -> trả lỗi validation.
- Tạo `admin`/`chuNha`/`dongChuTro` với `chucVu` bất kỳ -> lưu `null`.
- Sửa role từ `nhanVien` sang `quanLy` -> chức vụ phải hợp lệ theo quản lý.
- Sửa role từ `quanLy` sang `dongChuTro` -> clear `chucVu`.

### 11.3. Kiểm thử UI

- Dropdown chức vụ chỉ hiện khi role là `quanLy` hoặc `nhanVien`.
- Danh sách quản lý có đủ:
  - Giám đốc
  - Kế toán trưởng
  - Trưởng CSKH
  - Trưởng Hành chính
  - Trưởng Kỹ thuật
  - Thủ kho
  - Phó bộ phận
  - Phó KT
  - Quản lý kiêm toàn bộ
- Danh sách nhân viên có đủ:
  - Trưởng ca
  - Trưởng ca KT
  - NV Kế toán
  - Lễ tân
  - NV Hành chính
  - NV Kỹ thuật
  - NV Kho
  - Nhân viên kiêm toàn bộ
- Badge chức vụ hiển thị cạnh tên trong danh sách.
- Quyền, sidebar, giới hạn role và slot Zalo không thay đổi hành vi.

### 11.4. Kiểm thử hồi quy

- Admin vẫn chỉ quản lý admin/chủ trọ như hiện tại nếu logic hiện tại đang như vậy.
- Chủ trọ/đồng chủ trọ vẫn tạo được đồng chủ trọ/quản lý/nhân viên theo quyền hiện tại.
- Quản lý vẫn chỉ thấy/can thiệp theo quyền hiện tại.
- Nhân viên không tự nhiên có thêm quyền vì được chọn chức vụ.
- Zalo notification routing hiện tại không bị đổi.

---

## 12. Acceptance Criteria

- Có file `implementation_plan.merged.md` mới, không xóa hoặc ghi đè hai file gốc.
- Tài liệu hợp nhất đầy đủ đặc tả từ hai file nguồn.
- Tài liệu nêu rõ role code hiện tại không đổi.
- Tài liệu nêu rõ `chucVu` là lớp con theo tài khoản.
- Danh sách chức vụ đúng theo chốt mới:
  - `Phó bộ phận` thuộc quản lý.
  - `Phó KT` thuộc quản lý.
  - `Trưởng ca` thuộc nhân viên.
  - `Trưởng ca KT` thuộc nhân viên.
- Kế hoạch kỹ thuật đủ chi tiết để triển khai database/API/UI/test mà không cần tự suy diễn thêm.

# Kế hoạch triển khai chi tiết (merged) cho QL Trọ

> Phạm vi: kế hoạch triển khai theo từng bước để mở rộng/tinh chỉnh hệ thống quản lý phòng trọ hiện tại, bảo đảm không chồng chéo, không bỏ sót cấu hình quan trọng (đặc biệt các giới hạn theo vai trò/chức vụ và theo tòa nhà).

## 1) Mục tiêu triển khai

- Chuẩn hóa luồng triển khai từ **database → backend → frontend → vận hành**.
- Giảm rủi ro “lệch luật nghiệp vụ” giữa API và UI.
- Bổ sung đầy đủ cơ chế giới hạn: ví dụ số lượng người cho từng vai trò trong một tòa nhà, phân quyền chi tiết cho quản lý, bật/tắt đăng nhập khách thuê.
- Thiết lập checklist kiểm thử và rollout để không thiếu cài đặt môi trường.

## 2) Hiện trạng kiến trúc (đọc từ code)

- Stack chính: Next.js App Router + Prisma/PostgreSQL + NextAuth + API Route nội bộ.
- Mô hình dữ liệu đã có các trục nghiệp vụ lớn: `NguoiDung`, `ToaNha`, `ToaNhaNguoiQuanLy`, `Phong`, `KhachThue`, `HopDong`, `HoaDon`, `ChiSoDienNuoc`, `ZaloThongBaoCaiDat`.
- Đã có nhiều migration theo thời gian, trong đó có nhánh liên quan giới hạn vai trò theo tòa nhà (`add_role_limits_per_toa_nha`) và cài đặt theo chủ nhà/tòa nhà.
- Có repository layer riêng (`src/lib/repositories/pg/*`) nên thuận lợi để gom business rule vào 1 điểm, tránh duplicated logic trong nhiều route/page.

## 3) Nguyên tắc triển khai để tránh chồng chéo

1. **Single source of truth cho luật nghiệp vụ**: mọi giới hạn vai trò/chức vụ phải kiểm tra ở backend (service/repository), UI chỉ hiển thị cảnh báo.
2. **Mỗi nhóm tính năng đi theo vertical slice**: Schema + migration + repository + API + UI + test trong cùng một nhịp.
3. **Feature flag theo cài đặt**: nếu thay đổi lớn (ví dụ giới hạn vai trò), bật theo từng tòa nhà trước khi bật toàn hệ thống.
4. **Version hóa rule**: ghi rõ phiên bản rule trong log/audit để truy vết khi có thay đổi chính sách.
5. **Không triển khai “skip migration”**: mọi thay đổi dữ liệu phải qua migration chính thức.

## 4) Kế hoạch chi tiết theo giai đoạn

## Giai đoạn A — Rà soát & chốt rule nghiệp vụ (1–2 ngày)

### A1. Chốt ma trận vai trò và giới hạn
- Định nghĩa rõ các vai trò: `admin`, `chuNha`, `dongChuTro`, `quanLy`, `nhanVien`.
- Chốt phạm vi giới hạn theo tòa nhà, ví dụ:
  - Số `quanLy` tối đa/tòa.
  - Số `nhanVien` tối đa/tòa.
  - Có cho phép 1 người quản lý nhiều tòa không.
- Chốt quyền thao tác cho từng vai trò trên từng module: hợp đồng, hóa đơn, thanh toán, sự cố, duyệt thay đổi.

### A2. Chốt rule tenant/room/contract để tránh dữ liệu sai
- `Phong.soNguoiToiDa` phải chặn ở thời điểm ký hợp đồng/thêm người đồng thuê.
- Không cho tạo 2 hợp đồng hoạt động cùng thời điểm trên cùng phòng.
- Không cho phát sinh hóa đơn nếu hợp đồng chưa hiệu lực hoặc đã hủy.

### A3. Tài liệu hóa rule
- Tạo “Business Rule Matrix” (markdown) làm chuẩn cho đội backend/frontend/test.

## Giai đoạn B — Dữ liệu & Migration (1–2 ngày)

### B1. Rà migration hiện có và tạo migration bổ sung (nếu thiếu)
- Soát các migration liên quan `cai_dat`, `role_limits_per_toa_nha`, `quan_ly_quyen_kich_hoat`.
- Nếu giới hạn vai trò chưa đủ trường, thêm bảng/cột cài đặt giới hạn theo tòa nhà (vd: `maxQuanLy`, `maxNhanVien`, `maxDongChuTro`).

### B2. Backfill dữ liệu an toàn
- Gán giá trị mặc định cho tòa nhà cũ (không để null nếu rule yêu cầu bắt buộc).
- Thêm script kiểm tra dữ liệu vi phạm giới hạn hiện tại để xử lý trước khi bật hard validation.

### B3. Chốt index/constraint
- Unique cần giữ: phòng trong tòa (`maPhong + toaNhaId`), hợp đồng trong tòa (`maHopDong + toaNhaId`).
- Thêm partial/conditional index nếu cần tối ưu truy vấn danh sách quản lý theo tòa.

## Giai đoạn C — Backend rule enforcement (2–4 ngày)

### C1. Chuẩn hóa tầng kiểm tra quyền
- Tập trung hàm check quyền vào `src/lib/server/check-quyen.ts` + repository/service layer.
- Tách rõ:
  - check vai trò toàn hệ thống,
  - check vai trò theo tòa,
  - check quyền chi tiết được chủ trọ cấp cho quản lý.

### C2. Áp giới hạn vai trò khi CRUD tài khoản/phân công
- Trước khi tạo/gán `quanLy` vào `ToaNhaNguoiQuanLy`, đếm số hiện tại và so với limit.
- Trả về lỗi nghiệp vụ chuẩn hóa (error code + message) để UI hiển thị đúng.

### C3. Áp giới hạn phòng/khách/hợp đồng
- Khi tạo/sửa hợp đồng: kiểm tra số người thuê so với `soNguoiToiDa`.
- Khi đổi phòng/chuyển hợp đồng: re-validate cả phòng cũ/phòng mới.

### C4. Audit log & notification
- Ghi log các thao tác bị chặn do vượt giới hạn.
- Tùy chọn gửi thông báo cho chủ trọ khi quản lý cố gắng thao tác vượt quyền.

## Giai đoạn D — API contract & Frontend UX (2–3 ngày)

### D1. Chuẩn hóa API error contract
- Mọi API liên quan phân quyền/giới hạn trả format thống nhất:
  - `code`, `message`, `details`, `hint`.

### D2. Form cấu hình giới hạn
- Bổ sung UI tại trang cài đặt tòa nhà:
  - giới hạn số quản lý/nhân viên/đồng chủ trọ,
  - bật/tắt cho phép 1 người quản lý nhiều tòa,
  - bật/tắt hard block hoặc chỉ cảnh báo.

### D3. UX chống sót thao tác
- Hiển thị quota đã dùng / quota tối đa ngay trong màn phân quyền.
- Disable action button khi biết trước chắc chắn fail (nhưng backend vẫn validate).

## Giai đoạn E — Kiểm thử & phát hành (2 ngày)

### E1. Test bắt buộc
- Unit test rule giới hạn vai trò.
- Integration test API phân quyền + tạo hợp đồng/hóa đơn.
- Regression test các flow cũ: tạo tòa nhà, tạo phòng, tạo hợp đồng, ghi chỉ số, phát hành hóa đơn.

### E2. UAT checklist
- Kịch bản vượt quota quản lý.
- Kịch bản phòng vượt số người tối đa.
- Kịch bản quản lý bị thu hồi quyền giữa phiên làm việc.

### E3. Rollout
- Môi trường staging: bật hard validation 100%.
- Production: bật cảnh báo trước 3–7 ngày, sau đó chuyển hard validation.

## 5) Ma trận tránh chồng chéo công việc

- **DB owner**: schema + migration + backfill script.
- **Backend owner**: check quyền + business rule + API error contract.
- **Frontend owner**: form cài đặt + cảnh báo quota + xử lý lỗi API.
- **QA owner**: test plan + regression + dữ liệu kiểm thử.
- **DevOps owner**: env, migrate deploy, rollback.

> Quy tắc handoff: task backend không được “Done” nếu chưa có test case tương ứng; task frontend không được “Done” nếu chưa map đủ error code từ backend.

## 6) Danh sách cài đặt dễ bị bỏ sót (phải kiểm tra)

1. `NEXTAUTH_SECRET`, `NEXTAUTH_URL` đúng theo môi trường.
2. `DATABASE_URL` trỏ đúng DB và quyền migrate.
3. Cấu hình storage (Local/MinIO/Cloudinary) đồng nhất giữa upload và serve file.
4. Cấu hình Zalo bot (URL, token/webhook, TTL) theo từng tài khoản nếu dùng multi-account.
5. Timezone hệ thống và DB để tránh lệch kỳ hóa đơn.
6. Seed dữ liệu role mặc định và cài đặt limit mặc định khi tạo tòa nhà mới.
7. Cơ chế rollback migration và backup DB trước khi bật hard validation.

## 7) Kế hoạch thực thi chi tiết từng bước (task-level)

1. Chốt tài liệu business rule matrix với PO/ops.
2. Soát schema hiện tại + migration đã có, đánh dấu gap.
3. Viết migration bổ sung cho limit (nếu thiếu) + chạy local.
4. Viết script audit dữ liệu vi phạm hiện hữu.
5. Triển khai backend validation tại repository/service + error code chuẩn.
6. Bổ sung API route cập nhật cài đặt limit theo tòa.
7. Cập nhật UI cài đặt + màn phân quyền hiển thị quota.
8. Viết unit/integration test cho các nhánh pass/fail chính.
9. Chạy QA regression toàn luồng thu tiền.
10. Deploy staging + UAT + fix.
11. Deploy production theo 2 pha (warn-only → hard block).
12. Theo dõi log sau phát hành 72h và chốt postmortem nếu có lỗi.

## 8) Tiêu chí nghiệm thu

- Không thể gán vai trò vượt giới hạn đã cấu hình.
- Không thể thao tác vượt quyền được cấp theo tòa nhà.
- Không thể tạo hợp đồng/hóa đơn sai điều kiện nghiệp vụ chính.
- Tất cả lỗi nghiệp vụ trả về thống nhất, UI hiển thị rõ nguyên nhân.
- Có đầy đủ tài liệu vận hành và checklist rollback.
