import { DEFAULT_WELCOME_LETTER, WELCOME_LETTER_PLACEHOLDERS } from "../../welcomeLetter";

// Drafts a course's welcome letter with Gemini (GEMINI_API_KEY). Staff always review and save the
// draft themselves; without a key, or when the call fails, the MCNA default letter is returned instead.

export type WelcomeLetterDraft = { letter: string; source: "ai" | "template"; note?: string };

type CourseBrief = { title: string; description?: string; level?: string; sessionTitles: string[] };

const AI_TIMEOUT_MS = 30_000;

function buildPrompt(course: CourseBrief) {
  const placeholders = WELCOME_LETTER_PLACEHOLDERS.map(item => `${item.token} (${item.label})`).join(", ");
  return [
    "Bạn là chuyên viên đào tạo của MCNA Technology School. Hãy viết một lá thư chúc mừng bằng tiếng Việt gửi học viên vừa được xếp lớp.",
    "",
    `Khóa học: ${course.title}`,
    course.level ? `Trình độ: ${course.level}` : "",
    course.description ? `Mô tả khóa học: ${course.description.slice(0, 1200)}` : "",
    course.sessionTitles.length ? `Nội dung các buổi: ${course.sessionTitles.slice(0, 20).join("; ")}` : "",
    "",
    "Yêu cầu:",
    "- Dài 150 đến 220 từ, giọng ấm áp, chuyên nghiệp, xưng hô \"bạn\".",
    `- Thông tin riêng của từng học viên và lớp phải dùng đúng các biến sau, giữ nguyên dấu ngoặc nhọn kép: ${placeholders}.`,
    "- Mở đầu bằng lời chào có {{ten_hoc_vien}}; nêu lớp {{ma_lop}}, ngày khai giảng {{ngay_khai_giang}}, lịch học {{lich_hoc}} và giảng viên {{giang_vien}}.",
    "- Nói ngắn gọn học viên sẽ làm được gì sau khóa học, dựa trên nội dung các buổi ở trên.",
    "- Nhắc học viên tham gia nhóm Zalo của lớp, xem phần sách và tài liệu tham khảo, làm bài luyện tập trước buổi đầu.",
    "- Kết thư có số hỗ trợ {{so_ho_tro}} và ký tên MCNA Technology School.",
    "- Không cam kết về việc làm, thu nhập, chứng chỉ hay ưu đãi. Không bịa thông tin ngoài dữ liệu đã cho.",
    "- Chỉ trả về nội dung thư dạng văn bản thuần, không markdown, không tiêu đề, không giải thích."
  ].filter(line => line !== "").join("\n");
}

const cleanLetter = (text: string) => text
  .replace(/^```[a-z]*\n?/i, "")
  .replace(/\n?```$/i, "")
  .replace(/\*\*/g, "")
  .trim();

export async function generateWelcomeLetterDraft(course: CourseBrief): Promise<WelcomeLetterDraft> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return { letter: DEFAULT_WELCOME_LETTER, source: "template", note: "Máy chủ chưa cấu hình GEMINI_API_KEY nên dùng thư mẫu của MCNA." };
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await Promise.race([
      ai.models.generateContent({
        model: (process.env.GEMINI_MODEL || "").trim() || "gemini-2.5-flash",
        contents: buildPrompt(course),
        config: { temperature: 0.7 }
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI không phản hồi sau 30 giây")), AI_TIMEOUT_MS))
    ]);
    const letter = cleanLetter(String(response.text || ""));
    if (!letter) throw new Error("AI trả về nội dung trống");
    return { letter, source: "ai" };
  } catch (error: any) {
    console.warn("[welcome-letter] AI draft failed:", error?.message || error);
    return {
      letter: DEFAULT_WELCOME_LETTER,
      source: "template",
      note: `Không gọi được AI (${String(error?.message || error).slice(0, 160)}); dùng thư mẫu của MCNA.`
    };
  }
}
