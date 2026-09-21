# Hướng dẫn sử dụng đầy đủ E16 LMS/SIS

> ⚠️ **TÀI LIỆU LƯU TRỮ LỊCH SỬ:** Tài liệu này phản ánh cấu trúc cũ của hệ thống SIS với 8 vai trò (`super_admin`, `parent`, `advisor`, `finance`...). 
> Hệ thống MCNA LMS hiện hành đã chuẩn hóa về **3 vai trò chính thức** (`admin`, `teacher`, `student`). Xem chi tiết tại `docs/bao-cao-phan-tich-repo.md` và `docs/crm-integration.md`.

Phiên bản tài liệu: 2026-06-15 (Lưu trữ)

Tài liệu này hướng dẫn sử dụng các chức năng chính của hệ thống E16 LMS/SIS cho Ban quản trị, Admin quản lý lớp, Giảng viên, Học viên, Phụ huynh, bộ phận tài chính/vận hành và Cố vấn học tập.

## 1. Tổng quan hệ thống

E16 LMS/SIS có 2 phân hệ:

- **SIS - Học vụ/Hành chính đào tạo**: quản lý hồ sơ học viên, năm học, học kỳ, khoa/ngành, chương trình đào tạo, thời khóa biểu, xếp lớp, điểm danh, học phí, cảnh báo học tập, báo cáo và chứng chỉ.
- **LMS - Học tập trực tuyến**: quản lý khóa học, lớp học phần, buổi học, video bài giảng, bài tập, đề thi/trắc nghiệm, nộp bài, chấm điểm, tiến độ học tập, diễn đàn và thông báo.

Sau khi đăng nhập, hệ thống tự hiển thị menu theo đúng vai trò và quyền hạn của người dùng.

## 2. Vai trò và quyền hạn

| Vai trò | Chức năng chính |
| --- | --- |
| **super_admin** | Toàn quyền hệ thống: người dùng, cấu hình học vụ, thời khóa biểu, học phí, audit log, duyệt khóa học, xếp lớp, chứng chỉ. |
| **manager** | Quản trị vận hành: người dùng, audit log, theo dõi học vụ và các quy trình quản lý được phân quyền. |
| **admin** | Admin quản lý lớp: tạo tài khoản học viên, quản lý lớp học phần, xếp lớp, thời khóa biểu, điểm danh, cảnh báo, duyệt khóa học/lớp theo phạm vi được cấp. |
| **teacher** | Giảng viên: tạo/sửa khóa học của mình, quản lý lớp được giao, sửa nội dung buổi học, tải video, tạo bài tập/de thi theo buổi, điểm danh, chấm điểm, theo dõi lớp. |
| **student** | Học viên: cập nhật hồ sơ, đăng ký khóa/lớp, thanh toán học phí, vào lớp đã được xác nhận, xem buổi học/video, làm quiz, nộp bài, xem điểm/chứng chỉ/thông báo. |
| **parent** | Phụ huynh: theo dõi học tập, chuyên cần, học phí, cảnh báo và thông báo của học viên được liên kết. |
| **finance/vận hành thanh toán** | Theo dõi giao dịch, xác nhận thanh toán, quản lý công nợ/học phí, đối soát trạng thái thanh toán. |
| **advisor/cố vấn** | Theo dõi học viên phụ trách, ghi nhận tư vấn, xử lý cảnh báo học tập, chia sẻ ghi chú cho phụ huynh. |

## 3. Đăng nhập, đổi mật khẩu và thông báo

### Đăng nhập

1. Mở trang đăng nhập hệ thống.
2. Nhập email và mật khẩu.
3. Chọn đăng nhập. Hệ thống đưa người dùng vào phân hệ và menu phù hợp với vai trò.

### Tạo tài khoản học viên (tự đăng ký)

1. Ở trang đầu (danh mục khóa học), chọn **Tạo tài khoản**, hoặc bấm **Đăng ký lớp này** ở một lớp.
2. Nhập họ tên, **email cá nhân** và số điện thoại, rồi chọn **Tạo tài khoản**.
3. Mở hộp thư (kiểm tra cả thư mục Spam) để lấy **mật khẩu tạm thời**.
4. Đăng nhập bằng email và mật khẩu tạm. Hệ thống yêu cầu đặt mật khẩu mới (tối thiểu 8 ký tự) trước khi dùng các chức năng khác.
5. Nếu đã chọn một lớp trước khi tạo tài khoản, sau khi đổi mật khẩu hệ thống tự gửi yêu cầu đăng ký lớp đó.

Lưu ý: nếu email đã có tài khoản, màn hình vẫn báo đã gửi thông tin, và hệ thống gửi email nhắc bạn đăng nhập hoặc dùng **Quên mật khẩu**.

### Quên mật khẩu

1. Ở màn đăng nhập, chọn **Quên mật khẩu?**.
2. Nhập email đăng nhập và gửi yêu cầu.
3. Mở liên kết trong email (chỉ dùng được một lần, có thời hạn) để đặt mật khẩu mới.

### Đổi mật khẩu

1. Mở menu tài khoản ở góc giao diện.
2. Chọn đổi mật khẩu.
3. Nhập mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.
4. Lưu thay đổi.

### Thông báo

Thông báo được dùng cho các sự kiện như duyệt ghi danh, tạo phiên điểm danh, cảnh báo học tập, cập nhật học phí, kết quả chấm điểm, phản hồi phúc khảo và các thay đổi quan trọng của lớp học.

## 4. Hướng dẫn cho Ban quản trị và Admin quản lý lớp

### 4.1. Quản lý người dùng

Đường dẫn: **SIS hoặc LMS -> Quản lý người dùng**

Chức năng:

- Tạo tài khoản học viên, giảng viên, admin, manager, phụ huynh.
- Import danh sách người dùng bằng CSV.
- Tìm kiếm, lọc theo vai trò/trạng thái.
- Kích hoạt hoặc vô hiệu hóa tài khoản.
- Đổi vai trò người dùng theo quyền hạn.
- Đặt lại mật khẩu tạm thời.
- Tạo hồ sơ học viên kèm chương trình/khoa/ngành khi tạo tài khoản student.

Lưu ý:

- Admin quản lý lớp chỉ được tạo tài khoản **student**.
- Sau khi tạo học viên, tài khoản có thể dùng được ngay. Việc cấp email nội bộ/trường học có thể chạy nền; nếu email trường chưa sẵn sàng, kiểm tra trạng thái cấp email hoặc thực hiện cấp lại theo quy trình vận hành.

### 4.2. Quản lý cấu trúc học vụ

Đường dẫn: **SIS -> Năm học, Học kỳ, Khoa, Chương trình**

Thiết lập nền tảng đào tạo:

- **Năm học**: tạo năm học, ngày bắt đầu/kết thúc, đánh dấu năm hiện hành.
- **Học kỳ**: gắn vào năm học, mở/đóng thời gian đăng ký.
- **Khoa/Bộ môn**: tên khoa, mã khoa, trưởng khoa.
- **Chương trình đào tạo**: tên chương trình, loại bằng/chứng nhận, tổng tín chỉ, môn học bắt buộc/tự chọn.

### 4.3. Quản lý khóa học và duyệt nội dung

Đường dẫn: **LMS -> Duyệt khóa học**

Quy trình:

1. Giảng viên tạo khóa học ở trạng thái nháp hoặc chờ duyệt.
2. Admin xem tiêu đề, mô tả, giảng viên, giá, cấp độ, tag, bài học.
3. Nếu đạt yêu cầu, chọn **Duyệt/Xuất bản**.
4. Nếu chưa đạt, chọn **Từ chối** và nhập lý do để giảng viên sửa lại.

Khóa học đã xuất bản mới nên hiển thị cho học viên đăng ký.

### 4.4. Quản lý lớp học phần

Đường dẫn: **SIS/LMS -> Quản lý lớp học phần**

Chức năng:

- Tạo lớp học phần cho khóa học.
- Gán giảng viên phụ trách.
- Nhập mã lớp, sĩ số tối đa, trạng thái lớp.
- Nhập ngày khai giảng/mở lớp.
- Nhập thời khóa biểu: thứ, giờ bắt đầu, giờ kết thúc, phòng học.
- Nhập **số buổi học** của lớp.

Quy tắc quan trọng:

- Nếu nhập số buổi là 10, hệ thống cần hiển thị đủ 10 buổi học theo lịch học tuần của lớp.
- Buổi học được sinh theo thứ tự và lịch đã khai báo; giảng viên chỉ cần sửa tên buổi, nội dung giảng dạy, thời lượng và video.
- Khi cập nhật lịch học/số buổi, hệ thống giữ lại các buổi đã có nội dung và chỉ bổ sung buổi còn thiếu.

### 4.5. Xếp lớp và duyệt danh sách học viên

Đường dẫn: **SIS -> Xếp lớp**

Trạng thái thường gặp:

- **Chưa xếp lớp**: học viên đã ghi danh khóa học nhưng chưa được đưa vào lớp học phần cụ thể.
- **Chờ thanh toán**: khóa học có phí, học viên chưa được xác nhận thanh toán.
- **Chờ xác nhận/Waitlist**: học viên đã chọn lớp hoặc đang chờ admin xác nhận.
- **Đã vào lớp/Registered**: học viên đã được xếp lớp hợp lệ.

Quy trình với khóa học có phí:

1. Học viên đăng ký khóa/lớp.
2. Hệ thống tạo trạng thái chờ thanh toán nếu khóa học có phí.
3. Bộ phận thanh toán xác nhận giao dịch.
4. Admin quản lý lớp xác nhận xếp lớp hoặc duyệt waitlist.
5. Học viên mới có quyền vào lớp.

Lưu ý:

- Học viên chưa thanh toán hoặc chưa được admin xác nhận không được vào lớp.
- Khi xếp lớp hàng loạt, cần kiểm tra sĩ số còn trống và trạng thái thanh toán.

### 4.6. Thời khóa biểu

Đường dẫn: **SIS -> Thời khóa biểu**

Admin có thể:

- Tạo lớp học phần theo lịch tuần.
- Gán giảng viên, phòng học, ca học.
- Xem lịch dạng lưới hoặc danh sách.
- Kiểm tra trùng lịch giảng viên/phòng học.
- Điều hướng sang điểm danh cho từng lớp.

Khi thay đổi lịch, cần kiểm tra lại các buổi học đã sinh để đảm bảo đúng thứ tự và ngày học.

### 4.7. Điểm danh

Đường dẫn: **SIS -> Điểm danh**

Chức năng:

- Tạo phiên điểm danh theo lớp/buổi.
- Bật mã QR hoặc mã check-in cho học viên.
- Điểm danh thủ công: có mặt, đi trễ, vắng.
- Ghi chú lý do vắng/đi trễ.
- Theo dõi tỷ lệ chuyên cần.
- Xuất hoặc lọc danh sách điểm danh.

Quy trình:

1. Chọn khóa học và lớp học phần.
2. Tạo phiên điểm danh cho buổi hiện tại.
3. Mở QR/check-in nếu cần.
4. Kiểm tra danh sách học viên và chốt trạng thái.
5. Lưu biên bản điểm danh.

### 4.8. Học phí và công nợ

Đường dẫn: **SIS -> Học phí**

Chức năng:

- Tạo đợt học phí theo học viên/lớp/khoa.
- Xem danh sách còn nợ, quá hạn, đã thanh toán.
- Xác nhận thanh toán.
- Từ chối giao dịch nếu sai thông tin.
- Gửi nhắc nợ/thông báo.
- Xem lịch sử giao dịch và biên lai.

Quy trình xác nhận thanh toán:

1. Mở danh sách giao dịch chờ xử lý.
2. Đối soát số tiền, nội dung, học viên, khóa học.
3. Chọn xác nhận nếu hợp lệ.
4. Nếu không hợp lệ, từ chối và ghi lý do.
5. Hệ thống cập nhật trạng thái học phí và mở bước xếp lớp nếu đủ điều kiện.

### 4.9. Cảnh báo, báo cáo và audit log

Đường dẫn: **SIS -> Cảnh báo/Báo cáo/Audit**

Cảnh báo gồm:

- GPA thấp.
- Chuyên cần dưới ngưỡng.
- Chậm tiến độ học.
- Nợ học phí.
- Vi phạm hoặc quy trình cần xử lý.

Báo cáo gồm:

- Tổng quan học vụ.
- So sánh kết quả theo khoa/lớp/giảng viên.
- Danh sách học viên có nguy cơ.
- Báo cáo điểm danh.
- Báo cáo học phí.

Audit log ghi lại các hành động quan trọng như tạo/sửa/xóa người dùng, duyệt khóa học, xác nhận thanh toán, xếp lớp, chấm điểm.

### 4.10. Chứng chỉ

Đường dẫn: **SIS -> Xác thực chứng chỉ**

Chức năng:

- Tra cứu mã chứng chỉ.
- Xác thực học viên, khóa học, ngày cấp.
- Kiểm tra tính hợp lệ của chứng chỉ.

## 5. Hướng dẫn cho Giảng viên

### 5.1. Quản lý khóa học

Đường dẫn: **LMS -> Khóa học/Chương trình đào tạo**

Giảng viên có thể:

- Tạo khóa học mới.
- Nhập tiêu đề, mô tả, danh mục, cấp độ, giá, ảnh đại diện, tag.
- Sửa khóa học của mình.
- Tạo/sửa bài học trong khóa.
- Gửi khóa học cho admin duyệt.

Lưu ý:

- Khóa học chưa duyệt có thể chưa hiển thị cho học viên.
- Nếu bị từ chối, xem lý do, sửa nội dung và gửi duyệt lại.

### 5.2. Quản lý lớp học phần của mình

Đường dẫn: **SIS hoặc LMS -> Lớp học/Thời khóa biểu**

Giảng viên có thể:

- Xem lớp được phân công.
- Tạo lớp cho khóa học do mình phụ trách nếu được cấp quyền.
- Cập nhật thông tin lớp của mình theo phạm vi cho phép.
- Xem sĩ số, danh sách học viên, lịch học và phòng học.
- Vào diễn đàn lớp.

### 5.3. Sửa nội dung từng buổi học

Đường dẫn: **LMS -> Khóa học -> Lớp học phần -> Buổi học**

Quy trình:

1. Chọn khóa học.
2. Chọn lớp học phần.
3. Chọn buổi học cần sửa.
4. Chọn **Sửa nội dung**.
5. Cập nhật tên buổi, nội dung bài dạy, thời lượng.
6. Nhập URL video hoặc tải video lên.
7. Lưu thay đổi.

Lưu ý:

- Admin nhập số buổi và lịch học; hệ thống sinh khung buổi học.
- Giảng viên tập trung hoàn thiện nội dung giảng dạy của từng buổi.
- Video có thể được tải lên nếu giao diện hiển thị chức năng upload; nếu dùng video ngoài, dán URL hợp lệ.

#### Tài liệu buổi học: slide, file Word/PDF, video YouTube

Đường dẫn: **Điểm danh -> chọn lớp -> chọn buổi học -> khung "Slide, tài liệu & video YouTube"**

1. Chọn **Tải slide** để tải tệp `.ppt`, `.pptx` hoặc `.pdf`.
2. Chọn **Tải file Word/PDF** để tải tệp `.doc`, `.docx` hoặc `.pdf`.
3. Dán link YouTube (`youtube.com/watch?v=...`, `youtu.be/...` hoặc Shorts), nhập tiêu đề nếu muốn, rồi chọn **Thêm video**.
4. Dùng nút mũi tên để sắp xếp, nút bút để đổi tên, nút thùng rác để xóa tài liệu.

Lưu ý:

- Mỗi tệp tối đa 50 MB.
- Học viên chỉ thấy tài liệu khi đã được xếp vào lớp và ghi danh đang hoạt động.
- Không giảm được số buổi của lớp nếu các buổi sắp bị bỏ đang có tài liệu; hãy xóa tài liệu ở các buổi đó trước.

### 5.4. Tạo bài tập theo buổi học

Đường dẫn: **LMS -> Buổi học -> Bài tập** hoặc **Bài tập & Chấm điểm**

Quy trình:

1. Chọn khóa học và buổi học áp dụng.
2. Chọn tạo bài tập.
3. Nhập tiêu đề, mô tả, deadline, điểm tối đa.
4. Tải file đính kèm nếu cần.
5. Lưu bài tập.

Quy tắc:

- Bài tập phải gắn vào một buổi học cụ thể.
- Học viên sẽ thấy bài tập trong buổi học tương ứng.
- Deadline cần rõ ràng để hệ thống cảnh báo nộp muộn.

### 5.5. Tạo đề thi/trắc nghiệm theo buổi học

Đường dẫn: **LMS -> Buổi học -> Đề thi** hoặc **Đề thi & Đánh giá**

Quy trình tạo đề:

1. Chọn khóa học.
2. Chọn buổi học áp dụng.
3. Nhập tên đề, điểm đạt, thời gian làm bài, số lần làm tối đa, deadline.
4. Lưu đề.
5. Thêm câu hỏi thủ công hoặc import câu hỏi CSV.

Loại câu hỏi:

- Một đáp án đúng.
- Nhiều đáp án đúng.
- Tự luận/ngắn.

Lưu ý:

- Đề thi/trắc nghiệm phải gắn vào buổi học.
- Học viên làm bài trong phạm vi deadline và số lần làm bài cho phép.
- Kết quả quiz được tính vào tổng hợp điểm theo cấu hình hệ thống.

### 5.6. Chấm bài và sổ điểm

Đường dẫn: **LMS -> Bài tập & Chấm điểm / Sổ điểm**

Giảng viên có thể:

- Xem bài nộp của học viên.
- Mở nội dung nộp bài hoặc file đính kèm.
- Nhập điểm.
- Viết feedback.
- Lưu điểm và phản hồi.
- Xem bảng điểm tổng hợp theo lớp/khoa.
- Xuất CSV sổ điểm.

### 5.7. Điểm danh lớp

Đường dẫn: **SIS -> Thời khóa biểu / Điểm danh**

Quy trình:

1. Chọn lớp đang dạy.
2. Tạo phiên điểm danh.
3. Hiển thị QR/check-in cho học viên.
4. Kiểm tra danh sách điểm danh.
5. Sửa thủ công các trường hợp vắng, đi trễ, quên check-in.
6. Lưu biên bản.

### 5.8. Diễn đàn lớp

Đường dẫn: **LMS -> Lớp học -> Diễn đàn**

Chức năng:

- Tạo bài thảo luận.
- Trả lời câu hỏi học viên.
- Theo dõi trao đổi theo lớp học phần.

## 6. Hướng dẫn cho Học viên

### 6.1. Cập nhật hồ sơ cá nhân

Đường dẫn: **SIS -> Lý lịch cá nhân**

Học viên có thể cập nhật:

- Số điện thoại.
- Ngày sinh, giới tính.
- Địa chỉ.
- Thông tin người bảo hộ/phụ huynh.

Thông tin này được dùng cho liên hệ học vụ, học phí, cảnh báo và liên kết phụ huynh.

### 6.2. Đăng ký khóa học/lớp học

Có hai cách đăng ký.

**Từ trang đầu, chưa cần đăng nhập**

1. Mở trang chủ LMS: danh mục khóa học đang mở đăng ký hiện ngay.
2. Tìm theo tên hoặc lọc theo lĩnh vực, rồi mở chi tiết khóa học.
3. Xem các lớp đang mở: ngày khai giảng, giảng viên, số chỗ còn trống, lịch hàng tuần và lịch từng buổi.
4. Chọn **Đăng ký lớp này**, sau đó tạo tài khoản (xem mục 3) hoặc đăng nhập. Yêu cầu đăng ký được gửi tự động ngay sau khi đăng nhập.

**Sau khi đăng nhập**

Đường dẫn: **LMS -> Khám phá học trình**

1. Tìm khóa học bằng tên, danh mục hoặc từ khóa.
2. Mở chi tiết khóa học.
3. Chọn lớp mong muốn và bấm đăng ký.
4. Xem trạng thái ghi danh.

Với khóa học miễn phí:

- Học viên vào danh sách chờ của lớp đã chọn; phòng đào tạo xác nhận để mở quyền học.

Với khóa học có phí:

- Sau khi đăng ký, hệ thống tạo trạng thái **chờ thanh toán** và ghi nhớ lớp học viên đã chọn.
- Học viên chưa được vào lớp cho đến khi thanh toán được xác nhận (bởi phòng đào tạo, hoặc bởi bộ phận tư vấn qua CRM) và được xếp vào lớp.

### 6.3. Thanh toán học phí

Đường dẫn: **SIS -> Học phí/Thanh toán**

Quy trình:

1. Xem danh sách khoản phí cần thanh toán.
2. Mở hướng dẫn thanh toán/chuyển khoản.
3. Chuyển khoản đúng số tiền và nội dung.
4. Chờ bộ phận vận hành xác nhận.
5. Theo dõi trạng thái biên lai.

Trạng thái thường gặp:

- **Pending/Chờ xác nhận**: đã có yêu cầu, đang đợi đối soát.
- **Approved/Đã xác nhận**: thanh toán hợp lệ.
- **Rejected/Từ chối**: thông tin sai, cần xử lý lại.

### 6.4. Vào lớp và học theo buổi

Đường dẫn: **LMS -> Lớp học của tôi**

Điều kiện vào lớp:

- Khóa học đã ghi danh hợp lệ.
- Nếu khóa học có phí: thanh toán đã được xác nhận.
- Admin đã xác nhận xếp lớp/đăng ký lớp học phần.

Trong lớp học, học viên có thể:

- Xem danh sách buổi học theo lịch.
- Mở nội dung từng buổi.
- Xem video bài giảng.
- Xem video YouTube, tải slide và tài liệu Word/PDF của từng buổi (mục **Tài liệu buổi học**).
- Đọc nội dung/hướng dẫn.
- Làm quiz gắn với buổi học.
- Nộp bài tập gắn với buổi học.
- Theo dõi tiến độ hoàn thành.

### 6.5. Làm đề thi/trắc nghiệm

Đường dẫn: **LMS -> Buổi học -> Đề thi** hoặc **Đề thi & Đánh giá**

Quy trình:

1. Mở đề thi.
2. Kiểm tra thời gian, điểm đạt, số lần làm tối đa, deadline.
3. Chọn bắt đầu.
4. Trả lời câu hỏi.
5. Nộp bài trước khi hết giờ.
6. Xem kết quả nếu hệ thống cho phép hiển thị ngay.

Lưu ý:

- Hết giờ có thể tự động nộp bài.
- Vượt số lần làm tối đa sẽ không thể làm tiếp.
- Quá deadline có thể bị khóa bài.

### 6.6. Nộp bài tập

Đường dẫn: **LMS -> Buổi học -> Bài tập** hoặc **Bài tập về nhà**

Quy trình:

1. Mở bài tập.
2. Đọc yêu cầu, deadline và điểm tối đa.
3. Nhập nội dung bài làm hoặc dán liên kết.
4. Tải file đính kèm nếu cần.
5. Chọn nộp bài.
6. Theo dõi điểm và feedback sau khi giảng viên chấm.

Lưu ý:

- Bài nộp sau deadline có thể bị đánh dấu nộp muộn.
- Nếu cần sửa bài, kiểm tra xem hệ thống/giảng viên có cho nộp lại không.

### 6.7. Điểm danh

Đường dẫn: **SIS/LMS -> Thông báo hoặc Điểm danh**

Học viên có thể điểm danh bằng:

- Quét QR do giảng viên mở trên lớp.
- Nhập mã check-in nếu được cấp.
- Xem lịch sử chuyên cần trong SIS.

Nếu quên điểm danh, liên hệ giảng viên để được cập nhật thủ công nếu hợp lệ.

### 6.8. Điểm, học bạ, chứng chỉ

Đường dẫn: **SIS -> Kết quả học tập / Học bạ / Chứng chỉ**

Học viên có thể:

- Xem điểm thành phần.
- Xem điểm quiz, bài tập, điểm tổng kết.
- In/xuất học bạ nếu được hỗ trợ.
- Xem chứng chỉ đã được cấp.
- Sao chép mã chứng chỉ để xác thực.

## 7. Hướng dẫn cho Phụ huynh

### 7.1. Liên kết học viên

Tài khoản phụ huynh cần được admin liên kết với học viên. Nếu đăng nhập mà không thấy thông tin con/em, liên hệ admin để kiểm tra trường `linkedStudentId`.

### 7.2. Theo dõi tổng quan

Đường dẫn: **SIS -> Tổng quan phụ huynh**

Phụ huynh có thể xem:

- Thông tin học viên.
- Chương trình đang học.
- Tình hình học tập.
- Trạng thái cảnh báo.
- Công nợ học phí.

### 7.3. Điểm số và tiến độ

Đường dẫn: **LMS/SIS -> Điểm số**

Chức năng:

- Xem danh sách khóa học của học viên.
- Xem điểm trung bình, điểm thành phần, giảng viên, danh mục.
- Tìm kiếm/lọc khóa học.
- Mở chi tiết nếu cần theo dõi sâu hơn.

### 7.4. Chuyên cần, cảnh báo và học phí

Phụ huynh có thể:

- Xem tỷ lệ chuyên cần.
- Xem các buổi vắng/đi trễ.
- Xem cảnh báo đang mở.
- Xem ghi chú cố vấn được chia sẻ.
- Xem học phí còn nợ, đã thanh toán, quá hạn.
- Nhận thông báo từ nhà trường.

## 8. Hướng dẫn cho bộ phận tài chính/vận hành thanh toán

### 8.1. Xác nhận giao dịch

Quy trình:

1. Mở danh sách giao dịch đang chờ xử lý.
2. Kiểm tra học viên, khóa học, số tiền, nội dung, thời gian.
3. Nếu hợp lệ, xác nhận thanh toán.
4. Nếu sai, từ chối và ghi chú lý do.
5. Thông báo cập nhật về tài khoản học viên.

Tác động:

- Xác nhận thanh toán là điều kiện để học viên vào lớp có phí.
- Sau khi thanh toán hợp lệ, admin vẫn cần xác nhận xếp lớp nếu lớp đang waitlist/chờ duyệt.

### 8.2. Quản lý công nợ

Chức năng:

- Tạo đợt thu học phí.
- Theo dõi tổng công nợ.
- Lọc học viên quá hạn.
- Gửi nhắc thanh toán.
- Xuất danh sách phục vụ đối soát.

## 9. Hướng dẫn cho Cố vấn học tập

### 9.1. Theo dõi học viên phụ trách

Cố vấn có thể:

- Xem danh sách học viên được gán.
- Tìm học viên theo tên/email/mã sinh viên.
- Xem GPA, tiến độ, cảnh báo, học phí/chuyên cần liên quan.

### 9.2. Ghi chú tư vấn

Quy trình:

1. Chọn học viên.
2. Mở tab ghi chú/nhật ký tư vấn.
3. Chọn loại ghi chú: học tập, hành vi, tài chính, định hướng.
4. Nhập nội dung.
5. Chọn có chia sẻ với phụ huynh hay không.
6. Lưu ghi chú.

### 9.3. Xử lý cảnh báo

Quy trình:

1. Mở danh sách cảnh báo đang mở.
2. Xem nguyên nhân: GPA, chuyên cần, tiến độ, học phí.
3. Làm việc với học viên/giảng viên/phụ huynh.
4. Ghi nhận hướng xử lý.
5. Đánh dấu đã giải quyết khi hoàn tất.

## 10. Quy trình mẫu từ đầu đến cuối

### 10.1. Mở một lớp học có thu phí

1. Giảng viên tạo khóa học và nội dung tổng quan.
2. Admin duyệt/xuất bản khóa học.
3. Admin tạo lớp học phần, nhập lịch học, sĩ số, ngày khai giảng và số buổi.
4. Hệ thống sinh danh sách buổi học theo thời khóa biểu.
5. Học viên đăng ký khóa/lớp.
6. Hệ thống tạo yêu cầu thanh toán.
7. Tài chính xác nhận thanh toán.
8. Admin xác nhận xếp lớp/waitlist.
9. Học viên vào lớp.
10. Giảng viên sửa nội dung từng buổi, tải video, tạo bài tập/quiz theo buổi.
11. Học viên học, làm bài, nộp bài.
12. Giảng viên chấm điểm.
13. Hệ thống tổng hợp điểm, tiến độ, chứng chỉ nếu đủ điều kiện.

### 10.2. Xử lý học viên chưa vào được lớp

Kiểm tra theo thứ tự:

1. Học viên đã đăng ký đúng khóa/lớp chưa?
2. Khóa học có phí không?
3. Nếu có phí, giao dịch đã được xác nhận chưa?
4. Học viên đang ở trạng thái waitlist/chờ xếp lớp không?
5. Admin đã xác nhận lớp học phần chưa?
6. Lớp còn sĩ số không?
7. Khóa học/lớp học phần có đang active/published không?

### 10.3. Tạo đủ 10 buổi học theo lịch

1. Admin mở lớp học phần.
2. Nhập thời khóa biểu, ví dụ: Thứ 2 và Thứ 4, 19:00-21:00.
3. Nhập số buổi: 10.
4. Lưu lớp.
5. Hệ thống hiển thị 10 buổi theo thứ tự lịch gần nhất từ ngày khai giảng.
6. Giảng viên mở từng buổi để đổi tên, thêm nội dung, video, bài tập, quiz.

## 11. Các trạng thái quan trọng

### Khóa học

- **draft**: bản nháp.
- **pending**: chờ duyệt.
- **published**: đã xuất bản.
- **rejected**: bị từ chối, cần sửa.

### Ghi danh khóa học

- **pending**: chờ xử lý.
- **pending_payment**: chờ thanh toán.
- **active**: đang học.
- **completed**: đã hoàn thành.
- **cancelled**: đã hủy.

### Đăng ký lớp học phần

- **waitlisted**: chờ xác nhận/xếp lớp.
- **registered**: đã được vào lớp.
- **dropped/cancelled**: đã rời lớp/hủy.

### Thanh toán

- **pending**: chờ đối soát.
- **approved**: đã xác nhận.
- **rejected**: bị từ chối.

## 12. Xử lý sự cố thường gặp

| Sự cố | Cách kiểm tra/xử lý |
| --- | --- |
| Tạo tài khoản học viên báo chậm/lỗi nhưng học viên vẫn đăng nhập được | Kiểm tra tài khoản đã tạo trong danh sách người dùng. Nếu chỉ lỗi ở bước cấp email trường, thực hiện cấp lại email hoặc chờ tiến trình nền hoàn tất. |
| Học viên đăng ký lớp có phí nhưng không vào được | Kiểm tra thanh toán đã approved chưa và admin đã xác nhận xếp lớp chưa. |
| Học viên vào lớp khi chưa thanh toán | Kiểm tra trạng thái enrollment và course registration. Lớp có phí phải yêu cầu payment approved và registration registered. |
| Lớp không hiển thị đủ số buổi | Kiểm tra số buổi, ngày khai giảng và thời khóa biểu. Nếu lịch rỗng, hệ thống không có căn cứ sinh ngày học. |
| Giảng viên không sửa được buổi học | Kiểm tra giảng viên có phải teacherId của khóa/lớp không và khóa/lớp có thuộc phạm vi được giao không. |
| Bài tập/quiz không hiển thị trong buổi học | Kiểm tra bài tập/quiz đã gắn đúng `lessonId` của buổi học chưa. |
| Tải video lên thất bại | Kiểm tra định dạng, dung lượng, kết nối và quyền upload. Có thể dùng URL video tạm thời nếu upload chưa sẵn sàng. |
| Phụ huynh không thấy dữ liệu học viên | Kiểm tra tài khoản phụ huynh đã liên kết với học viên chưa. |
| Điểm danh QR không hoạt động | Kiểm tra phiên điểm danh còn mở không, đúng lớp/buổi không, mã có hết hạn không. |

## 13. Nguyên tắc vận hành khuyến nghị

- Tạo học viên xong nên kiểm tra hồ sơ student profile đã có chương trình/khoa/ngành.
- Khóa học có phí không cho vào lớp trước khi thanh toán approved.
- Lớp học phần cần có lịch học và số buổi trước khi bắt đầu giảng dạy.
- Bài tập, quiz, đề thi nên gắn vào từng buổi học để học viên học đến đâu thấy bài đến đó.
- Giảng viên nên cập nhật video/nội dung trước mỗi buổi học.
- Admin nên theo dõi waitlist và sĩ số lớp hằng ngày trong giai đoạn mở lớp.
- Tài chính nên đối soát thanh toán sớm để không làm chậm quy trình xếp lớp.
- Cố vấn nên xử lý cảnh báo sớm, đặc biệt với học viên vắng nhiều, nợ học phí hoặc GPA thấp.
- Audit log nên được kiểm tra khi có tranh chấp về duyệt lớp, thanh toán, điểm hoặc quyền truy cập.

