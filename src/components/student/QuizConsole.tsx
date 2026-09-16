import React from "react";
import { BookOpen, GraduationCap, CheckCircle, Bookmark, Award, Send, Clock, Play, Check, Lock, User, Search, ChevronRight, ArrowRight, HelpCircle, FileCheck, AlertCircle, X, FileText, CreditCard, Phone, Calendar, Home, Shield, Activity, DollarSign, Printer, FileSpreadsheet, Cpu, BadgeAlert } from "lucide-react";
import { AppStore } from "../../store";
import ModalPortal from "../ModalPortal";

interface ComponentProps {
  [key: string]: any;
}

export default function QuizConsole(props: ComponentProps) {
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
    paymentGuideTx,
    setPaymentGuideTx,
    myNotifications,
    handleMarkNotificationRead
  } = props;

  return (
    <>
      {/* QUIZ TAKING IMMERSIVE INTERFACES AND MODALS */}
      {activeQuizId && (() => {
        const activeQuizObj = store.quizzes.find(q => q.id === activeQuizId)!;
        const questions = store.questions.filter(qst => qst.quizId === activeQuizId);
        const currentQuestionObj = questions[currentQuestionIndex];

        return (
          <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto">
            <div className="bg-slate-900 border border-white/15 rounded-3xl p-6.5 w-full max-w-2xl shadow-2xl relative">
              
              {!quizFinishedState ? (
                // QUIZ QUESTION VIEW
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div>
                      <h4 className="font-display font-black text-white text-base leading-tight">{activeQuizObj.title}</h4>
                      <p className="text-[11px] font-mono text-white/40">Câu hỏi {currentQuestionIndex + 1} / {questions.length}</p>
                    </div>

                    {/* Timer visualization */}
                    <div className="p-2 py-1 px-3 bg-red-500/15 border border-red-500/25 rounded-xl text-red-400 font-mono text-xs flex items-center gap-1.5">
                      <Clock className="h-4 w-4 animate-pulse" />
                      <span>
                        Còn lại: {Math.floor(quizTimeRemaining / 60)}:{(quizTimeRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {currentQuestionObj && (
                    <div className="space-y-4">
                      <span className="text-sm font-bold text-white block leading-snug">{currentQuestionObj.text}</span>

                      {currentQuestionObj.type !== "text" ? (
                        <div className="space-y-2.5">
                          {currentQuestionObj.options.map((opt, idx) => {
                            const selectedStr = (quizAnswers && quizAnswers[currentQuestionObj.id]) || "";
                            const isChosen = currentQuestionObj.type === "multiple" 
                              ? selectedStr.split(",").includes(String(idx)) 
                              : selectedStr === String(idx);

                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (currentQuestionObj.type === "multiple") {
                                    const arrayValues = selectedStr ? selectedStr.split(",") : [];
                                    const nextArray = arrayValues.includes(String(idx))
                                      ? arrayValues.filter(v => v !== String(idx))
                                      : [...arrayValues, String(idx)];
                                    // Sort option index values numerically before saving to prevent order check failures
                                    const sortedArray = nextArray.sort((a, b) => Number(a) - Number(b));
                                    handleSelectQuizAnswer(currentQuestionObj.id, sortedArray.join(","));
                                  } else {
                                    handleSelectQuizAnswer(currentQuestionObj.id, String(idx));
                                  }
                                }}
                                className={`w-full text-left p-4 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                                  isChosen 
                                    ? "bg-white/15 border-white/20 text-indigo-300" 
                                    : "bg-black/25 border-white/5 text-white/60 hover:text-white"
                                  }`}
                              >
                                <span className="font-mono text-indigo-400 mr-2">[{idx + 1}]</span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Nhập từ khóa hoặc câu trả lời chính xác..."
                          value={quizAnswers[currentQuestionObj.id] || ""}
                          onChange={(e) => handleSelectQuizAnswer(currentQuestionObj.id, e.target.value)}
                          className="w-full px-3.5 py-3 bg-black/20 text-white border border-white/10 rounded-xl focus:outline-none focus:border-indigo-400 text-xs"
                        />
                      )}
                    </div>
                  )}

                  {/* Nav Footer Quiz controls */}
                  <div className="pt-4 border-t border-white/5 flex justify-between">
                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(p => p - 1)}
                      className="px-4 py-2 text-white/60 hover:text-white transition cursor-pointer disabled:text-white/20 text-xs"
                    >
                      Quay lại câu trước
                    </button>

                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex(p => p + 1)}
                        className="px-4.5 py-2 bg-white text-indigo-950 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Câu tiếp theo
                      </button>
                    ) : (
                      <button
                        onClick={handleAutoSubmitQuiz}
                        className="px-5 py-2.5 bg-indigo-600 font-bold hover:bg-indigo-500 rounded-xl text-xs transition cursor-pointer text-white shadow-xl"
                      >
                        Nộp bài trắc nghiệm
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // FINISHED RESULT SUMMARY VIEW
                <div className="space-y-6 text-center py-6">
                  {quizFinishedState.passed ? (
                    <div className="inline-flex p-4.5 bg-emerald-500/10 border border-emerald-500/20 text-[#16a34a] rounded-full mx-auto animate-bounce pb-4">
                      <FileCheck className="h-12 w-12" />
                    </div>
                  ) : (
                    <div className="inline-flex p-4.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full mx-auto pb-4">
                      <AlertCircle className="h-12 w-12" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-black text-white">
                      {quizFinishedState.passed ? "Kiểm tra Đạt yêu cầu!" : "Chưa đạt - Cần Học lại"}
                    </h3>
                    <p className="text-xs text-white/50 max-w-sm mx-auto">
                      {quizFinishedState.passed 
                        ? `Tuyệt vời! Điểm số của bạn vượt ngưỡng quy định. Chứng nhận tốt nghiệp đã chính thức được cấp.` 
                        : "Thông số điểm kiểm tra chưa vượt qua ngưỡng yêu cầu tối thiểu. Ôn lại bài tập và tham gia làm bài lại nhé."}
                    </p>
                  </div>

                  <div className="flex justify-center gap-10 py-4 font-mono">
                    <div>
                      <span className="text-white/40 block text-[10px] uppercase">Điểm đạt</span>
                      <span className="text-2xl font-bold text-white tracking-tight">{quizFinishedState.score}%</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px] uppercase">Ngưỡng đạt</span>
                      <span className="text-2xl font-bold text-indigo-300 tracking-tight">{activeQuizObj.passingScore}%</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px] uppercase">Câu trả lời đúng</span>
                      <span className="text-2xl font-bold text-emerald-400 tracking-tight">
                        {quizFinishedState.correctAnswers} / {quizFinishedState.total}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setActiveQuizId(null); setViewingCourseId(null); setLearningCourseId(null); setActiveSubTab("learning"); }}
                    className="px-5 py-2.5 bg-white hover:bg-white/95 text-indigo-950 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Quay lại Phòng học của tôi
                  </button>
                </div>
              )}

            </div>
          </div>
          </ModalPortal>
        );
      })()}

    </>
  );
}
