import React, { useState, useEffect } from 'react';
import { Quiz, QuizQuestion, QuizAttempt } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  HelpCircle, 
  Clock, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Send,
  Sparkles,
  BookOpen
} from 'lucide-react';

interface QuizzesTabProps {
  quizzes: Quiz[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const QuizzesTab: React.FC<QuizzesTabProps> = ({
  quizzes,
  onRefresh,
  isLoading
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [isTakingQuiz, setIsTakingQuiz] = useState<boolean>(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load quiz details when activeQuizId changes
  useEffect(() => {
    if (!activeQuizId) {
      setActiveQuiz(null);
      setQuestions([]);
      setIsTakingQuiz(false);
      setSubmittedAttempt(null);
      return;
    }

    async function loadQuiz() {
      try {
        setErrorMsg(null);
        const res = await api.getQuiz(activeQuizId!);
        setActiveQuiz(res.quiz);
        setQuestions(res.questions);
        if (res.attempt) {
          setSubmittedAttempt(res.attempt);
          setAnswers(res.attempt.answers || {});
          setIsTakingQuiz(false);
        } else {
          setSubmittedAttempt(null);
          setAnswers({});
          setTimeLeftSeconds((res.quiz.duration_minutes || 20) * 60);
          setIsTakingQuiz(true);
          setCurrentQIndex(0);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load quiz');
      }
    }

    loadQuiz();
  }, [activeQuizId]);

  // Quiz Countdown Timer
  useEffect(() => {
    if (!isTakingQuiz || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTakingQuiz, timeLeftSeconds]);

  const handleSelectOption = (questionId: string, option: string) => {
    if (submittedAttempt) return; // Prevent modifying after submission
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleAutoSubmit = () => {
    alert('Time limit reached! Your quiz will now be automatically evaluated.');
    handleSubmitQuiz();
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuizId) return;

    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      const confirmIncomplete = window.confirm(
        `You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`
      );
      if (!confirmIncomplete) return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.submitQuiz(activeQuizId, answers);
      setIsTakingQuiz(false);
      setSubmittedAttempt({
        id: res.attemptId,
        quiz_id: activeQuizId,
        student_usn: '',
        student_name: '',
        answers,
        score: res.score,
        total_marks: res.totalMarks,
        submitted_at: res.submittedAt
      });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Quiz submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading assigned quizzes...</span>
      </div>
    );
  }

  // Active Quiz View (Taking or Result Review)
  if (activeQuiz && questions.length > 0) {
    const currentQ = questions[currentQIndex];

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveQuizId(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {activeQuiz.title}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {activeQuiz.total_marks} Marks
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Faculty: {activeQuiz.faculty_name} • {questions.length} Questions
              </p>
            </div>
          </div>

          {/* Timer or Result Badge */}
          {isTakingQuiz ? (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs ${
              timeLeftSeconds < 180 
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-amber-300'
            }`}>
              <Clock className="w-4 h-4" />
              <span>Time Remaining: {formatTime(timeLeftSeconds)}</span>
            </div>
          ) : submittedAttempt ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Score: {submittedAttempt.score} / {submittedAttempt.total_marks} Marks</span>
            </div>
          ) : null}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submitted Score Banner */}
          {submittedAttempt && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 text-center space-y-1">
              <h4 className="text-sm font-bold text-emerald-300">Quiz Completed & Automatically Evaluated</h4>
              <p className="text-xs text-slate-300">
                You scored <strong className="text-white font-mono text-sm">{submittedAttempt.score}</strong> out of <strong className="text-white font-mono text-sm">{submittedAttempt.total_marks}</strong> marks.
              </p>
            </div>
          )}

          {/* Question Navigation Bubbles */}
          <div className="flex flex-wrap gap-2 items-center justify-center border-b border-slate-800 pb-4">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === currentQIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`w-9 h-9 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 shadow-md shadow-blue-600/30'
                      : isAnswered
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Current Question Display */}
          {currentQ && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
                  Question {currentQIndex + 1} of {questions.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {currentQ.marks} Marks
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-medium text-white leading-relaxed">
                {currentQ.question_text}
              </div>

              {/* 4 MCQ Options */}
              <div className="space-y-2 pt-2">
                {currentQ.options.map((option, optIdx) => {
                  const isSelected = answers[currentQ.id] === option;
                  const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={!!submittedAttempt}
                      onClick={() => handleSelectOption(currentQ.id, option)}
                      className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      } ${submittedAttempt ? 'cursor-default' : ''}`}
                    >
                      <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {optionLetter}
                      </span>
                      <span className="text-xs font-medium flex-1">{option}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {currentQIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-blue-600/30"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : isTakingQuiz ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Evaluating...' : 'Submit Final Quiz'}</span>
              </button>
            ) : null}
          </div>
        </div>

      </div>
    );
  }

  // Quiz Listing View
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Assigned Laboratory Quizzes</h2>
          <p className="text-xs text-slate-400">
            Interactive multiple-choice quizzes created by faculty for your branch and semester.
          </p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Quizzes Currently Assigned</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your branch faculty has not published any quizzes at this time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const hasAttempted = quiz.attempt_id !== null && quiz.attempt_id !== undefined;

            return (
              <div
                key={quiz.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 font-mono text-xs font-bold">
                      {quiz.total_marks} Marks
                    </span>
                    {hasAttempted ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Scored: {quiz.score} / {quiz.total_marks}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Available
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {quiz.instructions || 'Answer all questions within the allocated time.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Duration: {quiz.duration_minutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Branch: {quiz.branch} Sem {quiz.semester}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Faculty: {quiz.faculty_name}
                  </span>

                  <button
                    onClick={() => setActiveQuizId(quiz.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-md ${
                      hasAttempted
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                    }`}
                  >
                    <span>{hasAttempted ? 'Review Attempt' : 'Start Quiz'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
