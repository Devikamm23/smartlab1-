import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Assignment, Submission } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  CheckCheck, 
  Clock, 
  Award, 
  FileCode2, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Cpu, 
  User as UserIcon,
  X,
  Send
} from 'lucide-react';

interface SubmissionsViewProps {
  assignments: Assignment[];
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({ assignments }) => {
  const [selectedAssignId, setSelectedAssignId] = useState<string>(assignments[0]?.id || '');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inspectSubmission, setInspectSubmission] = useState<Submission | null>(null);

  // Evaluation Form State
  const [marks, setMarks] = useState<number>(20);
  const [feedback, setFeedback] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSubmissions = async (assignId: string) => {
    if (!assignId) return;
    setIsLoading(true);
    try {
      const res = await api.getAssignmentSubmissions(assignId);
      setSubmissions(res.submissions || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAssignId) {
      loadSubmissions(selectedAssignId);
    }
  }, [selectedAssignId]);

  const activeAssignment = assignments.find(a => a.id === selectedAssignId);

  const handleOpenEvaluation = (sub: Submission) => {
    setInspectSubmission(sub);
    setMarks(sub.marks_obtained !== null && sub.marks_obtained !== undefined ? sub.marks_obtained : (activeAssignment?.max_marks || 20));
    setFeedback(sub.feedback || '');
    setFeedbackMsg(null);
  };

  const handleSubmitEvaluation = async () => {
    if (!inspectSubmission) return;
    setIsEvaluating(true);
    setFeedbackMsg(null);

    try {
      await api.evaluateSubmission(inspectSubmission.id, marks, feedback);
      setFeedbackMsg({ type: 'success', text: 'Evaluation and marks awarded successfully!' });
      
      // Update local state
      setSubmissions(prev => prev.map(s => s.id === inspectSubmission.id ? {
        ...s,
        status: 'Evaluated',
        marks_obtained: marks,
        feedback: feedback
      } : s));

      setTimeout(() => {
        setInspectSubmission(null);
        setFeedbackMsg(null);
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Evaluation failed' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Assignment Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-emerald-400" />
            Code Submissions & Faculty Evaluation
          </h2>
          <p className="text-xs text-slate-400">
            Inspect student program implementations, compilation counts, test outputs, and record evaluation marks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Lab:</span>
          <select
            value={selectedAssignId}
            onChange={(e) => setSelectedAssignId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            {assignments.map(a => (
              <option key={a.id} value={a.id}>
                Lab {a.lab_number}: {a.title} ({a.branch} Sem {a.semester})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Student Submissions ({submissions.length})
            </span>
            {activeAssignment && (
              <span className="text-xs text-slate-400 font-mono">
                • Max Marks: {activeAssignment.max_marks}
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading student submissions...
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <FileCode2 className="w-8 h-8 mx-auto text-slate-600" />
            <p>No submissions received yet for this laboratory assignment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">USN</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Compilations</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Marks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {sub.student_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {sub.student_usn}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {sub.language}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300 text-[11px] font-bold">
                        {sub.compilation_count} Runs
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        sub.status === 'Evaluated'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : sub.status === 'Submitted'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {sub.marks_obtained !== null && sub.marks_obtained !== undefined ? (
                        <span className="text-emerald-300">
                          {sub.marks_obtained} / {activeAssignment?.max_marks || 20}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Unevaluated</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEvaluation(sub)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
                      >
                        {sub.status === 'Evaluated' ? 'Review & Edit' : 'Evaluate Code'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Evaluation Modal */}
      {inspectSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Evaluating: {inspectSubmission.student_name}</span>
                  <span className="font-mono text-blue-400 text-xs px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30">
                    {inspectSubmission.student_usn}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {activeAssignment?.title} • Language: {inspectSubmission.language}
                </p>
              </div>

              <button
                onClick={() => setInspectSubmission(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {feedbackMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}>
                  {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Student Metadata Strip */}
              <div className="grid grid-cols-3 gap-3 text-xs bg-slate-950/80 border border-slate-800 p-3 rounded-xl font-mono">
                <div>
                  <span className="text-slate-500 block text-[11px]">Submitted Timestamp:</span>
                  <span className="text-slate-300">{new Date(inspectSubmission.submitted_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Actual Compilation Count:</span>
                  <span className="text-blue-400 font-bold">{inspectSubmission.compilation_count} Runs</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Evaluation Status:</span>
                  <span className="text-emerald-400 font-bold">{inspectSubmission.status}</span>
                </div>
              </div>

              {/* Submitted Code Viewer in Monaco */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Submitted Solution Code:
                </label>
                <div className="h-64 rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e]">
                  <Editor
                    height="100%"
                    language={inspectSubmission.language.toLowerCase() === 'c++' ? 'cpp' : inspectSubmission.language.toLowerCase()}
                    theme="vs-dark"
                    value={inspectSubmission.code}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "'Fira Code', monospace"
                    }}
                  />
                </div>
              </div>

              {/* Execution / Test Case Results */}
              {inspectSubmission.execution_result && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Execution Log / Test Case Results:
                  </label>
                  <pre className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-mono text-emerald-300 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {inspectSubmission.execution_result}
                  </pre>
                </div>
              )}

              {/* Evaluation Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Marks Awarded (out of {activeAssignment?.max_marks || 20}) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeAssignment?.max_marks || 20}
                    step={0.5}
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Faculty Feedback / Review Comments
                  </label>
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="e.g. Excellent algorithmic optimization, clean edge case handling."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setInspectSubmission(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitEvaluation}
                disabled={isEvaluating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>{isEvaluating ? 'Saving...' : 'Save & Publish Evaluation'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
