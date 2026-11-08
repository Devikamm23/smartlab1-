import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  Mail,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';

export const FacultyApprovalsView: React.FC = () => {
  const [pendingFaculty, setPendingFaculty] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPending = async () => {
    setIsLoading(true);
    try {
      const res = await api.getPendingFaculty();
      setPendingFaculty(res.pending || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleAction = async (facultyId: string, action: 'approve' | 'reject') => {
    try {
      await api.approveFaculty(facultyId, action);
      setActionMsg({
        type: 'success',
        text: `Faculty account (${facultyId}) was ${action === 'approve' ? 'Approved' : 'Rejected'} successfully.`
      });
      loadPending();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Faculty Account Registrations & Admin Approval Portal
          </h2>
          <p className="text-xs text-slate-400">
            Verify academic credentials and grant access permissions to new faculty accounts.
          </p>
        </div>

        <button
          onClick={loadPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {actionMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          actionMsg.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
        }`}>
          {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Pending List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="font-bold text-white uppercase tracking-wider">
            Pending Faculty Registrations ({pendingFaculty.length})
          </span>
          <span className="text-slate-400 font-mono">
            Requires Administrative Approval
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Checking pending faculty submissions...
          </div>
        ) : pendingFaculty.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-slate-300 font-semibold">All Faculty Registrations are Up-to-Date</p>
            <p className="text-slate-500">There are no unapproved faculty registrations pending review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Faculty ID</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pendingFaculty.map((fac) => (
                  <tr key={fac.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {fac.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                      {fac.faculty_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {fac.username}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200">
                      {fac.branch}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {fac.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(fac.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(fac.faculty_id, 'approve')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleAction(fac.faculty_id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 text-xs font-semibold cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
