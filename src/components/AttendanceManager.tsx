import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  Send,
  Plus,
  Eye,
  Edit,
  Trash,
  ExternalLink,
  Search,
  MessageSquare,
  X,
  FileText,
  Upload,
  Link2
} from "lucide-react";
import { LMSDataStore, Course, User, AttendanceSession } from "../types";
import { api } from "../api";
import ModalPortal from "./ModalPortal";
import SessionMaterialsEditor from "./SessionMaterialsEditor";
import { ZoomLogo } from "./icons/BrandLogos";

const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_FILE_LABEL = "50 MB";

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
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || defaultCourseId || "");
  const [selectedSectionId, setSelectedSectionId] = useState(sectionId || "");
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

  const allCourses = store.courses || [];
  const courses = currentUser.role === "teacher"
    ? allCourses.filter(c => c.teacherId === currentUser.id)
    : allCourses;

  const courseSections = (store.courseSections || []).filter((s: any) => s.courseId === selectedCourseId && s.status !== "cancelled");
  const activeSection = (store.courseSections || []).find((s: any) => s.id === selectedSectionId);

  // Sessions for chosen course/section
  const sessions = (store.attendanceSessions || []).filter(s => (
    s.courseId === selectedCourseId && (!selectedSectionId || s.sectionId === selectedSectionId)
  ));

  // Auto-select first session if none is selected
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Modals state
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTopic, setNewSessionTopic] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("19:30 - 21:30");

  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [editTopic, setEditTopic] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editRecordingUrl, setEditRecordingUrl] = useState("");
  const [editDate, setEditDate] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  const [showEditMeetingUrlModal, setShowEditMeetingUrlModal] = useState(false);
  const [meetingUrlInput, setMeetingUrlInput] = useState("");
  const [isSavingMeetingUrl, setIsSavingMeetingUrl] = useState(false);

  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);

  // Handle Create Session
  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) {
      triggerToast("Vui lòng chọn môn học trước khi lập buổi học.");
      return;
    }
    if (!selectedSectionId) {
      triggerToast("Vui lòng chọn lớp học phần trước khi lập buổi học.");
      return;
    }
    if (!newSessionDate) {
      triggerToast("Hãy nhập ngày tháng cho buổi học.");
      return;
    }
    if (!newSessionTopic.trim()) {
      triggerToast("Hãy nhập chủ đề bài giảng cho buổi học.");
      return;
    }

    try {
      const combinedDate = newSessionTime.trim() ? `${newSessionDate} (${newSessionTime.trim()})` : newSessionDate;
      const result = await api.saveAttendance({
        courseId: selectedCourseId,
        sectionId: selectedSectionId,
        date: combinedDate,
        topic: newSessionTopic.trim(),
        records: []
      }) as any;
      setNewSessionDate("");
      setNewSessionTopic("");
      setNewSessionTime("19:30 - 21:30");
      setShowCreateSession(false);
      setActiveSessionId(result.session.id);
      onRefreshData();
      triggerToast("Đã thêm buổi học mới thành công.");
    } catch (err: any) {
      triggerToast(err.message || "Không thể khởi tạo buổi học.");
    }
  };

  // Handle Edit Session
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

  // Handle Update Section Meeting URL (Zoom link)
  const handleSaveMeetingUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionId || !activeSection) return;
    setIsSavingMeetingUrl(true);
    try {
      await api.updateCourseSection(selectedSectionId, {
        meetingUrl: meetingUrlInput.trim() || null
      });
      triggerToast("Đã cập nhật link Zoom cho lớp học thành công!");
      setShowEditMeetingUrlModal(false);
      onRefreshData();
    } catch (err: any) {
      triggerToast(err.message || "Không thể cập nhật link Zoom.");
    } finally {
      setIsSavingMeetingUrl(false);
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

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="space-y-6 animate-in fade-in duration-150 font-sans">
      {/* Page Header */}
      <div className="bg-white border border-slate-200/80 p-5 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-slate-900">
                Lịch học, Link Zoom & Tài liệu Buổi học
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý link phòng Zoom lớp học, đính kèm slide tài liệu bài giảng và video recording xem lại.
              </p>
            </div>
          </div>
        </div>

        {onGoBackToTimetable && (
          <button
            type="button"
            onClick={onGoBackToTimetable}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs cursor-pointer"
          >
            ← Quay lại Lịch giảng dạy
          </button>
        )}
      </div>

      {/* Selectors: Course & Section */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="col-span-1 md:col-span-6 space-y-1">
            <label className="text-slate-700 font-semibold text-xs block">
              1. Khóa học / Học phần:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedSectionId(""); setActiveSessionId(""); }}
              disabled={lockSelectors}
              className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition shadow-xs disabled:opacity-50"
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title} ({c.category})</option>
              ))}
            </select>
          </div>

          <div className="col-span-1 md:col-span-6 space-y-1">
            <label className="text-slate-700 font-semibold text-xs block">
              2. Lớp học phần:
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => { setSelectedSectionId(e.target.value); setActiveSessionId(""); }}
              disabled={lockSelectors || !selectedCourseId}
              className="w-full p-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition shadow-xs disabled:opacity-50"
            >
              <option value="">-- Chọn lớp học phần --</option>
              {courseSections.map((section: any) => (
                <option key={section.id} value={section.id}>{section.sectionCode} - {section.scheduleDisplay || "Lớp học"}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCourseId && selectedSectionId && activeSection ? (
        <div className="space-y-6">
          {/* Zoom Meeting Card for the Class Section */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 p-4 md:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 font-mono text-[10.5px] font-bold text-blue-900">
                    Lớp: {activeSection.sectionCode}
                  </span>
                  <span className="text-xs text-slate-500">
                    {activeSection.schedule?.map((s: any) => `${s.dayOfWeek} (${s.startTime}-${s.endTime})`).join(", ") || "Lịch học trực tuyến"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <ZoomLogo className="h-4.5 w-4.5 shrink-0" /> Link phòng Zoom học trực tuyến:
                  </span>
                  {activeSection.meetingUrl ? (
                    <a
                      href={activeSection.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-bold text-[#0B5CFF] hover:underline flex items-center gap-1 bg-white border border-blue-200 px-2.5 py-1 rounded-lg truncate max-w-xs md:max-w-md"
                    >
                      {activeSection.meetingUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa gắn link Zoom cho lớp này</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeSection.meetingUrl && (
                  <a
                    href={activeSection.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B5CFF] hover:bg-[#004BE5] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
                  >
                    <ZoomLogo className="h-3.5 w-3.5" /> Vào phòng Zoom ngay ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMeetingUrlInput(activeSection.meetingUrl || "");
                    setShowEditMeetingUrlModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
                >
                  <Edit className="h-3.5 w-3.5 text-slate-500" />
                  {activeSection.meetingUrl ? "Đổi link Zoom" : "+ Thêm link Zoom"}
                </button>
              </div>
            </div>
          </div>

          {/* Sessions & Materials Workspace Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Sessions List (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Lộ trình Buổi học ({sessions.length})
                  </h4>
                  <p className="text-[10px] text-slate-500">Bấm chọn buổi để tải tài liệu</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateSession(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm buổi
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {sessions.map((s, index) => {
                  const isSelected = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-300 shadow-xs"
                          : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                        }`}>
                          Buổi {index + 1}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {s.date?.split(" ")[0]}
                        </span>
                      </div>
                      <p className={`mt-1.5 text-xs font-bold line-clamp-2 ${isSelected ? "text-indigo-950" : "text-slate-800"}`}>
                        {s.topic || `Buổi học số ${index + 1}`}
                      </p>
                      {s.date && (
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" /> {s.date}
                        </p>
                      )}
                    </div>
                  );
                })}

                {sessions.length === 0 && (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs p-4">
                    Lớp này chưa có buổi học nào. Hãy bấm <strong>"Thêm buổi"</strong> để tạo buổi đầu tiên.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Active Session Detail & Materials Editor (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {activeSession ? (
                <div className="space-y-4">
                  {/* Active Session Info Header */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-700 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                            Buổi đang chọn
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            {activeSession.date}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-bold text-slate-900">
                          {activeSession.topic || "Buổi học trực tuyến"}
                        </h3>
                        {activeSession.content && (
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {activeSession.content}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditTopic(activeSession.topic || "");
                            setEditContent(activeSession.content || "");
                            setEditVideoUrl(activeSession.videoUrl || "");
                            setEditRecordingUrl(activeSession.recordingUrl || "");
                            setEditDate(activeSession.date || "");
                            setShowEditSessionModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-500" /> Sửa thông tin buổi
                        </button>
                      </div>
                    </div>

                    {/* Video Recording Link of the Session */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Video className="h-4 w-4 text-indigo-600" /> Video Recording buổi học (để học viên xem lại)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditTopic(activeSession.topic || "");
                            setEditContent(activeSession.content || "");
                            setEditVideoUrl(activeSession.videoUrl || "");
                            setEditRecordingUrl(activeSession.recordingUrl || "");
                            setEditDate(activeSession.date || "");
                            setShowEditSessionModal(true);
                          }}
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          {activeSession.recordingUrl ? "Đổi link recording" : "+ Gắn link recording"}
                        </button>
                      </div>

                      {activeSession.recordingUrl ? (
                        <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg p-2.5">
                          <a
                            href={activeSession.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-indigo-700 hover:underline truncate max-w-lg"
                          >
                            {activeSession.recordingUrl} ↗
                          </a>
                          <a
                            href={activeSession.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" /> Mở xem
                          </a>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Chưa có video recording cho buổi này. Sau buổi học, giảng viên dán link Zoom Cloud hoặc Google Drive vào đây để học viên tự xem lại.
                        </p>
                      )}

                      {activeSession.videoUrl && (
                        <div className="pt-2">
                          <video
                            src={activeSession.videoUrl}
                            controls
                            className="w-full max-h-56 rounded-xl border border-slate-200 bg-black"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Materials Editor for this Session */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <SessionMaterialsEditor
                      sessionId={activeSession.id}
                      triggerToast={triggerToast}
                      onChanged={onRefreshData}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-24 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs p-6 space-y-2 shadow-xs">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">Chưa chọn buổi học</p>
                  <p className="text-[11px] text-slate-400">Vui lòng chọn một buổi học ở danh sách bên trái hoặc bấm "Thêm buổi" để thiết lập.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center border border-dashed border-slate-200 bg-white rounded-2xl text-slate-400 space-y-3 shadow-xs flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Video className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h5 className="text-sm font-bold text-slate-800">
              Chọn Khóa học và Lớp học phần ở trên
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Chọn khóa học và lớp để thiết lập link phòng Zoom trực tuyến, xem lịch buổi học và đính kèm tài liệu học tập (Slide, Excel, Power BI, Word, Video).
            </p>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE NEW SESSION */}
      {showCreateSession && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-xs text-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateSession(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-indigo-600" /> Thêm buổi học mới
              </h4>

              <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Chủ đề bài giảng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Buổi 1 - Tổng quan về Power BI & Data Modeling"
                    value={newSessionTopic}
                    onChange={e => setNewSessionTopic(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Ngày học *</label>
                    <input
                      type="date"
                      required
                      value={newSessionDate}
                      onChange={e => setNewSessionDate(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Khung giờ học</label>
                    <input
                      type="text"
                      placeholder="19:30 - 21:30"
                      value={newSessionTime}
                      onChange={e => setNewSessionTime(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateSession(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                  >
                    Thêm buổi học
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 2: EDIT SESSION (Topic, Content, Video, Recording) */}
      {showEditSessionModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-xs text-slate-800">
              <button
                type="button"
                onClick={() => setShowEditSessionModal(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Edit className="h-4 w-4 text-indigo-600" /> Sửa thông tin buổi học & Video
              </h4>

              <form onSubmit={handleEditSessionSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Chủ đề bài giảng *</label>
                  <input
                    type="text"
                    required
                    value={editTopic}
                    onChange={e => setEditTopic(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Ngày giờ hiển thị</label>
                  <input
                    type="text"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    placeholder="2026-09-20 (19:30 - 21:30)"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Link Video Recording (Zoom Cloud / Google Drive / YouTube)
                  </label>
                  <input
                    type="url"
                    value={editRecordingUrl}
                    onChange={e => setEditRecordingUrl(e.target.value)}
                    placeholder="https://us02web.zoom.us/rec/... hoặc link Google Drive"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    Học viên sẽ thấy nút "Mở xem video bài giảng" để ôn lại bài bất cứ lúc nào.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Mô tả chi tiết nội dung</label>
                  <textarea
                    rows={3}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    placeholder="Mục tiêu buổi học, kiến thức cần nắm, lưu ý..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditSessionModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingSession}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {isUpdatingSession ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: EDIT CLASS SECTION ZOOM MEETING URL */}
      {showEditMeetingUrlModal && activeSection && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-xs text-slate-800">
              <button
                type="button"
                onClick={() => setShowEditMeetingUrlModal(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>

              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                <ZoomLogo className="h-4.5 w-4.5" /> Link phòng Zoom - Lớp {activeSection.sectionCode}
              </h4>
              <p className="text-[11px] text-slate-500 mb-4">
                Link này sẽ hiển thị nổi bật trên màn hình học tập của tất cả học viên đã được xếp vào lớp này.
              </p>

              <form onSubmit={handleSaveMeetingUrl} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Đường link phòng Zoom / Google Meet *</label>
                  <input
                    type="url"
                    required
                    value={meetingUrlInput}
                    onChange={e => setMeetingUrlInput(e.target.value)}
                    placeholder="https://zoom.us/j/... hoặc https://meet.google.com/..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditMeetingUrlModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMeetingUrl}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSavingMeetingUrl ? "Đang lưu..." : "Lưu link Zoom"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
