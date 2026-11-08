import React from 'react';
import { User } from '../../types.ts';
import { 
  User as UserIcon, 
  IdCard, 
  Mail, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  Sparkles,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

interface MyProfileTabProps {
  user: User;
}

export const MyProfileTab: React.FC<MyProfileTabProps> = ({ user }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-blue-400" />
          Student Profile & Biometric Credentials
        </h2>
        <p className="text-xs text-slate-400">
          Official engineering laboratory enrollment and facial authentication identity details.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        
        {/* Profile Avatar Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-extrabold text-2xl text-blue-400 font-mono">
              {user.name.charAt(0)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{user.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Student
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              USN: <span className="text-blue-300 font-semibold">{user.usn}</span>
            </p>
          </div>
        </div>

        {/* Academic Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              Department / Branch
            </span>
            <p className="font-bold text-slate-200">{user.branch}</p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Academic Semester
            </span>
            <p className="font-bold text-slate-200">Semester {user.semester}</p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              Official Email
            </span>
            <p className="font-mono text-slate-200 truncate">{user.email}</p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              Portal Username
            </span>
            <p className="font-mono text-slate-200">{user.username}</p>
          </div>
        </div>

        {/* Biometric Verification Status */}
        <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Facial Biometric Template Enrolled
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              128-D Vector Verified
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Your facial embedding template is permanently registered in the SmartLab biometric database and matched during each login attempt.
          </p>

          <div className="grid grid-cols-2 gap-3 text-[11px] pt-1 border-t border-slate-800">
            <div>
              <span className="text-slate-500">Biometric Template ID:</span>
              <p className="font-mono text-slate-300">face_{user.usn}</p>
            </div>
            <div>
              <span className="text-slate-500">Security Standard:</span>
              <p className="font-semibold text-emerald-400">Euclidean & Cosine Match</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
