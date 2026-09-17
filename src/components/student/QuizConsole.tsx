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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center p-4 pt-10 md:pt-14 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative text-slate-900">
              
              {!quizFinishedState ? (
                // QUIZ QUESTION VIEW
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="font-display font-bold text-slate-900 text-lg leading-tight">{activeQuizObj.title}</h4>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">Câu hỏi {currentQuestionIndex + 1} / {questions.length}</p>
                    </div>

                    {/* Timer visualization */}
                    <div className="p-2 py-1 px-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-mono text-xs flex items-center gap-1.5 font-semibold">
                      <Clock className="h-4 w-4 animate-pulse" />
                      <span>
                        Còn lại: {Math.floor(quizTimeRemaining / 60)}:{(quizTimeRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  {currentQuestionObj && (
                    <div className="space-y-4">
                      <span className="text-sm font-bold text-slate-900 block leading-snug">{currentQuestionObj.text}</span>

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
                                className={`w-full text-left p-4 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                                  isChosen 
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-xs" 
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                  }`}
                              >
                                <span className="font-mono text-indigo-600 mr-2">[{idx + 1}]</span>
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
                          className="w-full px-3.5 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs shadow-xs"
                        />
                      )}
                    </div>
                  )}

                  {/* Nav Footer Quiz controls */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <button
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(p => p - 1)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 transition cursor-pointer disabled:text-slate-300 text-xs font-medium"
                    >
                      ← Quay lại câu trước
                    </button>

                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestionIndex(p => p + 1)}
                        className="px-4.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs"
                      >
                        Câu tiếp theo →
                      </button>
                    ) : (
                      <button
                        onClick={handleAutoSubmitQuiz}
                        className="px-5 py-2.5 bg-indigo-600 font-semibold hover:bg-indigo-700 rounded-xl text-xs transition cursor-pointer text-white shadow-xs"
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
                    <div className="inline-flex p-4.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full mx-auto animate-bounce pb-4">
                      <FileCheck className="h-12 w-12" />
                    </div>
                  ) : (
                    <div className="inline-flex p-4.5 bg-red-50 border border-red-200 text-red-600 rounded-full mx-auto pb-4">
                      <AlertCircle className="h-12 w-12" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-bold text-slate-900">
                      {quizFinishedState.passed ? "Kiểm tra Đạt yêu cầu!" : "Chưa đạt - Cần Học lại"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      {quizFinishedState.passed 
                        ? `Tuyệt vời! Điểm số của bạn vượt ngưỡng quy định. Chứng nhận tốt nghiệp đã chính thức được cấp.` 
                        : "Thông số điểm kiểm tra chưa vượt qua ngưỡng yêu cầu tối thiểu. Ôn lại bài tập và tham gia làm bài lại nhé."}
                    </p>
                  </div>

                  <div className="flex justify-center gap-10 py-4 font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Điểm đạt</span>
                      <span className="text-2xl font-bold text-slate-900 tracking-tight">{quizFinishedState.score}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Ngưỡng đạt</span>
                      <span className="text-2xl font-bold text-indigo-600 tracking-tight">{activeQuizObj.passingScore}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Câu trả lời đúng</span>
                      <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                        {quizFinishedState.correctAnswers} / {quizFinishedState.total}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setActiveQuizId(null); setViewingCourseId(null); setLearningCourseId(null); setActiveSubTab("learning"); }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-xs"
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
