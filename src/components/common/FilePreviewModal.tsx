import React, { useState, useEffect } from "react";
import { 
  X, 
  Download, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Copy, 
  Check, 
  Code2, 
  FileText
} from "lucide-react";
import ModalPortal from "../ModalPortal";
import { SubmissionFileInfo, renderSubmissionFileIcon } from "../../submissionFiles";

interface FilePreviewModalProps {
  files: SubmissionFileInfo[];
  initialIndex?: number;
  onClose: () => void;
  studentName?: string;
  assignmentTitle?: string;
}

export default function FilePreviewModal({
  files,
  initialIndex = 0,
  onClose,
  studentName,
  assignmentTitle
}: FilePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialIndex >= 0 && initialIndex < files.length) return initialIndex;
    return 0;
  });

  const [imageZoom, setImageZoom] = useState<number>(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeFile = files[currentIndex] || files[0];

  // Reset zoom and load text content when active file changes
  useEffect(() => {
    setImageZoom(1);
    setTextContent(null);
    setCopiedCode(false);

    if (!activeFile) return;

    const codeExtensions = [
      ".txt", ".py", ".js", ".jsx", ".ts", ".tsx", ".html", 
      ".css", ".json", ".sql", ".java", ".c", ".cpp", ".cs", 
      ".md", ".xml", ".yaml", ".yml", ".sh", ".bat"
    ];
    const isCodeOrText = codeExtensions.includes(activeFile.ext.toLowerCase());

    if (isCodeOrText && activeFile.url) {
      setTextLoading(true);
      fetch(activeFile.url)
        .then(res => {
          if (!res.ok) throw new Error("Could not load text file");
          return res.text();
        })
        .then(text => {
          setTextContent(text);
          setTextLoading(false);
        })
        .catch(() => {
          setTextContent(null);
          setTextLoading(false);
        });
    }
  }, [activeFile?.url, activeFile?.ext]);

  // Keyboard navigation (Escape to close, ArrowLeft / ArrowRight to switch files)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && files.length > 1) {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : files.length - 1));
      } else if (e.key === "ArrowRight" && files.length > 1) {
        setCurrentIndex(prev => (prev < files.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files.length, onClose]);

  if (!activeFile) return null;

  const handleCopyCode = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isCodeOrText = Boolean(textContent !== null || textLoading);

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[100] flex items-center justify-center p-2 sm:p-4">
        <div 
          className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl h-[92vh] max-h-[920px] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                {renderSubmissionFileIcon(activeFile, "h-5 w-5")}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate" title={activeFile.filename}>
                    {activeFile.filename}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold uppercase shrink-0">
                    {activeFile.ext.replace(".", "") || "FILE"}
                  </span>
                </div>
                {(studentName || assignmentTitle) && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {studentName && <span>Học viên: <strong className="text-slate-700">{studentName}</strong></span>}
                    {studentName && assignmentTitle && <span> • </span>}
                    {assignmentTitle && <span>Bài tập: <strong className="text-slate-700">{assignmentTitle}</strong></span>}
                  </p>
                )}
              </div>
            </div>

            {/* Actions: Download, Open, Close */}
            <div className="flex items-center gap-2 shrink-0">
              {files.length > 1 && (
                <div className="hidden sm:flex items-center gap-1 mr-2 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 font-semibold shadow-2xs">
                  <span>Tệp {currentIndex + 1}/{files.length}</span>
                </div>
              )}

              <a
                href={activeFile.url}
                download={activeFile.filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer font-sans"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tải về</span>
              </a>

              <a
                href={activeFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition shadow-2xs"
                title="Mở trong tab trình duyệt mới"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Tab mới</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                aria-label="Đóng cửa sổ xem trước"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Multiple Files Tab Strip */}
          {files.length > 1 && (
            <div className="border-b border-slate-200 bg-white px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-thin">
              <span className="text-[11px] font-semibold uppercase font-mono text-slate-400 shrink-0 mr-1">
                Danh sách tệp ({files.length}):
              </span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {files.map((file, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap cursor-pointer border ${
                        isActive
                          ? "bg-indigo-50 border-indigo-200 text-indigo-800 font-bold shadow-2xs"
                          : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {renderSubmissionFileIcon(file, "h-3.5 w-3.5 shrink-0")}
                      <span className="truncate max-w-[140px] sm:max-w-[180px]">{file.filename}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation arrows */}
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : files.length - 1))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title="Tệp trước (Phím mũi tên trái)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => (prev < files.length - 1 ? prev + 1 : 0))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                  title="Tệp tiếp theo (Phím mũi tên phải)"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-h-0 bg-slate-900 relative flex flex-col overflow-hidden">
            {/* 1. Image Viewer */}
            {activeFile.isImage ? (
              <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 relative select-none">
                <img
                  src={activeFile.url}
                  alt={activeFile.filename}
                  style={{ transform: `scale(${imageZoom})`, transition: "transform 0.15s ease" }}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                />

                {/* Floating Image Zoom Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-sm border border-slate-700 text-white rounded-2xl px-3 py-1.5 flex items-center gap-3 shadow-xl">
                  <button
                    type="button"
                    onClick={() => setImageZoom(z => Math.max(0.2, z - 0.25))}
                    className="p-1 hover:text-indigo-400 transition cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-mono font-bold w-12 text-center">
                    {Math.round(imageZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageZoom(z => Math.min(4, z + 0.25))}
                    className="p-1 hover:text-indigo-400 transition cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <div className="h-3 w-px bg-slate-700 mx-1" />
                  <button
                    type="button"
                    onClick={() => setImageZoom(1)}
                    className="p-1 hover:text-indigo-400 transition cursor-pointer"
                    title="Đặt lại tỉ lệ gốc"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : activeFile.isPdf ? (
              /* 2. PDF Viewer */
              <div className="flex-1 h-full w-full bg-slate-900">
                <iframe
                  title={`Xem trước tài liệu ${activeFile.filename}`}
                  src={activeFile.url}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            ) : isCodeOrText ? (
              /* 3. Text / Source Code Viewer */
              <div className="flex-1 h-full w-full flex flex-col bg-slate-950 text-slate-100 font-mono text-xs overflow-hidden">
                <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Code2 className="h-4 w-4 text-indigo-400" />
                    <span>Nội dung mã nguồn / tệp văn bản</span>
                  </div>
                  {textContent !== null && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer font-sans"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedCode ? "Đã chép" : "Sao chép mã"}</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-4 leading-relaxed whitespace-pre font-mono selection:bg-indigo-600 selection:text-white">
                  {textLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-500 space-y-2">
                      <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mr-2" />
                      <span>Đang tải nội dung tệp văn bản...</span>
                    </div>
                  ) : textContent !== null ? (
                    <code>{textContent}</code>
                  ) : (
                    <iframe
                      title={`Xem trước tệp ${activeFile.filename}`}
                      src={activeFile.url}
                      className="h-full w-full border-0 bg-white text-slate-900"
                    />
                  )}
                </div>
              </div>
            ) : (
              /* 4. Document Card (Office / Zip / Other) */
              <div className="flex-1 h-full w-full flex flex-col items-center justify-center p-6 text-center text-slate-900 bg-white space-y-6 overflow-y-auto">
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm">
                  {renderSubmissionFileIcon(activeFile, "h-20 w-20")}
                </div>

                <div className="space-y-2 max-w-lg">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold font-mono uppercase tracking-wider">
                    {activeFile.ext.replace(".", "").toUpperCase() || "TỆP ĐÍNH KÈM"}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900 truncate px-4" title={activeFile.filename}>
                    {activeFile.filename}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Định dạng tệp này được lưu trữ an toàn trên máy chủ MCNA. Giảng viên có thể tải tệp về máy tính để chấm bài hoặc xem chi tiết.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={activeFile.url}
                    download={activeFile.filename}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-2xl transition flex items-center gap-2 shadow-sm cursor-pointer font-sans"
                  >
                    <Download className="h-4 w-4" /> Tải tệp bài làm về máy
                  </a>
                  <a
                    href={activeFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-2xl border border-slate-200 transition flex items-center gap-2 cursor-pointer font-sans"
                  >
                    <ExternalLink className="h-4 w-4" /> Mở trong tab mới
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
