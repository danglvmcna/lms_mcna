import React, { useState } from "react";
import { BookOpen, HelpCircle, FileText, Plus, Eye, Edit, Check, Award, Settings, Download, Tv, Trash, ChevronRight, TrendingUp, BarChart, Users, Clock, Search, MessageSquare, X, PlusCircle, FolderPlus, Upload, AlertCircle } from "lucide-react";
import { AppStore } from "../../store";
import { generateId } from "../../utils";
import { Question, LMSDataStore } from "../../types";
import { api } from "../../api";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
}

type QuizQuestionDraft = Pick<Question, "text" | "type" | "options" | "correctAnswer">;

export default function QuizBuilder(props: ComponentProps) {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [quizEditId, setQuizEditId] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [modalCsvText, setModalCsvText] = useState("");
  const [modalCsvFileName, setModalCsvFileName] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [modalDraftQuestions, setModalDraftQuestions] = useState<QuizQuestionDraft[]>([]);
  const [modalQuestionText, setModalQuestionText] = useState("");
  const [modalQuestionType, setModalQuestionType] = useState<"single" | "multiple" | "text">("single");
  const [modalQuestionOptionsText, setModalQuestionOptionsText] = useState("");
  const [modalQuestionCorrect, setModalQuestionCorrect] = useState("0");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 20 * 1024 * 1024) {
      if (triggerToast) triggerToast("Tệp tải lên vượt quá giới hạn 20MB.");
      return;
    }
    try {
      setIsSubmitting(true);
      if (triggerToast) triggerToast("Đang tải tệp lên...");
      const res = await api.uploadFile(file);
      setter(res.url);
      if (triggerToast) triggerToast("Tải tệp thành công.");
    } catch (err) {
      console.error(err);
      if (triggerToast) triggerToast("Lỗi tải tệp lên.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    activeSubTab,
    setActiveSubTab,
    selectedCourseId,
    setSelectedCourseId,
    selectedQuizId,
    setSelectedQuizId,
    selectedEssayId,
    setSelectedEssayId,
    assessmentType,
    setAssessmentType,
    showCourseModal,
    setShowCourseModal,
    courseModalMode,
    courseTitle,
    setCourseTitle,
    courseDesc,
    setCourseDesc,
    courseCategory,
    setCourseCategory,
    courseThumb,
    setCourseThumb,
    coursePrice,
    setCoursePrice,
    courseLevel,
    setCourseLevel,
    courseTags,
    setCourseTags,
    showLessonModal,
    setShowLessonModal,
    lessonTitle,
    setLessonTitle,
    lessonContent,
    setLessonContent,
    lessonVideo,
    setLessonVideo,
    lessonDuration,
    setLessonDuration,
    showQuizModal,
    setShowQuizModal,
    quizTitle,
    setQuizTitle,
    quizPassing,
    setQuizPassing,
    quizLimit,
    setQuizLimit,
    quizAttempts,
    setQuizAttempts,
    quizDeadline,
    setQuizDeadline,
    showQuestionModal,
    setShowQuestionModal,
    qText,
    setQText,
    qType,
    setQType,
    qOptions,
    setQOptions,
    qCorrect,
    setQCorrect,
    showAssignModal,
    setShowAssignModal,
    assignTitle,
    setAssignTitle,
    assignDesc,
    setAssignDesc,
    assignDeadline,
    setAssignDeadline,
    assignMaxScore,
    setAssignMaxScore,
    activeSubmissionId,
    setActiveSubmissionId,
    gradingScore,
    setGradingScore,
    gradingFeedback,
    setGradingFeedback,
    store,
    currentUser,
    myCourses,
    myCourseIds,
    handleOpenCreateCourse,
    handleOpenEditCourse,
    handleSaveCourse,
    handleSubmitCourseForApproval,
    handleAddLessonSubmit,
    handleAddQuizSubmit,
    handleAddQuestionSubmit,
    handleAddAssignmentSubmit,
    handleGradeSubmission,
    handleExportCSVGradebook,
    activeCourse,
    lessons,
    courseQuizzes,
    courseAssignments,
    myAssignments,
    studentSubmissionsRaw,
    onRefreshData,
    triggerToast,
    updateStore
  } = props;

  const handleStartEditQuiz = () => {
    const quizObj = store.quizzes.find((q: any) => q.id === selectedQuizId);
    if (!quizObj) return;

    setQuizEditId(quizObj.id);
    setQuizTitle(quizObj.title);
    setQuizPassing(quizObj.passingScore);
    setQuizLimit(quizObj.timeLimit);
    setQuizAttempts(quizObj.maxAttempts);
    setQuizDeadline(quizObj.deadline ? quizObj.deadline.split("T")[0] : "");
    setSelectedCourseId(quizObj.courseId);

    const sess = (store.attendanceSessions || []).find((s: any) => s.id === quizObj.sessionId);
    setSelectedSectionId(sess ? sess.sectionId || "" : "");
    setSelectedSessionId(quizObj.sessionId || "");

    setShowQuizModal(true);
  };

  const handleDeleteQuiz = async () => {
    if (!selectedQuizId) return;
    const quizObj = store.quizzes.find((q: any) => q.id === selectedQuizId);
    if (!quizObj) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xóa đề thi "${quizObj.title}" không? Tất cả câu hỏi đi kèm sẽ bị xóa vĩnh viễn.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      await api.deleteQuiz(selectedQuizId);
      
      if (updateStore) {
        updateStore((draft: LMSDataStore) => {
          draft.quizzes = draft.quizzes.filter(q => q.id !== selectedQuizId);
          draft.questions = draft.questions.filter(q => q.quizId !== selectedQuizId);
        });
      } else {
        const storeData = AppStore.get();
        storeData.quizzes = storeData.quizzes.filter(q => q.id !== selectedQuizId);
        storeData.questions = storeData.questions.filter(q => q.quizId !== selectedQuizId);
        AppStore.save(storeData);
        onRefreshData();
      }

      setSelectedQuizId(null);
      triggerToast("Đã xóa đề thi trắc nghiệm thành công.");
    } catch (err: any) {
      console.error("Failed to delete quiz:", err);
      triggerToast(err.message || "Lỗi xóa đề thi trên máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModalQuestionDraftForm = () => {
    setModalQuestionText("");
    setModalQuestionType("single");
    setModalQuestionOptionsText("");
    setModalQuestionCorrect("0");
  };

  const handleAddModalDraftQuestion = () => {
    const text = modalQuestionText.trim();
    if (!text) {
      triggerToast("Vui lòng nhập nội dung câu hỏi.");
      return;
    }

    const options = modalQuestionType === "text"
      ? []
      : modalQuestionOptionsText
          .split(/\r?\n|\|/)
          .map((option) => option.trim())
          .filter(Boolean);

    if (modalQuestionType !== "text" && options.length < 2) {
      triggerToast("Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn.");
      return;
    }

    const correctAnswer = modalQuestionCorrect.trim();
    if (!correctAnswer) {
      triggerToast("Vui lòng nhập đáp án đúng.");
      return;
    }

    if (modalQuestionType === "single") {
      const correctIndex = Number(correctAnswer);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        triggerToast(`Đáp án đúng phải là số thứ tự từ 0 đến ${options.length - 1}.`);
        return;
      }
    }

    if (modalQuestionType === "multiple") {
      const correctIndices = correctAnswer.split(",").map((value) => Number(value.trim()));
      if (correctIndices.length === 0 || correctIndices.some((idx) => !Number.isInteger(idx) || idx < 0 || idx >= options.length)) {
        triggerToast(`Các đáp án đúng phải là chỉ số hợp lệ từ 0 đến ${options.length - 1}, cách nhau bằng dấu phẩy.`);
        return;
      }
    }

    setModalDraftQuestions((prev) => [
      ...prev,
      { text, type: modalQuestionType, options, correctAnswer }
    ]);
    resetModalQuestionDraftForm();
  };

  const buildModalQuestionsPayload = () => {
    const csvQuestions = modalCsvText.trim()
      ? parseCSVText(modalCsvText).filter(q => !q.error).map(q => ({
          text: q.text,
          type: q.type,
          options: q.options,
          correctAnswer: q.correctAnswer
        }))
      : [];
    return [...modalDraftQuestions, ...csvQuestions];
  };

  const resetQuizModalQuestionInputs = () => {
    setModalDraftQuestions([]);
    resetModalQuestionDraftForm();
    setModalCsvText("");
    setModalCsvFileName("");
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || isSubmitting) return;
    if (!quizTitle.trim()) {
      triggerToast("Vui lòng nhập tiêu đề đề thi.");
      return;
    }
    if (!selectedSessionId) {
      triggerToast("Vui lòng chọn buổi học áp dụng cho đề thi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        courseId: selectedCourseId,
        title: quizTitle,
        passingScore: quizPassing,
        timeLimit: quizLimit,
        maxAttempts: quizAttempts,
        deadline: quizDeadline || null,
        sessionId: selectedSessionId || null
      };

      if (quizEditId) {
        const updated = await api.updateQuiz(quizEditId, payload);
        const questionPayload = buildModalQuestionsPayload();

        if (updateStore) {
          updateStore((draft: LMSDataStore) => {
            draft.quizzes = draft.quizzes.map(q => q.id === quizEditId ? { ...q, ...(updated as any) } : q);
          });
        } else {
          const storeData = AppStore.get();
          storeData.quizzes = storeData.quizzes.map(q => q.id === quizEditId ? { ...q, ...(updated as any) } : q);
          AppStore.save(storeData);
          onRefreshData();
        }

        if (questionPayload.length > 0) {
          const createdQuestions = (await api.bulkAddQuestions(quizEditId, questionPayload)) as any[];
          if (updateStore) {
            updateStore((draft: LMSDataStore) => {
              draft.questions.push(...createdQuestions);
            });
          } else {
            const storeData = AppStore.get();
            storeData.questions.push(...createdQuestions);
            AppStore.save(storeData);
            onRefreshData();
          }
        }

        AppStore.log(currentUser.id, "edit_quiz", quizTitle, `Updated assessment: ${quizEditId}`);
        triggerToast("Cập nhật cấu hình đề thi thành công.");
        setShowQuizModal(false);
        setQuizEditId(null);
        resetQuizModalQuestionInputs();
      } else {
        const created = (await api.createQuiz(payload)) as any;
        const questionPayload = buildModalQuestionsPayload();

        if (updateStore) {
          updateStore(draft => {
            draft.quizzes.push(created);
          });
        } else {
          const storeData = AppStore.get();
          storeData.quizzes.push(created);
          AppStore.save(storeData);
          onRefreshData();
        }

        AppStore.log(currentUser.id, "create_quiz", created.title, `Added assessment linked to course: ${selectedCourseId}`);

        if (questionPayload.length > 0) {
          const createdQuestions = (await api.bulkAddQuestions(created.id, questionPayload)) as any[];

          if (updateStore) {
            updateStore((draft: LMSDataStore) => {
              draft.questions.push(...createdQuestions);
            });
          } else {
            const storeData = AppStore.get();
            storeData.questions.push(...createdQuestions);
            AppStore.save(storeData);
            onRefreshData();
          }
          triggerToast(`Đã tạo đề thi và thêm thành công ${createdQuestions.length} câu hỏi.`);
        } else {
          triggerToast("Đã thiết lập đề thi mới thành công.");
        }

        setSelectedQuizId(created.id);
        setQuizTitle("");
        setQuizPassing(70);
        setQuizLimit(15);
        setQuizAttempts(3);
        setQuizDeadline("");
        setSelectedSectionId("");
        setSelectedSessionId("");
        resetQuizModalQuestionInputs();
        setShowQuizModal(false);
      }
    } catch (err: any) {
      console.error("Failed to save quiz:", err);
      triggerToast(err.message || "Lỗi lưu cấu hình đề thi trên máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = "\ufeff" + "Câu hỏi trắc nghiệm một đáp án?,single,Đáp án A|Đáp án B|Đáp án C,0\nCâu hỏi trắc nghiệm nhiều đáp án?,multiple,Lựa chọn 1|Lựa chọn 2|Lựa chọn 3,\"0,2\"\nCâu hỏi tự điền từ?,text,,từ khóa đáp án\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const encodedUri = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mau_cau_hoi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === "string") {
        setCsvText(event.target.result);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleModalCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setModalCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === "string") {
        setModalCsvText(event.target.result);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleCSVUploadSubmit = async () => {
    if (!selectedQuizId || importing) return;
    const parsed = parseCSVText(csvText);
    const validQuestions = parsed.filter(q => !q.error);
    const hasErrors = parsed.some(q => q.error);

    if (validQuestions.length === 0) {
      triggerToast("Không tìm thấy câu hỏi hợp lệ nào để import.");
      return;
    }

    if (hasErrors) {
      if (!window.confirm("Một số câu hỏi bị lỗi định dạng và sẽ bị bỏ qua. Bạn có muốn tiếp tục import các câu hỏi hợp lệ không?")) {
        return;
      }
    }

    try {
      setImporting(true);
      const payload = validQuestions.map(q => ({
        text: q.text,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer
      }));

      const createdQuestions = (await api.bulkAddQuestions(selectedQuizId, payload)) as any[];

      if (updateStore) {
        updateStore((draft: LMSDataStore) => {
          draft.questions.push(...createdQuestions);
        });
      } else {
        const storeData = AppStore.get();
        storeData.questions.push(...createdQuestions);
        AppStore.save(storeData);
        onRefreshData();
      }

      AppStore.log(currentUser.id, "bulk_add_quiz_questions", `Imported ${createdQuestions.length} questions`, `Quiz ID: ${selectedQuizId}`);
      triggerToast(`Import thành công ${createdQuestions.length} câu hỏi.`);
      setCsvText("");
      setShowImportPanel(false);
    } catch (err: any) {
      console.error("Failed to import questions:", err);
      triggerToast(err.message || "Lỗi import câu hỏi lên máy chủ.");
    } finally {
      setImporting(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
  };

  interface ParsedQuestion {
    text: string;
    type: "single" | "multiple" | "text";
    options: string[];
    correctAnswer: string;
    error?: string;
  }

  const parseCSVText = (text: string): ParsedQuestion[] => {
    const lines = text.split(/\r?\n/);
    const results: ParsedQuestion[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length < 4) {
        results.push({
          text: fields[0] || `Dòng ${i + 1}`,
          type: "single",
          options: [],
          correctAnswer: "",
          error: `Thiếu cột thông tin ở dòng ${i + 1} (Yêu cầu ít nhất 4 cột: Câu hỏi, Loại, Lựa chọn, Đáp án)`
        });
        continue;
      }
      
      const [qText, qTypeRaw, qOptionsRaw, qCorrectRaw] = fields;
      const qType = qTypeRaw.trim().toLowerCase();
      
      if (qType !== "single" && qType !== "multiple" && qType !== "text") {
        results.push({
          text: qText,
          type: "single",
          options: [],
          correctAnswer: "",
          error: `Loại câu hỏi không hợp lệ '${qTypeRaw}' ở dòng ${i + 1} (Chấp nhận: single, multiple, text)`
        });
        continue;
      }
      
      const options = qOptionsRaw
        ? qOptionsRaw.split("|").map(o => o.trim()).filter(o => o !== "")
        : [];
        
      if (qType !== "text" && options.length < 2) {
        results.push({
          text: qText,
          type: qType as any,
          options,
          correctAnswer: qCorrectRaw,
          error: `Câu hỏi trắc nghiệm ở dòng ${i + 1} phải có ít nhất 2 lựa chọn (phân tách bằng |)`
        });
        continue;
      }
      
      if (!qCorrectRaw.trim()) {
        results.push({
          text: qText,
          type: qType as any,
          options,
          correctAnswer: "",
          error: `Đáp án đúng ở dòng ${i + 1} không được để trống`
        });
        continue;
      }
      
      if (qType === "single") {
        const correctIdx = Number(qCorrectRaw);
        if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) {
          results.push({
            text: qText,
            type: "single",
            options,
            correctAnswer: qCorrectRaw,
            error: `Đáp án đúng ở dòng ${i + 1} phải là chỉ số hợp lệ từ 0 đến ${options.length - 1}`
          });
          continue;
        }
      } else if (qType === "multiple") {
        const correctIndices = qCorrectRaw.split(",").map(v => Number(v.trim()));
        let hasError = false;
        for (const idx of correctIndices) {
          if (isNaN(idx) || idx < 0 || idx >= options.length) {
            results.push({
              text: qText,
              type: "multiple",
              options,
              correctAnswer: qCorrectRaw,
              error: `Các đáp án đúng ở dòng ${i + 1} phải là chỉ số hợp lệ từ 0 đến ${options.length - 1}`
            });
            hasError = true;
            break;
          }
        }
        if (hasError) continue;
      }
      
      results.push({
        text: qText,
        type: qType as any,
        options,
        correctAnswer: qCorrectRaw.trim()
      });
    }
    
    return results;
  };

  const handleDeleteOption = (idxToDelete: number) => {
    if (qOptions.length <= 2) {
      triggerToast("Câu hỏi trắc nghiệm cần có ít nhất 2 đáp án.");
      return;
    }
    const nextOpts = qOptions.filter((_, idx) => idx !== idxToDelete);
    setQOptions(nextOpts);
    
    // Adjust correct answers
    const currentCorrect = qCorrect.split(",").filter(v => v !== "");
    const nextCorrect: string[] = [];
    for (const c of currentCorrect) {
      const val = Number(c);
      if (val < idxToDelete) {
        nextCorrect.push(String(val));
      } else if (val > idxToDelete) {
        nextCorrect.push(String(val - 1));
      }
    }
    setQCorrect(nextCorrect.join(","));
  };

  const handleStartEditQuestion = (qst: Question) => {
    setEditingQuestionId(qst.id);
    setQText(qst.text);
    setQType(qst.type);
    setQOptions(qst.options.length > 0 ? [...qst.options] : ["", "", ""]);
    setQCorrect(qst.correctAnswer);
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = async (qstId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này khỏi đề thi không?")) return;
    try {
      await api.deleteQuestion(qstId);
      if (updateStore) {
        updateStore((draft: LMSDataStore) => {
          draft.questions = draft.questions.filter(q => q.id !== qstId);
        });
      } else {
        const storeData = AppStore.get();
        storeData.questions = storeData.questions.filter(q => q.id !== qstId);
        AppStore.save(storeData);
        onRefreshData();
      }
      triggerToast("Đã xóa câu hỏi thành công.");
    } catch (err: any) {
      console.error("Failed to delete question:", err);
      triggerToast(`Lỗi xóa câu hỏi: ${err.message || "Không thể kết nối máy chủ."}`);
    }
  };

  const handleQuestionFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId || isSubmitting) return;
    if (!qText.trim()) {
      triggerToast("Vui lòng nhập nội dung câu hỏi.");
      return;
    }

    const storeData = AppStore.get();
    const cleanedOptions = qType !== "text" ? qOptions.filter((o: string) => o.trim() !== "") : [];

    if (qType !== "text") {
      const correctIndices = qCorrect.split(",").map(Number);
      for (const idx of correctIndices) {
        if (qOptions[idx] === undefined || qOptions[idx].trim() === "") {
          triggerToast(`Lựa chọn đáp án đúng (Lựa chọn ${idx + 1}) không được để trống.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      if (editingQuestionId) {
        // Edit mode on Backend
        const updatedQuestion = await api.updateQuestion(editingQuestionId, {
          text: qText,
          type: qType,
          options: cleanedOptions,
          correctAnswer: qCorrect
        });

        if (updateStore) {
          updateStore((draft: LMSDataStore) => {
            draft.questions = draft.questions.map(q => {
              if (q.id === editingQuestionId) {
                return {
                  ...q,
                  text: qText,
                  type: qType,
                  options: cleanedOptions,
                  correctAnswer: qCorrect
                };
              }
              return q;
            });
          });
        } else {
          storeData.questions = storeData.questions.map(q => {
            if (q.id === editingQuestionId) {
              return {
                ...q,
                text: qText,
                type: qType,
                options: cleanedOptions,
                correctAnswer: qCorrect
              };
            }
            return q;
          });
          AppStore.save(storeData);
          onRefreshData();
        }
        AppStore.log(currentUser.id, "edit_quiz_question", qText, `Edited question ID: ${editingQuestionId} inside quiz: ${selectedQuizId}`);
        triggerToast("Đã cập nhật câu hỏi thành công.");
      } else {
        // Create mode on Backend
        const newQuestion = await api.addQuestion(selectedQuizId, {
          text: qText,
          type: qType,
          options: cleanedOptions,
          correctAnswer: qCorrect
        });

        if (updateStore) {
          updateStore((draft: LMSDataStore) => {
            draft.questions.push(newQuestion as any);
          });
        } else {
          storeData.questions.push(newQuestion as any);
          AppStore.save(storeData);
          onRefreshData();
        }
        AppStore.log(currentUser.id, "add_quiz_question", qText, `Added question mapping inside quiz ID: ${selectedQuizId}`);
        triggerToast("Đã thêm câu hỏi mới thành công.");
      }

      setQText("");
      setQOptions(["", "", ""]);
      setQCorrect("0");
      setEditingQuestionId(null);
      setShowQuestionModal(false);
    } catch (err: any) {
      console.error("Failed to save question:", err);
      triggerToast(`Lỗi lưu câu hỏi: ${err.message || "Không thể kết nối máy chủ."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
        {/* Tab 2: Quiz Management & Question Mapping panels */}
        {activeSubTab === "quizzes" && (
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-display font-semibold text-slate-900">Đề thi & đánh giá</h4>
              <p className="mt-1 text-sm text-slate-500">Tạo và quản lý bài kiểm tra theo từng khóa học.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Side: Segmented control & Lists */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 h-fit shadow-xs">
                {/* Segmented Toggle Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                  <button
                    type="button"
                    onClick={() => setAssessmentType("quiz")}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition duration-150 cursor-pointer text-center ${
                      assessmentType === "quiz"
                        ? "bg-white text-slate-900 border border-slate-200/80 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Đề trắc nghiệm
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentType("essay")}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition duration-150 cursor-pointer text-center ${
                      assessmentType === "essay"
                        ? "bg-white text-slate-900 border border-slate-200/80 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Đề tự luận
                  </button>
                </div>

                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-2 font-mono">
                  {assessmentType === "quiz" ? "Đề trắc nghiệm đang hoạt động" : "Đề tự luận đang hoạt động"}
                </span>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {myCourses.map(course => {
                    const courseQuizzes = store.quizzes.filter((q: any) => q.courseId === course.id);
                    const courseEssays = store.assignments.filter((a: any) => a.courseId === course.id);
                    const items = assessmentType === "quiz" ? courseQuizzes : courseEssays;
                    
                    if (items.length === 0) return null;
                    
                    return (
                      <div key={course.id} className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block px-1 truncate" title={course.title}>
                          📖 {course.title}
                        </span>
                        {items.map((item: any) => {
                          const isSelected = assessmentType === "quiz" ? selectedQuizId === item.id : selectedEssayId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (assessmentType === "quiz") {
                                  setSelectedQuizId(item.id);
                                } else {
                                  setSelectedEssayId(item.id);
                                }
                              }}
                              className={`w-full text-left p-2.5 rounded-lg border text-xs transition duration-150 relative block cursor-pointer ${
                                isSelected
                                  ? "bg-white border-indigo-200 text-indigo-700 font-bold shadow-xs"
                                  : "bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60"
                              }`}
                            >
                              <h6 className="truncate max-w-[200px]">{item.title}</h6>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {assessmentType === "quiz" && store.quizzes.filter((q: any) => myCourseIds.includes(q.courseId)).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có đề thi trắc nghiệm nào.</p>
                  )}
                  {assessmentType === "essay" && store.assignments.filter((a: any) => myCourseIds.includes(a.courseId)).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có đề thi tự luận nào.</p>
                  )}
                </div>

                {/* Create Buttons */}
                {assessmentType === "quiz" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (myCourses.length === 0) {
                        triggerToast("Bạn cần có khóa học được duyệt để thiết lập đề thi.");
                        return;
                      }
                      setSelectedCourseId(myCourses[0].id);
                      setQuizTitle("");
                      setQuizPassing(70);
                      setQuizLimit(15);
                      setQuizAttempts(3);
                      setQuizDeadline("");
                      setSelectedSectionId("");
                      setSelectedSessionId("");
                      setQuizEditId(null);
                      setModalCsvText("");
                      setModalCsvFileName("");
                      setShowQuizModal(true);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition text-xs shadow-xs"
                  >
                    <PlusCircle className="h-4 w-4" /> Khởi tạo Đề trắc nghiệm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (myCourses.length === 0) {
                        triggerToast("Bạn cần có khóa học được duyệt để giao bài tập.");
                        return;
                      }
                      setSelectedCourseId(myCourses[0].id);
                      setAssignTitle("");
                      setAssignDesc("");
                      setAssignDeadline("");
                      setShowAssignModal(true);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition text-xs shadow-xs"
                  >
                    <PlusCircle className="h-4 w-4" /> Khởi tạo Đề tự luận
                  </button>
                )}
              </div>

              {/* Right Side Column */}
              <div className="lg:col-span-2 space-y-4">
                {assessmentType === "quiz" ? (
                  selectedQuizId ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-sm font-bold text-slate-900">
                              {store.quizzes.find((q: any) => q.id === selectedQuizId)?.title || "Cấu hình câu hỏi đề thi trắc nghiệm"}
                            </h5>
                            <button
                              type="button"
                              onClick={handleStartEditQuiz}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                              title="Chỉnh sửa đề thi"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteQuiz}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Xóa đề thi"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">Mã đề thi: <span className="font-mono text-slate-600">{selectedQuizId}</span></p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowImportPanel(!showImportPanel);
                              setCsvText("");
                            }}
                            className="p-1.5 px-3 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer transition border border-slate-200"
                            title="Nhập câu hỏi hàng loạt từ tệp CSV"
                          >
                            <Upload className="h-4 w-4 inline text-slate-500" /> Nhập từ CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingQuestionId(null); setQText(""); setQOptions(["", "", ""]); setQCorrect("0"); setShowQuestionModal(true); }}
                            className="p-1.5 px-3 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                          >
                            <PlusCircle className="h-4 w-4 inline" /> Thêm Câu hỏi
                          </button>
                        </div>
                      </div>

                      {/* Import CSV Panel */}
                      {showImportPanel && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                            <h6 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                              <Upload className="h-4 w-4" /> Nhập câu hỏi từ CSV
                            </h6>
                            <button
                              type="button"
                              onClick={() => {
                                setShowImportPanel(false);
                                setCsvText("");
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-600 space-y-1">
                            <p><strong>Hướng dẫn cấu trúc CSV (không có dòng tiêu đề):</strong></p>
                            <p className="font-mono bg-white p-2 rounded text-[10px] text-indigo-700 border border-slate-200 whitespace-pre-wrap select-all">
                              Nội dung câu hỏi, Loại câu hỏi, Các đáp án lựa chọn (cách nhau bởi |), Đáp án đúng
                            </p>
                            <div className="pl-3 list-disc space-y-0.5">
                              <div>• <strong>Loại câu hỏi:</strong> <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">single</code> (một đáp án), <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">multiple</code> (nhiều đáp án), <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">text</code> (tự điền).</div>
                              <div>• <strong>Các đáp án:</strong> Phân tách bằng dấu <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">|</code> (ví dụ: <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">Đáp án A|Đáp án B|Đáp án C</code>). Bỏ trống nếu là tự điền.</div>
                              <div>• <strong>Đáp án đúng:</strong> Chỉ số đáp án đúng bắt đầu từ 0 (ví dụ: <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">0</code> cho Single Choice, <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-slate-800">0,2</code> cho Multiple Choice) hoặc từ khóa cho tự điền.</div>
                            </div>
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handleDownloadSample}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" /> Tải file mẫu CSV câu hỏi
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold text-slate-700 block">Chọn file CSV từ máy tính</label>
                              <div className="border border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-white transition cursor-pointer relative shadow-xs">
                                <Upload className="h-6 w-6 text-slate-400" />
                                <span className="text-[10px] text-slate-500 text-center">Nhấp để chọn file .csv hoặc kéo thả vào đây</span>
                                <input
                                  type="file"
                                  accept=".csv"
                                  onChange={handleCSVFileChange}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold text-slate-700 block">Hoặc dán nội dung CSV thô</label>
                              <textarea
                                value={csvText}
                                onChange={(e) => setCsvText(e.target.value)}
                                placeholder="Dán nội dung CSV của bạn tại đây..."
                                className="w-full h-[88px] px-3 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-[10px] font-mono shadow-xs"
                              />
                            </div>
                          </div>

                          {/* Preview Area */}
                          {csvText.trim() && (() => {
                            const parsed = parseCSVText(csvText);
                            const errors = parsed.filter(q => q.error);
                            const valids = parsed.filter(q => !q.error);

                            return (
                              <div className="space-y-2 border-t border-slate-200/60 pt-3">
                                <div className="flex justify-between items-center text-[11px] font-semibold">
                                  <span className="text-slate-800">Xem trước kết quả phân tích:</span>
                                  <div className="space-x-2">
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{valids.length} Hợp lệ</span>
                                    {errors.length > 0 && (
                                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{errors.length} Lỗi</span>
                                    )}
                                  </div>
                                </div>

                                <div className="max-h-[150px] overflow-y-auto bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-[10px]">
                                  {parsed.map((q, idx) => (
                                    <div key={idx} className="p-2 flex items-start gap-2">
                                      {q.error ? (
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{q.text}</p>
                                        <p className="text-slate-500 text-[9px] mt-0.5">
                                          Loại: <span className="font-mono text-indigo-700">{q.type}</span>
                                          {q.options.length > 0 && ` | Lựa chọn: ${q.options.join(", ")}`}
                                          {` | Đáp án đúng: ${q.correctAnswer}`}
                                        </p>
                                        {q.error && (
                                          <p className="text-rose-600 font-semibold text-[9px] mt-0.5">{q.error}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowImportPanel(false);
                                      setCsvText("");
                                    }}
                                    className="px-4 py-1.5 bg-transparent text-slate-500 hover:text-slate-800 text-xs transition cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCSVUploadSubmit}
                                    disabled={valids.length === 0 || importing}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                  >
                                    {importing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    Xác nhận Import ({valids.length} câu)
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="space-y-3.5 pt-2 max-h-[600px] overflow-y-auto pr-1">
                        {store.questions.filter(qst => qst.quizId === selectedQuizId).map((qst, n) => (
                          <div key={qst.id} className="bg-white border border-slate-200/80 rounded-2xl p-4.5 space-y-3 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 min-w-0">
                              <span className="text-xs font-bold text-slate-900 min-w-0 flex-1 break-words">{n+1}. {qst.text}</span>
                              <span className="text-[10px] uppercase tracking-wider font-mono text-indigo-700 bg-indigo-50 py-0.5 px-2.5 rounded-full border border-indigo-200/60 text-right shrink-0 font-semibold">
                                {qst.type === "single" ? "Một đáp án" : qst.type === "multiple" ? "Nhiều đáp án" : "Tự điền từ"}
                              </span>
                            </div>

                            {/* Edit / Delete Actions */}
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(qst)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                title="Chỉnh sửa câu hỏi"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(qst.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa câu hỏi"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {qst.options.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                {qst.options.map((opt, idx) => (
                                  <div key={idx} className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                                    (qst.correctAnswer || "").split(",").includes(String(idx))
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium"
                                      : "bg-slate-50 border-slate-200 text-slate-600"
                                  }`}>
                                    <span className="font-bold text-[10px]">{idx + 1}.</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {qst.type === "text" && (
                              <div className="text-[11px] text-emerald-700 font-mono pl-4">
                                Đáp án chính xác để đối soát tự động: <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">{qst.correctAnswer}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {store.questions.filter(qst => qst.quizId === selectedQuizId).length === 0 && (
                          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs text-slate-400">Chưa có câu hỏi hay tiêu chí đánh giá nào được thiết lập.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col justify-center items-center">
                      <HelpCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-sans">Chọn một đề thi trắc nghiệm từ danh sách bên trái để khám phá và quản lý các câu hỏi tương ứng.</p>
                    </div>
                  )
                ) : (
                  selectedEssayId ? (
                    (() => {
                      const essay = store.assignments.find(a => a.id === selectedEssayId);
                      const submissions = store.submissions.filter(s => s.assignmentId === selectedEssayId);
                      return (
                        <div className="space-y-6">
                          <div className="border-b border-slate-200/80 pb-4">
                            <h5 className="text-base font-bold text-slate-900 mb-1">{essay?.title}</h5>
                            <p className="text-xs text-indigo-700 font-mono">Mã đề tự luận: <span className="text-slate-500">{selectedEssayId}</span></p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-1 shadow-xs">
                              <span className="text-[10px] text-slate-400 uppercase block font-mono">Hạn nộp bài</span>
                              <span className="text-sm font-bold text-indigo-700">{essay ? new Date(essay.deadline).toLocaleDateString() : ""}</span>
                            </div>
                            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-1 shadow-xs">
                              <span className="text-[10px] text-slate-400 uppercase block font-mono">Thang điểm tối đa</span>
                              <span className="text-sm font-bold text-emerald-600">{essay?.maxScore || 100} điểm</span>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-2 shadow-xs">
                            <span className="text-xs font-semibold text-slate-800 block uppercase font-mono tracking-wider">Yêu cầu thi tự luận</span>
                            <p className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-wrap break-words">{essay?.description}</p>
                          </div>

                          <div className="space-y-3">
                            <span className="text-xs font-semibold text-slate-800 block uppercase font-mono tracking-wider">Danh sách học viên đã nộp bài ({submissions.length})</span>
                            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden text-xs text-slate-700 shadow-xs">
                              <div className="grid grid-cols-3 bg-slate-50/80 border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider p-3 text-slate-500 font-semibold">
                                <span>Học viên</span>
                                <span>Ngày nộp</span>
                                <span className="text-right">Điểm số</span>
                              </div>
                              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                {submissions.map(sub => {
                                  const student = store.users.find(u => u.id === sub.studentId);
                                  return (
                                    <div key={sub.id} className="grid grid-cols-3 p-3 items-center hover:bg-slate-50/60 transition">
                                      <span className="font-semibold text-slate-900">{student?.name || "Học viên ẩn danh"}</span>
                                      <span className="text-slate-400 font-mono text-[11px]">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                                      <span className="text-right font-bold font-mono">
                                        {sub.score !== undefined ? (
                                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{sub.score}/{essay?.maxScore || 100}</span>
                                        ) : (
                                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-semibold">Chờ chấm</span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                                {submissions.length === 0 && (
                                  <div className="p-4 text-center text-slate-400 text-xs">
                                    Chưa có học viên nào nộp bài tự luận cho đề thi này.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col justify-center items-center">
                      <HelpCircle className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-sans">Chọn một đề thi tự luận từ danh sách bên trái để khám phá thông tin chi tiết và danh sách bài nộp.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

      {/* MODAL 3: CREATE QUIZ FORM */}
      {showQuizModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-slate-900 animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                setShowQuizModal(false);
                resetQuizModalQuestionInputs();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="h-5 w-5 text-indigo-600" /> {quizEditId ? "Chỉnh sửa Đề thi trắc nghiệm" : "Thiết lập Đề thi trắc nghiệm Khóa học"}
            </h3>

            <form onSubmit={handleQuizSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Chọn Khóa học tương ứng</label>
                <select
                  required
                  value={selectedCourseId || ""}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setSelectedSectionId("");
                    setSelectedSessionId("");
                  }}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  <option value="" disabled>-- Chọn khóa học --</option>
                  {myCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Chọn Lớp học phần</label>
                <select
                  required
                  value={selectedSectionId || ""}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setSelectedSessionId("");
                  }}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  <option value="" disabled>-- Chọn lớp học phần --</option>
                  {(store.courseSections || [])
                    .filter((sec: any) => sec.courseId === selectedCourseId)
                    .map((sec: any) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.sectionCode}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Buổi học áp dụng</label>
                <select
                  required
                  value={selectedSessionId || ""}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  <option value="" disabled>-- Chọn buổi học --</option>
                  {(store.attendanceSessions || [])
                    .filter((sess: any) => sess.sectionId === selectedSectionId)
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((sess: any, sIdx: number) => (
                      <option key={sess.id} value={sess.id}>
                        Buổi {sIdx + 1}: {sess.topic} ({new Date(sess.date).toLocaleDateString("vi-VN")})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Tiêu đề Đề thi</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài đánh giá năng lực cuối khóa"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Hạn chót Hoàn thành (Bỏ trống nếu không giới hạn)</label>
                <input
                  type="date"
                  value={quizDeadline || ""}
                  onChange={(e) => setQuizDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Điểm đạt %</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={quizPassing}
                    onChange={(e) => setQuizPassing(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Thời gian (Phút)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={quizLimit}
                    onChange={(e) => setQuizLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Số lượt làm bài</label>
                  <input
                     type="number"
                     required
                     min={1}
                     max={10}
                     value={quizAttempts}
                     onChange={(e) => setQuizAttempts(Number(e.target.value))}
                     className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3 mt-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <PlusCircle className="h-4 w-4 text-indigo-600" /> Tạo từng câu hỏi
                  </label>
                  <span className="text-[10px] text-indigo-600 font-mono font-semibold">
                    {modalDraftQuestions.length} câu nháp
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-medium text-slate-500">Nội dung câu hỏi</label>
                    <textarea
                      rows={2}
                      value={modalQuestionText}
                      onChange={(e) => setModalQuestionText(e.target.value)}
                      placeholder="Nhập câu hỏi giáo viên muốn đưa vào đề"
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-500">Loại câu hỏi</label>
                    <select
                      value={modalQuestionType}
                      onChange={(e) => {
                        const nextType = e.target.value as "single" | "multiple" | "text";
                        setModalQuestionType(nextType);
                        setModalQuestionCorrect(nextType === "single" ? "0" : "");
                      }}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                    >
                      <option value="single">Một đáp án</option>
                      <option value="multiple">Nhiều đáp án</option>
                      <option value="text">Tự luận ngắn</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-500">Đáp án đúng</label>
                    <input
                      type="text"
                      value={modalQuestionCorrect}
                      onChange={(e) => setModalQuestionCorrect(e.target.value)}
                      placeholder={modalQuestionType === "multiple" ? "Ví dụ: 0,2" : modalQuestionType === "text" ? "Từ khóa đáp án" : "Ví dụ: 0"}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                    />
                  </div>

                  {modalQuestionType !== "text" && (
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-medium text-slate-500">Các lựa chọn</label>
                      <textarea
                        rows={3}
                        value={modalQuestionOptionsText}
                        onChange={(e) => setModalQuestionOptionsText(e.target.value)}
                        placeholder={"Mỗi lựa chọn một dòng hoặc phân tách bằng dấu |"}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs resize-none"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddModalDraftQuestion}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer text-xs"
                >
                  <PlusCircle className="h-4 w-4" /> Thêm câu hỏi vào đề
                </button>

                {modalDraftQuestions.length > 0 && (
                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                    {modalDraftQuestions.map((question, index) => (
                      <div key={`${question.text}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-slate-900 font-semibold leading-snug break-words">
                              {index + 1}. {question.text}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 break-words">
                              {question.type === "single" ? "Một đáp án" : question.type === "multiple" ? "Nhiều đáp án" : "Tự luận ngắn"}
                              {question.options.length > 0 ? ` - ${question.options.join(" | ")}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setModalDraftQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                            className="shrink-0 p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                            aria-label="Xóa câu hỏi nháp"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional CSV Import on Creation */}
              <div className="space-y-1 border-t border-slate-100 pt-3 mt-3">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-indigo-600" /> Hoặc nhập nhanh từ CSV (Tùy chọn)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 border border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 bg-slate-50 transition cursor-pointer relative">
                    <span className="text-[11px] text-slate-600 text-center truncate w-full">
                      {modalCsvFileName ? `📁 ${modalCsvFileName}` : "Chọn file mẫu .csv hoặc kéo thả tại đây"}
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleModalCSVFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {modalCsvText && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalCsvText("");
                        setModalCsvFileName("");
                      }}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 text-[10px] font-semibold transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                {modalCsvText && (() => {
                  const parsed = parseCSVText(modalCsvText);
                  const valids = parsed.filter(q => !q.error);
                  const errors = parsed.filter(q => q.error);
                  return (
                    <div className="text-[10px] mt-1 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex justify-between font-semibold">
                        <span className="text-emerald-600">{valids.length} câu hợp lệ</span>
                        {errors.length > 0 && <span className="text-rose-600">{errors.length} câu lỗi</span>}
                      </div>
                      {errors.length > 0 && (
                        <p className="text-rose-600 text-[9px]">Cảnh báo: Có dòng bị lỗi định dạng và sẽ bị bỏ qua khi tạo.</p>
                      )}
                    </div>
                  );
                })()}
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="text-indigo-600 hover:text-indigo-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer mt-1"
                  >
                    <Download className="h-3 w-3" /> Tải file mẫu CSV
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuizModal(false);
                    resetQuizModalQuestionInputs();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {quizEditId ? "Cập nhật cấu hình" : "Thiết lập Đề thi"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MODAL 4: ADD QUESTION FORM */}
      {showQuestionModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-slate-900 animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => { setShowQuestionModal(false); setEditingQuestionId(null); }}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <PlusCircle className="h-5 w-5 text-indigo-600" /> {editingQuestionId ? "Chỉnh sửa câu hỏi trắc nghiệm" : "Tạo câu hỏi trắc nghiệm mới"}
            </h3>

            <form onSubmit={handleQuestionFormSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Nội dung câu hỏi</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đâu là cú pháp đúng để khai báo một biến trong TypeScript?"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Loại câu hỏi</label>
                  <select
                    value={qType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setQType(newType);
                      if (newType === "text") {
                        setQCorrect("");
                      } else {
                        setQCorrect("0");
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                  >
                    <option value="single">Một đáp án đúng (Single Choice)</option>
                    <option value="multiple">Nhiều đáp án đúng (Multiple Choice)</option>
                    <option value="text">Tự điền từ thích hợp (Free text)</option>
                  </select>
                </div>

                {qType === "text" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Từ khóa đáp án đúng (cách nhau bởi dấu phẩy)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: bảo mật, kế thừa, đa hình"
                      value={qCorrect}
                      onChange={(e) => setQCorrect(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Đáp án trắc nghiệm đã chọn</label>
                    <input
                      type="text"
                      disabled
                      placeholder="Chọn ở danh sách bên dưới"
                      value={
                        qCorrect
                          ? qCorrect
                              .split(",")
                              .map(idx => `Lựa chọn ${Number(idx) + 1}`)
                              .join(", ")
                          : "Chưa chọn đáp án nào"
                      }
                      className="w-full px-3 py-2 bg-slate-100 text-indigo-700 border border-slate-200 rounded-xl focus:outline-none font-semibold text-xs"
                    />
                  </div>
                )}
              </div>

              {qType !== "text" && (
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-slate-700 block">Cung cấp các lựa chọn đáp án và chọn đáp án đúng (tối thiểu 2)</span>
                  {qOptions.map((opt, id) => {
                    const isCorrect = qType === "multiple"
                      ? (qCorrect || "").split(",").includes(String(id))
                      : qCorrect === String(id);

                    return (
                      <div key={id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                        {qType === "multiple" ? (
                          <input
                            type="checkbox"
                            checked={isCorrect}
                            onChange={(e) => {
                              const currentSelected = qCorrect ? qCorrect.split(",") : [];
                              let nextSelected;
                              if (e.target.checked) {
                                nextSelected = [...currentSelected, String(id)];
                              } else {
                                nextSelected = currentSelected.filter(v => v !== String(id));
                              }
                              const sorted = nextSelected.sort((a, b) => Number(a) - Number(b));
                              setQCorrect(sorted.join(","));
                            }}
                            className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer"
                          />
                        ) : (
                          <input
                            type="radio"
                            name="correct-option-group"
                            checked={isCorrect}
                            onChange={() => {
                              setQCorrect(String(id));
                            }}
                            className="h-4.5 w-4.5 border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer"
                          />
                        )}
                        <span className="font-mono text-slate-500 text-xs min-w-[70px] select-none font-medium">Lựa chọn {id + 1}</span>
                        <input
                          type="text"
                          required={id < 2}
                          placeholder={`Nội dung lựa chọn đáp án #${id + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const nextOpts = [...qOptions];
                            nextOpts[id] = e.target.value;
                            setQOptions(nextOpts);
                          }}
                          className="flex-1 px-3 py-1.5 bg-white text-slate-900 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 shadow-xs"
                        />
                        {qOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer transition shrink-0"
                            title="Xóa lựa chọn này"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setQOptions([...qOptions, ""])}
                    className="mt-1.5 py-1 px-3 border border-dashed border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition w-fit"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm lựa chọn đáp án
                  </button>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowQuestionModal(false); setEditingQuestionId(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {editingQuestionId ? (isSubmitting ? "Đang cập nhật..." : "Cập nhật câu hỏi") : (isSubmitting ? "Đang thêm..." : "Thêm Câu hỏi")}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}



    </>
  );
}
