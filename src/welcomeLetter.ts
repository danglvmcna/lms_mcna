// Opening letter a learner sees once placed in a class. Staff edit one letter per course;
// the placeholders below are filled in for each learner and class when it is shown.

export type WelcomeLetterVars = {
  studentName?: string;
  courseTitle?: string;
  sectionCode?: string;
  teacherName?: string;
  openingDate?: string;
  schedule?: string;
  supportPhone?: string;
};

export const WELCOME_LETTER_PLACEHOLDERS: Array<{ token: string; key: keyof WelcomeLetterVars; label: string }> = [
  { token: "{{ten_hoc_vien}}", key: "studentName", label: "Tên học viên" },
  { token: "{{ten_khoa_hoc}}", key: "courseTitle", label: "Tên khóa học" },
  { token: "{{ma_lop}}", key: "sectionCode", label: "Mã lớp" },
  { token: "{{giang_vien}}", key: "teacherName", label: "Giảng viên" },
  { token: "{{ngay_khai_giang}}", key: "openingDate", label: "Ngày khai giảng" },
  { token: "{{lich_hoc}}", key: "schedule", label: "Lịch học" },
  { token: "{{so_ho_tro}}", key: "supportPhone", label: "Số hỗ trợ" }
];

export const DEFAULT_WELCOME_LETTER = `Chào {{ten_hoc_vien}},

Chúc mừng bạn đã chính thức trở thành học viên khóa {{ten_khoa_hoc}} tại MCNA Technology School!

Bạn được xếp vào lớp {{ma_lop}}, khai giảng ngày {{ngay_khai_giang}}. Lịch học: {{lich_hoc}}. Giảng viên phụ trách: {{giang_vien}}.

Để buổi học đầu tiên diễn ra suôn sẻ, bạn nên:
1. Tham gia nhóm Zalo của lớp để nhận thông báo và trao đổi với giảng viên.
2. Xem trước phần "Sách & tài liệu tham khảo" ngay bên dưới.
3. Làm thử "Bài luyện tập" để làm quen với công cụ trước khi vào học.

Mỗi buổi học trên LMS đều có slide để xem lại, file data để thực hành và bài tập về nhà. Hãy dành thời gian làm bài tập sau mỗi buổi, vì đó là cách nhanh nhất để biến kiến thức thành kỹ năng.

Cần hỗ trợ, bạn nhắn vào nhóm lớp hoặc gọi {{so_ho_tro}}.

Chúc bạn học thật vui và thu được nhiều giá trị!
MCNA Technology School`;

const MISSING_VALUE = "đang cập nhật";

/** Fills the placeholders; an empty letter falls back to the default one. */
export function renderWelcomeLetter(template: string | null | undefined, vars: WelcomeLetterVars): string {
  let text = String(template || "").trim() || DEFAULT_WELCOME_LETTER;
  for (const placeholder of WELCOME_LETTER_PLACEHOLDERS) {
    const value = String(vars[placeholder.key] || "").trim() || MISSING_VALUE;
    text = text.split(placeholder.token).join(value);
  }
  return text;
}
