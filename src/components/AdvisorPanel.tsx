import React, { useState, useEffect } from "react";
import { 
  Users, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  User as UserIcon, 
  MapPin, 
  Phone, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  Plus, 
  FileCheck,
  CheckCircle,
  HelpCircle,
  Share2,
  Bell
} from "lucide-react";
import { User, StudentProfile, AdvisorNote, AcademicWarning, Course, ProgramCourse, Semester, CourseSection } from "../types";
import { AppStore } from "../store";
import { generateId } from "../utils";
import { api } from "../api";
import { warningTypeLabel, normalizeWarningType } from "../gradeUtils";
import ModalPortal from "./ModalPortal";
import UserGuide from "./UserGuide";
import NotificationInbox from "./NotificationInbox";

interface AdvisorPanelProps {
  currentUser: User;
  onLogout: () => void;
  onRefreshData: () => void;
}

export default function AdvisorPanel({ currentUser, onLogout, onRefreshData }: AdvisorPanelProps) {
  const store = AppStore.get();
  
  // States
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(store.studentProfiles[0]?.userId || null);
  const [activeTab, setActiveTab] = useState<"students" | "warnings" | "notes" | "notifications" | "advisor_guide">("advisor_guide");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);
  const [noteType, setNoteType] = useState<"academic" | "behavioral" | "financial">("academic");
  const [noteContent, setNoteContent] = useState("");
  const [shareWithParent, setShareWithParent] = useState(true);
  const [suggestedPlanText, setSuggestedPlanText] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Find students assigned to this advisor
  const myAssignments = store.advisorAssignments?.filter(aa => aa.advisorId === currentUser.id) || [];
  const assignedStudentIds = myAssignments.map(aa => aa.studentId);
  
  // Filter core profiles
  const myStudents = store.studentProfiles.filter(profile => {
    const isAssigned = assignedStudentIds.includes(profile.userId);
    if (!isAssigned) return false;
    if (!studentSearch.trim()) return true;
    const u = store.users.find(usr => usr.id === profile.userId);
    const searchLower = studentSearch.toLowerCase();
    return (
      u?.name?.toLowerCase().includes(searchLower) ||
      profile.studentCode?.toLowerCase().includes(searchLower)
    );
  });
  
  // Selected Profile details
  const selectedProfile = store.studentProfiles.find(p => p.userId === selectedStudentId);
  const selectedUser = store.users.find(u => u.id === selectedStudentId);
  const selectedProgram = store.programs.find(p => p.id === selectedProfile?.programId);
  
  // Advisor notes for selected student
  const studentNotes = store.advisorNotes.filter(n => n.studentId === selectedStudentId);

  // Unresolved warnings for assigned students
  const assignedWarnings = store.academicWarnings.filter(w => assignedStudentIds.includes(w.studentId));
  const unresolvedWarnings = assignedWarnings.filter(w => !w.isResolved);

  // Statistics
  const totalStudentsCount = myStudents.length;
  const atRiskCount = myStudents.filter(p => p.gpa < 2.0 || unresolvedWarnings.some(w => w.studentId === p.userId)).length;
  const warningsCount = unresolvedWarnings.length;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !selectedStudentId) return;

    // Call backend API first to persist note in PostgreSQL database securely
    api.addAdvisorNote({
      studentId: selectedStudentId,
      type: noteType,
      content: noteContent.trim(),
      shareWithParent: shareWithParent
    }).then(() => {
      setNoteContent("");
      onRefreshData();
      showToast("Thêm nhận xét cố vấn thành công!");
      return;
    }).then((savedNote: any) => {
      if (!savedNote) return;
      const freshStore = AppStore.get();
      const newNote: AdvisorNote & { shareWithParent?: boolean } = {
        id: savedNote.id || generateId("adv_note"),
        advisorId: currentUser.id,
        studentId: selectedStudentId,
        content: noteContent.trim(),
        type: noteType,
        createdAt: savedNote.createdAt || new Date().toISOString(),
        shareWithParent: shareWithParent
      } as any;

      freshStore.advisorNotes.unshift(newNote);
      
      // Add audit log
      freshStore.auditLogs.unshift({
        id: generateId("log"),
        userId: currentUser.id,
        action: "add_advisor_note",
        target: "advisor_notes",
        detail: `Đã thêm nhận xét cố vấn loại ${noteType} cho sinh viên ${selectedUser?.name}`,
        createdAt: new Date().toISOString()
      });

      // Notify Student
      freshStore.notifications.unshift({
        id: generateId("note"),
        userId: selectedStudentId,
        type: "info",
        message: `Cố vấn học tập ${currentUser.name} vừa thêm nhận xét học tập mới cho bạn.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      // Notify Parent
      if (shareWithParent) {
        const parentUser = freshStore.users.find(u => (u.role as string) === "parent" && u.linkedStudentId === selectedStudentId);
        if (parentUser) {
          freshStore.notifications.unshift({
            id: generateId("note"),
            userId: parentUser.id,
            type: "info",
            message: `Cố vấn học tập đã chia sẻ nhận xét mới về tiến trình của con bạn: "${noteContent.slice(0, 50)}..."`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      AppStore.save(freshStore);
      setNoteContent("");
      onRefreshData();
      showToast("Thêm nhận xét cố vấn thành công!");
    }).catch(err => {
      console.error("Failed to add advisor note:", err);
      showToast("❗ Thêm nhận xét thất bại: " + err.message);
    });
  };

  const handleSaveSuggestedPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    const freshStore = AppStore.get();
    const profile = freshStore.studentProfiles.find(p => p.userId === selectedStudentId);
    if (profile) {
      const updatedNotes = (profile.notes || "") + `\n[Kế hoạch đề xuất đăng ký kì tới]: ${suggestedPlanText}`;
      
      // Call backend API to persist notes in PostgreSQL securely
      api.updateStudentNotes(selectedStudentId, updatedNotes).then(() => {
        setSuggestedPlanText("");
        onRefreshData();
        showToast("Đã lưu kế hoạch đăng ký đề xuất!");
        return;

        // Save semester suggested plan in profile notes locally
        profile.notes = updatedNotes;
        
        freshStore.auditLogs.unshift({
          id: generateId("log"),
          userId: currentUser.id,
          action: "save_semester_plan",
          target: "student_profiles",
          detail: `Đã cập nhật kế hoạch đăng ký lớp đề xuất cho sinh viên ${selectedUser?.name}`,
          createdAt: new Date().toISOString()
        });

        freshStore.notifications.unshift({
          id: generateId("note"),
          userId: selectedStudentId,
          type: "success",
          message: `Kế hoạch đề xuất kì tới đã được cố vấn ${currentUser.name} phê duyệt. Hãy kiểm tra tại trang đăng ký môn.`,
          isRead: false,
          createdAt: new Date().toISOString()
        });

        AppStore.save(freshStore);
        setSuggestedPlanText("");
        onRefreshData();
        showToast("Đã lưu kế hoạch đăng ký đề xuất!");
      }).catch(err => {
        console.error("Failed to save suggested plan:", err);
        showToast("❗ Lưu kế hoạch thất bại: " + err.message);
      });
    }
  };

  const handleResolveWarning = (warningId: string) => {
    api.resolveWarning(warningId)
      .then(() => {
        onRefreshData();
        showToast("Xử lý cảnh báo học tập thành công!");
      })
      .catch((err: Error) => showToast(err.message || "Không thể giải quyết cảnh báo."));
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#10b981] text-white py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-2 border border-white/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="h-5 w-5" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Bàn Làm Việc Cố Vấn Học Tập</h2>
          <p className="text-xs text-white/50 mt-1">Theo dõi, định hướng học tập, xử lý cảnh báo chuyên cần & thiết lập lộ trình cho sinh viên.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === "advisor_guide" ? "students" : "advisor_guide")}
            className={`text-[11px] font-bold py-1 px-3 rounded-full transition cursor-pointer border ${
              activeTab === "advisor_guide"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {activeTab === "advisor_guide" ? "✕ Đóng Hướng dẫn" : "📖 Hướng dẫn nghiệp vụ"}
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`text-[11px] font-bold py-1 px-3 rounded-full transition cursor-pointer border inline-flex items-center gap-1.5 ${
              activeTab === "notifications"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            Hộp thư
          </button>
          <span className="text-[11px] font-mono bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 py-1 px-3 rounded-full">
            Cố vấn: Lớp Kỹ thuật Phần mềm
          </span>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-white/45 block uppercase tracking-wider">Tổng Sinh Viên Phụ Trách</span>
            <span className="text-2xl font-black text-white mt-1 block">{totalStudentsCount} SV</span>
          </div>
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-white/45 block uppercase tracking-wider">Sinh Viên Cần Hỗ Trợ Học Tập</span>
            <span className="text-2xl font-black text-red-400 mt-1 block">{atRiskCount} SV</span>
          </div>
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-white/45 block uppercase tracking-wider">Cảnh Báo Chưa Giải Quyết</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{warningsCount} vụ</span>
          </div>
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Roster & Tabs view split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: assigned Student list */}
        <div className="lg:col-span-4 bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Danh Sách Sinh Viên Đảm Nhận</h3>
            <p className="text-[10px] text-white/40 mt-0.5">Chọn sinh viên bên dưới để kiểm tra tiến trình, học bạ chi tiết</p>
          </div>

          {/* Student Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm sinh viên, mã số..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-2 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
            />
            <span className="absolute left-2.5 top-2 px-1 text-white/40 text-xs">🔍</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {myStudents.map(student => {
              const u = store.users.find(usr => usr.id === student.userId);
              const isSelected = selectedStudentId === student.userId;
              const hasAlert = unresolvedWarnings.some(w => w.studentId === student.userId);

              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.userId)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition group cursor-pointer ${
                    isSelected 
                      ? "bg-indigo-600/20 border-indigo-500 text-white" 
                      : "bg-black/20 border-white/5 text-white/75 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold block truncate">{u?.name || "Không xác định"}</span>
                      {hasAlert && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-white/40 block mt-0.5">{student.studentCode} | GPA: {student.gpa.toFixed(2)}</span>
                  </div>
                  <UserIcon className={`h-4 w-4 ${isSelected ? "text-indigo-400" : "text-white/20 group-hover:text-white/40"}`} />
                </button>
              );
            })}

            {myStudents.length === 0 && (
              <p className="text-xs text-white/30 text-center py-6">Không có sinh viên nào được cố vấn trực tiếp tháng này.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          
          {activeTab === "notifications" ? (
            <NotificationInbox
              store={store}
              currentUser={currentUser}
              onRefreshData={onRefreshData}
            />
          ) : activeTab === "advisor_guide" ? (
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6">
              <UserGuide role="advisor" activeSystem="SIS" onClose={() => setActiveTab("students")} />
            </div>
          ) : selectedProfile && selectedUser ? (
            <div className="space-y-6">
              
              {/* Profile Card Header */}
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <UserIcon className="h-32 w-32 text-white" />
                </div>

                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                  <div className="w-16 h-16 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center text-indigo-400 font-bold text-xl uppercase">
                    {selectedUser.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {selectedUser.name}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        selectedProfile.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        selectedProfile.status === "suspended" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-white/10 text-white/60"
                      }`}>
                        {selectedProfile.status === "active" ? "Đang Học" : "Bảo Lưu/Kỷ Luật"}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 mt-2 gap-x-4 gap-y-1 text-xs text-white/65">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-indigo-400" />
                        <span className="truncate">{selectedProfile.address || "Chưa thiết lập địa chỉ"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-indigo-400" />
                        <span>{selectedProfile.phone || "Chưa cập nhật"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-indigo-400" />
                        <span>Sinh: {selectedProfile.dateOfBirth || "Chưa cập nhật"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3 w-3 text-indigo-400" />
                        <span className="truncate">Ngành: {selectedProgram?.name || "Không xác định"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub tabs configuration */}
              <div className="flex border-b border-white/5 space-x-6 text-xs">
                <button
                  onClick={() => setActiveTab("students")}
                  className={`pb-3 font-semibold transition cursor-pointer ${activeTab === "students" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-white/50 hover:text-white"}`}
                >
                  Tiến Trình & Cảnh Báo
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`pb-3 font-semibold transition cursor-pointer ${activeTab === "notes" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-white/50 hover:text-white"}`}
                >
                  Nhật Ký Tư Vấn & Đề Xuất Lộ Trình ({studentNotes.length})
                </button>
              </div>

              {/* TAB 1: Progress, Academic warnings resolving, Course sections Audit */}
              {activeTab === "students" && (
                <div className="space-y-6">
                  
                  {/* Warnings resolving desk */}
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">Phiếu Cảnh Báo Học Tập Hiện Hành</span>
                      <span className="text-[10px] text-white/30 font-mono">Dữ liệu thời gian thực</span>
                    </div>

                    <div className="space-y-3">
                      {store.academicWarnings.filter(w => w.studentId === selectedStudentId).map(warning => (
                        <div key={warning.id} className="p-4 bg-black/25 rounded-xl border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                normalizeWarningType(warning.type) === "low_attendance" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                              }`}>
                                Cảnh báo {warningTypeLabel(warning.type)}
                              </span>
                              {warning.courseId && (() => {
                                const course = store.courses.find(c => c.id === warning.courseId);
                                return course ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                                    Môn học: {course.title}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-slate-800 dark:text-white/75">{warning.message}</p>
                            <span className="text-[10px] text-slate-400 dark:text-white/30 block font-mono">Thời gian phát hiện: {new Date(warning.createdAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                          {!warning.isResolved ? (
                            <button
                              onClick={() => handleResolveWarning(warning.id)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white rounded-lg transition shrink-0 cursor-pointer"
                            >
                              Đánh dấu đã giải quyết
                            </button>
                          ) : (
                            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 shrink-0"><CheckCircle className="h-4 w-4" /> Đã xử lý xong</span>
                          )}
                        </div>
                      ))}

                      {store.academicWarnings.filter(w => w.studentId === selectedStudentId).length === 0 && (
                        <p className="text-xs text-white/40 text-center py-4">Sinh viên đang có trạng thái an toàn, không có cảnh báo học tập nào.</p>
                      )}
                    </div>
                  </div>

                  {/* Program Curriculum Check */}
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">Bản Đồ Học Phần Chương Trình Đào Tạo</span>
                      <span className="text-xs text-white/50 font-bold font-mono">Đã đạt: {selectedProfile.totalCreditsEarned}/120 tín chỉ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {store.programCourses.filter(pc => pc.programId === selectedProfile.programId).map(pc => {
                        const matchedCourse = store.courses.find(c => c.id === pc.courseId);
                        const enrollment = store.enrollments.find(e => e.studentId === selectedStudentId && e.courseId === pc.courseId);
                        
                        let statusColor = "text-white/40 border-white/5 bg-black/10";
                        let statusText = "Chưa học";
                        if (enrollment) {
                          if (enrollment.status === "completed") {
                            statusColor = "text-emerald-800 dark:text-emerald-300 border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40";
                            statusText = "Đã hoàn thành";
                          } else if (enrollment.status === "active") {
                            statusColor = "text-amber-800 dark:text-yellow-300 border-amber-500/20 dark:border-yellow-500/30 bg-amber-500/10 dark:bg-yellow-950/40";
                            statusText = "Đang tiến hành";
                          } else {
                            statusColor = "text-red-800 dark:text-red-300 border-red-500/20 dark:border-red-500/30 bg-red-500/10 dark:bg-red-950/40";
                            statusText = "Đã hủy";
                          }
                        }

                        return (
                          <div key={pc.id} className={`p-3 rounded-xl border flex justify-between items-center ${statusColor}`}>
                            <div className="min-w-0 pr-2 flex-1">
                              <span className="font-bold flex items-center gap-1.5 truncate">
                                {matchedCourse?.title || "Không xác định"}
                                {matchedCourse && (
                                  <button
                                    onClick={() => setCourseDetailId(matchedCourse.id)}
                                    className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-0.5 px-1.5 rounded flex items-center gap-0.5 transition cursor-pointer font-sans"
                                  >
                                    Xem 👁️
                                  </button>
                                )}
                              </span>
                              <span className="text-[10px] text-white/40 mt-0.5 block">{pc.credits} tín chỉ | Kỳ {pc.semester} | {pc.isRequired ? "Bắt buộc" : "Tự chọn"}</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider shrink-0">{statusText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: Notes writing & Suggested semester enrollment rules  */}
              {activeTab === "notes" && (
                <div className="space-y-6">
                  
                  {/* Advisor Notes creation */}
                  <form onSubmit={handleAddNote} className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/5 pb-2">
                      Ghi nhận xét cố vấn mới
                    </span>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="text-white/60 font-semibold block">Phân loại nhận xét</label>
                        <select
                          value={noteType}
                          onChange={(e) => setNoteType(e.target.value as any)}
                          className="w-full bg-black/25 text-white border border-white/10 rounded-xl p-2.5 outline-none"
                        >
                          <option value="academic">Nhận xét học tập</option>
                          <option value="behavioral">Nhận xét hành vi/kỉ luật</option>
                          <option value="financial">Vấn đề tài chính/học bổng</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="shareInput"
                          checked={shareWithParent}
                          onChange={(e) => setShareWithParent(e.target.checked)}
                          className="rounded border-white/10 bg-black/25 text-indigo-600 focus:ring-0"
                        />
                        <label htmlFor="shareInput" className="text-white/70 font-semibold text-xs select-none cursor-pointer flex items-center gap-1">
                          <Share2 className="h-3 w-3 text-indigo-400" /> Chia sẻ dữ liệu với Phụ Huynh
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <label className="text-white/60 font-semibold block">Nội dung tư vấn chi tiết</label>
                      <textarea
                        required
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Ví dụ: Đã gặp trực tiếp sinh viên trao đổi về học tập kì mới. Đề xuất sinh viên đăng ký học lại môn Core HTTP..."
                        className="w-full h-24 bg-black/25 text-white border border-white/10 rounded-xl p-3 outline-none focus:border-indigo-400 placeholder-white/20 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition cursor-pointer"
                    >
                      Lưu và gửi thông báo
                    </button>
                  </form>

                  {/* Next Semester suggestions planer form */}
                  <form onSubmit={handleSaveSuggestedPlan} className="bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/5 pb-2">
                      Đề xuất đăng ký môn học kì tới (Kế hoạch học tập)
                    </span>
                    <p className="text-[10px] text-white/50">Các nhận xét, lộ trình đề cử sẽ xuất hiện trực tiếp tại giao diện đăng ký học phần kì tới của sinh viên.</p>

                    <div className="space-y-2 text-xs">
                      <label className="text-white/60 font-semibold block">Môn học đề xuất / Mã lớp học phần</label>
                      <textarea
                        required
                        value={suggestedPlanText}
                        onChange={(e) => setSuggestedPlanText(e.target.value)}
                        placeholder="Nhập kí hiệu các lớp đề xuất học (Ví dụ: Khuyên đăng ký CS101-01 vào Thứ Hai, không trùng lịch; tập trung bù điểm Python... )"
                        className="w-full h-20 bg-black/25 text-white border border-white/10 rounded-xl p-3 outline-none focus:border-indigo-400 placeholder-white/20 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition cursor-pointer"
                    >
                      Xác nhận Kế hoạch đăng ký
                    </button>
                  </form>

                  {/* Notes Timeline List */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest block">Lịch sử biểu mẫu tư vấn</span>
                    
                    {studentNotes.map(note => (
                      <div key={note.id} className="bg-slate-900 p-4 border border-white/5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            note.type === "academic" ? "bg-blue-500/10 text-blue-400" :
                            note.type === "behavioral" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {note.type === "academic" ? "Học tập" :
                             note.type === "behavioral" ? "Hành vi/kỉ luật" : "Tài chính"}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono">{new Date(note.createdAt).toLocaleString("vi-VN")}</span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed font-sans">{note.content}</p>
                        
                        {(note as any).shareWithParent && (
                          <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-0.5"><Share2 className="h-2.5 w-2.5" /> Đã chia sẻ với phụ huynh</span>
                        )}
                      </div>
                    ))}

                    {studentNotes.length === 0 && (
                      <p className="text-xs text-white/30 text-center py-4">Chưa có nhật ký ghi chép cố vấn nào cho sinh viên này.</p>
                    )}
                  </div>

                </div>
              )}

            </div>
          ) : (
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-10 text-center text-white/40 font-sans">
              <UserIcon className="h-12 w-12 text-white/10 mx-auto mb-3" />
              <p className="text-xs">Vui lòng chọn một học viên từ danh sách bên trái để kiểm tra chi tiết học bạ & thực hiện tư vấn lý lịch học tập.</p>
            </div>
          )}
        </div>
      </div>

      {/* Premium glassmorphic Course Details consultation modal */}
      {courseDetailId && (() => {
        const course = store.courses.find(c => c.id === courseDetailId);
        if (!course) return null;
        const teacher = store.users.find(u => u.id === course.teacherId) || { name: "Chưa phân công" };
        const lessons = store.lessons.filter(l => l.courseId === course.id).sort((a,b) => a.order - b.order);
        const quizzes = store.quizzes.filter(q => q.courseId === course.id);
        const assignments = store.assignments.filter(a => a.courseId === course.id);
        const formatVND = (num: number) => {
          return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
        };
        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
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
                    Khung chương trình ({lessons.length} bài học, {quizzes.length} bài thi, {assignments.length} tự luận)
                  </span>
                  
                  {lessons.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-sans">
                      {lessons.map((lesson, idx) => (
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
    </div>
  );
}
