import React, { useState } from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu } from "lucide-react";
import { AppStore } from "../../store";
import { api } from "../../api";
import { calculateCourseGradePercent, collectCourseGradeInputs } from "../../gradeUtils";
import ModalPortal from "../ModalPortal";

/** Format date string to dd/mm/yyyy. Never shows time. Returns '—' for empty. */
const fmtDate = (s?: string | null): string => {
  if (!s) return "—";
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = plain ? new Date(s + "T00:00:00") : new Date(s);
  if (isNaN(d.getTime())) return s || "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

interface ComponentProps {
  [key: string]: any;
}

export default function StudentAcademics(props: ComponentProps) {
  const {
    activeSubTab,
    setActiveSubTab,
    viewingCourseId,
    setViewingCourseId,
    filteredCatalog,
    catalogSearch,
    setCatalogSearch,
    catalogCategory,
    setCatalogCategory,
    myEnrolledCourseIds,
    store,
    handleEnrollIntoCourse,
    setLearningCourseId,
    myEnrollments,
    currentUser,
    setActiveLessonId,
    handleToggleLessonComplete,
    learningCourseId,
    currentLearningCourse,
    currentLearningLessons,
    activeLearningEnrollment,
    activeLessonId,
    currentLessonContentObj,
    handleStartQuiz,
    setSubmittingAssignmentId,
    setSubmissionCodeText,
    submittingAssignmentId,
    submissionCodeText,
    handleSendAssignmentSubmit,
    quizTimeRemaining,
    activeQuizId,
    setActiveQuizId,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    quizAnswers,
    quizFinishedState,
    handleSelectQuizAnswer,
    handleAutoSubmitQuiz,
    showProfileEditForm,
    setShowProfileEditForm,
    myProfile,
    editPhone,
    setEditPhone,
    editBirth,
    setEditBirth,
    editGender,
    setEditGender,
    editAddress,
    setEditAddress,
    editParent,
    setEditParent,
    editParentPhone,
    setEditParentPhone,
    onRefreshData,
    triggerToast,
    showPrintTranscript,
    setShowPrintTranscript,
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  } = props;

  // Local search filter states
  const [courseSearch, setCourseSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);

  // Sorting state for my enrollments schedule
  const [enrollSortField, setEnrollSortField] = useState<string>("courseTitle");
  const [enrollSortOrder, setEnrollSortOrder] = useState<"asc" | "desc">("asc");

  // Sorting state for student transactions receipt history
  const [txSortField, setTxSortField] = useState<string>("createdAt");
  const [txSortOrder, setTxSortOrder] = useState<"asc" | "desc">("desc");

  // Sorting state for transcripts grades summary
  const [transcriptSortField, setTranscriptSortField] = useState<string>("courseTitle");
  const [transcriptSortOrder, setTranscriptSortOrder] = useState<"asc" | "desc">("asc");

  const handleEnrollSort = (field: string) => {
    if (enrollSortField === field) {
      setEnrollSortOrder(enrollSortOrder === "asc" ? "desc" : "asc");
    } else {
      setEnrollSortField(field);
      setEnrollSortOrder("asc");
    }
  };

  const handleTxSort = (field: string) => {
    if (txSortField === field) {
      setTxSortOrder(txSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTxSortField(field);
      setTxSortOrder("asc");
    }
  };

  const handleTranscriptSort = (field: string) => {
    if (transcriptSortField === field) {
      setTranscriptSortOrder(transcriptSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTranscriptSortField(field);
      setTranscriptSortOrder("asc");
    }
  };

  // Dynamic GPA and Credits calculation
  const enrollmentsByCourse: Record<string, any[]> = {};
  myEnrollments.forEach((enroll: any) => {
    if (!enrollmentsByCourse[enroll.courseId]) {
      enrollmentsByCourse[enroll.courseId] = [];
    }
    enrollmentsByCourse[enroll.courseId].push(enroll);
  });

  const uniqueCourseGrades = Object.entries(enrollmentsByCourse).map(([courseId, enrolls]) => {
    const course = store.courses.find((c: any) => c.id === courseId);
    if (!course) return null;

    const programCourse = store.programCourses?.find((pc: any) => pc.courseId === courseId);
    const credits = programCourse ? programCourse.credits : 3;
    const gradeResult = calculateCourseGradePercent(collectCourseGradeInputs(store, currentUser.id, courseId));
    const isCompleted = enrolls.some((e: any) => e.status === "completed") || Boolean(gradeResult.countsForGpa);

    if (!gradeResult.hasGrades || gradeResult.finalPercent === null) {
      return null;
    }

    return {
      courseId,
      course,
      grade: gradeResult.finalPercent,
      scale4Val: gradeResult.gradePoint ?? 0,
      letterGrade: gradeResult.letterGrade ?? "F",
      isCompleted,
      credits,
      midtermGrade: gradeResult.assignmentAvg,
      finalExamGrade: gradeResult.quizAvg
    };
  }).filter(Boolean) as Array<{
    courseId: string;
    course: any;
    grade: number;
    scale4Val: number;
    letterGrade: string;
    isCompleted: boolean;
    credits: number;
    midtermGrade: number | null;
    finalExamGrade: number | null;
  }>;

  const calculatedCredits = uniqueCourseGrades.reduce((sum, c) => {
    if (c.isCompleted || c.grade >= 60) {
      return sum + c.credits;
    }
    return sum;
  }, 0);

  const gradedCourses = uniqueCourseGrades.filter(c => c.letterGrade !== "IP" && (c.isCompleted || c.grade > 0));
  const calculatedGpa = gradedCourses.length > 0
    ? gradedCourses.reduce((sum, c) => sum + (c.scale4Val * c.credits), 0) / gradedCourses.reduce((sum, c) => sum + c.credits, 0)
    : 0.0;

  // Filtered datasets for SIS tabs
  const filteredMyEnrollments = myEnrollments.filter((enroll: any) => {
    if (!courseSearch.trim()) return true;
    const course = store.courses.find((c: any) => c.id === enroll.courseId);
    return course?.title?.toLowerCase().includes(courseSearch.toLowerCase());
  });

  const sortedMyEnrollments = [...filteredMyEnrollments].sort((a, b) => {
    if (!enrollSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    const courseA = store.courses.find((c: any) => c.id === a.courseId);
    const courseB = store.courses.find((c: any) => c.id === b.courseId);

    if (enrollSortField === "courseTitle") {
      valA = courseA?.title || "";
      valB = courseB?.title || "";
    } else if (enrollSortField === "credits") {
      valA = 3;
      valB = 3;
    } else if (enrollSortField === "category") {
      valA = courseA?.category || "";
      valB = courseB?.category || "";
    } else if (enrollSortField === "status") {
      valA = a.status || "";
      valB = b.status || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return enrollSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return enrollSortOrder === "asc" ? valA - valB : valB - valA;
  });

  const filteredTransactions = (store.transactions || [])
    .filter((t: any) => t.studentId === currentUser.id)
    .filter((tx: any) => {
      if (!txSearch.trim()) return true;
      const course = store.courses.find((c: any) => c.id === tx.courseId);
      const courseTitle = course?.title || "";
      const txNotes = tx.notes || "";
      const searchLower = txSearch.toLowerCase();
      return (
        courseTitle.toLowerCase().includes(searchLower) ||
        tx.id.toLowerCase().includes(searchLower) ||
        txNotes.toLowerCase().includes(searchLower)
      );
    });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!txSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    if (txSortField === "id") {
      valA = a.id || "";
      valB = b.id || "";
    } else if (txSortField === "notes") {
      const courseA = store.courses.find((c: any) => c.id === a.courseId);
      valA = a.notes && a.notes.startsWith("tuition_fee_pay:") ? "Học phí tháng" : (courseA ? courseA.title : "Học phí");
      const courseB = store.courses.find((c: any) => c.id === b.courseId);
      valB = b.notes && b.notes.startsWith("tuition_fee_pay:") ? "Học phí tháng" : (courseB ? courseB.title : "Học phí");
    } else if (txSortField === "amount") {
      valA = a.amount || 0;
      valB = b.amount || 0;
    } else if (txSortField === "paymentMethod") {
      valA = a.paymentMethod || "";
      valB = b.paymentMethod || "";
    } else if (txSortField === "createdAt") {
      valA = new Date(a.createdAt).getTime();
      valB = new Date(b.createdAt).getTime();
    } else if (txSortField === "status") {
      valA = a.status || "";
      valB = b.status || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return txSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return txSortOrder === "asc" ? valA - valB : valB - valA;
  });

  const filteredUniqueCourseGrades = uniqueCourseGrades.filter((g: any) => {
    if (!g) return false;
    if (!transcriptSearch.trim()) return true;
    return g.course?.title?.toLowerCase().includes(transcriptSearch.toLowerCase());
  });

  const sortedUniqueCourseGrades = [...filteredUniqueCourseGrades].sort((a, b) => {
    if (!transcriptSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    if (transcriptSortField === "courseTitle") {
      valA = a.course?.title || "";
      valB = b.course?.title || "";
    } else if (transcriptSortField === "credits") {
      valA = a.credits || 0;
      valB = b.credits || 0;
    } else if (transcriptSortField === "midtermGrade") {
      valA = a.midtermGrade !== null ? a.midtermGrade : -1;
      valB = b.midtermGrade !== null ? b.midtermGrade : -1;
    } else if (transcriptSortField === "finalGrade") {
      valA = a.finalExamGrade !== null ? a.finalExamGrade : -1;
      valB = b.finalExamGrade !== null ? b.finalExamGrade : -1;
    } else if (transcriptSortField === "grade") {
      valA = a.grade || 0;
      valB = b.grade || 0;
    } else if (transcriptSortField === "scale4Val") {
      valA = a.scale4Val || 0;
      valB = b.scale4Val || 0;
    } else if (transcriptSortField === "letterGrade") {
      valA = a.letterGrade || "";
      valB = b.letterGrade || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return transcriptSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return transcriptSortOrder === "asc" ? valA - valB : valB - valA;
  });

  return (
    <>

        {activeSubTab === "profile" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h4 className="text-base font-display font-bold text-white flex items-center gap-1.5">
                  <User className="h-5 w-5 text-indigo-400" /> Hồ sơ lý lịch Học sinh Sinh viên
                </h4>
                <p className="text-xs text-white/50">Mã định danh duy nhất của bạn: <span className="text-cyan-400 font-mono font-bold">{myProfile.studentCode}</span></p>
              </div>
              <button
                onClick={() => setShowProfileEditForm(!showProfileEditForm)}
                className="px-3.5 py-1.5 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer text-xs"
              >
                {showProfileEditForm ? "Bỏ qua điều chỉnh" : "Cập nhật hồ sơ"}
              </button>
            </div>

            {!showProfileEditForm ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Visual student card info */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center font-bold text-lg text-indigo-300 font-mono">
                      {currentUser.name.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{currentUser.name}</h5>
                      <span className="text-[10.5px] text-indigo-300 font-mono font-bold block">{myProfile.studentCode} • dự kiến tốt nghiệp: {fmtDate(myProfile.expectedGraduation)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                    <div>
                      <span className="text-white/40 block">Điện thoại</span>
                      <span className="font-bold text-white mt-0.5">{myProfile.phone || "Chưa bổ sung"}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block">Ngày sinh</span>
                      <span className="font-bold text-white mt-0.5">{fmtDate(myProfile.dateOfBirth)}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block">Giới tính</span>
                      <span className="font-bold text-white mt-0.5">{myProfile.gender || "Chưa thiết lập"}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block">Ngày nhập học</span>
                      <span className="font-bold text-white font-mono text-indigo-300 mt-0.5">{fmtDate(myProfile.enrollmentDate)}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 text-xs">
                    <span className="text-white/40 block">Địa chỉ thường trú</span>
                    <span className="font-bold text-white mt-0.5">{myProfile.address || "Chưa có địa chỉ cụ thể"}</span>
                  </div>
                </div>

                {/* Guardian info card */}
                <div className="bg-white/3 border border-white/5 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Shield className="h-4 w-4" /> Thông tin Cố vấn & Người bảo hộ
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                      <div>
                        <span className="text-white/40 block">Người bảo hộ</span>
                        <span className="font-bold text-white mt-0.5">{myProfile.guardianName || "Chưa cập nhật"}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Số điện thoại liên hệ</span>
                        <span className="font-bold text-white mt-0.5">{myProfile.guardianPhone || "Chưa cập nhật"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 text-xs bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                    <p className="text-[10.5px] leading-relaxed text-indigo-300">
                      ℹ️ Thông tin người bảo hộ vô cùng quan trọng dùng trong trường hợp khẩn cấp học phẩm hoặc cảnh cáo học tập từ Phòng Công tác Sinh viên (SVS).
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              // EDIT PROFILE FORM
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Validate phone
                  if (editPhone) {
                    const phoneClean = editPhone.replace(/\s/g, "");
                    if (!/^0[0-9]{9}$/.test(phoneClean)) {
                      triggerToast("❗ Số điện thoại không hợp lệ. Phải là 10 số, bắt đầu bằng 0 (VD: 0912345678).");
                      return;
                    }
                  }
                  // Validate birthdate required
                  if (!editBirth) {
                    triggerToast("❗ Ngày sinh là bắt buộc. Vui lòng chọn ngày sinh.");
                    return;
                  }
                  if (new Date(editBirth) > new Date()) {
                    triggerToast("❗ Ngày sinh không thể là ngày trong tương lai.");
                    return;
                  }
                  const storeData = AppStore.get();

                  // Call backend API to persist in PostgreSQL database securely
                  api.updateStudentProfile({
                    phone: editPhone || undefined,
                    dateOfBirth: editBirth || undefined,
                    gender: editGender || undefined,
                    address: editAddress || undefined,
                    guardianName: editParent || undefined,
                    guardianPhone: editParentPhone || undefined
                  }).then(() => {
                    (storeData as any).studentProfiles = ((storeData as any).studentProfiles || []).map((p: any) => {
                      if (p.userId === currentUser.id) {
                        AppStore.log(currentUser.id, "update_profile", p.studentCode, "Cập nhật hồ sơ thông tin trực tuyến.");
                        return {
                          ...p,
                          phone: editPhone,
                          dateOfBirth: editBirth,
                          gender: editGender,
                          address: editAddress,
                          guardianName: editParent,
                          guardianPhone: editParentPhone
                        };
                      }
                      return p;
                    });

                    // Keep client state in sync
                    AppStore.save(storeData);
                    setShowProfileEditForm(false);
                    onRefreshData();
                    triggerToast("✅ Cập nhật hồ sơ lý lịch thành công!");
                  }).catch(err => {
                    console.error("Profile update failed:", err);
                    triggerToast("❗ Cập nhật hồ sơ thất bại: " + err.message);
                  });
                }}
                className="bg-white/3 border border-white/5 rounded-3xl p-5 md:p-6 text-xs space-y-4"
              >
                {/* Required field notice */}
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl">
                  <span className="text-red-400 font-bold">*</span>
                  <span>Trường có dấu sao đỏ là bắt buộc nhập</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 block font-bold">
                      Số điện thoại cá nhân
                      <span className="text-white/35 text-[10px] font-normal ml-1">(10 số)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="VD: 0912345678"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 block font-bold">
                      Ngày sinh <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={editBirth}
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setEditBirth(e.target.value)}
                      className={`w-full px-3 py-2 bg-black/25 text-white border rounded-xl focus:outline-none focus:border-indigo-500/40 transition ${
                        !editBirth ? "border-red-500/40" : "border-white/10"
                      }`}
                    />
                    {!editBirth && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" /> Bắt buộc nhập
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 block font-bold">Giới tính</label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 transition"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-white/70 block font-bold">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ của bạn..."
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl"
                  />
                </div>

                <div className="border-t border-white/5 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 block font-bold">Tên người bảo hộ (Bố/Mẹ)</label>
                    <input
                      type="text"
                      placeholder="Họ tên bố mẹ bảo lãnh"
                      value={editParent}
                      onChange={(e) => setEditParent(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-white/70 block font-bold">Điện thoại liên hệ bảo hộ</label>
                    <input
                      type="text"
                      placeholder="SĐT người bảo lãnh"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileEditForm(false)}
                    className="px-4 py-2 bg-transparent text-white/50 hover:text-white cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    Lưu trữ hồ sơ
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab SIS 2: Educational Progress Record and GPA credit calculations */}
        {activeSubTab === "academics_record" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h4 className="text-base font-display font-bold text-white flex items-center gap-1.5">
                <Bookmark className="h-5 w-5 text-indigo-400" /> Trạng thái Học tập niên khóa
              </h4>
              <p className="text-xs text-white/50">Cơ chế quản điểm 4.0 và phân chia tiến trình theo Tín chỉ đợt học phần.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/3 border border-white/5 p-4 rounded-2xl text-center">
                <span className="text-[10px] text-white/40 block uppercase font-bold">Điểm GPA Tích lũy</span>
                <span className="text-3xl font-mono font-black text-amber-400 mt-1 block">{calculatedGpa.toFixed(2)}</span>
                <span className="text-[10px] text-white/30 font-serif italic mt-0.5 block">Hệ số 4.0 chuẩn hóa</span>
              </div>
              <div className="bg-white/3 border border-white/5 p-4 rounded-2xl text-center">
                <span className="text-[10px] text-white/40 block uppercase font-bold">Tích lũy Tín chỉ</span>
                <span className="text-3xl font-mono font-black text-indigo-300 mt-1 block">{calculatedCredits} Tín</span>
                <span className="text-[10px] text-white/30 italic mt-0.5 block">Tối thiểu tốt nghiệp: 120 Tín</span>
              </div>
              <div className="bg-white/3 border border-white/5 p-4 rounded-2xl flex flex-col justify-center items-center">
                <span className="text-[10px] text-white/40 uppercase font-black tracking-wide">Trạng thái Sinh viện</span>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black uppercase rounded-lg mt-1.5">
                  {myProfile.status}
                </span>
              </div>
            </div>

            {/* GPA calculations formulas rules box */}
            <div className="bg-indigo-950/20 border border-indigo-500/10 p-4.5 rounded-2xl text-xs space-y-1.5 text-indigo-300 leading-relaxed font-sans">
              <h5 className="font-bold flex items-center gap-1"><Cpu className="h-4 w-4" /> Công thức cấu thành Điểm trung bình GPA</h5>
              <p>Công thức áp dụng hệ điểm 4: A=4.0; B=3.0; C=2.0; D=1.0; F=0.0. Điểm môn học phần:</p>
              <code className="block p-2 bg-slate-900 rounded text-center text-cyan-400 font-mono font-bold font-black text-[11px] select-all">
                GPA = Sum(GradePoint × Tín chỉ) / Sum(Tổng số Tín chỉ có điểm)
              </code>
            </div>

            {/* Curriculum checklist details */}
            <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Danh sách lớp đào tạo đang học</span>
                
                {/* Course Search Input */}
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    placeholder="Tìm lớp đang học..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
                  />
                  <span className="absolute left-2.5 top-1.5 text-white/40 text-xs">🔍</span>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase text-white/45">
                    <th className="py-2 cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("courseTitle")}>
                      Học phần Môn học {enrollSortField === "courseTitle" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="py-2 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("credits")}>
                      Tín chỉ {enrollSortField === "credits" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="py-2 cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("category")}>
                      Tên lớp đào tạo {enrollSortField === "category" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="py-2 text-right cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("status")}>
                      Trạng thái {enrollSortField === "status" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/2 text-xs text-white/85">
                  {sortedMyEnrollments.map(enroll => {
                    const course = store.courses.find(c => c.id === enroll.courseId);
                    return (
                      <tr key={enroll.id}>
                        <td className="py-2.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{course ? course.title : "Không xác định"}</span>
                            {course && (
                              <button
                                onClick={() => setCourseDetailId(course.id)}
                                className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-0.5 px-1.5 rounded flex items-center gap-0.5 transition cursor-pointer font-sans"
                              >
                                Xem 👁️
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-mono font-bold text-indigo-300">3 Tín</td>
                        <td className="py-2.5 text-white/50">{course ? course.category : "Không xác định"}</td>
                        <td className="py-2.5 text-right font-bold text-xs">
                          <span className={
                            enroll.status === "completed" ? "text-emerald-400" :
                            enroll.status === "pending" ? "text-violet-400 font-bold" :
                            enroll.status === "pending_payment" ? "text-amber-400 font-bold" :
                            enroll.status === "active" ? "text-cyan-400" : "text-red-400"
                          }>
                            {enroll.status === "completed" ? "Đã xong" :
                             enroll.status === "pending" ? "Chờ xếp lớp" :
                             enroll.status === "pending_payment" ? "Chờ thanh toán" :
                             enroll.status === "active" ? "Đang học" : "Đã hủy"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {sortedMyEnrollments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-white/30 italic">Chưa ghi nhận khóa học nào đang tiến hành hoặc không khớp từ khóa tìm kiếm.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab SIS 3: Attendance details summaries with alerts alerts */}
        {activeSubTab === "student_attendance" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h4 className="text-base font-display font-bold text-white flex items-center gap-1.5">
                <Activity className="h-5 w-5 text-indigo-400" /> Báo cáo chuyên học & Giờ điểm danh
              </h4>
              <p className="text-xs text-white/50">Quy chuẩn chuyên cần nghiêm thắt, vắng quá 20% (dưới mốc 80%) sẽ bị đình chỉ tư cách dự thi kết môn tháng.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myEnrollments.map(enroll => {
                const course = store.courses.find(c => c.id === enroll.courseId);
                if (!course) return null;

                const sessions = (store.attendanceSessions || []).filter(s => s.courseId === course.id);
                const pastSessions = sessions.filter(s => new Date(s.date).getTime() <= Date.now());
                const sessionsCount = pastSessions.length;

                const myRecords = (store.attendanceRecords || []).filter(r =>
                  r.studentId === currentUser.id &&
                  pastSessions.some(s => s.id === r.sessionId)
                );

                const countPresent = myRecords.filter(r => r.status === "present" || r.status === "late" || r.status === "excused").length;
                const percentage = sessionsCount > 0 ? Math.round((countPresent / sessionsCount) * 100) : 100;

                return (
                  <div key={enroll.id} className="bg-white/4 border border-white/5 rounded-2xl p-4.5 space-y-3">
                    <div className="flex justify-between items-start leading-tight">
                      <h5 className="font-bold text-white text-xs max-w-[70%] truncate">{course.title}</h5>
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        percentage >= 80 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500 animate-pulse"
                      }`}>
                        {percentage}%
                      </span>
                    </div>

                    <div className="text-xs text-white/50 flex justify-between font-mono">
                      <span>Đi học đầy đủ: {countPresent}/{sessionsCount} buổi tổng</span>
                      <span>Vắng: {sessionsCount - countPresent} buổi</span>
                    </div>

                    {/* Progress tracking display bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${percentage >= 80 ? "bg-emerald-400" : "bg-red-500"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {percentage < 80 && (
                      <div className="text-[10px] text-red-400 bg-red-400/5 p-2 rounded-xl border border-red-500/10 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" /> Cảnh cáo chuyên cần: Bạn có nguy cơ không đủ tư cách dự thi môn này do vắng vượt giới hạn!
                      </div>
                    )}
                  </div>
                );
              })}
              {myEnrollments.length === 0 && (
                <div className="col-span-2 text-center text-white/40 py-12">Không tìm thấy kế hoạch dữ liệu chuyên cần học phần.</div>
              )}
            </div>
          </div>
        )}

        {/* Tab SIS 4: Tuition manager and bills receivables payment histories */}
        {activeSubTab === "student_tuition" && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h4 className="text-base font-display font-bold text-white flex items-center gap-1.5">
                <DollarSign className="h-5 w-5 text-indigo-400" /> Bản kê khai học phí và nộp trực tuyến
              </h4>
              <p className="text-xs text-white/50">Hệ hạch học phí, thanh toán biên thu trực tiếp kết toán.</p>
            </div>

            {/* Tuition fee list */}
            <div className="space-y-4">
              {(store.tuitionFees || []).filter(f => f.studentId === currentUser.id).map(fee => {
                const remaining = fee.amount - fee.paidAmount;
                const isOverdue = new Date(fee.dueDate) < new Date() && fee.status !== "paid";

                return (
                  <div key={fee.id} className="bg-white/4 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest font-black">
                          Tháng: {fee.semesterId === "sem_spring25" ? "Spring 2025" : fee.semesterId}
                        </span>
                        <h5 className="font-bold text-white text-xs mt-1">Học phí đợt tuyển sinh và hoạt động lý thuyết học viện</h5>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono self-start sm:self-auto ${
                        fee.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        fee.status === "partial" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-red-500/10 text-red-500 border border-red-500/15"
                      }`}>
                        {fee.status === "paid" ? "Đã đóng đủ" :
                         fee.status === "partial" ? "Trả góp / Một phần" : "Chưa thanh toán"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-white/40 block">Tổng hóa đơn học phí</span>
                        <span className="font-bold text-white mt-0.5 text-sm">{fee.amount.toLocaleString()} VND</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Đã thanh toán hóa đơn</span>
                        <span className="font-bold text-emerald-400 mt-0.5 text-sm">{fee.paidAmount.toLocaleString()} VND</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Còn lại phải nộp</span>
                        <span className={`font-bold mt-0.5 text-sm ${remaining > 0 ? "text-red-400" : "text-white/60"}`}>{remaining.toLocaleString()} VND</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Hạn đóng quy định</span>
                        <span className="font-bold text-indigo-300 mt-0.5">{fmtDate(fee.dueDate)}</span>
                      </div>
                    </div>

                    {isOverdue && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[11px] leading-relaxed flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 animate-bounce" />
                        <span>Cảnh cáo: Tài khoản của bạn đã quá thời hạn đóng nợ học phí ({fee.dueDate}). Vui lòng hoàn tất giao dịch để duy trì tư cách dự thi học viện.</span>
                      </div>
                    )}

                    {/* QR Code trigger if unpaid remains */}
                    {fee.status !== "paid" && (
                      <div className="flex gap-4 items-center bg-black/25 p-4 rounded-xl border border-white/5 flex-col md:flex-row text-xs">
                        <div className="flex-1 space-y-1.5 text-xs text-white/70">
                          <p className="font-bold text-white font-sans text-xs">Cổng chuyển khoản nộp trực tuyến an toàn:</p>
                          <p className="leading-relaxed font-sans text-[11.5px]">Quét mã VietQR nộp trực tuyến dưới đây. Trạng thái sẽ được cập nhật sau khi bên xử lý thanh toán xác nhận giao dịch.</p>
                          <button
                            onClick={async () => {
                              const customAmountStr = window.prompt(`Tổng số dư nợ học phí còn lại là: ${remaining.toLocaleString()} VND.\nNhập số tiền bạn đã chuyển khoản để gửi xác nhận (VND):`, remaining.toString());
                              if (customAmountStr === null) return; // Người dùng ấn Hủy
                              const customAmount = Number(customAmountStr.replace(/[^0-9]/g, ""));
                              if (isNaN(customAmount) || customAmount <= 0) {
                                triggerToast("❗ Số tiền nhập không hợp lệ.");
                                return;
                              }
                              if (customAmount > remaining) {
                                triggerToast(`❗ Số tiền nộp không được lớn hơn dư nợ học phí còn lại (${remaining.toLocaleString()} VND).`);
                                return;
                              }
                              try {
                                await api.confirmTransfer({ feeId: fee.id, amount: customAmount });
                                triggerToast(`Gửi xác nhận chuyển khoản ${customAmount.toLocaleString()} VND thành công. Giao dịch đang chờ bên xử lý thanh toán xác nhận.`);
                                await onRefreshData();
                              } catch (err: any) {
                                console.error(err);
                                triggerToast("❗ Giao dịch thất bại: " + err.message);
                              }
                            }}
                            className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1 text-[11px] w-fit"
                          >
                            Tôi đã chuyển khoản (Giả lập test)
                          </button>
                        </div>
                        <div className="flex-shrink-0 p-3 bg-white rounded-xl border border-white/10 w-28 h-28 flex items-center justify-center">
                          <img
                            src={`https://img.vietqr.io/image/MB-099162438104-compact2.png?amount=${remaining}&addInfo=${encodeURIComponent(`MCNA HOCPHI ${fee.studentId}`)}&accountName=HOC%20VIEN%20CONG%20NGHE%20MCNA`}
                            alt="VietQR MB Bank MCNA"
                            className="w-24 h-24 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                                `MB Bank 099162438104 HOC VIEN CONG NGHE MCNA memo MCNA HOCPHI ${fee.studentId} remaining ${remaining}`
                              )}`;
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(store.tuitionFees || []).filter(f => f.studentId === currentUser.id).length === 0 && (
                <div className="text-center py-12 text-white/40">Chưa ghi nhận bất kỳ chứng từ nợ học vị nào quy định.</div>
              )}

              {/* Bảng Lịch sử giao dịch đóng tiền (Double check) */}
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-400" /> Nhật ký nộp học phí trực tuyến (Double check)
                    </h5>
                    <p className="text-[11px] text-white/50 leading-relaxed font-sans">
                      Danh sách các giao dịch đóng tiền bạn đã gửi lên hệ thống. Giao dịch ở trạng thái "Chờ xác nhận thanh toán" đang chờ bên xử lý thanh toán cập nhật kết quả.
                    </p>
                  </div>

                  {/* Transaction Search Input */}
                  <div className="relative max-w-xs w-full">
                    <input
                      type="text"
                      placeholder="Tìm mã GD, môn học..."
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
                    />
                    <span className="absolute left-2.5 top-1.5 text-white/40 text-xs">🔍</span>
                  </div>
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/15">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-white/50 font-mono tracking-wider font-bold">
                        <th className="p-3 text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("id")}>
                          Mã Giao dịch {txSortField === "id" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="p-3 text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("notes")}>
                          Nội dung học phí {txSortField === "notes" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="p-3 text-right text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("amount")}>
                          Số tiền nộp {txSortField === "amount" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="p-3 text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("paymentMethod")}>
                          Phương thức {txSortField === "paymentMethod" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="p-3 text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("createdAt")}>
                          Thời gian nộp {txSortField === "createdAt" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="p-3 text-right text-[10.5px] cursor-pointer select-none hover:text-white transition" onClick={() => handleTxSort("status")}>
                          Trạng thái thanh toán {txSortField === "status" ? (txSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/85">
                      {sortedTransactions.map(tx => {
                        const course = store.courses.find(c => c.id === tx.courseId);
                        return (
                          <tr key={tx.id} className="hover:bg-white/3 transition duration-150">
                            <td className="p-3 font-mono font-bold text-cyan-400">{tx.id}</td>
                            <td className="p-3 font-medium text-white">
                              <div className="flex items-center gap-2">
                                <span>{tx.notes && tx.notes.startsWith("tuition_fee_pay:") ? "Học phí tháng" : (course ? course.title : "Học phí")}</span>
                                {course && (
                                  <button
                                    onClick={() => setCourseDetailId(course.id)}
                                    className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-0.5 px-1.5 rounded flex items-center gap-0.5 transition cursor-pointer font-sans"
                                  >
                                    Xem 👁️
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{tx.amount.toLocaleString()} VND</td>
                            <td className="p-3 text-white/60">{tx.paymentMethod}</td>
                            <td className="p-3 text-white/50">{new Date(tx.createdAt).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">
                              {tx.status === "approved" && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">Thành công ✅</span>
                              )}
                              {tx.status === "pending" && (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">Chờ xác nhận thanh toán</span>
                              )}
                              {tx.status === "rejected" && (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold">Từ chối ❌</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-white/30 italic">Không tìm thấy giao dịch nào khớp với kết quả tìm kiếm.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab SIS 5: Official educational transcripts printable format requests */}
        {activeSubTab === "student_transcript" && (
          <div className="space-y-6 font-sans">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h4 className="text-base font-display font-bold text-white flex items-center gap-1.5">
                  <FileText className="h-5 w-5 text-indigo-400" /> Bảng điểm & Kết quả Học tập Học thuật (Official Transcript)
                </h4>
                <p className="text-xs text-white/50">Kết quả học tập được chứng nhận dấu đỏ số hóa của E16.</p>
              </div>
              <button
                onClick={() => setShowPrintTranscript(true)}
                className="px-4 py-2 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 text-xs"
              >
                <Printer className="h-4 w-4" /> In Học Bạ Dấu Đỏ
              </button>
            </div>

            {/* Transcript Table and cumulative scores calculations */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2 text-xs">
                <span className="font-mono text-cyan-400 font-bold">MÃ PROFILE: {myProfile.studentCode}</span>
                
                {/* Transcript Search Input */}
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    placeholder="Tìm theo môn học..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
                  />
                  <span className="absolute left-2.5 top-1.5 text-white/40 text-xs">🔍</span>
                </div>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                      <th className="py-2.5 cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("courseTitle")}>
                        Tên môn học giảng dạy {transcriptSortField === "courseTitle" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("credits")}>
                        Tín chỉ {transcriptSortField === "credits" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("midtermGrade")}>
                        Điểm thành phần (30%) {transcriptSortField === "midtermGrade" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("finalGrade")}>
                        Điểm thi final (70%) {transcriptSortField === "finalGrade" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("grade")}>
                        Điểm tổng kết (100) {transcriptSortField === "grade" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("scale4Val")}>
                        Hệ số GPA (4.0) {transcriptSortField === "scale4Val" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                      <th className="py-2.5 text-right cursor-pointer select-none hover:text-white transition" onClick={() => handleTranscriptSort("letterGrade")}>
                        Học bạ xếp loại {transcriptSortField === "letterGrade" ? (transcriptSortOrder === "asc" ? "▲" : "▼") : "↕"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-white/85">
                    {sortedUniqueCourseGrades.map(g => (
                      <tr key={g.courseId}>
                        <td className="py-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{g.course.title}</span>
                            <button
                              onClick={() => setCourseDetailId(g.courseId)}
                              className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-0.5 px-1.5 rounded flex items-center gap-0.5 transition cursor-pointer font-sans"
                            >
                              Xem 👁️
                            </button>
                          </div>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-indigo-300">{g.credits} Tín</td>
                        <td className="py-3 text-center font-mono font-bold text-sky-400">
                          {g.midtermGrade !== null ? g.midtermGrade : "-"}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-cyan-400">
                          {g.finalExamGrade !== null ? g.finalExamGrade : "-"}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-white font-sans">
                          {g.letterGrade === "IP" ? "-" : g.grade}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-amber-400">
                          {g.letterGrade === "IP" ? "-" : g.scale4Val.toFixed(1)}
                        </td>
                        <td className="py-3 text-right font-black font-mono">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] ${
                            g.letterGrade === "A" ? "bg-emerald-500/15 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30" :
                            g.letterGrade === "B" ? "bg-blue-500/15 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-500/20 dark:border-blue-500/30" :
                            g.letterGrade === "C" ? "bg-cyan-500/15 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border border-cyan-500/20 dark:border-cyan-500/30" :
                            g.letterGrade === "D" ? "bg-amber-500/15 dark:bg-yellow-950/40 text-amber-800 dark:text-yellow-300 border border-amber-500/20 dark:border-yellow-500/30" : 
                            g.letterGrade === "IP" ? "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50" :
                            "bg-red-500/15 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-500/20 dark:border-red-500/30"
                          }`}>
                            {g.letterGrade === "IP" ? "Đang học" : `Xếp loại ${g.letterGrade}`}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredUniqueCourseGrades.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-white/30 italic">Không tìm thấy kết quả phù hợp với từ khóa tìm kiếm.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-white/50">
                <span>Tổng số tín chỉ tích lũy: <strong className="text-white">{calculatedCredits} Tín</strong></span>
                <span>GPA Trung bình Tích Lũy cuối đợt: <strong className="text-amber-400 text-sm">{calculatedGpa.toFixed(2)}</strong></span>
              </div>
            </div>

            <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10 text-xs text-indigo-300 leading-relaxed font-sans">
              <p className="font-bold flex items-center gap-1"><HelpCircle className="h-4 w-4" /> Bản học bạ điện tử (E-Transcript):</p>
              <p className="mt-1 text-[11px]">Bản điểm điện tử này có giá trị xác nhận tương đương để tiếp đăng học lên các bậc học cao hơn của khối ngành liên thông quốc gia. Bất kỳ sự giả mạo dữ liệu can thiệp nào cũng đều bị lập biên của ban điều hành kiểm soát đào tạo.</p>
            </div>
          </div>
        )}
      {showPrintTranscript && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl p-8 relative shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none print:rounded-none">
            <button
              onClick={() => setShowPrintTranscript(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer print:hidden"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Standard letterhead of academic institute */}
            <div className="text-center space-y-2 border-b-2 border-slate-900 pb-4">
              <h3 className="text-sm font-serif font-black uppercase tracking-widest text-indigo-900">BỘ GIÁO DỤC VÀ ĐÀO TẠO • HỆ THỐNG PHÁT TRIỂN E16</h3>
              <h2 className="text-lg font-serif font-black uppercase tracking-tight text-slate-900">HỌC BẠ CHÍNH THỨC - BẢNG ĐIỂM HỌC TẬP</h2>
              <div className="text-[10px] text-slate-500 tracking-wider">Xác thực hệ thống điện tử khóa MB099162438104</div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-serif italic text-slate-800">
              <div>
                <span className="block font-bold">Họ và tên Học sinh: {currentUser.name}</span>
                <span className="block">Mã số định danh: {myProfile.studentCode}</span>
                <span className="block">Khoa chuyên môn: Công nghệ Phần mềm</span>
              </div>
              <div className="text-right">
                <span className="block font-bold">Ngày nhập học: {fmtDate(myProfile.enrollmentDate)}</span>
                <span className="block">Ngày in học bạ: {new Date().toLocaleDateString()}</span>
                <span className="block">Trạng thái: Hoạt động chính thức</span>
              </div>
            </div>

            {/* Detailed tabular statistics */}
            <div className="border border-slate-300 rounded-xl overflow-hidden mt-4 text-xs">
              <table className="w-full text-left border-collapse text-xs font-serif">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">Học vị môn học đề cương</th>
                    <th className="py-2.5 px-3 text-center">Tín chỉ</th>
                    <th className="py-2.5 px-3 text-center">Điểm thi thử (100)</th>
                    <th className="py-2.5 px-3 text-center">Hệ số GPA (4.0)</th>
                    <th className="py-2.5 px-3 text-right">Xếp Loại học bạ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {uniqueCourseGrades.map((g, i) => (
                    <tr key={i} className="text-slate-950">
                      <td className="py-2.5 px-3 font-semibold">{g.course.title}</td>
                      <td className="py-2.5 px-3 text-center">{g.credits} Tín</td>
                      <td className="py-2.5 px-3 text-center">{g.grade}</td>
                      <td className="py-2.5 px-3 text-center">{g.scale4Val.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">Xếp loại {g.letterGrade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center border-t border-slate-300 pt-4 font-serif text-xs">
              <span>Tổng số Tín chỉ Tích lũy: <strong>{calculatedCredits} Tín chỉ</strong></span>
              <span>Điểm trung bình GPA chung: <strong className="text-slate-900 text-sm font-mono font-black">{calculatedGpa.toFixed(2)}</strong></span>
            </div>

            {/* Simulated seal and signature stamp */}
            <div className="flex justify-between items-center pt-8 text-xs font-serif">
              <div className="text-center space-y-1 select-none">
                <span className="block font-bold">MỘC XÁC THỰC ĐIỆN TỬ</span>
                <div className="w-16 h-16 rounded-full border-4 border-double border-red-500/80 flex items-center justify-center text-red-500 font-serif font-black text-[9px] rotate-12 mx-auto uppercase">
                   ĐÃ ĐÓNG DẤU E16
                </div>
              </div>
              <div className="text-center space-y-1.5">
                <span className="block italic text-slate-500">Hà Nội, ngày cấp chứng tích</span>
                <span className="block font-bold">HỘI ĐỒNG TUYỂN SINH PHÒNG HỌC VỤ</span>
                <span className="block pt-8 font-sans font-black text-slate-400">E15 VIỆT NAM ĐÃ KÝ</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2 text-xs print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintTranscript(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Đóng học bạ
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1"
              >
                <Printer className="h-4.5 w-4.5" /> In Ngay Bây Giờ
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* Premium glassmorphic Course Details consultation modal */}
      {courseDetailId && (() => {
        const course = store.courses.find((c: any) => c.id === courseDetailId);
        if (!course) return null;
        const teacher = store.users.find((u: any) => u.id === course.teacherId) || { name: "Chưa phân công" };
        const lessons = store.lessons.filter((l: any) => l.courseId === course.id).sort((a: any, b: any) => a.order - b.order);
        const quizzes = store.quizzes.filter((q: any) => q.courseId === course.id);
        const assignments = store.assignments.filter((a: any) => a.courseId === course.id);
        const formatVND = (num: number) => {
          return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
        };
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto text-left">
            <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 text-white font-sans max-h-[85vh] overflow-y-auto flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex justify-between items-start border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                      {course.category}
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">{course.title}</h3>
                    <p className="text-xs text-white/40 mt-1">Giảng viên: <strong className="text-indigo-200">{teacher.name}</strong></p>
                  </div>
                  <button 
                    onClick={() => setCourseDetailId(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/50 cursor-pointer font-sans"
                  >
                    <span className="text-lg font-bold">✕</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-white/2 p-4 rounded-xl border border-white/5 font-sans">
                  <div>
                    <span className="text-white/45 block">Học phí:</span>
                    <strong className="text-sm font-mono text-emerald-400 font-black">{course.price ? formatVND(course.price) : "Miễn phí"}</strong>
                  </div>
                  <div>
                    <span className="text-white/45 block">Cấp trình độ:</span>
                    <strong className="text-indigo-300 capitalize">{course.level || "Cơ bản"}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] text-white/45 font-bold uppercase block">Mô tả khóa đào tạo:</span>
                  <p className="text-xs text-white/70 leading-relaxed bg-black/15 p-3 rounded-lg border border-white/5 font-sans">{course.description}</p>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] text-white/45 font-bold uppercase flex items-center gap-1 font-sans">
                    Khung chương trình ({lessons.length} bài học, {quizzes.length} bài thi{(() => {
                      const isPlaced = (store.courseRegistrations || []).some((r: any) => {
                        if (r.studentId !== currentUser.id || r.status !== "registered") return false;
                        const sec = (store.courseSections || []).find((s: any) => s.id === r.sectionId);
                        return sec && sec.courseId === course.id;
                      });
                      return isPlaced ? `, ${assignments.length} tự luận` : "";
                    })()})
                  </span>
                  
                  {lessons.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-sans">
                      {lessons.map((lesson: any, idx: number) => (
                        <div key={lesson.id} className="p-2.5 bg-white/3 border border-white/5 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-white/90">Bài {idx + 1}: {lesson.title}</span>
                          <span className="text-[10px] text-white/40 font-mono">{lesson.duration || "15 phút"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/35 italic font-sans">Chưa tải giáo trình bài giảng cho lớp học này.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 mt-5 flex justify-end">
                <button
                  onClick={() => setCourseDetailId(null)}
                  className="px-4 py-2 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-100 transition text-xs cursor-pointer font-sans"
                >
                  Đóng thông tin
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </>
  );
}
