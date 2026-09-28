import React, { useState } from "react";
import { ArrowRight, Compass, LineChart, Video } from "lucide-react";
import { Button, cx, Dialog, Illustration, IllustrationName } from "../ui";
import { callName } from "../../lib/format";

const STORAGE_KEY = "mcna_welcome_tour_v1";

const SLIDES: Array<{ illustration: IllustrationName; icon: React.ReactNode; title: string; text: string }> = [
  { illustration: "explore", icon: <Compass className="h-7 w-7" />, title: "Chọn lớp bạn thích", text: "Mở “Khám phá” để xem khóa học, lịch từng lớp và đăng ký chỉ với một chạm." },
  { illustration: "live-class", icon: <Video className="h-7 w-7" />, title: "Học trực tiếp cùng giảng viên", text: "Đến giờ học, bấm “Vào lớp” để tham gia Zoom. Slide và video xem lại có sẵn sau mỗi buổi." },
  { illustration: "progress", icon: <LineChart className="h-7 w-7" />, title: "Thấy mình tiến bộ", text: "Đánh dấu bài đã học để theo dõi tiến độ. Trang chủ luôn nhắc bạn buổi học tiếp theo." }
];

export const shouldShowWelcomeTour = (userId: string) => {
  try {
    return !localStorage.getItem(`${STORAGE_KEY}:${userId}`);
  } catch {
    return false;
  }
};

/** Three-card introduction shown once per learner on their first visit to Home. */
export default function WelcomeTour({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(`${STORAGE_KEY}:${userId}`, new Date().toISOString());
    } catch {
      // Private mode: the tour may show again next time, which is harmless.
    }
    onClose();
  };

  return (
    <Dialog onClose={finish} size="sm">
      <div className="flex flex-col items-center text-center">
        <p className="text-[13px] font-semibold text-indigo-600">Chào mừng {callName(name)} đến với MCNA!</p>
        <div key={index} className="flex h-44 w-full animate-fade-up items-center justify-center">
          <Illustration
            name={slide.illustration}
            eager
            className="h-40 w-40"
            fallback={<span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-brand-gradient text-white shadow-raised">{slide.icon}</span>}
          />
        </div>
        <h2 className="text-[22px] font-bold tracking-tight text-slate-900">{slide.title}</h2>
        <p className="mt-2 min-h-[4.5rem] text-[15px] leading-relaxed text-slate-600">{slide.text}</p>

        <div className="mt-4 flex gap-2" role="tablist" aria-label="Trang giới thiệu">
          {SLIDES.map((item, dotIndex) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Trang ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
              className={cx("h-2 rounded-full transition-all", dotIndex === index ? "w-6 bg-indigo-600" : "w-2 bg-slate-300")}
            />
          ))}
        </div>

        <div className="mt-7 flex w-full flex-col gap-2">
          <Button block size="lg" onClick={() => (last ? finish() : setIndex(index + 1))} iconRight={!last ? <ArrowRight className="h-4 w-4" /> : undefined}>
            {last ? "Bắt đầu học" : "Tiếp tục"}
          </Button>
          {!last && <Button block variant="ghost" onClick={finish}>Bỏ qua</Button>}
        </div>
      </div>
    </Dialog>
  );
}
