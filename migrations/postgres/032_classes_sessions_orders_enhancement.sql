-- 032_classes_sessions_orders_enhancement.sql
-- 1. Thêm link phòng học online (Zoom/Google Meet) và link nhóm trao đổi (Zalo/Discord) cho lớp học.
-- 2. Thêm giá gốc niêm yết (original_price) cho khóa học để hỗ trợ hiển thị giá ưu đãi gạch ngang.
-- 3. Thêm link video ghi lại (recording_url) cho từng buổi học để học viên xem lại bài giảng.

ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS group_chat_url TEXT;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS original_price NUMERIC;

ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS recording_url TEXT;
