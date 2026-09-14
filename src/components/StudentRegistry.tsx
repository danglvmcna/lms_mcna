import React, { useState } from "react";
import { 
  Search, 
  SlidersHorizontal, 
  Download, 
  X, 
  User, 
  AlertCircle, 
  Activity, 
  DollarSign, 
  Plus, 
  MessageSquare, 
  GraduationCap, 
  Calendar, 
  Clock, 
  ShieldAlert 
} from "lucide-react";
import { 
  LMSDataStore, 
  User as UserType, 
  Enrollment, 
  AttendanceRecord, 
  AttendanceSession, 
  TuitionFee, 
  AcademicWarning, 
  AdvisorNote 
} from "../types";
import { AppStore } from "../store";
import { generateId } from "../utils";
import ModalPortal from "./ModalPortal";

interface StudentRegistryProps {
  store: LMSDataStore;
  currentUser: UserType;
  onRefreshData: () => void;
  triggerToast: (msg: string) => void;
}

export default function StudentRegistry({ store, currentUser, onRefreshData, triggerToast }: StudentRegistryProps) {
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Target Student for View Modal
  const [detailedStudentId, setDetailedStudentId] = useState<string | null>(null);
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);

  // Sorting state for students roster registry
  const [studentSortField, setStudentSortField] = useState<string>("studentCode");
  const [studentSortOrder, setStudentSortOrder] = useState<"asc" | "desc">("asc");

  // Sorting state for detailed enrollments log
  const [enrollSortField, setEnrollSortField] = useState<string>("courseTitle");
  const [enrollSortOrder, setEnrollSortOrder] = useState<"asc" | "desc">("asc");

  const handleStudentSort = (field: string) => {
    if (studentSortField === field) {
      setStudentSortOrder(studentSortOrder === "asc" ? "desc" : "asc");
    } else {
      setStudentSortField(field);
      setStudentSortOrder("asc");
    }
  };

  const handleEnrollSort = (field: string) => {
    if (enrollSortField === field) {
      setEnrollSortOrder(enrollSortOrder === "asc" ? "desc" : "asc");
    } else {
      setEnrollSortField(field);
      setEnrollSortOrder("asc");
    }
  };

  // Advisories Notes Create Form state
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<"academic" | "behavioral" | "financial">("academic");

  // Format Helper collections
  const students = (store.studentProfiles || []).map(p => {
    const usr = store.users.find(u => u.id === p.userId) || { name: "Người học", email: "" };
    return {
      ...p,
      name: usr.name,
      email: usr.email
    };
  });


  const courses = store.courses || [];
  const enrollments = store.enrollments || [];
  const attendanceRecords = store.attendanceRecords || [];
  const attendanceSessions = store.attendanceSessions || [];
  const tuitionFees = store.tuitionFees || [];
  const warnings = store.academicWarnings || [];
  const advisorNotes = store.advisorNotes || [];

  // Filter conditions
  const filteredStudents = students.filter(st => {
    const matchesSearch = st.name.toLowerCase().includes(search.toLowerCase()) || 
                          st.studentCode.toLowerCase().includes(search.toLowerCase()) ||
                          st.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || st.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (!studentSortField) return 0;
    let valA: any = "";
    let valB: any = "";

    if (studentSortField === "studentCode") {
      valA = a.studentCode || "";
      valB = b.studentCode || "";
    } else if (studentSortField === "name") {
      valA = a.name || "";
      valB = b.name || "";
    } else if (studentSortField === "gpa") {
      valA = a.gpa || 0;
      valB = b.gpa || 0;
    } else if (studentSortField === "status") {
      valA = a.status || "";
      valB = b.status || "";
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return studentSortOrder === "asc"
        ? valA.localeCompare(valB, "vi", { sensitivity: "base" })
        : valB.localeCompare(valA, "vi", { sensitivity: "base" });
    }
    return studentSortOrder === "asc" ? valA - valB : valB - valA;
  });

  // Checkbox selectors
  // CSV Export action
  const handleExportCSV = () => {
    let csvContent = "\ufeff"; // BOM for excel Vietnamese readability
    csvContent += "Mã Học Viên,Họ Tên,Email,Số Điện Thoại,GPA,Trạng Thái\n";

    filteredStudents.forEach(st => {
      const row = [
        st.studentCode,
        st.name,
        st.email,
        st.phone || "",
        st.gpa,
        st.status
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `danh_sach_sinh_vien_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Đã tải về bảng dữ liệu CSV sinh viên.");
  };

  // Advisor Note Form action
  const handleAddAdvisorNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedStudentId) return;
    if (!noteContent.trim()) {
      triggerToast("Nội dung tư vấn không được bỏ trống.");
      return;
    }

    const storeData = AppStore.get();
    const newNote: AdvisorNote = {
      id: generateId("adv"),
      advisorId: currentUser.id,
      studentId: detailedStudentId,
      content: noteContent.trim(),
      type: noteType,
      createdAt: new Date().toISOString()
    };

    if (!storeData.advisorNotes) {
      storeData.advisorNotes = [];
    }

    storeData.advisorNotes.unshift(newNote);
    AppStore.log(currentUser.id, "add_advisor_note", detailedStudentId, `Thêm ghi chú tư vấn cố vấn học tập (${noteType})`);
    AppStore.save(storeData);
    setNoteContent("");
    onRefreshData();
    triggerToast("Đã đăng tải ghi chú học thuật từ trợ lý cố vấn viên.");
  };

  // Retrieve Detailed student statistics
  const currentDetailedProfile = students.find(s => s.userId === detailedStudentId);
  
  // Specific stats computed on-demand
  let detailedEnrollments: Enrollment[] = [];
  let detailedAttendance: { courseName: string; presentCount: number; totalCount: number; percentage: number }[] = [];
  let detailedTuition: TuitionFee[] = [];
  let detailedWarnings: AcademicWarning[] = [];
  let detailedNotes: AdvisorNote[] = [];

  if (currentDetailedProfile) {
    detailedEnrollments = enrollments.filter(e => e.studentId === currentDetailedProfile.userId && e.status !== "cancelled");
    
    // Compute student attendance summaries
    detailedEnrollments.forEach(enroll => {
      const course = courses.find(c => c.id === enroll.courseId);
      if (!course) return;

      const sessionsForCourse = attendanceSessions.filter(s => s.courseId === course.id);
      const pastSessions = sessionsForCourse.filter(s => new Date(s.date).getTime() <= Date.now());
      const sessionsCount = pastSessions.length;
      
      const recordsForStudent = attendanceRecords.filter(r => 
        r.studentId === currentDetailedProfile.userId &&
        pastSessions.some(s => s.id === r.sessionId)
      );

      const presentRecords = recordsForStudent.filter(r => r.status === "present" || r.status === "late" || r.status === "excused").length;
      
      detailedAttendance.push({
        courseName: course.title,
        presentCount: presentRecords,
        totalCount: sessionsCount,
        percentage: sessionsCount > 0 ? Math.round((presentRecords / sessionsCount) * 100) : 100
      });
    });

    detailedTuition = tuitionFees.filter(f => f.studentId === currentDetailedProfile.userId);
    detailedWarnings = warnings.filter(w => w.studentId === currentDetailedProfile.userId);
    detailedNotes = advisorNotes.filter(n => n.studentId === currentDetailedProfile.userId);
  }

  return (
    <div className="space-y-6">
      {/* Filters HUD panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/3 border border-white/5 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã HS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs bg-black/25 text-white placeholder-white/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/20 w-44 md:w-56"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-white/40" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1.5 text-[11px] bg-black/25 text-white/80 border border-white/10 rounded-xl focus:outline-none"
            >
              <option value="all" className="bg-slate-900">Mọi Trạng Thái</option>
              <option value="active" className="bg-slate-900">Đang học</option>
              <option value="on-leave" className="bg-slate-900">Bảo lưu</option>
              <option value="suspended" className="bg-slate-900">Đình chỉ</option>
              <option value="graduated" className="bg-slate-900">Tốt nghiệp</option>
              <option value="withdrawn" className="bg-slate-900">Thôi học</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Xuất dữ liệu CSV
        </button>
      </div>

      {/* Roster Table Data view */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/2 text-[10.5px] uppercase tracking-wider text-white/50">
                <th className="py-3 px-3 cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("studentCode")}>
                  Mã SV {studentSortField === "studentCode" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("name")}>
                  Học sinh Sinh viên {studentSortField === "name" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                </th>
                <th className="py-3 px-3">Số điện thoại</th>
                <th className="py-3 px-3 text-center cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("gpa")}>
                  GPA {studentSortField === "gpa" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                </th>
                <th className="py-3 px-3 cursor-pointer select-none hover:text-white transition" onClick={() => handleStudentSort("status")}>
                  Trạng thái {studentSortField === "status" ? (studentSortOrder === "asc" ? "▲" : "▼") : "↕"}
                </th>
                <th className="py-3 px-4 text-right">Xem thêm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/95">
              {sortedStudents.map(st => {
                // Color badges status
                let statusClass = "bg-white/10 text-white/80 border border-white/10";
                if (st.status === "active") statusClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                if (st.status === "on-leave") statusClass = "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
                if (st.status === "suspended") statusClass = "bg-red-500/10 text-red-500 border border-red-500/15";
                if (st.status === "graduated") statusClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

                return (
                  <tr key={st.id} className="hover:bg-white/3 transition duration-150">
                    <td className="py-3 px-3 font-mono font-bold text-cyan-400">{st.studentCode}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">{st.name}</div>
                      <div className="text-[10px] text-white/40 font-mono">{st.email}</div>
                    </td>
                    <td className="py-3 px-3 font-medium text-white/80">{st.phone || "—"}</td>
                    <td className="py-3 px-3 text-center font-bold font-mono text-amber-400">{st.gpa}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${statusClass}`}>
                        {st.status === "active" ? "Đang học" :
                         st.status === "on-leave" ? "Bảo lưu" :
                         st.status === "suspended" ? "Đình chỉ" :
                         st.status === "graduated" ? "Tốt nghiệp" : "Đã nghỉ"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDetailedStudentId(st.userId)}
                        className="px-2.5 py-1 text-[10px] font-bold text-indigo-950 bg-white hover:bg-slate-100 rounded-lg transition shadow-sm cursor-pointer"
                      >
                        Hồ Sơ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/30 text-xs">Không tìm thấy bản ghi sinh viên trùng khớp yêu cầu tra cứu.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPREHENSIVE VIEW & ADVISOR PROFILE MODAL CONTAINER */}
      {detailedStudentId && currentDetailedProfile && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-4xl shadow-2xl relative my-8 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header elements */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <User className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {currentDetailedProfile.name}
                    <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">
                      {currentDetailedProfile.studentCode}
                    </span>
                  </h3>
                  <p className="text-xs text-white/50">{currentDetailedProfile.email} • dự kiến tốt nghiệp: {currentDetailedProfile.expectedGraduation}</p>
                </div>
              </div>

              <button
                onClick={() => { setDetailedStudentId(null); setNoteContent(""); }}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Inner scrollable contents */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visual statistics info panels */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* General Profile section info Grid */}
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-indigo-400" /> Hồ sơ lý lịch sinh viên
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-white/40">Số Điện thoại</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.phone || "Chưa thiết lập"}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Ngày sinh</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.dateOfBirth || "Chưa thiết lập"}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Giới tính</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.gender || "Chưa thiết lập"}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-white/40">Địa chỉ liên hệ</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.address || "Chưa lập địa chỉ"}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Ngày nhập học</div>
                        <div className="font-bold text-white font-mono text-indigo-300 mt-0.5">{currentDetailedProfile.enrollmentDate}</div>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-3 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-white/40">Người bảo hộ (Phụ huynh)</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.guardianName || "Chưa cập nhật"}</div>
                      </div>
                      <div>
                        <div className="text-white/40">Số liên hệ bảo hộ</div>
                        <div className="font-bold text-white mt-0.5">{currentDetailedProfile.guardianPhone || "Chưa cập nhật"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Academic Enrollments logs tracker */}
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <Calendar className="h-4 w-4 text-indigo-400" /> Tiến trình học tập & Đăng ký môn
                    </h4>

                    {/* Enrollment Search Input */}
                    <div className="flex gap-3 bg-white/3 border border-white/5 p-2 rounded-xl text-xs max-w-sm">
                      <input
                        type="text"
                        placeholder="Tìm học phần đã đăng ký..."
                        value={enrollmentSearch}
                        onChange={(e) => setEnrollmentSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-black/25 text-white placeholder-white/30 border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
                      />
                    </div>
                    {(() => {
                      const filteredDetailedEnrollments = detailedEnrollments.filter(enroll => {
                        const course = courses.find(c => c.id === enroll.courseId);
                        return !enrollmentSearch ||
                          (course?.title || "").toLowerCase().includes(enrollmentSearch.toLowerCase()) ||
                          (course?.category || "").toLowerCase().includes(enrollmentSearch.toLowerCase());
                      });

                      const sortedDetailedEnrollments = [...filteredDetailedEnrollments].sort((a, b) => {
                        if (!enrollSortField) return 0;
                        let valA: any = "";
                        let valB: any = "";

                        const courseA = courses.find(c => c.id === a.courseId);
                        const courseB = courses.find(c => c.id === b.courseId);

                        if (enrollSortField === "courseTitle") {
                          valA = courseA?.title || "";
                          valB = courseB?.title || "";
                        } else if (enrollSortField === "createdAt") {
                          valA = (a as any).createdAt || "";
                          valB = (b as any).createdAt || "";
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

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead>
                              <tr className="border-b border-white/5 text-[10px] text-white/40 uppercase">
                                <th className="py-2 cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("courseTitle")}>
                                  Học phần lớp học {enrollSortField === "courseTitle" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                                </th>
                                <th className="py-2 cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("createdAt")}>
                                  Ngày nhập môn {enrollSortField === "createdAt" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                                </th>
                                <th className="py-2 cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("category")}>
                                  Tên lớp {enrollSortField === "category" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                                </th>
                                <th className="py-2 text-right cursor-pointer select-none hover:text-white transition" onClick={() => handleEnrollSort("status")}>
                                  Trạng thái lớp {enrollSortField === "status" ? (enrollSortOrder === "asc" ? "▲" : "▼") : "↕"}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/2">
                              {sortedDetailedEnrollments.map(enroll => {
                                const course = courses.find(c => c.id === enroll.courseId);
                                return (
                                  <tr key={enroll.id}>
                                    <td className="py-2.5 font-bold text-white">
                                      <div className="flex items-center gap-1.5">
                                        <span>{course ? course.title : "Không xác định"}</span>
                                        {course && (
                                          <button
                                            onClick={() => setCourseDetailId(course.id)}
                                            className="px-1.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer font-sans"
                                          >
                                            Xem 👁
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 font-mono text-white/60">{((enroll as any).createdAt || new Date().toISOString()).slice(0,10)}</td>
                                    <td className="py-2.5 text-white/50">{course ? course.category : "Không xác định"}</td>
                                    <td className="py-2.5 text-right capitalize">
                                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                                        enroll.status === "active" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                                        enroll.status === "pending" ? "bg-violet-500/10 text-violet-300 border-violet-500/20" :
                                        enroll.status === "pending_payment" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
                                        enroll.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        "bg-red-500/10 text-red-400 border-red-500/15"
                                      }`}>
                                        {enroll.status === "active" ? "Đang học" :
                                         enroll.status === "pending" ? "Chờ xếp lớp" :
                                         enroll.status === "pending_payment" ? "Chờ thanh toán" :
                                         enroll.status === "completed" ? "Đã xong" : "Đã hủy"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                              {sortedDetailedEnrollments.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="text-center py-6 text-white/30 italic">Không tìm thấy lớp học phần phù hợp.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Attendance detail status box */}
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-indigo-400" /> Báo cáo tỷ lệ chuyên cần
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {detailedAttendance.map((att, i) => (
                        <div key={i} className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                          <div className="font-bold text-white leading-tight truncate">{att.courseName}</div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/50">Đi học: {att.presentCount} / {att.totalCount} buổi</span>
                            <span className={`font-mono font-bold ${att.percentage >= 80 ? "text-emerald-400" : "text-red-400 animate-pulse"}`}>
                              {att.percentage}%
                            </span>
                          </div>
                          {att.percentage < 80 && (
                            <div className="text-[9.5px] text-red-400 bg-red-400/5 p-1 rounded border border-red-500/10 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3 flex-shrink-0" /> Chuyên cần báo động đỏ (Dưới 80%)
                            </div>
                          )}
                        </div>
                      ))}
                      {detailedAttendance.length === 0 && (
                        <div className="text-white/30 text-[11px] py-2 col-span-2 text-center">Chưa có kết quả thống kê chuyên cần ghi nhận.</div>
                      )}
                    </div>
                  </div>

                  {/* Tuition fees profile section info */}
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-indigo-400" /> Hồ sơ thanh toán học phí cá nhân
                    </h4>
                    <div className="space-y-2">
                      {detailedTuition.map(fee => (
                        <div key={fee.id} className="flex justify-between items-center bg-black/25 p-3 rounded-xl border border-white/5 text-xs">
                          <div>
                            <div className="font-bold text-white font-mono">Đợt đóng: {fee.semesterId === "sem_spring25" ? "Spring 2025" : fee.semesterId}</div>
                            <div className="text-[10px] text-white/40">Hạn nộp: {fee.dueDate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-black text-white">{fee.amount.toLocaleString()} VND</div>
                            {fee.status === "paid" && (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.2 rounded text-[9.5px] font-bold">Đã đóng toàn bộ</span>
                            )}
                            {fee.status === "unpaid" && (
                              <span className="bg-red-500/10 text-red-500 border border-red-500/15 px-1.5 py-0.2 rounded text-[9.5px] font-black animate-pulse">Chưa đóng học phí</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {detailedTuition.length === 0 && (
                        <div className="text-white/30 text-[11px] py-2 text-center">Không tìm thấy ghi chú phát sinh chi phí đợt tuyển.</div>
                      )}
                    </div>
                  </div>

                  {/* Active Warnings alarms logs */}
                  {detailedWarnings.length > 0 && (
                    <div className="bg-red-500/10 dark:bg-red-950/40 border border-red-500/20 dark:border-red-500/30 rounded-2xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" /> Cảnh cáo Học tập chủ động can thiệp
                      </h4>
                      <div className="space-y-2 text-xs">
                        {detailedWarnings.map(wf => (
                          <div key={wf.id} className="p-3 bg-red-500/20 dark:bg-red-900/35 border border-red-500/30 dark:border-red-500/25 rounded-xl text-red-800 dark:text-red-200">
                            <div className="flex justify-between">
                              <span className="font-bold uppercase tracking-wide text-[10px]">Cảnh báo: {wf.type}</span>
                              <span className="font-mono text-[9px] text-red-400/80">{wf.createdAt.slice(0,10)}</span>
                            </div>
                            <div className="mt-1 leading-relaxed text-[11px]">{wf.message}</div>
                            {wf.isResolved ? (
                              <span className="mt-2 inline-block bg-emerald-600 text-white border border-emerald-400/40 px-2 py-0.5 rounded text-[9px] font-bold">Nội dung đã khắc phục</span>
                            ) : (
                              <span className="mt-2 inline-block bg-red-600 text-white border border-red-400/40 px-2 py-0.5 rounded text-[9px] font-bold">Cảnh báo đang treo</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right col: Advisor notes timeline logs */}
                <div className="lg:col-span-4 bg-white/2 border border-white/5 rounded-2xl p-4 flex flex-col space-y-4 max-h-[100%]">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <MessageSquare className="h-4 w-4" /> Sổ tư vấn Cố vấn học tập
                  </h4>

                  {/* Note input forms */}
                  <form onSubmit={handleAddAdvisorNoteSubmit} className="space-y-2 text-xs">
                    <div className="space-y-1">
                     <label className="text-[10px] text-slate-300 font-bold">Phân hệ Tư vấn</label>
                      <select
                        value={noteType}
                        onChange={(e) => setNoteType(e.target.value as any)}
                        className="w-full p-2 bg-slate-900 border border-white/10 rounded-lg text-white"
                      >
                        <option value="academic">Nhắc nhở Học tập</option>
                        <option value="behavioral">Đạo đức Kỷ luật</option>
                        <option value="financial">Công nợ Học phí</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-white/50 text-slate-300 font-bold">Ghi nhận nội dung thảo luận</label>
                      <textarea
                        required
                        placeholder="Nhập ghi chú tư vấn, thỏa thuận học vụ, lộ trình cải thiện..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 text-white placeholder-white/20 border border-white/10 rounded-xl focus:outline-none h-24"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-[10px] cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm ghi nhận tư vấn
                    </button>
                  </form>

                  {/* Sidebar notes list view timeline */}
                  <div className="flex-1 overflow-y-auto space-y-3 mt-4 max-h-72 pr-1.5">
                    {detailedNotes.map(note => (
                      <div key={note.id} className="p-3 bg-white/3 border border-white/5 rounded-xl space-y-2 text-[11px]">
                        <div className="flex justify-between items-center text-[9px] text-white/45">
                          <span className="bg-white/5 px-2 py-0.5 rounded uppercase font-bold text-indigo-300">{note.type}</span>
                          <span>{note.createdAt.slice(0, 10)}</span>
                        </div>
                        <p className="text-white/80 leading-relaxed font-sans">{note.content}</p>
                      </div>
                    ))}
                    {detailedNotes.length === 0 && (
                      <div className="text-center py-6 text-white/30 text-[10.5px]">Chưa ghi nhận phản hồi cố vấn nào dành cho sinh viên này.</div>
                    )}
                  </div>

                </div>

              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-5 border-t border-white/10 flex justify-end text-xs flex-shrink-0">
              <button
                onClick={() => { setDetailedStudentId(null); setNoteContent(""); }}
                className="px-5 py-2.5 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng thông tin
              </button>
            </div>

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
    </div>
  );
}
