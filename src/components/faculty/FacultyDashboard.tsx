import React, { useState, useEffect } from 'react';
import { User, Assignment } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  LayoutDashboard, 
  FileCode2, 
  CheckCheck, 
  Users, 
  HelpCircle, 
  Activity, 
  Copy, 
  ShieldCheck, 
  Settings,
  Plus,
  BookOpen,
  Award,
  Clock,
  Radio,
  Sparkles,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { AssignLabView } from './AssignLabView.tsx';
import { SubmissionsView } from './SubmissionsView.tsx';
import { StudentEnrollmentView } from './StudentEnrollmentView.tsx';
import { QuizManagementView } from './QuizManagementView.tsx';
import { LiveMonitoringView } from './LiveMonitoringView.tsx';
import { PlagiarismView } from './PlagiarismView.tsx';
import { FacultyApprovalsView } from './FacultyApprovalsView.tsx';
import { PerformanceAnalysisView } from './PerformanceAnalysisView.tsx';
import { Judge0SettingsModal } from './Judge0SettingsModal.tsx';
import { UnauthorizedAccess } from '../common/UnauthorizedAccess.tsx';

interface FacultyDashboardProps {
  user: User;
}

type FacultyTab = 
  | 'overview'
  | 'performance'
  | 'assign'
  | 'submissions'
  | 'enrollment'
  | 'quizzes'
  | 'monitoring'
  | 'plagiarism'
  | 'approvals';

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ user }) => {
  // Strict Role Guard: Students attempting to render FacultyDashboard receive 403 Forbidden screen
  if (user.role !== 'faculty' && user.role !== 'admin') {
    return <UnauthorizedAccess user={user} attemptedRole="faculty" />;
  }

  const [activeTab, setActiveTab] = useState<FacultyTab>('overview');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [showJudge0Modal, setShowJudge0Modal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assignRes, liveRes, pendingRes] = await Promise.all([
        api.getAssignments(),
        api.getLiveMonitoring(),
        api.getPendingFaculty()
      ]);
      setAssignments(assignRes.assignments || []);
      setLiveStudents(liveRes.students || []);
      setPendingApprovalsCount(pendingRes.pending?.length || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSubmissions = assignments.reduce((acc, a) => acc + (a.submitted_count || 0), 0);
  const totalEvaluated = assignments.reduce((acc, a) => acc + (a.evaluated_count || 0), 0);
  const pendingEvaluations = Math.max(0, totalSubmissions - totalEvaluated);
  const onlineStudentsCount = liveStudents.filter(s => s.liveStatus === 'Active' || s.liveStatus === 'Idle').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-white">Faculty Laboratory Control Console</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {user.branch || 'ISE'} Department
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Welcome back, <strong className="text-slate-200">{user.name}</strong> • Faculty ID: <span className="font-mono text-purple-300">{user.facultyId || 'FAC-ISE-001'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJudge0Modal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Judge0 Settings</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex flex-wrap items-center gap-1 shadow-lg text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <span>Performance Analysis</span>
        </button>

        <button
          onClick={() => setActiveTab('assign')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'assign'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>Assign Lab Program</span>
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'submissions'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Code Evaluation</span>
          {pendingEvaluations > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono">
              {pendingEvaluations}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('enrollment')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'enrollment'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Student Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'quizzes'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Quiz System</span>
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'monitoring'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Proctoring</span>
          {onlineStudentsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {onlineStudentsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('plagiarism')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'plagiarism'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Copy className="w-4 h-4" />
          <span>Paste & Similarity</span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>

      {/* Render Current View */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Active Lab Works</span>
                  <FileCode2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">
                  {assignments.length}
                </div>
                <div className="text-[11px] text-slate-400">
                  Java, Python, C, C++, SQL
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Student Submissions</span>
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-300 font-mono">
                  {totalSubmissions}
                </div>
                <div className="text-[11px] text-slate-400">
                  {totalEvaluated} Evaluated • {pendingEvaluations} Pending
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Students Online Now</span>
                  <Radio className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {onlineStudentsCount}
                </div>
                <div className="text-[11px] text-slate-400">
                  {liveStudents.length} Total Enrolled
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Pending Faculty Approvals</span>
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-purple-300 font-mono">
                  {pendingApprovalsCount}
                </div>
                <div className="text-[11px] text-slate-400">
                  Requires Admin Verification
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Labs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-blue-400" />
                    Published Laboratory Programs
                  </h3>
                  <button
                    onClick={() => setActiveTab('assign')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    View All & Assign &rarr;
                  </button>
                </div>

                <div className="space-y-3">
                  {assignments.slice(0, 3).map(a => (
                    <div key={a.id} className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                            Lab {a.lab_number}
                          </span>
                          <span className="text-xs font-bold text-white">{a.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {a.subject} • {a.branch} Sem {a.semester} • Max Marks: {a.max_marks}
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveTab('submissions')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Submissions ({a.submitted_count || 0})
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Proctoring Quick Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Student Status Feed
                  </h3>
                  <button
                    onClick={() => setActiveTab('monitoring')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    Details &rarr;
                  </button>
                </div>

                <div className="space-y-2">
                  {liveStudents.slice(0, 5).map(st => (
                    <div key={st.usn} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                      <div>
                        <span className="font-semibold text-white block">{st.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{st.usn} • {st.branch}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.liveStatus === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : st.liveStatus === 'Idle'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {st.liveStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'performance' && (
          <PerformanceAnalysisView />
        )}

        {activeTab === 'assign' && (
          <AssignLabView onAssignmentCreated={loadData} />
        )}

        {activeTab === 'submissions' && (
          <SubmissionsView assignments={assignments} />
        )}

        {activeTab === 'enrollment' && (
          <StudentEnrollmentView />
        )}

        {activeTab === 'quizzes' && (
          <QuizManagementView />
        )}

        {activeTab === 'monitoring' && (
          <LiveMonitoringView />
        )}

        {activeTab === 'plagiarism' && (
          <PlagiarismView assignments={assignments} />
        )}

        {activeTab === 'approvals' && (
          <FacultyApprovalsView />
        )}
      </div>

      {/* Judge0 Settings Modal */}
      <Judge0SettingsModal
        isOpen={showJudge0Modal}
        onClose={() => setShowJudge0Modal(false)}
      />

    </div>
  );
};
