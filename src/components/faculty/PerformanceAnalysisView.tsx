import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { 
  TrendingUp, 
  Search, 
  User, 
  FileCode2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Copy, 
  Cpu, 
  Terminal, 
  Sparkles, 
  Eye, 
  ArrowRight, 
  Filter, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export const PerformanceAnalysisView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'assignments' | 'report'>('students');
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters for Student Performance Table
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Selected Assignment for Assignment Monitoring View
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Individual Report State
  const [reportUsn, setReportUsn] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Active Code Inspection Modal
  const [inspectSubmission, setInspectSubmission] = useState<any>(null);

  const loadOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getFacultyPerformanceOverview();
      setOverviewData(data);
      if (data?.assignmentsMonitoring?.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(data.assignmentsMonitoring[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load performance analysis overview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const loadStudentReport = async (usn: string) => {
    if (!usn.trim()) return;
    setIsReportLoading(true);
    setReportError(null);
    try {
      const data = await api.getStudentReport(usn.trim().toUpperCase());
      setReportData(data);
      setReportUsn(usn.trim().toUpperCase());
      setActiveSubTab('report');
    } catch (err: any) {
      setReportError(err.message || `Could not find report for USN ${usn}`);
    } finally {
      setIsReportLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading automatic student performance metrics...</span>
      </div>
    );
  }

  const studentsList = overviewData?.students || [];
  const assignmentsList = overviewData?.assignmentsMonitoring || [];

  const filteredStudents = studentsList.filter((st: any) => {
    const matchesSearch = 
      st.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.usn.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || st.branch === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const activeAssignment = assignmentsList.find((a: any) => a.id === selectedAssignmentId) || assignmentsList[0];

  return (
    <div className="space-y-6">
      
      {/* Header & Sub-Tabs Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Automatic Performance Analysis & Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time evaluation tracking, execution penalty deductions, activity duration, and individual USN forensic reports.
          </p>
        </div>

        {/* 3 Sub-Tabs (Requirements 4A, 4B, 4C) */}
        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('students')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'students'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            A. Student Performance ({studentsList.length})
          </button>

          <button
            onClick={() => setActiveSubTab('assignments')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'assignments'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            B. Assignment Monitoring ({assignmentsList.length})
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'report'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            C. Individual Reports
          </button>

          <button
            onClick={loadOverview}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer ml-1"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: STUDENT PERFORMANCE TABLE (Requirement 4A)                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          
          {/* Controls: Search and Branch Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search registered student by name or USN..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Branch:</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-purple-500 font-medium cursor-pointer"
              >
                <option value="all">All Branches</option>
                <option value="ISE">ISE</option>
                <option value="CSE">CSE</option>
                <option value="AI & ML">AI & ML</option>
                <option value="AI & DS">AI & DS</option>
                <option value="ECE">ECE</option>
              </select>
            </div>
          </div>

          {/* Student Performance Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Branch & Sem</th>
                    <th className="py-3 px-4">Completion %</th>
                    <th className="py-3 px-4">Correctness</th>
                    <th className="py-3 px-4">Executions</th>
                    <th className="py-3 px-4">Penalty Deducted</th>
                    <th className="py-3 px-4">Active / Idle Time</th>
                    <th className="py-3 px-4">Last Submission</th>
                    <th className="py-3 px-4">Final Marks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        No students matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st: any) => (
                      <tr key={st.usn} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">
                          {st.name}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {st.usn}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {st.branch} • Sem {st.semester}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${st.completionPercentage}%` }} 
                              />
                            </div>
                            <span className="font-mono text-[11px] text-slate-300">
                              {st.completionPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-300">
                          {st.codeCorrectnessMarks} <span className="text-[10px] text-slate-500 font-normal">/ 50</span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200">
                            {st.totalExecutions} Runs
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {st.executionPenaltyMarksDeducted > 0 ? (
                            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              -{st.executionPenaltyMarksDeducted} Marks
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <span className="text-emerald-400 font-bold">{formatSeconds(st.activeSeconds)}</span>
                          <span className="text-slate-500"> / {formatSeconds(st.idleSeconds)}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {st.submissionTimestamp ? new Date(st.submissionTimestamp).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className="text-base text-purple-300">
                            {st.finalCalculatedMarks}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => loadStudentReport(st.usn)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <span>Report</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: ASSIGNMENT MONITORING (Requirement 4B)                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'assignments' && (
        <div className="space-y-4">
          
          {/* Assignment Selector Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-purple-400" />
                Select Laboratory Program:
              </span>
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {assignmentsList.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    Lab {a.labNumber}: {a.title} ({a.allocatedCount} Allocated)
                  </option>
                ))}
              </select>
            </div>

            {activeAssignment && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>Allocated:</span>
                  <strong className="text-white">{activeAssignment.allocatedCount}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span>Submitted:</span>
                  <strong className="text-emerald-300">{activeAssignment.submittedCount}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span>Pending:</span>
                  <strong className="text-amber-300">{activeAssignment.pendingCount}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Student Allocations and Submissions Table for this Lab */}
          {activeAssignment && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Lab {activeAssignment.labNumber}: {activeAssignment.title}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {activeAssignment.subject} • Due: {activeAssignment.dueDate} • Max Marks: {activeAssignment.maxMarks}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {activeAssignment.studentDetails?.length || 0} Enrolled Students
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">USN</th>
                      <th className="py-3 px-4">Submission Status</th>
                      <th className="py-3 px-4">Code Executions</th>
                      <th className="py-3 px-4">Penalty</th>
                      <th className="py-3 px-4">Auto Final Score</th>
                      <th className="py-3 px-4">Program Output</th>
                      <th className="py-3 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {activeAssignment.studentDetails?.map((st: any) => (
                      <tr key={st.student_usn} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">
                          {st.student_name}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          {st.student_usn}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            st.submission_status === 'Submitted' || st.submission_status === 'Evaluated'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : st.total_executions > 0
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {st.submission_status || (st.total_executions > 0 ? 'In Progress' : 'Pending')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="font-semibold text-white">{st.total_executions || 0} Runs</span>
                          {st.total_executions <= 5 ? (
                            <span className="text-[10px] text-emerald-400 block">5 Free</span>
                          ) : (
                            <span className="text-[10px] text-rose-400 block">Over limit</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {(st.execution_penalty || 0) > 0 ? (
                            <span className="text-rose-400">-{st.execution_penalty} Marks</span>
                          ) : (
                            <span className="text-emerald-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className="text-purple-300 text-sm">
                            {st.final_score !== null && st.final_score !== undefined ? st.final_score : '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[11px] font-mono text-slate-400">
                          {st.execution_result || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {st.code && (
                              <button
                                onClick={() => setInspectSubmission(st)}
                                className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[11px] transition cursor-pointer"
                                title="View Submitted Code"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => loadStudentReport(st.student_usn)}
                              className="p-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-[11px] transition cursor-pointer"
                              title="View Individual Report"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: INDIVIDUAL STUDENT REPORT BY USN (Requirement 4C)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'report' && (
        <div className="space-y-6">
          
          {/* USN Search Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              <span className="text-xs font-semibold text-slate-300 shrink-0">Search Student USN:</span>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="e.g. 1MS22IS025, 1MS22IS022..."
                  value={reportUsn}
                  onChange={(e) => setReportUsn(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadStudentReport(reportUsn)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={() => loadStudentReport(reportUsn)}
                disabled={isReportLoading}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition cursor-pointer"
              >
                {isReportLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Quick Select Pill Buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px]">Quick Load:</span>
              {['1MS22IS025', '1MS22IS018', '1MS22IS022', '1MS22IS015'].map(u => (
                <button
                  key={u}
                  onClick={() => loadStudentReport(u)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono text-[11px] cursor-pointer"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {reportError && (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{reportError}</span>
            </div>
          )}

          {/* Student Report Content */}
          {reportData && !isReportLoading && (
            <div className="space-y-6">
              
              {/* Student Profile & Overall Performance Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{reportData.student.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {reportData.student.usn}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {reportData.student.branch} • Semester {reportData.student.semester}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Email: {reportData.student.email} • Enrolled: {new Date(reportData.student.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-3 text-center min-w-[140px]">
                    <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">Overall Performance</span>
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {reportData.overall.overallScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </span>
                  </div>
                </div>

                {/* 5 Overall Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-xs font-mono">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Assignments Allocated</span>
                    <strong className="text-white text-base">{reportData.overall.totalAssignments}</strong>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Completed Submissions</span>
                    <strong className="text-emerald-400 text-base">{reportData.overall.completedAssignments}</strong>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Total Executions</span>
                    <strong className="text-blue-400 text-base">{reportData.overall.totalExecutions} Runs</strong>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Total Penalties Deducted</span>
                    <strong className={reportData.overall.totalPenaltyDeducted > 0 ? "text-rose-400 text-base" : "text-emerald-400 text-base"}>
                      -{reportData.overall.totalPenaltyDeducted} Marks
                    </strong>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Active / Idle Time</span>
                    <span className="text-emerald-400 font-bold">{formatSeconds(reportData.overall.totalActiveSeconds)}</span>
                    <span className="text-slate-500"> / {formatSeconds(reportData.overall.totalIdleSeconds)}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Assignment-Wise Marks Breakdown Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    100-Mark Model Detailed Assignment Breakdown
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {reportData.assignmentEvaluations?.length || 0} Records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Lab #</th>
                        <th className="py-3 px-3">Assignment Title</th>
                        <th className="py-3 px-3">Correctness (50)</th>
                        <th className="py-3 px-3">Completion (20)</th>
                        <th className="py-3 px-3">Effort (15)</th>
                        <th className="py-3 px-3">Timely (10)</th>
                        <th className="py-3 px-3">Originality (5)</th>
                        <th className="py-3 px-3">Base</th>
                        <th className="py-3 px-3">Executions</th>
                        <th className="py-3 px-3">Penalty</th>
                        <th className="py-3 px-3">Final Marks</th>
                        <th className="py-3 px-3">Faculty Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {reportData.assignmentEvaluations?.map((ev: any) => (
                        <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-bold text-blue-400">
                            Lab {ev.lab_number}
                          </td>
                          <td className="py-3 px-3 font-sans font-semibold text-white max-w-xs truncate">
                            {ev.title}
                          </td>
                          <td className="py-3 px-3 text-blue-300">{ev.code_correctness_marks}</td>
                          <td className="py-3 px-3 text-emerald-300">{ev.completion_marks}</td>
                          <td className="py-3 px-3 text-purple-300">{ev.activity_effort_marks}</td>
                          <td className="py-3 px-3 text-amber-300">{ev.timely_submission_marks}</td>
                          <td className="py-3 px-3 text-cyan-300">{ev.originality_marks}</td>
                          <td className="py-3 px-3 text-slate-300">{ev.base_score}</td>
                          <td className="py-3 px-3 text-slate-200">{ev.execution_count} Runs</td>
                          <td className="py-3 px-3 text-rose-400 font-bold">
                            {ev.execution_penalty > 0 ? `-${ev.execution_penalty}` : '0'}
                          </td>
                          <td className="py-3 px-3 text-base font-bold text-purple-300">
                            {ev.final_score}
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-300 italic max-w-xs truncate">
                            {ev.faculty_feedback || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Two Column Grid: Copy-Paste Events Log & Code Execution Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Copy-Paste Log */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Copy className="w-4 h-4 text-amber-400" />
                    Copy-Paste Events Audit Log ({reportData.pasteLogs?.length || 0})
                  </h4>

                  {reportData.pasteLogs?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No paste events recorded. Student wrote code manually.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {reportData.pasteLogs?.map((p: any) => (
                        <div key={p.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>{new Date(p.timestamp).toLocaleTimeString()} • {p.assignment_title || 'Workspace'}</span>
                            <span className="font-bold text-amber-400">{p.character_count} chars</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-slate-300 truncate">
                            "{p.pasted_snippet}"
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Code Execution Logs */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    Code Execution History ({reportData.executionLogs?.length || 0})
                  </h4>

                  {reportData.executionLogs?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No execution logs available.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {reportData.executionLogs?.map((e: any) => (
                        <div key={e.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-400">{new Date(e.created_at).toLocaleTimeString()} • {e.language}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                              e.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {e.status}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-300 truncate">
                            Output: {e.output || e.error || 'Empty output'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* Code Inspection Modal */}
      {inspectSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">
                  Submission Code: {inspectSubmission.student_name} ({inspectSubmission.student_usn})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">Language: {inspectSubmission.language}</span>
              </div>
              <button
                onClick={() => setInspectSubmission(null)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-slate-200 whitespace-pre">
              {inspectSubmission.code}
            </div>
            {inspectSubmission.execution_result && (
              <div className="p-3 border-t border-slate-800 bg-slate-900 text-xs font-mono text-slate-300">
                <span className="text-slate-400 block text-[10px]">Execution Result:</span>
                {inspectSubmission.execution_result}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
