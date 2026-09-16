import React, { useState, useEffect } from "react";
import { 
  Users, 
  Calendar, 
  Plus, 
  Check, 
  X, 
  ShieldAlert, 
  Activity, 
  BookOpen,
  PlusCircle,
  FolderSync
} from "lucide-react";
import { LMSDataStore, Course, User, AttendanceSession, AttendanceRecord } from "../types";
import { AppStore } from "../store";
import { api } from "../api";
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_LABEL } from "../utils";
import SessionMaterialsEditor from "./SessionMaterialsEditor";
import ModalPortal from "./ModalPortal";

interface SearchableSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[200px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-2.5 bg-white text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-sans transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 h-[38px] shadow-sm hover:border-slate-400"
      >
        <span className="truncate font-medium">
          {selectedOption ? (
            `${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ""}`
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <span className="text-slate-400 text-[10px]">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <input
              type="text"
              autoFocus
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-xs font-sans"
            />
          </div>
          <div className="overflow-y-auto max-h-48 divide-y divide-slate-100">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 transition flex flex-col gap-0.5 ${
                    opt.id === value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700"
                  }`}
                >
                  <span className="truncate font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="text-[10px] text-slate-400 truncate">{opt.sublabel}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-slate-400 italic text-center font-sans">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


interface AttendanceManagerProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
  triggerToast: (msg: string) => void;
  defaultCourseId?: string;
  defaultSessionId?: string;
  defaultSessionTopic?: string;
  lockSelectors?: boolean;
  courseId?: string | null;
  sectionId?: string | null;
  onGoBackToTimetable?: () => void;
}

export default function AttendanceManager({
  store,
  currentUser,
  onRefreshData,
  triggerToast,
  defaultCourseId,
  defaultSessionId = "",
  defaultSessionTopic = "",
  lockSelectors = false,
  courseId = null,
  sectionId = null,
  onGoBackToTimetable
}: AttendanceManagerProps) {
  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || defaultCourseId || "");
  const [selectedSectionId, setSelectedSectionId] = useState(sectionId || "");
  // Session selection (or create new)
  const [activeSessionId, setActiveSessionId] = useState(defaultSessionId || "");

  // Sync locked values if they change
  useEffect(() => {
    if (lockSelectors) {
      if (courseId) setSelectedCourseId(courseId);
      if (sectionId) setSelectedSectionId(sectionId);
    }
  }, [lockSelectors, courseId, sectionId]);

  useEffect(() => {
    setActiveSessionId(defaultSessionId);
    if (defaultSessionId) {
      const session = (store.attendanceSessions || []).find(s => s.id === defaultSessionId);
      if (session) {
        if (session.courseId) setSelectedCourseId(session.courseId);
        if (session.sectionId) setSelectedSectionId(session.sectionId);
      }
    }
  }, [defaultSessionId, store.attendanceSessions]);

  useEffect(() => {
    setNewSessionTopic(defaultSessionTopic);
  }, [defaultSessionTopic]);

  // Auto-select latest session if locked and no session is active yet
  useEffect(() => {
    if (defaultSessionTopic && !defaultSessionId) return;
    if (lockSelectors && selectedCourseId && selectedSectionId && !activeSessionId) {
      const classSessions = (store.attendanceSessions || []).filter(s =>
        s.courseId === selectedCourseId && s.sectionId === selectedSectionId
      );
      if (classSessions.length > 0) {
        setActiveSessionId(classSessions[classSessions.length - 1].id);
      }
    }
  }, [lockSelectors, selectedCourseId, selectedSectionId, activeSessionId, store.attendanceSessions, defaultSessionTopic, defaultSessionId]);

  // Sorting state for nonCompliantCourses
  const [complianceSortField, setComplianceSortField] = useState<string>("courseTitle");
  const [complianceSortOrder, setComplianceSortOrder] = useState<"asc" | "desc">("asc");
  const [complianceTab, setComplianceTab] = useState<"students" | "teachers">("students");

  // Sorting state for courseStudents
  const [studentSortField, setStudentSortField] = useState<string>("studentCode");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");

  const handleComplianceSort = (field: string) => {
    if (complianceSortField === field) {
      setComplianceSortOrder(complianceSortOrder === "asc" ? "desc" : "asc");
    } else {
      setComplianceSortField(field);
      setComplianceSortOrder("asc");
    }
  };

  const handleStudentSort = (field: string) => {
    if (studentSortField === field) {
      setStudentSortOrder(studentSortOrder === "asc" ? "desc" : "asc");
    } else {
      setStudentSortField(field);
      setStudentSortOrder("asc");
    }
  };

  // New session creation fields
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [complianceSearch, setComplianceSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTopic, setNewSessionTopic] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("09:00 - 11:30");
  const [checkinMethod, setCheckinMethod] = useState<"manual" | "link">("manual");

  // Edit session fields
  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [editTopic, setEditTopic] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editRecordingUrl, setEditRecordingUrl] = useState("");
  const [editDate, setEditDate] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  const allCourses = store.courses || [];
  const courses = currentUser.role === "teacher"
    ? allCourses.filter(c => c.teacherId === currentUser.id)
    : allCourses;
  const enrollments = store.enrollments || [];

  const courseSections = (store.courseSections || []).filter((s: any) => s.courseId === selectedCourseId && s.status !== "cancelled");
  // Sessions for chosen course/section
  const sessions = (store.attendanceSessions || []).filter(s => (
    s.courseId === selectedCourseId && (!selectedSectionId || s.sectionId === selectedSectionId)
  ));
  // Enrolled students in chosen course/section
  const courseEnrollments = selectedSectionId
    ? (store.courseRegistrations || [])
        .filter((r: any) => r.sectionId === selectedSectionId && r.status === "registered")
        .map((r: any) => ({ courseId: selectedCourseId, studentId: r.studentId, status: "active" }))
    : [];
  const courseStudents = courseEnrollments.map(enroll => {
    const usr = store.users.find(u => u.id === enroll.studentId) || { name: "Học viên", id: enroll.studentId, email: "" };
    return {
      userId: usr.id,
      name: usr.name,
      studentCode: (usr as any).email || usr.id
    };
  }).filter(st => {
    return !studentSearch ||
      st.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.studentCode.toLowerCase().includes(studentSearch.toLowerCase());
  });

  const sortedCourseStudents = [...courseStudents].sort((a, b) => {
    if (!studentSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    if (studentSortField === "studentCode") {
      valA = a.studentCode || "";
      valB = b.studentCode || "";
    } else if (studentSortField === "name") {
      valA = a.name || "";
      valB = b.name || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return studentSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return studentSortOrder === "asc" ? valA - valB : valB - valA;
  });

  // Load records for active session
  const activeRecords = (store.attendanceRecords || []).filter(r => r.sessionId === activeSessionId);

  // New Session submit
  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      triggerToast("Vui lòng chọn môn học trước khi lập buổi điểm danh.");
      return;
    }
    if (!selectedSectionId) {
      triggerToast("Vui lòng chọn lớp học phần trước khi lập buổi điểm danh.");
      return;
    }
    if (checkinMethod === "manual" && !newSessionDate) {
      triggerToast("Hãy nhập ngày tháng cho buổi điểm danh.");
      return;
    }
    if (!newSessionTopic.trim()) {
      triggerToast("Hãy nhập chủ đề/đề tài giảng dạy cho buổi điểm danh.");
      return;
    }

    try {
      if (checkinMethod === "link") {
        const result = await api.generateAttendanceLink({
          courseId: selectedCourseId,
          sectionId: selectedSectionId,
          topic: newSessionTopic.trim()
        });
        setNewSessionDate("");
        setNewSessionTopic("");
        setNewSessionTime("09:00 - 11:30");
        setCheckinMethod("manual");
        setShowCreateSession(false);
        setActiveSessionId(result.session.id);
        onRefreshData();
        triggerToast(`Đã gửi link điểm danh tự động 5 phút tới cả lớp! Mã Code: ${result.code}`);
      } else {
        const combinedDate = newSessionTime.trim() ? `${newSessionDate} (${newSessionTime.trim()})` : newSessionDate;
        const result = await api.saveAttendance({
          courseId: selectedCourseId,
          sectionId: selectedSectionId,
          date: combinedDate,
          topic: newSessionTopic.trim(),
          records: courseEnrollments.map(enroll => ({ studentId: enroll.studentId, status: "present" }))
        }) as any;
        setNewSessionDate("");
        setNewSessionTopic("");
        setNewSessionTime("09:00 - 11:30");
        setShowCreateSession(false);
        setActiveSessionId(result.session.id);
        onRefreshData();
        triggerToast("Đã khởi tạo buổi điểm danh môn học mới thành công.");
      }
    } catch (err: any) {
      triggerToast(err.message || "Không thể khởi tạo.");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size >= MAX_UPLOAD_FILE_BYTES) {
      triggerToast(`Video bài giảng phải nhỏ hơn ${MAX_UPLOAD_FILE_LABEL}.`);
      e.target.value = "";
      return;
    }
    setUploadingVideo(true);
    try {
      const res = await api.uploadFile(file);
      setEditVideoUrl(res.url);
      triggerToast("Tải video lên thành công!");
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Tải video lên thất bại.");
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const handleEditSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId) return;
    setIsUpdatingSession(true);
    try {
      await api.updateAttendanceSession(activeSessionId, {
        topic: editTopic,
        content: editContent,
        videoUrl: editVideoUrl,
        recordingUrl: editRecordingUrl.trim() || undefined,
        date: editDate.trim() || undefined
      });
      triggerToast("Cập nhật thông tin buổi học thành công!");
      setShowEditSessionModal(false);
      onRefreshData();
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Cập nhật thất bại. Vui lòng thử lại.");
    } finally {
      setIsUpdatingSession(false);
    }
  };

  // Modify Record Status per student
  const handleMarkStatusChange = async (studentId: string, status: "present" | "absent" | "late" | "excused") => {
    if (!activeSessionId) return;
    try {
      await api.updateAttendanceRecord({ sessionId: activeSessionId, studentId, status });
      onRefreshData();
    } catch (err: any) {
      triggerToast(err.message || "Không thể cập nhật điểm danh.");
    }
  };

  // Pre-calculate presence rates for display in list
  const getStudentPresenceRate = (studentId: string) => {
    const pastSessions = sessions.filter(s => new Date(s.date).getTime() <= Date.now());
    const sessionsCount = pastSessions.length;
    if (sessionsCount === 0) return 100;
    
    const records = (store.attendanceRecords || []).filter(r => 
      r.studentId === studentId && 
      pastSessions.some(s => s.id === r.sessionId)
    );
    const presentRecords = records.filter(r => r.status === "present" || r.status === "late" || r.status === "excused").length;
    return Math.round((presentRecords / sessionsCount) * 100);
  };

  // Compliance checking: courses with zero attendance sessions
  const nonCompliantCourses = courses.filter(c => {
    const courseSessions = (store.attendanceSessions || []).filter(s => s.courseId === c.id);
    const matchesSearch = !complianceSearch ||
      c.title.toLowerCase().includes(complianceSearch.toLowerCase()) ||
      (store.users.find(u => u.id === c.teacherId)?.name || "").toLowerCase().includes(complianceSearch.toLowerCase());
    return courseSessions.length === 0 && matchesSearch;
  });

  const sortedNonCompliantCourses = [...nonCompliantCourses].sort((a, b) => {
    if (!complianceSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    if (complianceSortField === "courseTitle") {
      valA = a.title || "";
      valB = b.title || "";
    } else if (complianceSortField === "teacherName") {
      valA = store.users.find(u => u.id === a.teacherId)?.name || "";
      valB = store.users.find(u => u.id === b.teacherId)?.name || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return complianceSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return complianceSortOrder === "asc" ? valA - valB : valB - valA;
  });

  return (
    <div className="space-y-6">
      {lockSelectors && onGoBackToTimetable && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-semibold text-indigo-200 font-sans">
              Đang mở chế độ Điểm danh học viên từ Thời khóa biểu. Lọc chọn lớp/môn học đã khóa để tránh sai lệch.
            </span>
          </div>
          <button
            onClick={onGoBackToTimetable}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition duration-150 cursor-pointer text-xs flex items-center gap-1 shadow-lg shadow-indigo-600/10 border border-indigo-500/20"
          >
            ← Quay lại Thời khóa biểu
          </button>
        </div>
      )}

      {/* Giám sát tuân thủ điểm danh giảng viên (Học vụ & Admin) */}
      {currentUser.role === "admin" && (
        <div className="bg-white/4 border border-white/5 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 border-b border-white/10 gap-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-400" /> Giám sát tuân thủ giảng dạy & Điểm danh
            </h4>
            <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setComplianceTab("students")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  complianceTab === "students" ? "bg-white/10 text-white border border-white/15" : "text-white/40 hover:text-white"
                }`}
              >
                Học viên chưa điểm danh ({nonCompliantCourses.length})
              </button>
              <button
                onClick={() => setComplianceTab("teachers")}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  complianceTab === "teachers" ? "bg-white/10 text-white border border-white/15" : "text-white/40 hover:text-white"
                }`}
              >
                Giảng viên lên lớp ({(store.teacherAttendance || []).length})
              </button>
            </div>
          </div>

          {complianceTab === "students" ? (
            nonCompliantCourses.length > 0 ? (
              <div className="space-y-3">
                {/* Search bar */}
                <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs max-w-sm font-sans">
                  <input
                    type="text"
                    placeholder="Tìm môn học chưa điểm danh..."
                    value={complianceSearch}
                    onChange={(e) => setComplianceSearch(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                        <th className="py-2.5 cursor-pointer select-none hover:text-white transition" onClick={() => handleComplianceSort("courseTitle")}>
                          Tên môn học {complianceSortField === "courseTitle" ? (complianceSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="py-2.5 cursor-pointer select-none hover:text-white transition" onClick={() => handleComplianceSort("teacherName")}>
                          Giảng viên phụ trách {complianceSortField === "teacherName" ? (complianceSortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </th>
                        <th className="py-2.5 text-center">Trạng thái</th>
                        <th className="py-2.5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/85">
                      {sortedNonCompliantCourses.map(course => {
                        const teacher = store.users.find(u => u.id === course.teacherId) || { name: "Chưa phân công", email: "" };
                        return (
                          <tr key={course.id}>
                            <td className="py-3 font-bold text-white">
                              <div className="flex items-center gap-1.5">
                                <span>{course.title} ({course.id})</span>
                                <button
                                  onClick={() => setCourseDetailId(course.id)}
                                  className="px-1.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer font-sans"
                                >
                                  Xem 👁️
                                </button>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-white/95">{teacher.name}</div>
                              <div className="text-[10px] text-white/40">{teacher.email || "Chưa cập nhật"}</div>
                            </td>
                            <td className="py-3 text-center">
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                Chưa Điểm Danh ❌
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={async () => {
                                  if (!course.teacherId) {
                                    triggerToast("Môn học này chưa được phân công giảng viên!");
                                    return;
                                  }
                                  try {
                                    await api.warnTeacher({ courseId: course.id, teacherId: course.teacherId });
                                    triggerToast(`Đã bắn mail và hệ thống cảnh cáo tới giảng viên ${teacher.name}! 📧`);
                                    onRefreshData();
                                  } catch (err: any) {
                                    triggerToast(err.message || "Không thể gửi cảnh cáo.");
                                  }
                                }}
                                className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/30 text-rose-300 font-bold rounded-lg transition cursor-pointer text-[11px]"
                              >
                                Bắn mail Cảnh cáo 📧
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-400 font-semibold italic">100% Giảng viên đã thực hiện điểm danh đầy đủ cho các lớp học phần! 🎉</p>
            )
          ) : (
            /* Teacher Attendance history list */
            <div>
              {(!store.teacherAttendance || store.teacherAttendance.length === 0) ? (
                <p className="text-xs text-white/40 italic py-4">Chưa có giảng viên nào ghi nhận hoạt động lên lớp.</p>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                        <th className="py-2.5">Giảng viên</th>
                        <th className="py-2.5">Môn học</th>
                        <th className="py-2.5">Ca học</th>
                        <th className="py-2.5">Ngày dạy</th>
                        <th className="py-2.5">Thời điểm điểm danh</th>
                        <th className="py-2.5 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/85">
                      {(store.teacherAttendance || []).map((ta: any) => {
                        const teacher = store.users.find(u => u.id === ta.teacherId) || { name: ta.teacherId, email: "" };
                        const course = store.courses.find(c => c.id === ta.courseId) || { title: ta.courseId };
                        return (
                          <tr key={ta.id}>
                            <td className="py-3 font-semibold text-white">{teacher.name}</td>
                            <td className="py-3 text-white/70">{course.title}</td>
                            <td className="py-3 font-mono">{ta.slotTime}</td>
                            <td className="py-3 font-mono">{ta.classDate}</td>
                            <td className="py-3 font-mono text-white/40">{new Date(ta.checkedInAt).toLocaleTimeString("vi-VN")}</td>
                            <td className="py-3 text-right">
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                Lên lớp Đúng giờ ✅
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Course & Session selectors */}
      <div className="bg-slate-950/30 backdrop-blur-md border border-white/10 p-5 rounded-3xl text-xs shadow-xl transition-all duration-200">
        {lockSelectors ? (
          <div className="space-y-3">
            {(() => {
              const lockedCourse = store.courses.find(c => c.id === selectedCourseId);
              const lockedSection = (store.courseSections || []).find(s => s.id === selectedSectionId);
              return lockedCourse ? (
                <div className="text-[11px] text-white/50 bg-white/5 border border-white/5 rounded-xl px-3 py-2 flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-white/70">Đang chọn:</span>
                  <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/20 font-sans">{lockedCourse.title}</span>
                  {lockedSection && (
                    <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-md border border-violet-500/20 font-mono">Lớp: {lockedSection.sectionCode}</span>
                  )}
                </div>
              ) : null;
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="col-span-1 sm:col-span-8 space-y-1.5">
                <label className="text-white/60 font-semibold tracking-wide block flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                  Chọn đợt buổi học:
                </label>
                <select
                  value={activeSessionId}
                  onChange={(e) => setActiveSessionId(e.target.value)}
                  className="w-full p-2.5 bg-black/40 text-white border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-sans transition-all"
                >
                  <option value="">-- Mở bảng tháng --</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id} className="bg-slate-900">{s.date} -- Đề mục: {s.topic}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 sm:col-span-4">
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="w-full p-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl font-bold text-white flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer text-xs shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] h-[38px] truncate"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">Tạo buổi / Gửi link 🚀</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className={selectedCourseId ? "col-span-1 md:col-span-4 space-y-1.5" : "col-span-1 md:col-span-12 space-y-1.5"}>
              <label className="text-white/60 font-semibold tracking-wide block flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                1. Lựa chọn môn học / học phần:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedSectionId(""); setActiveSessionId(""); }}
                disabled={lockSelectors}
                className="w-full p-2.5 bg-black/40 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 font-sans transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">-- Click chọn lớp môn học --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.title} ({c.category})</option>
                ))}
              </select>
            </div>

            {selectedCourseId && (
              <>
                <div className="col-span-1 md:col-span-3 space-y-1.5">
                  <label className="text-white/60 font-semibold tracking-wide block flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                    2. Chọn lớp học phần:
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => { setSelectedSectionId(e.target.value); setActiveSessionId(""); }}
                    disabled={lockSelectors}
                    className="w-full p-2.5 bg-black/40 text-white border border-white/10 rounded-xl focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-sans transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Chọn lớp --</option>
                    {courseSections.map((section: any) => (
                      <option key={section.id} value={section.id} className="bg-slate-900">{section.sectionCode}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-3 space-y-1.5">
                  <label className="text-white/60 font-semibold tracking-wide block flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    3. Chọn đợt buổi học:
                  </label>
                  <select
                    value={activeSessionId}
                    onChange={(e) => setActiveSessionId(e.target.value)}
                    className="w-full p-2.5 bg-black/40 text-white border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-sans transition-all"
                  >
                    <option value="">-- Mở bảng tháng --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900">{s.date} -- Đề mục: {s.topic}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-1 md:col-span-2">
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="w-full p-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl font-bold text-white flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer text-xs shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] h-[38px] truncate"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Tạo buổi / Gửi link 🚀</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Area layout split */}
      {selectedCourseId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left / Middle Span: Attendance taking Grid */}
          <div className="lg:col-span-2 space-y-4">
            {activeSessionId ? (
              <div className="space-y-4">
                {(() => {
                  const activeSession = sessions.find(s => s.id === activeSessionId);
                  const isLinkActive = activeSession && activeSession.code && activeSession.expiresAt && new Date(activeSession.expiresAt) > new Date();
                  return (
                    <div className="flex flex-col gap-2 border-b border-white/10 pb-3 font-sans">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            Chốt danh sách điểm danh: <span className="text-indigo-400 font-mono font-semibold">{activeSession?.date}</span>
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-white/40">
                              Chủ đề buổi học: <span className="text-cyan-400 font-semibold">{activeSession?.topic}</span>
                            </p>
                            <button
                              onClick={() => setCourseDetailId(selectedCourseId)}
                              className="px-1.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer font-sans"
                            >
                              Xem thông tin khóa 👁️
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded font-mono font-bold font-mono">
                          ID: {activeSessionId.slice(0, 8)}
                        </span>
                      </div>

                      {activeSession && activeSession.code && (
                        <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-2xl flex flex-wrap items-center justify-between text-xs gap-3">
                          <span className="text-indigo-300 font-semibold flex items-center gap-1">🔗 Link tự điểm danh trực tuyến (5p)</span>
                          <span className="font-mono bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded font-black text-cyan-300 select-all tracking-wider text-sm">
                            MÃ CODE: {activeSession.code}
                          </span>
                          <span className={`font-bold font-mono px-2.5 py-1 rounded-lg ${isLinkActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                            {isLinkActive ? `🟢 Đang mở (Hết hạn: ${new Date(activeSession.expiresAt!).toLocaleTimeString("vi-VN", {hour: "2-digit", minute:"2-digit"})})` : `🔴 Đã đóng / Hết hạn`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const activeSession = sessions.find(s => s.id === activeSessionId);
                  if (!activeSession) return null;
                  return (
                    <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl space-y-3 font-sans text-xs shadow-md">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <h5 className="font-bold text-white uppercase tracking-wider text-[11px] text-white/70">
                          Nội dung & Tài liệu học tập
                        </h5>
                        {(currentUser.role === "teacher" || currentUser.role === "admin") && (
                          <button
                            onClick={() => {
                              setEditTopic(activeSession.topic || "");
                              setEditContent(activeSession.content || "");
                              setEditVideoUrl(activeSession.videoUrl || "");
                              setEditRecordingUrl(activeSession.recordingUrl || "");
                              setEditDate(activeSession.date || "");
                              setShowEditSessionModal(true);
                            }}
                            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            Sửa thông tin buổi học ✏️
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-white/40 block text-[10px] uppercase font-bold">Chủ đề & Thời gian:</span>
                            <span className="text-white font-medium text-sm">{activeSession.topic || "Chưa thiết lập"}</span>
                            <span className="text-indigo-400 font-mono text-[11px] block mt-0.5">{activeSession.date}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[10px] uppercase font-bold">Nội dung bài học:</span>
                            <p className="text-white/80 whitespace-pre-wrap leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5 max-h-40 overflow-y-auto font-sans">
                              {activeSession.content || "Chưa có nội dung chi tiết."}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <span className="text-white/40 block text-[10px] uppercase font-bold">Video bài giảng / Recording:</span>
                            {activeSession.recordingUrl ? (
                              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1">
                                <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
                                  📹 Video Recording buổi học
                                </span>
                                <a
                                  href={activeSession.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 hover:underline block truncate font-mono text-[10px]"
                                >
                                  {activeSession.recordingUrl} ↗
                                </a>
                              </div>
                            ) : null}

                            {activeSession.videoUrl ? (
                              <div className="space-y-2">
                                <video 
                                  src={activeSession.videoUrl} 
                                  controls 
                                  className="w-full max-h-36 bg-black rounded-xl border border-white/10 shadow-inner"
                                />
                                <a 
                                  href={activeSession.videoUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-cyan-400 hover:underline inline-block font-mono text-[10px]"
                                >
                                  Mở link video bài giảng trong tab mới ↗
                                </a>
                              </div>
                            ) : !activeSession.recordingUrl ? (
                              <div className="flex flex-col items-center justify-center py-6 bg-black/20 rounded-xl border border-white/5 border-dashed text-white/40 font-sans">
                                <span>Chưa cập nhật video hay recording buổi học.</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {activeSessionId && (currentUser.role === "teacher" || currentUser.role === "admin") && (
                  <SessionMaterialsEditor sessionId={activeSessionId} triggerToast={triggerToast} onChanged={onRefreshData} />
                )}

                {/* Student search input */}
                <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-xl text-xs max-w-sm">
                  <input
                    type="text"
                    placeholder="Tìm kiếm học viên theo tên hoặc mã SV..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10.5px] uppercase text-white/50 bg-white/2">
                          <th className="py-2.5 px-3 cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("studentCode")}>
                            Mã SV {studentSortField === "studentCode" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                          </th>
                          <th className="py-2.5 px-3 cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("name")}>
                            Tên Sinh Viên {studentSortField === "name" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                          </th>
                          <th className="py-2.5 px-3 text-center">Đúng giờ (Có mặt)</th>
                          <th className="py-2.5 px-3 text-center text-yellow-400">Đi Muộn</th>
                          <th className="py-2.5 px-3 text-center text-orange-400">Có Phép</th>
                          <th className="py-2.5 px-3 text-center text-red-400">Vắng mặt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-white/90">
                        {sortedCourseStudents.map(st => {
                          const record = activeRecords.find(r => r.studentId === st.userId);
                          const activeStatus = record ? record.status : "present";
                          return (
                            <tr key={st.userId} className="hover:bg-white/2 transition">
                              <td className="py-3 px-3 font-mono font-bold text-cyan-400">{st.studentCode}</td>
                              <td className="py-3 px-3 font-semibold text-white">{st.name}</td>
                              
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${st.userId}`}
                                  checked={activeStatus === "present"}
                                  onChange={() => handleMarkStatusChange(st.userId, "present")}
                                  className="h-4 w-4 bg-black/30 border-white/10 text-emerald-500 cursor-pointer focus:ring-opacity-0 focus:ring-0"
                                />
                              </td>

                              <td className="py-3 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${st.userId}`}
                                  checked={activeStatus === "late"}
                                  onChange={() => handleMarkStatusChange(st.userId, "late")}
                                  className="h-4 w-4 bg-black/30 border-white/10 text-yellow-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${st.userId}`}
                                  checked={activeStatus === "excused"}
                                  onChange={() => handleMarkStatusChange(st.userId, "excused")}
                                  className="h-4 w-4 bg-black/30 border-white/10 text-cyan-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-3 text-center">
                                <input
                                  type="radio"
                                  name={`status-${st.userId}`}
                                  checked={activeStatus === "absent"}
                                  onChange={() => handleMarkStatusChange(st.userId, "absent")}
                                  className="h-4 w-4 bg-black/30 border-white/10 text-red-500 cursor-pointer"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center border border-dashed border-white/10 bg-slate-950/20 backdrop-blur-sm rounded-3xl text-white/30 space-y-4 shadow-inner flex flex-col items-center justify-center transition-all duration-300">
                <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/5 animate-pulse">
                  <Calendar className="h-7 w-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h5 className="text-xs font-bold text-white/70 tracking-wide font-sans">
                    {!selectedSectionId ? "Chưa chọn lớp học phần" : "Chưa chọn đợt buổi học"}
                  </h5>
                  <p className="text-[11px] text-white/40 leading-relaxed font-sans">
                    {!selectedSectionId 
                      ? "Vui lòng chọn một lớp học phần ở khung lựa chọn phía trên để tải danh sách học viên và thiết lập điểm danh."
                      : "Vui lòng chọn một đợt học đã lưu từ ô chọn trên, hoặc bấm nút \"Tạo buổi học / Gửi link điểm danh\" màu tím để tạo buổi học mới."
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Attendance Statistics & alarms triggers */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 p-5 rounded-3xl space-y-4 h-fit shadow-xl">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="truncate">Thống kê lớp học phần</span>
              </h4>
              {selectedSectionId && (
                <button
                  onClick={() => setShowStatsModal(true)}
                  className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white text-[10px] font-bold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-0.5 shrink-0 ml-1"
                  title="Mở bảng thống kê chi tiết ở cửa sổ lớn"
                >
                  Xem rộng 📊
                </button>
              )}
            </div>

            {selectedSectionId ? (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedCourseStudents.map(st => {
                  const percentage = getStudentPresenceRate(st.userId);
                  
                  // Fine-tuned three-color scales
                  const barColor = percentage >= 80 ? "bg-gradient-to-r from-emerald-500 to-teal-500" : 
                                   percentage >= 50 ? "bg-gradient-to-r from-amber-500 to-orange-500" : 
                                   "bg-gradient-to-r from-rose-500 to-red-500";
                                   
                  const textColor = percentage >= 80 ? "text-emerald-400" : 
                                    percentage >= 50 ? "text-amber-400" : 
                                    "text-rose-400";

                  return (
                    <div key={st.userId} className="space-y-2.5 p-3.5 bg-black/45 hover:bg-white/5 hover:-translate-y-[0.5px] rounded-2xl border border-white/5 hover:border-white/15 transition-all duration-200">
                      {/* Row 1: Avatar & Full Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/25 border border-indigo-500/35 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {st.name.charAt(0)}
                        </div>
                        <span className="font-bold text-white text-[13px] truncate flex-1">{st.name}</span>
                      </div>
                      
                      {/* Row 2: Progress Bar & Percentage */}
                      <div className="flex items-center gap-3 text-[11px] font-mono text-white/50">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className={`font-mono font-extrabold text-[12px] shrink-0 ${textColor}`}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {sortedCourseStudents.length === 0 && (
                  <div className="text-center py-8 text-white/30 text-[11px] font-sans">Chưa có sinh viên đăng ký lớp học phần này.</div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-black/20 text-white/40 text-xs font-sans">
                Vui lòng chọn lớp học phần để hiển thị thống kê chuyên cần học viên.
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {currentUser.role === "teacher" && (
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-display">
                  🔑 Lịch sử lên lớp & Điểm danh Giảng viên
                </h4>
                {(() => {
                  const teacherRecords = (store.teacherAttendance || []).filter((ta: any) => ta.teacherId === currentUser.id);
                  const total = teacherRecords.length;
                  const present = teacherRecords.filter((ta: any) => ta.status === "present").length;
                  const rate = total > 0 ? Math.round((present / total) * 100) : 100;
                  return (
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                      Tỉ lệ lên lớp: {rate}% ({present}/{total})
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const teacherRecords = (store.teacherAttendance || []).filter((ta: any) => ta.teacherId === currentUser.id);
                if (teacherRecords.length === 0) {
                  return (
                    <p className="text-xs text-white/40 italic py-4">Chưa có lịch sử điểm danh lên lớp nào được ghi nhận.</p>
                  );
                }
                return (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                          <th className="py-2.5">Môn học</th>
                          <th className="py-2.5">Ca học</th>
                          <th className="py-2.5">Ngày dạy</th>
                          <th className="py-2.5">Thời gian điểm danh</th>
                          <th className="py-2.5 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white/80">
                        {teacherRecords.map((ta: any) => {
                          const course = store.courses.find((c: any) => c.id === ta.courseId) || { title: ta.courseId };
                          return (
                            <tr key={ta.id} className="hover:bg-white/2 transition duration-150">
                              <td className="py-2.5 font-semibold text-white">{course.title}</td>
                              <td className="py-2.5 font-mono">{ta.slotTime}</td>
                              <td className="py-2.5 font-mono">{ta.classDate}</td>
                              <td className="py-2.5 font-mono text-white/50">{new Date(ta.checkedInAt).toLocaleTimeString("vi-VN")}</td>
                              <td className="py-2.5 text-right">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                                  Có mặt ✅
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="py-16 text-center border border-white/5 bg-white/2 rounded-3xl text-white/40 space-y-2">
            <BookOpen className="h-10 w-10 mx-auto text-indigo-500/30" />
            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">Quản trị chuyên cần & Biểu chuyên học</h4>
            <p className="text-[11px] max-w-sm mx-auto leading-relaxed">Vui lòng chọn hoặc lựa chọn một Học phần đào tạo từ thanh công cụ HUD phía trên đầu để khởi chạy quản trị chuyên cần.</p>
          </div>
        </div>
      )}

      {/* CREATE SESSION MODAL CONTAINER */}
      {showCreateSession && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowCreateSession(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3 uppercase">
              <PlusCircle className="h-5 w-5 text-indigo-400" /> Thiết lập buổi điểm danh lớp học
            </h3>

            <p className="text-xs text-white/50 leading-relaxed mb-4">
              Khởi động khung điểm danh cho ngày hôm nay. Hệ thống sẽ tự kiểm kích và lên sẵn bộ hồ sơ mặc định của sinh viên để bớt thao tác rờ rà.
            </p>

            <form onSubmit={handleCreateSessionSubmit} className="space-y-4 text-xs">
              
              {/* Method Selector */}
              <div className="space-y-1.5 bg-white/3 border border-white/5 p-3 rounded-2xl">
                <label className="text-white/70 font-semibold block mb-1 font-sans">Phương thức điểm danh</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-white/80">
                    <input
                      type="radio"
                      name="checkin-method"
                      checked={checkinMethod === "manual"}
                      onChange={() => setCheckinMethod("manual")}
                      className="h-4 w-4 text-indigo-500 bg-black/30 border-white/10"
                    />
                    <span>Thủ công (Giảng viên tích)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-indigo-300">
                    <input
                      type="radio"
                      name="checkin-method"
                      checked={checkinMethod === "link"}
                      onChange={() => setCheckinMethod("link")}
                      className="h-4 w-4 text-indigo-500 bg-black/30 border-white/10"
                    />
                    <span>Gửi link tự động (5 phút)</span>
                  </label>
                </div>
              </div>

              {checkinMethod === "manual" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-white/70 font-semibold block">Ngày học tập</label>
                    <input
                      type="date"
                      required
                      value={newSessionDate}
                      onChange={(e) => setNewSessionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/70 font-semibold block">Giờ học cụ thể</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 09:00 - 11:30"
                      value={newSessionTime}
                      onChange={(e) => setNewSessionTime(e.target.value)}
                      className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-2xl text-[10.5px] leading-relaxed font-sans">
                  ℹ️ <strong>Cơ chế Tự động:</strong> Hệ thống sẽ khởi tạo ca học và gửi một thông báo kèm liên kết tương tác đến hộp thư của tất cả sinh viên hoạt động trong lớp. Học sinh click xác nhận trong vòng <strong>5 phút</strong> để ghi nhận chuyên cần. Sau 5 phút, link sẽ hết hạn.
                </div>
              )}

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Đề tài giảng dạy / Chủ đề ngày học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lý thuyết Model Schema Design hay Lab 03 Git..."
                  value={newSessionTopic}
                  onChange={(e) => setNewSessionTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSession(false)}
                  className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition cursor-pointer flex items-center gap-1"
                >
                  {checkinMethod === "link" ? (
                    <>🚀 Gửi link điểm danh (5 phút)</>
                  ) : (
                    <>
                      <FolderSync className="h-3.5 w-3.5" /> Mở điểm danh thủ công
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
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

      {/* EDIT SESSION MODAL */}
      {showEditSessionModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button 
              onClick={() => setShowEditSessionModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-1.5 border-b border-white/10 pb-3 uppercase font-sans">
              Sửa thông tin buổi học
            </h3>

            <form onSubmit={handleEditSessionSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Tên chủ đề / Đề tài giảng dạy</label>
                <input
                  type="text"
                  required
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Ví dụ: Giới thiệu lập trình Web, React Hooks, ..."
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Ngày học / Thời gian (cho phép dời lịch nếu trùng nghỉ lễ)</label>
                <input
                  type="text"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  placeholder="Ví dụ: 2026-09-20 (09:00 - 11:30)"
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Nội dung chi tiết bài học</label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Mô tả tóm tắt nội dung bài học, các kiến thức truyền đạt, bài tập về nhà..."
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Link Video Recording buổi học (Zoom Cloud / Drive / YouTube)</label>
                <input
                  type="url"
                  value={editRecordingUrl}
                  onChange={(e) => setEditRecordingUrl(e.target.value)}
                  placeholder="https://us02web.zoom.us/rec/... hoặc https://drive.google.com/..."
                  className="w-full px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-xs"
                />
                <p className="text-[10px] text-white/40 font-sans">Học viên có thể xem trực tiếp video ghi lại buổi học này sau giờ học.</p>
              </div>

              <div className="space-y-1">
                <label className="text-white/70 font-semibold block">Video bài giảng tải lên nội bộ (mp4/webm)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editVideoUrl}
                    onChange={(e) => setEditVideoUrl(e.target.value)}
                    placeholder="Đường dẫn video (mp4, webm, ...)"
                    className="flex-1 px-3 py-2 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400"
                  />
                  <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer shrink-0">
                    {uploadingVideo ? "Đang tải..." : "Tải lên 📤"}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      disabled={uploadingVideo}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-white/40 font-sans">Hỗ trợ các định dạng video mp4, webm. Nếu tải lên, hệ thống sẽ tự động điền đường dẫn.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditSessionModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition cursor-pointer font-sans font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSession}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer font-sans"
                >
                  {isUpdatingSession ? "Đang lưu..." : "Lưu thay đổi 💾"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* DETAILED STATISTICS MODAL */}
      {showStatsModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-3xl shadow-2xl relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between text-white font-sans text-xs">
            <button 
              onClick={() => setShowStatsModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-white/10 pb-3 mb-4 flex justify-between items-center pr-8">
              <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                📊 Thống kê chuyên cần chi tiết lớp học phần
              </h3>
              <span className="font-mono text-xs bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-300">
                Tổng số: {sortedCourseStudents.length} học viên | {sessions.length} buổi học phần
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10.5px] uppercase text-white/50 bg-white/2">
                    <th className="py-2.5 px-3">Mã SV</th>
                    <th className="py-2.5 px-3">Tên Sinh Viên</th>
                    <th className="py-2.5 px-3 text-center">Tỉ lệ chuyên cần</th>
                    <th className="py-2.5 px-3 text-center">Số buổi học chi tiết</th>
                    <th className="py-2.5 px-3 text-center">Cảnh báo học vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedCourseStudents.map((st) => {
                    const percentage = getStudentPresenceRate(st.userId);
                    const textColor = percentage >= 80 ? "text-emerald-400 font-bold" : 
                                      percentage >= 50 ? "text-amber-400 font-bold" : 
                                      "text-rose-400 font-bold";

                    return (
                      <tr key={st.userId} className="hover:bg-white/2 transition">
                        <td className="py-3 px-3 font-mono font-bold text-cyan-400">{st.studentCode}</td>
                        <td className="py-3 px-3 font-semibold text-white text-[13px]">{st.name}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={textColor}>{percentage}%</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {(() => {
                            const studentRecords = (store.attendanceRecords || []).filter(r => r.studentId === st.userId && sessions.some(s => s.id === r.sessionId));
                            const present = studentRecords.filter(r => r.status === "present").length;
                            const absent = studentRecords.filter(r => r.status === "absent").length;
                            const late = studentRecords.filter(r => r.status === "late").length;
                            const excused = studentRecords.filter(r => r.status === "excused").length;
                            return (
                              <span className="text-[11px] text-white/70">
                                {present} Có mặt | {late} Muộn | {excused} Phép | {absent} Vắng
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {percentage < 80 ? (
                            <span className="text-[10px] text-rose-400 font-bold">⚠️ Dưới chuẩn</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold">🟢 Đạt chuẩn</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-white/10 mt-4 flex justify-end">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer font-sans"
              >
                Đóng thống kê
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
