import React, { useState } from 'react';
import { 
  User as UserIcon, 
  GraduationCap, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Fingerprint,
  Layers,
  ArrowRight,
  UserPlus,
  LogIn,
  IdCard,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Laptop,
  HelpCircle,
  X
} from 'lucide-react';
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { ALL_BRANCHES, ALL_SEMESTERS, Branch, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { ForgotPasswordModal } from './ForgotPasswordModal.tsx';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

type AuthMode = 'student_login' | 'student_register' | 'faculty_login' | 'faculty_register';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  // Primary active mode
  const [activeMode, setActiveMode] = useState<AuthMode>('student_login');

  // Student Login Fields
  const [studentUsn, setStudentUsn] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Faculty Login Fields
  const [facultyId, setFacultyId] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');
  const [showFacultyPassword, setShowFacultyPassword] = useState(false);

  // Student Registration Fields (Strictly role: student)
  const [regFullName, setRegFullName] = useState('');
  const [regUsn, setRegUsn] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBranch, setRegBranch] = useState<Branch>('ISE');
  const [regSemester, setRegSemester] = useState<number>(5);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Admin Faculty Creation Fields
  const [adminKey, setAdminKey] = useState('');
  const [facFullName, setFacFullName] = useState('');
  const [facId, setFacId] = useState('');
  const [facUsername, setFacUsername] = useState('');
  const [facEmail, setFacEmail] = useState('');
  const [facDept, setFacDept] = useState<Branch>('ISE');
  const [facPassword, setFacPassword] = useState('');
  const [facConfirmPassword, setFacConfirmPassword] = useState('');

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authStatusText, setAuthStatusText] = useState<string>('');

  // Biometric / WebAuthn Challenge State
  const [pendingChallenge, setPendingChallenge] = useState<any | null>(null);
  const [isPromptingBiometrics, setIsPromptingBiometrics] = useState<boolean>(false);

  // 2FA Fallback Code State (for devices without biometric hardware)
  const [showFallbackCodeDialog, setShowFallbackCodeDialog] = useState<boolean>(false);
  const [fallbackCode, setFallbackCode] = useState<string>('');
  const [serverFallbackCodeDisplay, setServerFallbackCodeDisplay] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>('');

  // Forgot Password Modal
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);

  if (!isOpen) return null;

  // Quick Demo Account Preloader (Fills credentials without bypassing biometric prompt)
  const handlePreloadDemo = (type: 'faculty' | 'devika' | 'kavana' | 'kanika' | 'chaitanya') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setPendingChallenge(null);
    setShowFallbackCodeDialog(false);

    if (type === 'faculty') {
      setActiveMode('faculty_login');
      setFacultyId('bhavesh_ise');
      setFacultyPassword('Faculty@123');
    } else {
      setActiveMode('student_login');
      setStudentPassword('Student@123');
      if (type === 'devika') setStudentUsn('1MS22IS018');
      if (type === 'kavana') setStudentUsn('1MS22IS025');
      if (type === 'kanika') setStudentUsn('1MS22IS022');
      if (type === 'chaitanya') setStudentUsn('1MS22IS015');
    }
  };

  // -------------------------------------------------------------
  // Universal Biometric Face / Passkey Authentication Handler
  // -------------------------------------------------------------
  const handleInitiateBiometricLogin = async (e: React.FormEvent, role: 'student' | 'faculty') => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    setAuthStatusText('Verifying credentials with database...');

    const identifier = role === 'student' ? studentUsn.trim() : facultyId.trim();
    const password = role === 'student' ? studentPassword : facultyPassword;

    if (!identifier || !password) {
      setErrorMsg('Please enter both your identifier and password.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Issue WebAuthn challenge from server
      const challengeRes = await api.webauthnLoginChallenge({
        identifier,
        password,
        role,
      });

      setPendingChallenge(challengeRes);

      // Check browser WebAuthn support
      const webAuthnSupported = browserSupportsWebAuthn();
      if (!webAuthnSupported) {
        // Automatically route to verified 2FA recovery code flow (Requirement 5)
        setAuthStatusText('Device does not support WebAuthn biometrics. Initializing 2FA recovery code...');
        await triggerFallbackCode(challengeRes.challengeToken);
        return;
      }

      // 2. Trigger native device biometric prompt (Windows Hello Face, Apple Face ID, Android Biometrics)
      setIsPromptingBiometrics(true);
      setAuthStatusText('Awaiting device biometric verification (Windows Hello Face / Apple Face ID / Passkey)...');

      let credentialAssertion: any;
      if (challengeRes.hasPasskey && challengeRes.mode === 'authentication') {
        try {
          credentialAssertion = await startAuthentication({ optionsJSON: challengeRes.options });
        } catch (authErr: any) {
          if (authErr.name === 'NotAllowedError') {
            throw new Error('Biometric authentication prompt was canceled or timed out.');
          }
          throw authErr;
        }
      } else {
        // Initial passkey enrollment for account
        setAuthStatusText('Initial biometric passkey enrollment: Please authorize Face ID / Passkey on your device...');
        try {
          credentialAssertion = await startRegistration({ optionsJSON: challengeRes.options });
        } catch (regErr: any) {
          if (regErr.name === 'NotAllowedError') {
            throw new Error('Biometric passkey enrollment was canceled on your device.');
          }
          throw regErr;
        }
      }

      // 3. Cryptographically verify assertion on backend
      setAuthStatusText('Verifying biometric cryptographic signature with backend...');
      const verifyRes = await api.webauthnLoginVerify({
        challengeToken: challengeRes.challengeToken,
        credential: credentialAssertion,
      });

      setSuccessMsg('Biometric Face Authentication verified successfully!');
      setTimeout(() => {
        onAuthSuccess(verifyRes.user);
        onClose();
      }, 600);

    } catch (err: any) {
      console.warn('Biometric flow notice:', err);
      setErrorMsg(err.message || 'Biometric authentication failed.');
      // Keep challenge available so user can switch to 2FA Recovery Code fallback
    } finally {
      setIsLoading(false);
      setIsPromptingBiometrics(false);
      setAuthStatusText('');
    }
  };

  // -------------------------------------------------------------
  // 2FA Fallback Verification for Devices Without Biometric Support
  // -------------------------------------------------------------
  const triggerFallbackCode = async (tokenOverride?: string) => {
    const token = tokenOverride || pendingChallenge?.challengeToken;
    if (!token) {
      setErrorMsg('Please enter your credentials first to generate a verification challenge.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.recoveryRequestCode(token);
      setServerFallbackCodeDisplay(res.recoveryCode);
      setMaskedEmail(res.maskedEmail || '');
      setShowFallbackCodeDialog(true);
      setSuccessMsg(res.message || '2FA Device Verification Code generated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyFallbackCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingChallenge?.challengeToken || !fallbackCode) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.recoveryVerifyCode({
        challengeToken: pendingChallenge.challengeToken,
        code: fallbackCode.trim(),
      });

      setSuccessMsg('2FA verification code approved! Signing in...');
      setTimeout(() => {
        onAuthSuccess(res.user);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired 2FA verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Student Registration (Strictly Role: Student)
  // -------------------------------------------------------------
  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      // Synthetic 128-D vector placeholder for registered template
      const dummyVec = Array.from({ length: 128 }, (_, i) => Math.sin(i * 31) * 0.5);

      const res = await api.studentRegister({
        fullName: regFullName.trim(),
        usn: regUsn.trim().toUpperCase(),
        username: regUsername.trim().toLowerCase(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
        email: regEmail.trim(),
        branch: regBranch,
        semester: regSemester,
        faceVector: dummyVec,
      });

      setSuccessMsg(res.message || 'Student account registered! You can now sign in with biometric authentication.');
      setActiveMode('student_login');
      setStudentUsn(regUsn.trim().toUpperCase());
      setStudentPassword(regPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Student registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Admin-Only Faculty Account Creation (Requirement 2)
  // -------------------------------------------------------------
  const handleAdminFacultyCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (facPassword !== facConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/faculty-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminKey.trim(),
        },
        body: JSON.stringify({
          fullName: facFullName.trim(),
          facultyId: facId.trim().toUpperCase(),
          username: facUsername.trim().toLowerCase(),
          email: facEmail.trim(),
          department: facDept,
          password: facPassword,
          confirmPassword: facConfirmPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create faculty account.');
      }

      setSuccessMsg('Faculty account provisioned successfully by administrator. Ready for faculty login.');
      setActiveMode('faculty_login');
      setFacultyId(facUsername.trim().toLowerCase());
      setFacultyPassword(facPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Faculty account creation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                SmartLab Security Gateway
              </h2>
              <p className="text-xs text-slate-400">
                Biometric Face Authentication & Role-Based Access Control
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Primary Tabs: Student Login vs Faculty Login (Requirement 1 & 7) */}
        <div className="grid grid-cols-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveMode('student_login');
              setErrorMsg(null);
              setSuccessMsg(null);
              setShowFallbackCodeDialog(false);
            }}
            className={`py-3.5 px-3 text-center border-b-2 transition cursor-pointer flex items-center justify-center gap-2 ${
              activeMode === 'student_login' || activeMode === 'student_register'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Student Login</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('faculty_login');
              setErrorMsg(null);
              setSuccessMsg(null);
              setShowFallbackCodeDialog(false);
            }}
            className={`py-3.5 px-3 text-center border-b-2 transition cursor-pointer flex items-center justify-center gap-2 ${
              activeMode === 'faculty_login' || activeMode === 'faculty_register'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Faculty Login</span>
          </button>
        </div>

        {/* Quick Demo Preload Strip */}
        <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800 text-[11px] flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Quick Demo Autofill:
          </span>
          <button
            onClick={() => handlePreloadDemo('faculty')}
            className="px-2 py-0.5 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-500/40 cursor-pointer font-medium"
          >
            Dr. Bhavesh S S (Faculty)
          </button>
          <button
            onClick={() => handlePreloadDemo('devika')}
            className="px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-500/40 cursor-pointer font-medium"
          >
            Devika (ISE Student)
          </button>
          <button
            onClick={() => handlePreloadDemo('kavana')}
            className="px-2 py-0.5 rounded bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-500/40 cursor-pointer font-medium"
          >
            Kavana (ISE Student)
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Alerts */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {authStatusText && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 animate-pulse">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>{authStatusText}</span>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 1. STUDENT LOGIN TAB */}
          {/* ------------------------------------------------------------- */}
          {activeMode === 'student_login' && !showFallbackCodeDialog && (
            <form onSubmit={(e) => handleInitiateBiometricLogin(e, 'student')} className="space-y-4">
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Hardware Biometric Verification:</strong> Enter your student credentials and authenticate using your device&apos;s Face Recognition (Windows Hello Face / Apple Face ID / Passkey).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  USN / Student ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={studentUsn}
                    onChange={(e) => setStudentUsn(e.target.value)}
                    placeholder="e.g. 1MS22IS018 or 1MS22IS025"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Enter student password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Button: Face Authentication */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{isPromptingBiometrics ? 'Verifying with Face Authentication...' : 'Verify with Face Authentication (Passkey)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Device Without Biometrics Fallback Option (Requirement 5 & Test scenario 12) */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => triggerFallbackCode()}
                  className="hover:text-blue-400 flex items-center gap-1 cursor-pointer transition"
                >
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  <span>Device without biometric hardware? Use 2FA Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('student_register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  New Student? Register
                </button>
              </div>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 2. FACULTY LOGIN TAB */}
          {/* ------------------------------------------------------------- */}
          {activeMode === 'faculty_login' && !showFallbackCodeDialog && (
            <form onSubmit={(e) => handleInitiateBiometricLogin(e, 'faculty')} className="space-y-4">
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  <strong>Authorized Faculty Access Only:</strong> Enter your registered Faculty credentials. Access to the faculty console requires verified administrator provisioning and biometric verification.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Faculty ID / Username / Email <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)}
                    placeholder="e.g. bhavesh_ise or FAC-ISE-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Faculty Password <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showFacultyPassword ? 'text' : 'password'}
                    required
                    value={facultyPassword}
                    onChange={(e) => setFacultyPassword(e.target.value)}
                    placeholder="Enter faculty password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFacultyPassword(!showFacultyPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showFacultyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Button: Face Authentication */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-purple-600/30"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{isPromptingBiometrics ? 'Verifying with Face Authentication...' : 'Verify with Face Authentication (Passkey)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => triggerFallbackCode()}
                  className="hover:text-purple-400 flex items-center gap-1 cursor-pointer transition"
                >
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  <span>Device without biometric hardware? Use 2FA Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('faculty_register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                >
                  Admin Provisioning
                </button>
              </div>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 3. 2FA DEVICE FALLBACK CODE DIALOG (Requirement 5 & Test scenario 12) */}
          {/* ------------------------------------------------------------- */}
          {showFallbackCodeDialog && (
            <form onSubmit={handleVerifyFallbackCode} className="space-y-4 p-4 bg-slate-950 border border-blue-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4" />
                  2FA Device Verification (No Biometric Hardware)
                </span>
                <button
                  type="button"
                  onClick={() => setShowFallbackCodeDialog(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  Back to Biometric Prompt
                </button>
              </div>

              {serverFallbackCodeDisplay && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center space-y-1">
                  <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block">
                    Device 2FA Verification Code
                  </span>
                  <span className="text-2xl font-mono font-bold text-blue-400 tracking-widest">
                    {serverFallbackCodeDisplay}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Generated for verified account {maskedEmail ? `(${maskedEmail})` : ''}. Never bypass authentication automatically.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Enter 6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={fallbackCode}
                  onChange={(e) => setFallbackCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center font-mono text-sm text-white tracking-widest focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <span>{isLoading ? 'Verifying Code...' : 'Authorize Session & Sign In'}</span>
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 4. STUDENT REGISTRATION (Role: Student Only - Requirement 2) */}
          {/* ------------------------------------------------------------- */}
          {activeMode === 'student_register' && (
            <form onSubmit={handleStudentRegister} className="space-y-4">
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 flex items-center justify-between">
                <span>
                  <strong>Student Registration:</strong> Role is permanently set to <strong>Student</strong>. Students cannot select faculty roles.
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase text-[10px]">
                  Role: Student
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">USN / Student ID *</label>
                  <input
                    type="text"
                    required
                    value={regUsn}
                    onChange={(e) => setRegUsn(e.target.value)}
                    placeholder="e.g. 1MS22IS099"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. ananya_22"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. student@college.edu"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Branch *</label>
                  <select
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value as Branch)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {ALL_BRANCHES.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Semester *</label>
                  <select
                    value={regSemester}
                    onChange={(e) => setRegSemester(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {ALL_SEMESTERS.map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('student_login')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-blue-600/30"
                >
                  <span>Register Student Profile</span>
                </button>
              </div>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 5. ADMIN FACULTY CREATION (Requirement 2 & Test scenario 6) */}
          {/* ------------------------------------------------------------- */}
          {activeMode === 'faculty_register' && (
            <form onSubmit={handleAdminFacultyCreate} className="space-y-4">
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Administrative Verification Required</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Faculty accounts cannot be created publicly by students. An authorized college administrator secret key is required.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-300 mb-1">
                  Administrator Authorization Key *
                </label>
                <input
                  type="password"
                  required
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter administrator secret (e.g. SMARTLAB_ADMIN_2026)"
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Full Name *</label>
                  <input
                    type="text"
                    required
                    value={facFullName}
                    onChange={(e) => setFacFullName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Rao"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty ID *</label>
                  <input
                    type="text"
                    required
                    value={facId}
                    onChange={(e) => setFacId(e.target.value)}
                    placeholder="e.g. FAC-CSE-005"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={facUsername}
                    onChange={(e) => setFacUsername(e.target.value)}
                    placeholder="e.g. ramesh_cse"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Official College Email *</label>
                  <input
                    type="email"
                    required
                    value={facEmail}
                    onChange={(e) => setFacEmail(e.target.value)}
                    placeholder="e.g. ramesh@smartlab.edu"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department *</label>
                  <select
                    value={facDept}
                    onChange={(e) => setFacDept(e.target.value as Branch)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {ALL_BRANCHES.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={facPassword}
                    onChange={(e) => setFacPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={facConfirmPassword}
                    onChange={(e) => setFacConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('faculty_login')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Back to Faculty Login
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  <span>Authorize & Create Faculty Profile</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          initialRole={activeMode === 'student_login' ? 'student' : 'faculty'}
          initialIdentifier={activeMode === 'student_login' ? studentUsn : facultyId}
        />
      )}
    </div>
  );
};
