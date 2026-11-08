import React, { useState, useEffect } from 'react';
import { LiveStudentStatus, ActivitySession, PasteEvent } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  Activity, 
  Radio, 
  History, 
  Clock, 
  Cpu, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  PauseCircle, 
  WifiOff, 
  LogOut,
  RefreshCw
} from 'lucide-react';

export const LiveMonitoringView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [liveStudents, setLiveStudents] = useState<LiveStudentStatus[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [pasteEvents, setPasteEvents] = useState<PasteEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [liveRes, histRes] = await Promise.all([
        api.getLiveMonitoring(),
        api.getActivityHistory()
      ]);
      setLiveStudents(liveRes.students || []);
      setSessions(histRes.sessions || []);
      setPasteEvents(histRes.pasteEvents || []);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh live status every 15 seconds
    const interval = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0m';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${seconds % 60}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Active
          </span>
        );
      case 'Idle':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
            Idle (&gt;2 mins)
          </span>
        );
      case 'Disconnected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            Disconnected
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            Logged Out
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Student Laboratory Activity & Proctoring
          </h2>
          <p className="text-xs text-slate-400">
            Real-time session monitoring with heartbeat tracking, active/idle time duration, and historical audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-mono">
            Auto-refreshed: {lastRefreshed}
          </span>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'live'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Live Monitoring ({liveStudents.filter(s => s.liveStatus === 'Active' || s.liveStatus === 'Idle').length} Online)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity History & Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: LIVE MONITORING */}
      {activeTab === 'live' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <span className="font-bold text-white uppercase tracking-wider">
              Enrolled Students Real-Time Status
            </span>
            <span className="text-slate-400 font-mono">
              Inactivity Threshold: 2 Minutes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">USN</th>
                  <th className="py-3 px-4">Branch & Sem</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Active Duration</th>
                  <th className="py-3 px-4">Idle Duration</th>
                  <th className="py-3 px-4">Total Compilations</th>
                  <th className="py-3 px-4">Paste Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {liveStudents.map((st) => (
                  <tr key={st.usn} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {st.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {st.usn}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {st.branch} Sem {st.semester}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(st.liveStatus)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-semibold">
                      {formatDuration(st.active_seconds)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-amber-400 font-semibold">
                      {formatDuration(st.idle_seconds)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-blue-300 font-bold">
                      {st.total_compilations || 0} Runs
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {st.paste_count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVITY HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          
          {/* Recent Sessions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Recent Student Login Sessions
              </span>
              <span className="text-slate-400 font-mono">
                {sessions.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Login Time</th>
                    <th className="py-3 px-4">Logout Time</th>
                    <th className="py-3 px-4">Active Time</th>
                    <th className="py-3 px-4">Idle Time</th>
                    <th className="py-3 px-4">Final Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">{sess.student_name}</td>
                      <td className="py-3 px-4 font-mono text-blue-400">{sess.student_usn}</td>
                      <td className="py-3 px-4 text-slate-400">{new Date(sess.login_time).toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {sess.logout_time ? new Date(sess.logout_time).toLocaleString() : <span className="text-emerald-400 font-semibold">Active Session</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400">{formatDuration(sess.active_seconds)}</td>
                      <td className="py-3 px-4 font-mono text-amber-400">{formatDuration(sess.idle_seconds)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                          {sess.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paste Audit Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Copy className="w-4 h-4 text-amber-400" />
                Monaco Editor Paste Activity Logs
              </span>
              <span className="text-slate-400 font-mono">
                {pasteEvents.length} Recorded Events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Assignment</th>
                    <th className="py-3 px-4">Characters</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Pasted Content Snippet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pasteEvents.map((pe) => (
                    <tr key={pe.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">{pe.student_name}</td>
                      <td className="py-3 px-4 font-mono text-blue-400">{pe.student_usn}</td>
                      <td className="py-3 px-4 text-slate-400">{pe.assignment_title || 'Workspace'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {pe.character_count} chars
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(pe.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 max-w-sm truncate text-[11px]">
                        {pe.pasted_snippet}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
