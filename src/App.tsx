/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, ALL_BRANCHES } from './types.ts';
import { api, getStoredToken } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { PasskeySettingsModal } from './components/auth/PasskeySettingsModal.tsx';
import { StudentDashboard } from './components/student/StudentDashboard.tsx';
import { FacultyDashboard } from './components/faculty/FacultyDashboard.tsx';
import { UnauthorizedAccess } from './components/common/UnauthorizedAccess.tsx';
import { 
  Code2, 
  Terminal, 
  ShieldCheck, 
  Activity, 
  GraduationCap, 
  UserPlus, 
  LogIn, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Cpu,
  Layers,
  Fingerprint,
  Lock,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isPasskeysOpen, setIsPasskeysOpen] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [urlHash, setUrlHash] = useState<string>(() => window.location.hash || window.location.search);

  // Sync URL hash / query state for direct link protection
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlHash(window.location.hash || window.location.search);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Validate session against SQLite backend database on startup
  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setIsLoadingAuth(false);
        return;
      }

      try {
        const res = await api.getCurrentUser();
        if (res.user) {
          // Always use backend database verified role
          setCurrentUser(res.user);
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        // Token expired, revoked or invalidated
        setCurrentUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    checkAuth();
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    window.location.hash = '';
    setUrlHash('');
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Initializing SmartLab Academic Gateway...</span>
      </div>
    );
  }

  // Determine if direct URL tampering or forbidden cross-role access is attempted
  const lowerUrl = urlHash.toLowerCase();
  const isStudentAttemptingFaculty = currentUser?.role === 'student' && (lowerUrl.includes('faculty') || lowerUrl.includes('admin'));
  const isFacultyAttemptingStudent = (currentUser?.role === 'faculty' || currentUser?.role === 'admin') && lowerUrl.includes('student');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Universal Top Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPasskeys={() => setIsPasskeysOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1">
        {currentUser ? (
          /* Check Role-Based Access Control (RBAC) */
          isStudentAttemptingFaculty ? (
            <UnauthorizedAccess
              user={currentUser}
              attemptedRole="faculty"
              onReturn={() => {
                window.location.hash = '';
                window.history.pushState(null, '', window.location.pathname);
                setUrlHash('');
              }}
            />
          ) : isFacultyAttemptingStudent ? (
            <UnauthorizedAccess
              user={currentUser}
              attemptedRole="student"
              onReturn={() => {
                window.location.hash = '';
                window.history.pushState(null, '', window.location.pathname);
                setUrlHash('');
              }}
            />
          ) : currentUser.role === 'student' ? (
            /* Student is strictly restricted to StudentDashboard */
            <StudentDashboard user={currentUser} />
          ) : (
            /* Faculty is strictly restricted to FacultyDashboard */
            <FacultyDashboard user={currentUser} />
          )
        ) : (
          /* Landing Screen (When not signed in) */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
            
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold tracking-wide uppercase">
                <Fingerprint className="w-3.5 h-3.5" />
                Device Biometric Face Authentication & RBAC Enforced
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                SMART<span className="text-blue-500">LAB</span>
              </h1>
              <p className="text-sm sm:text-base font-semibold text-slate-300">
                Unified Multi-Branch Coding Platform & Faculty Monitoring System
              </p>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Empowering engineering students and faculty with device-native biometric passkeys (Windows Hello Face, Apple Face ID, Android Biometrics), isolated role-based security, sandboxed code execution, and proctoring.
              </p>

              {/* Login Portal Trigger Buttons */}
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-xl shadow-blue-600/30 flex items-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Student Sign In (Biometric Passkey)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-6 py-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-bold text-xs tracking-wider transition cursor-pointer flex items-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Faculty Console Access</span>
                </button>
              </div>
            </div>

            {/* 2 Main Role Portals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              
              {/* Option 1: Student Portal */}
              <div 
                onClick={() => setIsAuthOpen(true)}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4 cursor-pointer group transition duration-200 hover:-translate-y-1"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-300">
                    Student Laboratory Portal
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Access your assigned laboratory works, Monaco coding editor, and quizzes with device-native face biometric verification (Windows Hello Face, Apple Face ID).
                  </p>
                </div>
                <div className="flex items-center text-xs font-bold text-blue-400 gap-1 pt-2">
                  <span>Sign In / Enroll Face</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Option 2: Faculty Portal */}
              <div 
                onClick={() => setIsAuthOpen(true)}
                className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4 cursor-pointer group transition duration-200 hover:-translate-y-1"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-300">
                    Faculty Control Console
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Protected console for approved faculty to assign labs, evaluate submissions, grade code, inspect live heartbeats, and detect plagiarism.
                  </p>
                </div>
                <div className="flex items-center text-xs font-bold text-purple-400 gap-1 pt-2">
                  <span>Faculty Biometric Sign In</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </div>
              </div>

            </div>

            {/* Supported Branches Showcase */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                Supported Engineering Disciplines (Semesters 1 through 8)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center text-xs">
                {ALL_BRANCHES.map(b => (
                  <div key={b.id} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                    <span className="font-mono font-bold text-blue-400 block">{b.id}</span>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <Fingerprint className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">Device WebAuthn Passkeys</h4>
                <p className="text-slate-400 leading-relaxed">
                  Cryptographically secure platform authentication using Windows Hello Face, Apple Face ID, or Android Biometrics without storing raw biometric images.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <Lock className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-bold text-white">Database-Verified RBAC</h4>
                <p className="text-slate-400 leading-relaxed">
                  Strict student and faculty boundaries checked against SQLite on every request. URL tampering, browser inspection, and unauthorized API calls return HTTP 403.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Proctoring & Proctor Dashboard</h4>
                <p className="text-slate-400 leading-relaxed">
                  Real-time student status tracking (Active, Idle, Disconnected), Monaco paste event recording, lexical similarity comparison, and MCQ quiz grading.
                </p>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      {/* Passkey Management Modal */}
      {currentUser && (
        <PasskeySettingsModal
          isOpen={isPasskeysOpen}
          onClose={() => setIsPasskeysOpen(false)}
          user={currentUser}
        />
      )}

    </div>
  );
}
