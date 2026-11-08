import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, AlertTriangle } from 'lucide-react';
import { User } from '../../types.ts';

interface UnauthorizedAccessProps {
  user: User | null;
  attemptedRole?: 'faculty' | 'student';
  onReturn?: () => void;
}

export const UnauthorizedAccess: React.FC<UnauthorizedAccessProps> = ({
  user,
  attemptedRole = 'faculty',
  onReturn,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-rose-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-900/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" />
            HTTP 403 • Access Forbidden
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">
            Unauthorized Access
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {user?.role === 'student' && attemptedRole === 'faculty' ? (
              <>
                You are currently signed in as a <span className="text-emerald-400 font-semibold">Student ({user.name} • {user.usn})</span>. Students are strictly forbidden from viewing or accessing the Faculty Control Console, evaluations, and proctoring streams.
              </>
            ) : (
              <>
                Your account does not possess the required credentials to view this protected laboratory view. Role-based access control is enforced by the backend database.
              </>
            )}
          </p>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Security Policy Enforcement:</span>
          </div>
          <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
            <li>Role switching through URL manipulation is blocked.</li>
            <li>Browser inspection modifications are rejected by the API.</li>
            <li>All administrative requests require verified faculty sessions.</li>
          </ul>
        </div>

        <div>
          <button
            onClick={() => {
              if (onReturn) onReturn();
              else {
                window.location.hash = '';
                window.history.pushState(null, '', window.location.pathname);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wider transition cursor-pointer border border-slate-700 hover:border-slate-600 shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {user?.role === 'student' ? 'Student Dashboard' : 'Authorized Portal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
