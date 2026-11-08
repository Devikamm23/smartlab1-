import React, { useState } from 'react';
import { 
  KeyRound, 
  Mail, 
  IdCard, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  ShieldCheck,
  Lock,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api.ts';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'student' | 'faculty';
  initialIdentifier?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'student',
  initialIdentifier = '',
}) => {
  const [role, setRole] = useState<'student' | 'faculty'>(initialRole);
  const [step, setStep] = useState<'request_pin' | 'reset_password'>('request_pin');
  
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [email, setEmail] = useState('');
  
  const [recoveryPin, setRecoveryPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [generatedPinDisplay, setGeneratedPinDisplay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Step 1: Request Password Recovery PIN
  const handleRequestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await api.passwordRecoveryRequest({
        identifier: identifier.trim(),
        email: email.trim().toLowerCase(),
        role,
      });

      setSuccessMsg(res.message || 'Verification PIN generated.');
      if (res.recoveryPin) {
        setGeneratedPinDisplay(res.recoveryPin);
        setRecoveryPin(res.recoveryPin); // Pre-fill for demonstration in academic lab
      }
      setStep('reset_password');
    } catch (err: any) {
      setErrorMsg(err.message || 'Password recovery request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Reset Password with PIN
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.passwordRecoveryReset({
        identifier: identifier.trim(),
        email: email.trim().toLowerCase(),
        recoveryPin: recoveryPin.trim(),
        newPassword,
        confirmPassword,
      });

      setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Account Password Recovery
              </h2>
              <p className="text-xs text-slate-400">
                Secure 2-Step Identity Verification & Password Reset
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

        {/* Content */}
        <div className="p-6 space-y-4">
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

          {step === 'request_pin' ? (
            <form onSubmit={handleRequestPin} className="space-y-4">
              {/* Role Toggle */}
              <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    role === 'student' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Student Account
                </button>
                <button
                  type="button"
                  onClick={() => setRole('faculty')}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    role === 'faculty' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Faculty Account
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {role === 'student' ? 'USN / Student ID' : 'Faculty ID / Official Username'} *
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. 1MS22IS018' : 'e.g. bhavesh_ise or FAC-ISE-001'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Registered Official Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. devika@smartlab.edu' : 'e.g. dr.bhavesh@smartlab.edu'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
              >
                <span>{isLoading ? 'Verifying...' : 'Generate 6-Digit Verification PIN'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {generatedPinDisplay && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-1">
                  <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
                    Security Verification PIN
                  </span>
                  <span className="text-xl font-mono font-bold text-amber-400 tracking-widest">
                    {generatedPinDisplay}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Use this PIN to authorize your password reset. All previous sessions will be terminated.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  6-Digit Verification PIN *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={recoveryPin}
                  onChange={(e) => setRecoveryPin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-center font-mono text-white tracking-widest focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password (min 6 characters) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('request_pin')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider transition cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <span>{isLoading ? 'Resetting...' : 'Confirm Password Reset'}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
