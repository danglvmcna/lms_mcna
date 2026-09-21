# Chính sách Bảo tồn 17 Bảng Dữ liệu SIS Lịch sử (Schema Retention Policy)

## 1. Bối cảnh & Quyết định Nghiệp vụ
MCNA LMS được kế thừa và chuyển dịch từ hệ thống quản lý đại học E16 SIS sang nền tảng LMS bán khóa học và đào tạo trực tuyến thực chiến.

Trong quá trình chuyển dịch, cơ sở dữ liệu PostgreSQL lưu giữ **17 bảng dữ liệu** thuộc hệ thống SIS cũ:
1. `academic_warnings`
2. `academic_years`
3. `advisor_assignments`
4. `advisor_notes`
5. `departments`
6. `grade_appeals`
7. `graduation_applications`
8. `leave_requests`
9. `parent_links`
10. `program_courses`
11. `programs`
12. `registration_periods`
13. `scholarship_applications`
14. `scholarships`
15. `semesters`
16. `student_profiles`
17. `tuition_fees`

## 2. Nguyên tắc Bắt buộc (Invariant R1)
> [!IMPORTANT]
> **TUYỆT ĐỐI KHÔNG DROP 17 BẢNG TRÊN**.
> Đây là quyết định có chủ ý của Ban Quản trị Học viện MCNA nhằm lưu trữ và bảo toàn toàn vẹn dữ liệu học vụ lịch sử.

## 3. Trạng thái Vận hành Hiện tại
- **Mã nguồn LMS**: Toàn bộ luồng đăng ký học viên, ghi danh, nộp bài, chấm điểm, thanh toán SePay và đồng bộ CRM **không thực hiện bất kỳ thao tác Đọc (SELECT) hay Ghi (INSERT/UPDATE)** nào vào 17 bảng trên.
- **Dọn dẹp & Seed dữ liệu**: Các script bảo trì (`scripts/dbSeed.ts` và `scripts/purgeMockData.ts`) chỉ thực hiện dọn dẹp an toàn khi chạy chế độ reset môi trường dev/staging.
- **Tương thích ngược**: Bất kỳ kỹ sư hoặc agent nào tiếp nhận repo này đều phải tuân thủ nguyên tắc không tạo migration DROP các bảng trên.
