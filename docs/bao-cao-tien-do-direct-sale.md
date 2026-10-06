# Báo cáo tiến độ LMS – mô hình direct sale

Chuẩn bị cho buổi họp thứ Bảy 03/10/2026 với anh Sơn · Lập ngày 01/10/2026, cập nhật 03/10/2026 · Người lập: Đăng

## 1. Tóm tắt

Checklist có 36 mục: 15 🔴, 18 🟡, 3 ⚪.

| Nhóm | Xong, đã kiểm thử | Xong, chờ kiểm chứng hoặc cấu hình | Chưa xong |
|---|---|---|---|
| 🔴 15 mục | 10 | 3 (email đăng nhập, email xếp lớp, thư AI) | 2 (recap, lớp thật) |
| 🟡 18 mục | 13 | 5 (mẫu chứng chỉ, giáo án mẫu, tài khoản công ty, quy tắc bậc, ngày tính hoa hồng) | 0 |
| ⚪ 3 mục | 0 | 0 | 3 (chờ Triều, anh Khang) |

* **Các mục độc lập phía LMS của nhóm 🔴 và 🟡 đã có luồng vận hành**: direct sale, xếp lớp, tài liệu, nộp/chấm bài, giáo án, chứng chỉ, giờ dạy, tư vấn, ưu đãi và đơn upsell. Đã kiểm thử bằng dữ liệu giả trên database riêng; không đồng nghĩa đã vận hành với học viên thật.
* **Đã chạy trên máy chủ thật:** mã đã vào nhánh chính và chạy tại `lms-mcna.vercel.app` (bản Đăng quản lý) từ 02/10/2026, có sẵn 14 khóa học của mcna.vn. `lms.mcna.vn` trên VPS do người khác quản lý, vẫn là bản cũ và dùng database khác.
* **Đã đọc được CRM thật:** nút **Lấy từ CRM** đọc bảng doanh thu của CRM (chỉ đọc). Lần nhập thật đầu tiên tạo 3 tài khoản học viên và 8 lượt ghi danh chờ xếp lớp.
* **Chưa làm:** chạy thử với lớp thật, gửi recap cho anh Sơn (mục 3).
* **Email:** bản Vercel đã gửi được email thật (email thử lúc 15:18 ngày 02/10/2026, gửi bằng hộp thư Gmail cá nhân của Đăng). Email tài khoản và email xếp lớp chưa có lần gửi thật nào thành công: ở lần nhập thật đầu tiên 3 email đăng nhập không gửi được, nguyên nhân đã sửa.
* **Chưa kiểm chứng:** soạn thư chúc mừng bằng AI với khóa API thật (mục 5).

## 2. Trạng thái từng mục 🔴

| # | Mục trong checklist | Trạng thái | Ghi chú |
|---|---|---|---|
| 0.1 | Có dữ liệu "khách đã thanh toán – đăng ký khóa nào" (bảng test của Triều hoặc nhập tay) | Xong phần LMS | Màn **Nhập danh sách đã thanh toán**: dán bảng từ Excel/Sheets, tải tệp `.xlsx/.csv`, hoặc nhập tay từng người. Thêm nút **Lấy từ CRM** đọc thẳng bảng doanh thu của CRM (chỉ đọc); với dữ liệu thật: 4 bản ghi đã thanh toán đủ thành 9 dòng, 8 dòng khớp khóa học LMS, 1 dòng đào tạo doanh nghiệp không khớp. |
| 0.2 | Tự động tạo tài khoản học viên: đăng nhập Gmail, mật khẩu mặc định, tự đổi mật khẩu | Xong, **email chờ gửi thử lại** | Bắt đổi mật khẩu ở lần đăng nhập đầu. Nhập lại cùng bảng không tạo trùng. Có email gửi thông tin đăng nhập; 3 email của lần nhập thật đầu tiên chưa gửi được, đã sửa nguyên nhân. Máy chủ thư đã gửi được email thử ngày 02/10. |
| 0.3 | Tài khoản mới để trống, lớp chỉ hiện khi Quản lý lớp xếp xong | Xong | Chưa xếp lớp: không thấy lớp, tài liệu hay danh mục khóa học. |
| 0.4 | Chuyển sang direct sale: ẩn/tắt tự đăng ký, QR, admin duyệt | Xong | Là chế độ mặc định. Luồng cũ vẫn giữ, bật lại bằng một cấu hình. |
| 1.1 | Tách quyền Quản lý lớp với admin hệ thống | Xong | Vai trò **Quản Lý Lớp**: không thấy tài khoản hệ thống, nhật ký hệ thống, hàng đợi CRM; không xóa được khóa học. |
| 1.2 | Tạo khóa học một lần, lấy từ mcna.vn | Xong | Nút **Nạp khóa học từ mcna.vn**: 14 khóa kèm đề cương từng buổi (bản chụp mcna.vn ngày 14/09/2026). Học phí là giá tạm. |
| 1.3 | Tạo lớp có mã lớp, lịch học, ngày khai giảng, giờ học, link Zalo, giảng viên | Xong | Số buổi tự lấy theo khóa. Lớp online không bị báo trùng phòng. |
| 1.4 | Xếp lớp: chọn học viên từ danh sách rồi gán vào mã lớp | Xong | Chọn nhiều học viên một lần; kiểm tra sĩ số; chuyển lớp được. |
| 1.5 | Tự động gửi email xếp lớp (tên lớp, lịch học, link Zalo, giảng viên, số hỗ trợ) | Xong, **chờ kiểm tra gửi thật** | Có nút gửi lại và trạng thái email của từng học viên. Máy chủ thư đã gửi được email thử ngày 02/10; chưa gửi email xếp lớp thật nào. |
| 2.1 | Chặn tải slide và tài liệu, chỉ xem trực tuyến; chỉ tải file data | Xong | Slide/tài liệu cần bản **PDF** để xem trên LMS. Bài tập về nhà đang để chỉ xem, chờ anh Sơn quyết. |
| 2.2 | Tài liệu mở đầu: thư chúc mừng (AI viết), sách/tài liệu tham khảo, bài luyện tập | Xong, **AI chờ khóa API** | Thư tự điền tên học viên, lớp, giảng viên, lịch. Chưa có khóa API thì nút soạn thư trả về thư mẫu. |
| 2.3 | Mỗi buổi có tài liệu, data và bài tập về nhà | Xong | Học viên xem đề bài/hạn, nộp/nộp lại bài, xem nhận xét và lịch sử ngay tại từng buổi. |
| 5.1 | Gửi recap cuộc họp cho anh Sơn | **Có bản nháp, chưa gửi** | [recap-hop-anh-son.md](recap-hop-anh-son.md) |
| 5.2 | Chạy thử với một lớp thật (ví dụ AI Automation) | **Chưa chạy** | Đã có hướng dẫn từng bước và danh sách nghiệm thu: [direct-sale-van-hanh.md](direct-sale-van-hanh.md) |
| 5.3 | Chuẩn bị demo và báo cáo tiến độ | Xong | Tài liệu này, kịch bản demo ở mục 4. |

## 3. Việc còn lại

1. Rà và gửi recap cho anh Sơn.
2. Gửi thử email tài khoản và email xếp lớp trên `lms-mcna.vercel.app`: nhập một dòng với email của chính mình, xếp vào lớp thử, xác nhận nhận được hai email. Email thử của máy chủ thư đã gửi được.
3. Báo thông tin đăng nhập cho 3 học viên đã có tài khoản từ lần nhập thật (email đăng nhập của họ chưa được gửi).
4. Tạo tài khoản Quản lý lớp và giảng viên; tạo lớp thật.
5. Chuẩn bị nội dung buổi 1 của lớp chạy thử: slide bản PDF dưới 4 MB, file data, bài tập, thư chúc mừng.
6. Xếp lớp cho học viên thật của lớp chạy thử.

## 4. Kịch bản demo (khoảng 12 phút)

Chuẩn bị: hai cửa sổ trình duyệt riêng (một cửa sổ thường cho Quản lý lớp, một cửa sổ ẩn danh cho học viên) vì mỗi trình duyệt chỉ giữ một phiên đăng nhập; một bảng 3 học viên trong Excel/Google Sheets; một slide PDF và một file data.

| Phút | Vai | Thao tác | Điều cần thấy |
|---|---|---|---|
| 0–1 | Khách | Mở trang đăng nhập và trang khóa học công khai | Không còn nút đăng ký; khóa học chỉ có "Liên hệ tư vấn". |
| 1–2 | Admin | **Quản lý người dùng → Tạo người dùng** với vai trò Quản Lý Lớp | Admin là người duy nhất tạo được tài khoản vận hành. |
| 2–4 | Quản lý lớp | Đăng nhập → **Khóa học & Lớp học** → **Nạp khóa học từ mcna.vn** → **Thêm Lớp học phần** "AI Automation 01" | Menu gọn (không có người dùng, nhật ký). Lớp có mã, lịch, khai giảng, Zoom, Zalo, giảng viên; số buổi tự điền. |
| 4–6 | Quản lý lớp | **Học viên & Xếp lớp → Nhập danh sách đã thanh toán**: dán bảng → **Kiểm tra** → **Nhập** | Bước kiểm tra chưa ghi dữ liệu. 3 tài khoản mới, 3 học viên chờ xếp lớp. Nhập lại lần nữa: bị bỏ qua, không trùng. |
| 6–7 | Học viên | Đăng nhập bằng email + mật khẩu mặc định | Bị yêu cầu đổi mật khẩu; sau đó màn "Lớp học của tôi" trống. |
| 7–9 | Quản lý lớp | Chọn 3 học viên → chọn lớp → **Xếp lớp & gửi email** | Thông báo số email đã gửi; mở email xếp lớp: tên lớp, lịch, Zalo, giảng viên, số hỗ trợ. |
| 9–10 | Quản lý lớp / giảng viên | **Nội dung lớp học**: thư chúc mừng (**Soạn bằng AI**), tải slide PDF, file data, **Giao bài tập** | Tài liệu mở đầu dùng chung cho mọi lớp của khóa; nội dung theo từng buổi. |
| 10–12 | Học viên | Tải lại trang → vào lớp → **Tài liệu mở đầu** → buổi 1 | Thư mang tên học viên. Slide mở trong trình xem, không có nút tải. File data tải được. Có bài tập và hạn nộp. Mở thêm trên điện thoại. |

Lưu ý môi trường demo:
* Demo trên `lms-mcna.vercel.app` với một lớp thử. 14 khóa học đã được nạp sẵn nên có thể bỏ thao tác nạp khóa học.
* Dùng email thử của chính mình cho 3 học viên demo. Không xếp lớp cho 3 học viên thật đã nhập từ CRM trong lúc demo, vì bấm **Xếp lớp & gửi email** sẽ gửi email thật cho khách.
* Có thể bấm **Lấy từ CRM** rồi **Kiểm tra** để cho thấy dữ liệu CRM thật; bước kiểm tra chưa ghi dữ liệu.
* Slide PDF và file data dùng để demo cần dưới 4 MB (giới hạn tải tệp của Vercel, xem mục 7).

## 5. Đã kiểm chứng gì, chưa kiểm chứng gì

**Đã kiểm chứng trên môi trường thử nghiệm (máy cá nhân, PostgreSQL riêng):**
* Chạy lại sáng 03/10/2026 trên mã hiện tại, database thử riêng: kịch bản direct sale **56 bước** và kịch bản vận hành cho nhóm 🟡 **171 kiểm tra** đều đạt.
* Kịch bản tự động chạy toàn bộ luồng direct sale trên bản build production, 56 bước kiểm tra đều đạt: chặn tự đăng ký, quyền Quản lý lớp, nạp khóa học, tạo lớp, nhập bảng (xem trước, nhập thật, nhập lại), tài khoản trống, xếp lớp và email, quy tắc tải/xem tài liệu, tài liệu mở đầu, quyền giảng viên theo lớp.
* Kịch bản của luồng tự đăng ký cũ vẫn đạt khi bật lại chế độ cũ.
* Bản mở rộng: **153 kiểm thử đơn vị/19 tệp đạt**, kiểm tra kiểu và build đạt. Luồng vận hành **171 kiểm tra** đạt ở bản phát triển và build production local, cùng luồng direct sale 56 bước.
* Migration mới **040** đã kiểm tra trên database mới (000–040), nâng cấp từ 039 và chạy lại không áp dụng trùng. Kiểm tra cấu trúc database không có mục thiếu.
* Đã rà logic hai lượt: quyền theo lớp/tệp/học viên; giao dịch, gửi lại và gửi đồng thời; lịch sử bài nộp, chấm phiên bản cũ, voucher cuối, xác nhận thanh toán lặp, giờ thực dạy khi đổi giảng viên, tháng cần xác nhận lại và chứng chỉ sau buổi cuối kết thúc.
* Job chứng chỉ kiểm tra luân phiên theo từng nhóm 25 lớp, không để các lớp thiếu điều kiện ở đầu danh sách khiến lớp phía sau bị bỏ sót; lỗi giữa lượt không đẩy con trỏ đi tiếp.
* Rà soát tiếp ngày 01/10/2026: chạy lại luồng direct sale trên database thử riêng ở cả chế độ phát triển và bản build production, đều đạt. Đã sửa lỗi `/api/store` trả chi tiết lỗi máy chủ; kiểm tra production, staging và Vercel đều chỉ nhận thông báo chung, còn lỗi đầy đủ được giữ trong log máy chủ.
* Xem trực tiếp trên trình duyệt: màn Quản lý lớp, nhập danh sách, xếp lớp, nội dung lớp, màn học viên, trình xem PDF (máy tính và cỡ màn hình điện thoại), màn giảng viên, hai mẫu email.

**Đã kiểm chứng trên bản chạy thật `lms-mcna.vercel.app` (02/10/2026):**
* Bản đang chạy khớp nhánh chính; migration tự chạy khi triển khai. Bản hiện tại: 190 kiểm thử đơn vị đạt, kiểm tra kiểu đạt.
* Màn **Cấu hình hệ thống** báo email, địa chỉ LMS trong email và kết nối đọc CRM đã được cấu hình.
* **Lấy từ CRM** với dữ liệu CRM thật, và một lần nhập thật: 3 tài khoản mới, 8 lượt ghi danh chờ xếp lớp.
* Máy chủ thư: email thử gửi từ bản Vercel đã tới hộp thư Gmail lúc 15:18 ngày 02/10/2026.

**Chưa kiểm chứng:**
* Email tài khoản và email xếp lớp gửi tới học viên. Lần nhập thật đầu tiên báo 3 email đăng nhập chưa gửi; đã sửa (màn cấu hình và phần gửi thư dùng hai cách đọc cấu hình khác nhau) và máy chủ thư đã gửi được email thử, nhưng hai loại email này chưa được gửi lại.
* Soạn thư chúc mừng bằng AI với khóa API thật.
* Xếp lớp thật trên bản Vercel.
* Trên điện thoại thật (mới thử ở cỡ màn hình điện thoại trên máy tính).

## 6. Cần anh Sơn chốt

1. **Bài tập về nhà** có cho học viên tải về không, hay chỉ xem trực tuyến như slide?
2. **Slide chỉ xem trực tuyến cần bản PDF.** Giảng viên tải PowerPoint/Word thì học viên chưa xem được. Chấp nhận quy ước "slide đưa lên dạng PDF" không?
3. **Mật khẩu mặc định** dùng chung cho cả đợt nhập (học viên bị bắt đổi ở lần đăng nhập đầu). Dùng mật khẩu nào, và có gửi qua email cho học viên không hay tư vấn báo riêng?
4. **Lớp chạy thử:** lớp nào, ngày khai giảng, ai là Quản lý lớp và giảng viên.
5. **Số hỗ trợ** in trong email: `0939.866.825` hay số khác.
6. **Hộp thư gửi:** bản Vercel đang gửi bằng Gmail cá nhân của Đăng, tên hiển thị "LMS MCNA". Khi chạy với học viên thật dùng hộp thư nào của MCNA?

## 7. Giới hạn hiện tại

* Bản Vercel từ chối request tải lên qua Function lớn hơn 4,5 MB. Mã nguồn mới hỗ trợ tải slide/tài liệu trực tiếp lên Supabase Storage và xem PDF lớn theo từng phần; cần cấu hình `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` và bucket private trên Production rồi kiểm thử với tệp lớn. Khi chưa cấu hình, giữ tệp dưới 4 MB; tài liệu vẫn lưu trong database.
* `lms-mcna.vercel.app` và `lms.mcna.vn` là hai bản riêng với hai database riêng; dữ liệu nhập ở bản này không có ở bản kia.
* Chặn tải là chặn ở mức phần mềm; học viên vẫn chụp màn hình được.
* Tệp đề bài/lời giải chặn truy cập trực tiếp ở máy chủ và đúng lớp, không còn chỉ ẩn nút ở giao diện. Người có quyền xem vẫn có thể lấy byte bằng công cụ kỹ thuật; không phải DRM.
* Khi cập nhật, quy tắc mới áp dụng cho cả lớp đang chạy: slide/tài liệu không phải PDF sẽ tạm không xem được với học viên cho tới khi có bản PDF.
* Quản lý lớp có màn tạo giảng viên/chọn môn; vẫn không quản trị admin/manager. Học viên quên mật khẩu dùng "Quên mật khẩu?" hoặc nhờ admin.
* CRM direct sale dùng mật khẩu mặc định nếu cấu hình, nếu không dùng mật khẩu ngẫu nhiên. CRM/SePay/upsell xác nhận tiền không tự xếp lớp.
* Chứng chỉ tải xuống là SVG mẫu trung tính có mã xác minh, chưa phải bộ mẫu Triều/PDF ký số. Giáo án mẫu cần MCNA đưa nội dung thật vào; hệ thống có cơ chế lưu/sao chép, không tự giả lập giáo án đã phê duyệt.
* Chính sách bậc giảng viên, ngân hàng công ty và ngày bắt đầu hoa hồng để trống cho admin nhập; không tự đoán các dữ liệu kinh doanh này.

## 8. Trạng thái từng mục 🟡 và ⚪

Nhóm 🟡 là nhóm làm sau khi chạy thử. Phần LMS đã làm trước và đã kiểm thử tự động bằng dữ liệu giả; **chưa mục nào được dùng với giảng viên hay học viên thật**.

| # | Mục trong checklist | Trạng thái | Ghi chú |
|---|---|---|---|
| 0.5 | 🟡 Đổi nguồn sang CRM thật | Đã chạy với dữ liệu thật | LMS đọc thẳng bảng doanh thu của CRM (chỉ đọc) qua nút **Lấy từ CRM**. Quản lý lớp vẫn kiểm tra rồi mới nhập. API cho CRM gọi vào LMS vẫn có sẵn nếu sau này cần tự động hoàn toàn. |
| 1.6 | 🟡 Danh sách và tài khoản giảng viên, tick các môn dạy được | Đã làm | **Vận hành lớp học → Giảng viên**. Quản lý lớp không tạo được admin hay quản lý lớp khác. |
| 1.7 | 🟡 Tự duyệt chứng chỉ khi nghỉ không quá 2 buổi và đã nộp bài cuối khóa; Quản lý lớp override | Đã làm | Tự xét khi buổi cuối kết thúc. Cấp ngoại lệ phải ghi lý do, lưu vào nhật ký; thu hồi được. |
| 1.8 | ⚪ Nhận bộ mẫu chứng chỉ từ Triều | **Chờ Triều** | Khi có mẫu thì thay cho mẫu trung tính đang dùng. |
| 2.4 | 🟡 Nộp bài tập theo từng buổi | Đã làm | Nộp, nộp lại, xem lịch sử và nhận xét ngay tại từng buổi. |
| 2.5 | 🟡 Xem và tải chứng chỉ điện tử sau buổi cuối | Đã làm, **chờ mẫu chứng chỉ** | Học viên xem, tải và xác minh bằng mã. Đang dùng mẫu trung tính. |
| 2.6 | 🟡 Upsell: gợi ý khóa tiếp theo kèm voucher, QR chuyển khoản công ty, xác nhận thanh toán thủ công | Đã làm, **cần nhập tài khoản công ty** | Có giá gạch và giá ưu đãi, đơn ưu đãi, xác nhận thủ công rồi chờ xếp lớp. QR chỉ hiện sau khi admin nhập tài khoản ngân hàng công ty. |
| 2.7 | 🟡 Nút "Cần tư vấn" chuyển khách sang sale | Đã làm | Yêu cầu vào danh sách ở **Tư vấn & Ưu đãi**, có trạng thái xử lý. |
| 3.1 | 🟡 Tài khoản giảng viên đăng nhập bằng Gmail với mật khẩu mặc định | Đã làm | Tài khoản mới phải đổi mật khẩu ở lần đăng nhập đầu. |
| 3.2 | 🟡 Email và thông báo khi được phân lớp, kèm lịch học và link Zalo | Đã làm | Có nút gửi lại. Email phân lớp cho giảng viên chưa gửi thật lần nào. |
| 3.3 | 🟡 Bộ mẫu MCNA sẵn theo từng môn | Đã làm, **chờ nội dung giáo án** | Đã có chỗ lưu và sao chép bộ mẫu theo môn. MCNA cần đưa giáo án thật vào. |
| 3.4 | 🟡 Chọn giáo án mặc định hoặc tự tạo; mỗi buổi tải slide, data, bài tập, lời giải | Đã làm | Lời giải ẩn cho tới khi giảng viên công bố. Học viên cần bản PDF để xem trực tuyến. |
| 3.5 | 🟡 Giáo án riêng của giảng viên thay cho bản mặc định | Đã làm | Nội dung của lớp được giữ độc lập với bộ mẫu. |
| 3.6 | 🟡 Điểm danh từng buổi | Đã làm | Không mặc định có mặt; chọn trạng thái từng người rồi xác nhận buổi đã dạy. |
| 3.7 | 🟡 Chấm bài tập: cho điểm và nhận xét | Đã làm | Có nhận xét mẫu và lịch sử các lần nộp. |
| 3.8 | 🟡 Xác nhận tổng số buổi dạy vào cuối tháng | Đã làm | Giảng viên xác nhận, Quản lý lớp duyệt hoặc yêu cầu sửa. |
| 3.9 | 🟡 Hiển thị bậc, số khóa còn thiếu để lên bậc, tổng giờ và số khóa đã dạy; không hiển thị tiền | Đã làm, **cần nhập quy tắc bậc** | Mốc số khóa của từng bậc để trống cho admin nhập. |
| 4.1 | 🟡 Gắn nguồn đơn upsell: tự mua 10%, qua sale 5%, áp dụng 12 tháng | Đã làm, **cần ngày bắt đầu** | Mỗi đơn ghi nguồn và tỉ lệ hoa hồng. Hoa hồng chỉ tính sau khi admin nhập ngày bắt đầu áp dụng. |
| 4.2 | 🟡 Quyền gửi thông báo và voucher tới học viên | Đã làm | Admin cấp quyền cho từng Quản lý lớp. Tạo voucher theo học viên, khóa và hạn dùng. |
| 4.3 | ⚪ Xác nhận chuyển khoản tự động qua cổng trung gian | **Chờ anh Khang, Triều** | Hiện xác nhận thanh toán thủ công. |
| 5.4 | ⚪ Theo dõi việc của Triều: sửa CRM, bảng test, bộ mẫu chứng chỉ | **Đang chờ** | Bảng test không còn cần vì LMS đã đọc thẳng CRM. Còn chờ sửa CRM và bộ mẫu chứng chỉ. |

## 9. Trạng thái bàn giao mã

Toàn bộ phần direct sale đã được merge vào nhánh chính của hai repo `cskhmcna247/lms_mcna` và `danglvmcna/lms_mcna` (nội dung giống nhau). Repo `danglvmcna/lms_mcna` tự triển khai nhánh chính lên `lms-mcna.vercel.app`; migration (đến 040) tự chạy trong bước triển khai. **`lms.mcna.vn` trên VPS chưa được cập nhật** và do người khác quản lý. Xem [direct-sale-van-hanh.md](direct-sale-van-hanh.md), mục 11–12, để cấu hình và thao tác các màn mới.

Chưa gửi recap, chưa liên hệ anh Sơn/Triều/Khang thay Đăng. Chưa xác nhận email tới hộp thư thật, CRM nhận webhook thật, chuyển khoản thật hay pilot lớp thật. Các mục này cần quyết định/dữ liệu/cấu hình và người vận hành thực tế.
