import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { MyProgressResponse, MyProgressAssignment } from '../../types.ts';
import { 
  TrendingUp, 
  Cpu, 
  CheckCircle2, 
  Clock, 
  Award, 
  AlertCircle,
  FileCode2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info
} from 'lucide-react';

export const MyProgressTab: React.FC = () => {
  const [data, setData] = useState<MyProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await api.getMyProgress();
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load progress details');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading your laboratory progress and performance metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-xs text-rose-300">{error || 'Could not load progress'}</p>
      </div>
    );
  }

  const { metrics, assignments } = data;

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Academic Progress & Performance Analysis
        </h2>
        <p className="text-xs text-slate-400">
          Real-time record of your assigned laboratory programs, automated 100-mark evaluations, execution limits, and faculty feedback.
        </p>
      </div>

      {/* 4 Required Metric Summary Cards (Requirement 1C) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Total Assignments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Assignments</span>
            <FileCode2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {metrics.totalAssigned}
          </div>
          <div className="text-[11px] text-slate-400">
            Published Laboratory Programs
          </div>
        </div>

        {/* 2. Completed Assignments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Completed Assignments</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 font-mono">
            {metrics.completedCount}
          </div>
          <div className="text-[11px] text-slate-400">
            Submitted Laboratory Solutions
          </div>
        </div>

        {/* 3. Pending Assignments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Assignments</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300 font-mono">
            {metrics.pendingCount}
          </div>
          <div className="text-[11px] text-slate-400">
            Awaiting Completion / In Progress
          </div>
        </div>

        {/* 4. Automatically Calculated Performance */}
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden shadow-lg shadow-blue-500/5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="text-blue-300 font-semibold">Automatic Performance</span>
            <Award className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">
            {metrics.overallPerformance} <span className="text-sm font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Weighted 100-mark automated model
          </div>
        </div>

      </div>

      {/* 100-Mark Model & Execution Limit Transparency Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            100-Mark Automatic Evaluation Model & Execution Limit Formula
          </h3>
          <span className="text-[10px] text-purple-300 font-mono bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded">
            Authoritative Server Calculation
          </span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Code Correctness</span>
            <strong className="text-blue-300 font-mono">50 Marks</strong>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Completion</span>
            <strong className="text-emerald-300 font-mono">20 Marks</strong>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Activity & Effort</span>
            <strong className="text-purple-300 font-mono">15 Marks</strong>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Timely Submission</span>
            <strong className="text-amber-300 font-mono">10 Marks</strong>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Originality</span>
            <strong className="text-cyan-300 font-mono">5 Marks</strong>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-rose-500/30">
            <span className="text-rose-400 block text-[10px]">Execution Penalty</span>
            <strong className="text-rose-300 font-mono">FLOOR((N-1)/5)</strong>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong>Rule:</strong> Each assignment allows <strong>5 free code executions</strong>. Starting from the 6th execution, 1 mark is deducted for every additional group of 5 executions. Active coding time is tracked continuously; idle periods are excluded.
        </p>
      </div>

      {/* Assigned Labs & Automatic Performance Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-blue-400" />
            Assigned Laboratory Programs, Marks & Faculty Feedback
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {assignments.length} Assignment{assignments.length === 1 ? '' : 's'}
          </span>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No lab assignments have been allocated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Lab #</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Executions</th>
                  <th className="py-3 px-4">Penalty</th>
                  <th className="py-3 px-4">Calculated Score</th>
                  <th className="py-3 px-4">Faculty Marks & Feedback</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {assignments.map((item: MyProgressAssignment) => {
                  const isExpanded = expandedId === item.assignmentId;
                  const finalScore = item.evaluation?.finalScore ?? 0;
                  const penalty = item.executionPenalty;

                  return (
                    <React.Fragment key={item.assignmentId}>
                      <tr className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                          Lab {item.labNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white block">{item.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.subject} • Due: {item.dueDate}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'Submitted'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.status === 'In Progress'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-white font-semibold">{item.totalExecutions}</span>
                          <span className="text-slate-400 text-[10px] block">
                            {item.remainingFreeExecutions > 0 ? `${item.remainingFreeExecutions} free left` : '5 free limit used'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          {penalty > 0 ? (
                            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              -{penalty} Mark{penalty === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">0 (Free)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className="text-base text-blue-400">
                            {finalScore}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal"> / 100</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {item.submission?.marksObtained !== null && item.submission?.marksObtained !== undefined ? (
                            <div>
                              <span className="font-mono font-bold text-emerald-300">
                                {item.submission.marksObtained} / {item.maxMarks}
                              </span>
                              {item.submission.feedback && (
                                <p className="text-[11px] text-slate-300 italic truncate mt-0.5">
                                  "{item.submission.feedback}"
                                </p>
                              )}
                            </div>
                          ) : item.status === 'Submitted' ? (
                            <span className="text-blue-300 text-[11px] italic">Submitted • Pending faculty review</span>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Not submitted</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => toggleExpand(item.assignmentId)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                            title="Toggle Factor Breakdown"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable 100-Mark Breakdown Row */}
                      {isExpanded && item.evaluation && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={8} className="p-4 border-t border-b border-slate-800">
                            <div className="space-y-3">
                              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                                <span>100-Mark Automatic Evaluation Breakdown for Lab {item.labNumber}</span>
                                <span className="font-mono text-purple-400">
                                  Final Score: {item.evaluation.finalScore} / 100
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">1. Code Correctness</span>
                                  <span className="text-sm font-bold text-blue-400 font-mono">
                                    {item.evaluation.codeCorrectnessMarks} <span className="text-[10px] font-normal text-slate-400">/ 50</span>
                                  </span>
                                </div>

                                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">2. Completion</span>
                                  <span className="text-sm font-bold text-emerald-400 font-mono">
                                    {item.evaluation.completionMarks} <span className="text-[10px] font-normal text-slate-400">/ 20</span>
                                  </span>
                                </div>

                                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">3. Coding Effort</span>
                                  <span className="text-sm font-bold text-purple-400 font-mono">
                                    {item.evaluation.activityEffortMarks} <span className="text-[10px] font-normal text-slate-400">/ 15</span>
                                  </span>
                                </div>

                                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">4. Timeliness</span>
                                  <span className="text-sm font-bold text-amber-400 font-mono">
                                    {item.evaluation.timelySubmissionMarks} <span className="text-[10px] font-normal text-slate-400">/ 10</span>
                                  </span>
                                </div>

                                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 text-[10px] block">5. Originality</span>
                                  <span className="text-sm font-bold text-cyan-400 font-mono">
                                    {item.evaluation.originalityMarks} <span className="text-[10px] font-normal text-slate-400">/ 5</span>
                                  </span>
                                </div>

                                <div className="bg-slate-900 p-2.5 rounded-xl border border-rose-500/30">
                                  <span className="text-rose-400 text-[10px] block">Execution Penalty</span>
                                  <span className="text-sm font-bold text-rose-400 font-mono">
                                    -{item.evaluation.executionPenalty}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-400 font-mono bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                                Base Score: {item.evaluation.baseScore} – Penalty ({item.evaluation.executionPenalty}) = Final Score: {item.evaluation.finalScore} / 100
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

