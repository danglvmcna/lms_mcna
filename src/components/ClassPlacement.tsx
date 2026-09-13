import React, { useState } from "react";
import { 
  Users, 
  Layers, 
  MapPin, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  TrendingUp,
  UserCheck,
  Search,
  Upload,
  Info,
  ChevronDown
} from "lucide-react";
import { LMSDataStore, User } from "../types";
import { AppStore } from "../store";
import { api } from "../api";

interface ClassPlacementProps {
  store: LMSDataStore;
  currentUser: User;
  onRefreshData: () => void;
}

const resolveCurrentSemesterId = (store: LMSDataStore) => {
  const semesters = store.semesters || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  return semesters.find(s => s.isCurrent)?.id ||
    semesters.find(s => s.startDate && s.endDate && todayStr >= String(s.startDate).slice(0, 10) && todayStr <= String(s.endDate).slice(0, 10))?.id ||
    semesters[0]?.id ||
    "";
};

export default function ClassPlacement({ store, currentUser, onRefreshData }: ClassPlacementProps) {
  const [activeTab, setActiveTab] = useState<"unplaced" | "waitlisted">("unplaced");
  const [activeSemesterId, setActiveSemesterId] = useState<string>(() => resolveCurrentSemesterId(store));
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCourseGroups, setExpandedCourseGroups] = useState<Record<string, boolean>>({});
  
  // Selection and filter states
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [bulkPlaceSectionId, setBulkPlaceSectionId] = useState("");
  const [groupBulkSectionIds, setGroupBulkSectionIds] = useState<Record<string, string>>({});
  
  // CSV Import States
  const [showCsvImportPanel, setShowCsvImportPanel] = useState(false);
  const [csvFileText, setCsvFileText] = useState("");

  // Placement Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    courseId: string;
    courseTitle: string;
    isPaymentPending: boolean;
  } | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 6000); // 6s so user has time to read details
  };

  const formatBulkError = (err: any, defaultMsg: string) => {
    if (err.payload?.errors && Array.isArray(err.payload.errors)) {
      const details = err.payload.errors.map((e: any) => e.error).join("; ");
      return `❌ ${err.message}: ${details}`;
    }
    return `❌ Lỗi: ${err.message || defaultMsg}`;
  };

  const getUnplacedStudents = () => {
    const enrollments = store.enrollments || [];
    const regs = store.courseRegistrations || [];
    const sections = store.courseSections || [];

    // Filter course-level enrollment requests that still need class placement.
    const activeEnrollments = enrollments.filter(
      e => e.status === "pending" || e.status === "active" || e.status === "pending_payment"
    );

    return activeEnrollments.map(e => {
      const student = store.users.find(u => u.id === e.studentId);
      const course = store.courses.find(c => c.id === e.courseId);

      if (!student || !course) return null;

      // Find registrations for this student in sections of this course for the active semester
      const studentRegsForCourse = regs.filter(r => 
        r.studentId === e.studentId && 
        r.semesterId === activeSemesterId &&
        ["registered", "completed"].includes(r.status) &&
        sections.some(s => s.id === r.sectionId && s.courseId === e.courseId)
      );

      // If no active registration exists, the student is unplaced!
      if (studentRegsForCourse.length === 0) {
        // Fetch className from student profile
        const profile = (store.studentProfiles || []).find((p: any) => p.studentId === e.studentId);
        const className = profile?.className || "Tự do";

        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          studentName: student.name,
          studentEmail: student.email,
          courseId: e.courseId,
          courseTitle: course.title,
          enrolledAt: e.enrolledAt,
          status: e.status,
          isPaymentPending: e.status === "pending_payment",
          className: className
        };
      }
      return null;
    }).filter(Boolean) as Array<{
      enrollmentId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      courseId: string;
      courseTitle: string;
      enrolledAt: string;
      status: string;
      isPaymentPending: boolean;
      className: string;
    }>;
  };

  const getWaitlistedStudents = () => {
    const regs = store.courseRegistrations || [];
    const waitlisted = regs.filter(r => r.status === "waitlisted" && r.semesterId === activeSemesterId);

    return waitlisted.map(r => {
      const student = store.users.find(u => u.id === r.studentId);
      const section = (store.courseSections || []).find(s => s.id === r.sectionId);
      const course = section ? store.courses.find(c => c.id === section.courseId) : null;

      if (!student || !section || !course) return null;

      return {
        registrationId: r.id,
        studentId: r.studentId,
        studentName: student.name,
        studentEmail: student.email,
        courseId: course.id,
        sectionId: r.sectionId,
        sectionCode: section.sectionCode,
        courseTitle: course.title,
        registeredAt: r.registeredAt,
        credits: r.credits
      };
    }).filter(Boolean) as Array<{
      registrationId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      courseId: string;
      sectionId: string;
      sectionCode: string;
      courseTitle: string;
      registeredAt: string;
      credits: number;
    }>;
  };

  // Base unfiltered lists
  const rawUnplacedList = getUnplacedStudents();
  const rawWaitlistedList = getWaitlistedStudents();

  // Search filtered lists
  const unplacedList = rawUnplacedList.filter(item => 
    item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const waitlistedList = rawWaitlistedList.filter(item => 
    item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Class Name filter dropdown items
  const uniqueClasses = Array.from(new Set(rawUnplacedList.map(item => item.className).filter(Boolean)));

  // Class filtered list
  const filteredUnplacedList = unplacedList.filter(item => {
    if (selectedClassFilter !== "all" && item.className !== selectedClassFilter) {
      return false;
    }
    return true;
  });

  const groupByCourse = <T extends { courseId: string; courseTitle: string }>(items: T[]) => {
    const grouped = new Map<string, { courseId: string; courseTitle: string; items: T[] }>();
    items.forEach(item => {
      const group = grouped.get(item.courseId);
      if (group) {
        group.items.push(item);
      } else {
        grouped.set(item.courseId, { courseId: item.courseId, courseTitle: item.courseTitle, items: [item] });
      }
    });
    return Array.from(grouped.values()).sort((a, b) => a.courseTitle.localeCompare(b.courseTitle, "vi"));
  };

  const groupedUnplacedList = groupByCourse(filteredUnplacedList);
  const groupedWaitlistedList = groupByCourse(waitlistedList);
  const placeableUnplacedList = rawUnplacedList.filter(item => !item.isPaymentPending);
  const selectedUnplacedItems = placeableUnplacedList.filter(item => selectedEnrollmentIds.includes(item.enrollmentId));
  const selectedCourseIds = Array.from(new Set(selectedUnplacedItems.map(item => item.courseId)));
  const selectedBulkCourseId = selectedCourseIds.length === 1 ? selectedCourseIds[0] : "";
  const selectedBulkCourse = store.courses.find(course => course.id === selectedBulkCourseId);
  const bulkPlaceSections = (store.courseSections || []).filter(
    section => section.semesterId === activeSemesterId &&
      section.status === "open" &&
      (!selectedBulkCourseId || section.courseId === selectedBulkCourseId)
  );
  const canBulkPlace = selectedEnrollmentIds.length > 0 && selectedCourseIds.length === 1 && Boolean(bulkPlaceSectionId);

  const updateSelectedEnrollmentIds = (nextIds: string[]) => {
    setSelectedEnrollmentIds(nextIds);
    const nextItems = rawUnplacedList.filter(item => nextIds.includes(item.enrollmentId));
    const nextCourseIds = Array.from(new Set(nextItems.map(item => item.courseId)));
    if (nextCourseIds.length !== 1) {
      setBulkPlaceSectionId("");
      return;
    }
    const selectedSection = (store.courseSections || []).find(section => section.id === bulkPlaceSectionId);
    if (selectedSection && selectedSection.courseId !== nextCourseIds[0]) {
      setBulkPlaceSectionId("");
    }
  };

  const toggleEnrollmentSelection = (enrollmentId: string, checked: boolean) => {
    updateSelectedEnrollmentIds(
      checked
        ? Array.from(new Set([...selectedEnrollmentIds, enrollmentId]))
        : selectedEnrollmentIds.filter(id => id !== enrollmentId)
    );
  };

  const toggleCourseSelection = (items: typeof filteredUnplacedList, checked: boolean) => {
    const itemIds = items.filter(item => !item.isPaymentPending).map(item => item.enrollmentId);
    updateSelectedEnrollmentIds(
      checked
        ? Array.from(new Set([...selectedEnrollmentIds, ...itemIds]))
        : selectedEnrollmentIds.filter(id => !itemIds.includes(id))
    );
  };

  const toggleCourseGroup = (groupKey: string) => {
    setExpandedCourseGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleOpenPlacement = (item: typeof unplacedList[0]) => {
    setSelectedEnrollment({
      enrollmentId: item.enrollmentId,
      studentId: item.studentId,
      studentName: item.studentName,
      courseId: item.courseId,
      courseTitle: item.courseTitle,
      isPaymentPending: item.isPaymentPending
    });
    // Default to the class the student picked when registering, otherwise the first open class
    const availableSections = (store.courseSections || []).filter(
      s => s.courseId === item.courseId && s.semesterId === activeSemesterId && s.status === "open"
    );
    const requestedSectionId = (store.enrollments || []).find(enrollment => enrollment.id === item.enrollmentId)?.requestedSectionId;
    const requestedSection = availableSections.find(section => section.id === requestedSectionId);
    setSelectedSectionId(requestedSection?.id || availableSections[0]?.id || "");
    setShowModal(true);
  };

  // Submit placement
  const handleAssignPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment || !selectedSectionId) {
      triggerToast("⚠️ Vui lòng chọn một lớp học phần hợp lệ!");
      return;
    }

    const section = (store.courseSections || []).find(s => s.id === selectedSectionId);
    
    if (!section) {
      triggerToast("⚠️ Không tìm thấy thông tin lớp học phần!");
      return;
    }

    // Check capacity
    const currentRegs = (store.courseRegistrations || []).filter(
      r => r.sectionId === selectedSectionId && r.status === "registered"
    ).length;

    if (currentRegs >= section.maxStudents) {
      triggerToast("⚠️ Lớp này đã đạt sĩ số tối đa. Không thể xếp thêm học viên.");
      return;
    }

    try {
      if (selectedEnrollment.isPaymentPending) {
        const paymentTx = (store.transactions || []).find((tx: any) =>
          tx.studentId === selectedEnrollment.studentId &&
          tx.courseId === selectedEnrollment.courseId &&
          (tx.status === "pending" || tx.status === "approved")
        );

        if (!paymentTx) {
          triggerToast("Không tìm thấy giao dịch thanh toán để duyệt trước khi xếp lớp.");
          return;
        }

        if (paymentTx.status === "pending") {
          await api.reviewTransaction(paymentTx.id, {
            status: "approved",
            notes: "Class placement admin confirmed payment during placement."
          });
        }
      }

      await api.approveEnrollment(selectedEnrollment.enrollmentId, {
        sectionId: selectedSectionId,
        semesterId: activeSemesterId
      });
      setShowModal(false);
      onRefreshData();
      triggerToast(
        selectedEnrollment.isPaymentPending
          ? `✅ Đã duyệt thanh toán và xếp lớp thành công cho ${selectedEnrollment.studentName}!`
          : `✅ Đã xếp lớp thành công cho học viên ${selectedEnrollment.studentName}!`
      );
    } catch (err: any) {
      triggerToast(err.message || "Không thể duyệt và xếp lớp học viên.");
    }
  };

  // Submit bulk placement
  const handleBulkPlaceSubmit = async () => {
    if (!bulkPlaceSectionId || selectedEnrollmentIds.length === 0) return;
    const selectedBlocked = rawUnplacedList.some(item => selectedEnrollmentIds.includes(item.enrollmentId) && item.isPaymentPending);
    if (selectedBlocked) {
      triggerToast("Payment must be confirmed before class placement.");
      return;
    }

    const section = (store.courseSections || []).find(s => s.id === bulkPlaceSectionId);
    if (!section) return;
    if (selectedCourseIds.length !== 1 || section.courseId !== selectedBulkCourseId) {
      triggerToast("Vui lòng chỉ chọn học viên trong cùng một môn và chọn lớp học phần đúng môn.");
      return;
    }

    const placements = selectedEnrollmentIds.map(id => ({
      enrollmentId: id,
      sectionId: bulkPlaceSectionId
    }));

    try {
      const res = (await api.bulkPlaceEnrollments(placements)) as any;
      triggerToast(`✅ Đã xếp lớp hàng loạt thành công cho ${res.count || placements.length} học viên!`);
      setSelectedEnrollmentIds([]);
      setBulkPlaceSectionId("");
      onRefreshData();
    } catch (err: any) {
      triggerToast(formatBulkError(err, "Không thể xếp lớp hàng loạt"));
    }
  };

  const handleGroupBulkPlace = async (courseId: string) => {
    const sectionId = groupBulkSectionIds[courseId];
    if (!sectionId) return;

    const groupItems = filteredUnplacedList.filter(item => item.courseId === courseId && !item.isPaymentPending);
    const selectedGroupIds = groupItems
      .filter(item => selectedEnrollmentIds.includes(item.enrollmentId))
      .map(item => item.enrollmentId);

    if (selectedGroupIds.length === 0) {
      triggerToast("⚠️ Vui lòng chọn học viên cần xếp lớp!");
      return;
    }

    const section = (store.courseSections || []).find(s => s.id === sectionId);
    if (!section) return;

    const placements = selectedGroupIds.map(id => ({
      enrollmentId: id,
      sectionId: sectionId
    }));

    try {
      const res = (await api.bulkPlaceEnrollments(placements)) as any;
      triggerToast(`✅ Đã xếp lớp hàng loạt thành công cho ${res.count || placements.length} học viên!`);
      
      // Clear selection for these items
      setSelectedEnrollmentIds(prev => prev.filter(id => !selectedGroupIds.includes(id)));
      
      // Clear dropdown selection
      setGroupBulkSectionIds(prev => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });
      onRefreshData();
    } catch (err: any) {
      triggerToast(formatBulkError(err, "Không thể xếp lớp hàng loạt"));
    }
  };

  // Submit CSV Import
  const handleCsvImportSubmit = async () => {
    if (!csvFileText.trim()) {
      triggerToast("⚠️ Vui lòng nhập hoặc tải tệp CSV.");
      return;
    }

    const lines = csvFileText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      triggerToast("⚠️ Tệp CSV trống hoặc thiếu hàng tiêu đề.");
      return;
    }

    const parseCsvLine = (row: string) => {
      const columns: string[] = [];
      let value = "";
      let quoted = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const next = row[i + 1];
        if (char === '"' && quoted && next === '"') {
          value += '"';
          i++;
          continue;
        }
        if (char === '"') {
          quoted = !quoted;
          continue;
        }
        if (char === "," && !quoted) {
          columns.push(value.trim());
          value = "";
          continue;
        }
        value += char;
      }
      columns.push(value.trim());
      return columns;
    };

    const headers = parseCsvLine(lines[0]);
    const studentCodeIdx = headers.findIndex(h => h.toLowerCase() === "studentcode");
    const emailIdx = headers.findIndex(h => h.toLowerCase() === "email");
    const sectionCodeIdx = headers.findIndex(h => h.toLowerCase() === "sectioncode");

    if (sectionCodeIdx === -1 || (studentCodeIdx === -1 && emailIdx === -1)) {
      triggerToast("⚠️ Tiêu đề cột CSV không hợp lệ. Phải chứa (studentCode hoặc email) và sectionCode.");
      return;
    }

    const placements: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < headers.length) continue;

      const placement: any = {
        sectionCode: cols[sectionCodeIdx].toUpperCase()
      };

      if (studentCodeIdx !== -1) {
        placement.studentCode = cols[studentCodeIdx];
      }
      if (emailIdx !== -1) {
        placement.email = cols[emailIdx];
      }

      placements.push(placement);
    }

    if (placements.length === 0) {
      triggerToast("⚠️ Không tìm thấy dòng dữ liệu nào để xử lý.");
      return;
    }

    try {
      const res = (await api.bulkPlaceEnrollments(placements)) as any;
      triggerToast(`✅ Xếp lớp thành công cho ${res.count || placements.length} học viên từ file CSV!`);
      setCsvFileText("");
      setShowCsvImportPanel(false);
      onRefreshData();
    } catch (err: any) {
      triggerToast(formatBulkError(err, "Lỗi xếp lớp hàng loạt bằng tệp CSV"));
    }
  };

  // Approve waitlist registration
  const handleApproveWaitlist = async (id: string, name: string, code: string) => {
    if (!window.confirm(`Xác nhận duyệt học viên ${name} từ danh sách chờ vào đăng ký chính thức của lớp ${code}?`)) return;

    const approved = await api.approveCourseRegistration(id).catch((err: any) => {
      triggerToast(err.message || "Khong the phe duyet hoc vien vao lop.");
      return null;
    });
    if (!approved) return;
    const storeData = AppStore.get();
    storeData.courseRegistrations = (storeData.courseRegistrations || []).map(r => {
      if (r.id === id) {
        return { ...r, status: "registered" as any };
      }
      return r;
    });

    AppStore.log(currentUser.id, "approve_waitlist", name, `Phê duyệt học viên vào lớp chính thức ${code}.`);
    AppStore.save(storeData);
    onRefreshData();
    triggerToast(`✅ Đã xếp lớp thành công cho ${name}!`);
  };

  return (
    <div className="space-y-6 font-sans text-white">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 border border-white/20 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <Info className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header controls block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-indigo-400" />
            Điều phối & Sắp xếp Lớp học
          </h3>
          <p className="text-xs text-white/50 mt-1">
            Quản lý những học viên đã đăng ký học môn nhưng chưa có ca xếp lớp chi tiết.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCsvImportPanel(!showCsvImportPanel)}
            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white font-bold text-xs rounded-xl border border-indigo-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> CSV Xếp lớp nhanh
          </button>
          
          <select
            value={activeSemesterId}
            onChange={(e) => {
              setActiveSemesterId(e.target.value);
              setSelectedEnrollmentIds([]);
            }}
            className="px-3 py-1.5 bg-black/40 text-white border border-white/10 rounded-xl text-xs focus:outline-none"
          >
            {store.semesters.map(sem => (
              <option key={sem.id} value={sem.id}>{sem.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CSV Import Panel */}
      {showCsvImportPanel && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
            <span className="font-bold text-sm text-indigo-300">Nhập danh sách xếp lớp từ CSV</span>
            <button
              onClick={() => {
                const csvTemplate = "studentCode,sectionCode\nSV001,JV101-01\nSV002,JV101-01";
                const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.setAttribute("href", url);
                a.setAttribute("download", "template_xep_lop.csv");
                a.click();
              }}
              className="text-[10px] text-indigo-300 font-bold hover:underline cursor-pointer"
            >
              Tải file CSV mẫu
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Vui lòng dán định dạng CSV hoặc tải tệp lên. Cần định dạng chuẩn: <strong>studentCode</strong> (hoặc <strong>email</strong>) và <strong>sectionCode</strong>.
            </p>
            <textarea
              rows={4}
              placeholder="studentCode,sectionCode&#10;SV001,CS101-01&#10;SV002,CS101-01"
              value={csvFileText}
              onChange={(e) => setCsvFileText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 text-white font-mono text-[11px] border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-between items-center pt-1.5">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setCsvFileText(event.target?.result as string || "");
                    };
                    reader.readAsText(file);
                  }
                }}
                className="text-[11px] text-white/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCsvImportPanel(false)}
                  className="px-3 py-1.5 bg-transparent text-white/50 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  onClick={handleCsvImportSubmit}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Xử lý Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono">
            Học viên chờ xếp lớp
          </span>
          <h4 className="text-3xl font-mono font-black text-white">{rawUnplacedList.length} HV</h4>
          <p className="text-[10px] text-white/40">Đã đăng ký nhưng chưa có ca xếp lớp cụ thể.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest font-mono">
            Danh sách chờ (Waitlist)
          </span>
          <h4 className="text-3xl font-mono font-black text-amber-400">{rawWaitlistedList.length} HV</h4>
          <p className="text-[10px] text-white/40">Đang chờ lớp học phần được thêm sĩ số trống.</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-white/10 p-5 rounded-3xl relative overflow-hidden space-y-1">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">
            Lớp học phần hoạt động
          </span>
          <h4 className="text-3xl font-mono font-black text-emerald-400">
            {(store.courseSections || []).filter(s => s.semesterId === activeSemesterId && s.status === "open").length} Lớp
          </h4>
          <p className="text-[10px] text-white/40">Số lớp học phần đang tuyển sinh tháng này.</p>
        </div>
      </div>

      {/* Tab select and search input bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
        <div className="flex gap-1 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("unplaced")}
            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "unplaced" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Chờ xếp lớp ({rawUnplacedList.length})
          </button>
          <button
            onClick={() => setActiveTab("waitlisted")}
            className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === "waitlisted" ? "bg-indigo-600 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            Danh sách Chờ ({rawWaitlistedList.length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {activeTab === "unplaced" && (
            <div className="flex items-center gap-1.5 text-xs text-white/60 w-full sm:w-auto">
              <span>Lớp Sinh hoạt:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setSelectedEnrollmentIds([]);
                }}
                className="px-2 py-1 bg-black/40 text-white border border-white/10 rounded-xl focus:outline-none text-[11px]"
              >
                <option value="all">Tất cả lớp</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Tìm theo học viên, môn học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/25 text-white border border-white/10 rounded-xl py-1.5 px-3 pl-8 text-xs outline-none focus:border-indigo-400 placeholder-white/20"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {activeTab === "unplaced" && selectedEnrollmentIds.length > 0 && (
        <div className="bg-indigo-950/40 border border-indigo-500/25 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs animate-in slide-in-from-top-1 duration-150">
          <div className="space-y-1">
            <span className="font-bold">Đang chọn:</span>
            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-mono font-bold">
              {selectedEnrollmentIds.length} học viên
            </span>
            {selectedBulkCourse && (
              <span className="ml-2 px-2 py-0.5 bg-white/10 text-white rounded border border-white/10">
                {selectedBulkCourse.title}
              </span>
            )}
            {selectedCourseIds.length > 1 && (
              <p className="text-[10.5px] text-amber-300">
                Chọn hàng loạt chỉ áp dụng cho học viên cùng một môn. Bỏ bớt lựa chọn khác môn để chọn lớp đích.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-white/70 font-medium">Chọn lớp học phần đích:</label>
            <select
              value={bulkPlaceSectionId}
              onChange={(e) => setBulkPlaceSectionId(e.target.value)}
              disabled={selectedCourseIds.length !== 1}
              className="px-3 py-1.5 bg-slate-950 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 text-xs"
            >
              <option value="">
                {selectedCourseIds.length === 1 ? "-- Chọn lớp học phần đúng môn --" : "-- Chọn một môn trước --"}
              </option>
              {bulkPlaceSections.map(s => {
                  const courseTitle = store.courses.find(c => c.id === s.courseId)?.title || "";
                  return (
                    <option key={s.id} value={s.id}>
                      {s.sectionCode} ({courseTitle})
                    </option>
                  );
                })}
            </select>
            <button
              onClick={handleBulkPlaceSubmit}
              disabled={!canBulkPlace}
              className="px-4.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Xếp lớp hàng loạt
            </button>
          </div>
        </div>
      )}

      {/* DATA TABLE */}
      <div className="space-y-4">
        {activeTab === "unplaced" ? (
          <>
            {groupedUnplacedList.map(group => {
              const openSections = (store.courseSections || []).filter(
                section => section.courseId === group.courseId && section.semesterId === activeSemesterId && section.status === "open"
              );
              const placeableGroupItems = group.items.filter(item => !item.isPaymentPending);
              const groupSelectedCount = placeableGroupItems.filter(item => selectedEnrollmentIds.includes(item.enrollmentId)).length;
              const allGroupSelected = placeableGroupItems.length > 0 && groupSelectedCount === placeableGroupItems.length;
              const groupKey = `unplaced:${group.courseId}`;
              const isExpanded = Boolean(expandedCourseGroups[groupKey]);

              return (
                <section key={group.courseId} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-white/4">
                    <button
                      type="button"
                      onClick={() => toggleCourseGroup(groupKey)}
                      className="flex items-start gap-3 min-w-0 text-left cursor-pointer group"
                    >
                      <div className="mt-0.5 h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center shrink-0">
                        <ChevronDown className={`h-4.5 w-4.5 text-indigo-300 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Môn học</div>
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-200">{group.courseTitle}</h4>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-white/65">
                      <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">{group.items.length} học viên chờ xếp</span>
                      {group.items.some(item => item.isPaymentPending) && (
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          {group.items.filter(item => item.isPaymentPending).length} chờ thanh toán
                        </span>
                      )}
                      {groupSelectedCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                          Đã chọn {groupSelectedCount}/{placeableGroupItems.length}
                        </span>
                      )}
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">{openSections.length} lớp đang mở</span>
                      <label className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/20 border border-white/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          disabled={placeableGroupItems.length === 0}
                          onChange={(e) => toggleCourseSelection(placeableGroupItems, e.target.checked)}
                          className="rounded border-white/20 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                        />
                        Chọn tất cả
                      </label>
                      {groupSelectedCount > 0 && (
                        openSections.length > 0 ? (
                          <div className="flex items-center gap-1.5 bg-indigo-600/20 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                            <span className="text-[10px] text-indigo-300 font-bold shrink-0">Xếp vào lớp:</span>
                            <select
                              value={groupBulkSectionIds[group.courseId] || ""}
                              onChange={(e) => setGroupBulkSectionIds(prev => ({ ...prev, [group.courseId]: e.target.value }))}
                              className="px-2 py-0.5 bg-slate-950 text-white border border-white/10 rounded-md focus:outline-none text-[10.5px]"
                            >
                              <option value="">-- Chọn lớp --</option>
                              {openSections.map(s => {
                                const currentCount = (store.courseRegistrations || []).filter(
                                  r => r.sectionId === s.id && r.status === "registered"
                                ).length;
                                return (
                                  <option key={s.id} value={s.id}>
                                    {s.sectionCode} ({currentCount}/{s.maxStudents})
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              onClick={() => handleGroupBulkPlace(group.courseId)}
                              disabled={!groupBulkSectionIds[group.courseId]}
                              className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 disabled:text-white/40 disabled:cursor-not-allowed text-white font-bold rounded-md transition cursor-pointer text-[10.5px]"
                            >
                              Xác nhận xếp
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold">
                            ⚠️ Chưa có lớp mở
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                          <th className="py-3 px-3 w-8"></th>
                          <th className="py-3">Học viên chờ xếp</th>
                          <th className="py-3">Lớp sinh hoạt</th>
                          <th className="py-3">Ngày đăng ký môn</th>
                          <th className="py-3 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-white/85">
                        {group.items.map(item => (
                          <tr key={item.enrollmentId} className="hover:bg-white/2 transition">
                            <td className="py-3.5 px-3">
                              <input
                                type="checkbox"
                                checked={selectedEnrollmentIds.includes(item.enrollmentId)}
                                disabled={item.isPaymentPending}
                                onChange={(e) => toggleEnrollmentSelection(item.enrollmentId, e.target.checked)}
                                className="rounded border-white/20 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-3.5">
                              <div className="font-bold text-white">{item.studentName}</div>
                              <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                              {item.isPaymentPending && (
                                <span className="mt-1 inline-block px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold">
                                  Chờ xác nhận thanh toán
                                </span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span className="inline-block px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 font-mono text-[9px] rounded border border-indigo-500/20">
                                {item.className}
                              </span>
                            </td>
                            <td className="py-3.5 font-mono text-indigo-300">
                              {new Date(item.enrolledAt).toLocaleDateString("vi-VN")}
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => handleOpenPlacement(item)}
                                className="px-3.5 py-1.5 bg-white text-indigo-950 font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer text-[10.5px] inline-flex items-center gap-1"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                {item.isPaymentPending ? "Duyệt & xếp lớp" : "Xếp lớp học phần"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </section>
              );
            })}

            {groupedUnplacedList.length === 0 && (
              <div className="bg-slate-900 border border-white/10 rounded-2xl py-12 text-center text-white/30 italic text-xs">
                Không tìm thấy học viên chờ xếp lớp nào phù hợp.
              </div>
            )}
          </>
        ) : (
          <>
            {groupedWaitlistedList.map(group => {
              const groupKey = `waitlisted:${group.courseId}`;
              const isExpanded = Boolean(expandedCourseGroups[groupKey]);

              return (
                <section key={group.courseId} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-white/10 bg-white/4">
                    <button
                      type="button"
                      onClick={() => toggleCourseGroup(groupKey)}
                      className="flex items-start gap-3 min-w-0 text-left cursor-pointer group"
                    >
                      <div className="mt-0.5 h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-400/20 flex items-center justify-center shrink-0">
                        <ChevronDown className={`h-4.5 w-4.5 text-amber-300 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Môn học</div>
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-amber-100">{group.courseTitle}</h4>
                      </div>
                    </button>
                    <span className="w-fit px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10.5px]">
                      {group.items.length} học viên trong danh sách chờ
                    </span>
                  </div>
                  {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-white/40 uppercase text-[10px]">
                          <th className="py-3 px-5">Học viên chờ lớp</th>
                          <th className="py-3">Mã lớp xếp hàng</th>
                          <th className="py-3">Đăng ký vào</th>
                          <th className="py-3 text-right pr-5">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-white/85">
                        {group.items.map(item => (
                          <tr key={item.registrationId} className="hover:bg-white/2 transition">
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-white">{item.studentName}</div>
                              <div className="text-[10px] text-white/40 font-mono">{item.studentEmail}</div>
                            </td>
                            <td className="py-3.5">
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 font-mono font-bold rounded text-[10px]">
                                {item.sectionCode}
                              </span>
                            </td>
                            <td className="py-3.5 font-mono text-indigo-300">
                              {new Date(item.registeredAt).toLocaleDateString("vi-VN")}
                            </td>
                            <td className="py-3.5 text-right pr-5">
                              <button
                                onClick={() => handleApproveWaitlist(item.registrationId, item.studentName, item.sectionCode)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-[10.5px] inline-flex items-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> Phê duyệt vào lớp
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </section>
              );
            })}

            {groupedWaitlistedList.length === 0 && (
              <div className="bg-slate-900 border border-white/10 rounded-2xl py-12 text-center text-white/30 italic text-xs">
                Danh sách chờ lớp học phần hiện tại trống.
              </div>
            )}
          </>
        )}
      </div>

      {/* PLACEMENT MODAL */}
      {showModal && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center bg-white/3 px-6 py-4 border-b border-white/5">
              <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
                <Layers className="h-5 w-5 text-indigo-400" />
                Xếp lớp Học phần Hành chính
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleAssignPlacement} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest font-mono">Học viên lựa chọn</span>
                <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                  <h5 className="font-bold text-white text-sm">{selectedEnrollment.studentName}</h5>
                  {selectedEnrollment.isPaymentPending && (
                    <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl text-[11px] leading-relaxed">
                      Học viên đang chờ xác nhận thanh toán. Khi bấm xác nhận, hệ thống sẽ duyệt giao dịch thanh toán trước rồi xếp học viên vào lớp đã chọn.
                    </div>
                  )}
                  <p className="text-[11px] text-white/50 mt-0.5">Môn học đã ghi danh: <strong className="text-white">{selectedEnrollment.courseTitle}</strong></p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/60 block font-bold">Chọn lớp học phần trống chỗ</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full px-3 py-2 bg-black/25 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/40 text-xs"
                >
                  <option value="">-- Chọn Lớp học phần mở trong kỳ --</option>
                  {(store.courseSections || [])
                    .filter(s => s.courseId === selectedEnrollment.courseId && s.semesterId === activeSemesterId && s.status === "open")
                    .map(s => {
                      const currentCount = (store.courseRegistrations || []).filter(
                        r => r.sectionId === s.id && r.status === "registered"
                      ).length;

                      const scheduleSummary = s.schedule.map(slot => 
                        `${slot.dayOfWeek} (${slot.startTime}-${slot.endTime})`
                      ).join(", ");

                      return (
                        <option key={s.id} value={s.id}>
                          {s.sectionCode} - Phòng {s.schedule[0]?.room || "Chưa gán"} ({currentCount}/{s.maxStudents} HV) - Lịch: {scheduleSummary}
                        </option>
                      );
                    })}
                </select>

                {(store.courseSections || []).filter(
                  s => s.courseId === selectedEnrollment.courseId && s.semesterId === activeSemesterId && s.status === "open"
                ).length === 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span>
                      ⚠️ Hiện chưa có lớp học phần mở nào cho môn học này trong tháng {activeSemesterId}. Vui lòng tạo mới Lớp học phần trước!
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Modal Actions */}
              <div className="border-t border-white/5 pt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-transparent text-white/50 hover:text-white transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!selectedSectionId}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {selectedEnrollment.isPaymentPending ? "Duyệt thanh toán & xếp lớp" : "Xác nhận Xếp lớp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
