import React, { useState, useEffect } from 'react';
import { Quiz, QuizQuestion, ALL_BRANCHES, ALL_SEMESTERS, Branch } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Clock, 
  Award, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Check, 
  Eye,
  X
} from 'lucide-react';

export const QuizManagementView: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [inspectQuizId, setInspectQuizId] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [branch, setBranch] = useState<Branch>('ISE');
  const [semester, setSemester] = useState<number>(5);
  const [totalMarks, setTotalMarks] = useState<10 | 15 | 20>(15);
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [allocationType, setAllocationType] = useState<'all' | 'specific'>('all');
  
  // Dynamic Questions list
  const [questions, setQuestions] = useState<Array<{
    questionText: string;
    options: string[];
    correctAnswer: string;
    marks: number;
  }>>([
    {
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      marks: 3
    }
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadQuizzes = async () => {
    setIsLoading(true);
    try {
      const res = await api.getQuizzes();
      setQuizzes(res.quizzes || []);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleAddQuestion = () => {
    const defaultMarks = Math.round(totalMarks / (questions.length + 1)) || 1;
    setQuestions([
      ...questions,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        marks: defaultMarks
      }
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestionText = (idx: number, text: string) => {
    const updated = [...questions];
    updated[idx].questionText = text;
    setQuestions(updated);
  };

  const updateOptionText = (qIdx: number, optIdx: number, val: string) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = val;
    setQuestions(updated);
  };

  const updateCorrectAnswer = (qIdx: number, val: string) => {
    const updated = [...questions];
    updated[qIdx].correctAnswer = val;
    setQuestions(updated);
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setErrorMsg(`Question ${i + 1} text cannot be empty.`);
        return;
      }
      if (q.options.some(opt => !opt.trim())) {
        setErrorMsg(`All 4 options for Question ${i + 1} must be provided.`);
        return;
      }
      if (!q.correctAnswer.trim()) {
        setErrorMsg(`Please select the correct answer for Question ${i + 1}.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await api.createQuiz({
        title,
        instructions,
        branch,
        semester,
        allocationType,
        totalMarks,
        durationMinutes,
        questions
      });

      setSuccessMsg(`Quiz "${title}" published and allocated to ${branch} Sem ${semester} successfully!`);
      setShowCreateModal(false);
      resetForm();
      loadQuizzes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setInstructions('');
    setBranch('ISE');
    setSemester(5);
    setTotalMarks(15);
    setDurationMinutes(20);
    setQuestions([
      {
        questionText: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        marks: 3
      }
    ]);
  };

  const handleInspectQuiz = async (id: string) => {
    setInspectQuizId(id);
    try {
      const res = await api.getQuiz(id);
      setInspectData(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            Quiz Management System
          </h2>
          <p className="text-xs text-slate-400">
            Create structured multiple-choice question quizzes with automatic evaluation and immediate score computation.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs tracking-wide shadow-md shadow-purple-600/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Quiz</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Quizzes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 font-mono text-xs font-bold">
                  {quiz.total_marks} Total Marks
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Published
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{quiz.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {quiz.instructions || 'Answer all questions in the allotted time.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Duration: {quiz.duration_minutes} mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Marks/Q: {quiz.marks_per_question} pts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Target: {quiz.branch} Sem {quiz.semester}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Questions: {quiz.question_count || 5}</span>
                </div>
              </div>

              {/* Attempts Counter */}
              <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Student Attempts:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {quiz.attempt_count || 0} Submitted
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Created: {new Date(quiz.created_at).toLocaleDateString()}
              </span>

              <button
                onClick={() => handleInspectQuiz(quiz.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Results & Questions</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <span>Create Multiple Choice Quiz</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Quiz Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Java Programming Basics"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Total Quiz Marks * (10, 15, or 20)
                  </label>
                  <select
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value) as 10 | 15 | 20)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value={10}>10 Marks</option>
                    <option value={15}>15 Marks</option>
                    <option value={20}>20 Marks</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Branch *</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value as Branch)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {ALL_BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Semester *</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {ALL_SEMESTERS.map(s => (
                      <option key={s} value={s}>Sem {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Duration (Minutes) *</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Quiz Instructions</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Answer all multiple choice questions. Negative marking is not applicable."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Dynamic Questions Builder */}
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Questions ({questions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-400">
                        Question #{qIdx + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="e.g. Which keyword is used to create a class in Java?"
                      value={q.questionText}
                      onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct_${qIdx}`}
                            checked={q.correctAnswer === opt && opt.length > 0}
                            onChange={() => updateCorrectAnswer(qIdx, opt)}
                            className="accent-emerald-500"
                            title="Mark as correct answer"
                          />
                          <input
                            type="text"
                            required
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                            value={opt}
                            onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      * Select radio button next to the option that represents the correct answer.
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-2 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish & Assign Quiz to Students</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Inspect Quiz Details Modal */}
      {inspectData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{inspectData.quiz.title}</h3>
                <p className="text-xs text-slate-400">
                  Target: {inspectData.quiz.branch} Sem {inspectData.quiz.semester} • Total Marks: {inspectData.quiz.total_marks}
                </p>
              </div>
              <button
                onClick={() => setInspectData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Questions Overview */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Configured Questions ({inspectData.questions?.length})
                </h4>
                <div className="space-y-2">
                  {inspectData.questions?.map((q: any, i: number) => (
                    <div key={q.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Q{i + 1}: {q.question_text}</span>
                        <span className="text-amber-400 font-mono">{q.marks} pts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                        {q.options.map((opt: string, oi: number) => (
                          <span
                            key={oi}
                            className={`p-1.5 rounded ${
                              opt.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
                                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Attempts Table */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Student Attempts & Results ({inspectData.attempts?.length || 0})
                </h4>
                
                {inspectData.attempts?.length === 0 ? (
                  <p className="text-slate-500 italic">No students have attempted this quiz yet.</p>
                ) : (
                  <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[11px] font-mono text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">USN</th>
                          <th className="py-2.5 px-3">Attempted Date</th>
                          <th className="py-2.5 px-3 font-mono">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {inspectData.attempts.map((att: any) => (
                          <tr key={att.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-3 font-semibold text-white">{att.student_name}</td>
                            <td className="py-2.5 px-3 font-mono text-blue-400">{att.student_usn}</td>
                            <td className="py-2.5 px-3 text-slate-400">{new Date(att.submitted_at).toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-300">
                              {att.score} / {att.total_marks}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
