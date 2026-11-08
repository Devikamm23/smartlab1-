import React from 'react';
import { User } from '../types.ts';
import { 
  Code2, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  Sparkles,
  Laptop
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenPasskeys?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onOpenAuth, onOpenPasskeys }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Code2 className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-lg text-white font-mono">
                SMART<span className="text-blue-400">LAB</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                Multi-Branch Coding Platform
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Unified Laboratory Execution & Faculty Monitoring System
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-semibold text-slate-200">{user.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    user.role === 'faculty' || user.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-end gap-2">
                  {user.role === 'student' ? (
                    <>
                      <span className="font-mono text-blue-300 font-medium">{user.usn}</span>
                      <span>•</span>
                      <span>{user.branch} Sem {user.semester}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-purple-300">{user.facultyId || 'FACULTY'}</span>
                      <span>•</span>
                      <span>{user.branch || 'Dept'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Passkeys Management Button */}
              {onOpenPasskeys && (
                <button
                  onClick={onOpenPasskeys}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-medium transition cursor-pointer"
                  title="Manage Biometric Passkeys"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden md:inline">Passkeys</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 text-xs font-medium transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-wide shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>Portal Sign In / Register</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
