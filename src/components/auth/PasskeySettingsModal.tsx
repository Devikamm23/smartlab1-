import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Fingerprint, 
  Laptop, 
  X, 
  Lock,
  Calendar,
  Smartphone
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { User } from '../../types.ts';
import { api } from '../../services/api.ts';

interface PasskeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const PasskeySettingsModal: React.FC<PasskeySettingsModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add passkey dialog state
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [addPassword, setAddPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Remove passkey dialog state
  const [removePasskeyId, setRemovePasskeyId] = useState<string | null>(null);
  const [removePassword, setRemovePassword] = useState<string>('');
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const loadPasskeys = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getPasskeys();
      setPasskeys(res.passkeys || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load passkeys.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPasskeys();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPasskeyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsRegistering(true);

    try {
      // 1. Verify password & request WebAuthn registration options
      const optRes = await api.webauthnRegisterOptions(addPassword);
      if (!optRes.options) {
        throw new Error('Server did not return WebAuthn registration options.');
      }

      // 2. Trigger platform biometric passkey prompt
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optRes.options });
      } catch (regErr: any) {
        if (regErr.name === 'NotAllowedError') {
          throw new Error('Biometric passkey registration was canceled or timed out on your device.');
        }
        throw new Error(regErr.message || 'Device biometric registration failed. Ensure your platform authenticator is active.');
      }

      // 3. Verify assertion on backend
      const verifyRes = await api.webauthnRegisterVerify({
        challengeToken: optRes.challengeToken,
        credential: attResp,
      });

      setSuccessMsg(verifyRes.message || 'Passkey registered successfully!');
      setShowAddDialog(false);
      setAddPassword('');
      await loadPasskeys();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register passkey.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemovePasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removePasskeyId) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsRemoving(true);

    try {
      const res = await api.removePasskey({
        passkeyId: removePasskeyId,
        password: removePassword,
      });
      setSuccessMsg(res.message || 'Passkey removed successfully.');
      setRemovePasskeyId(null);
      setRemovePassword('');
      await loadPasskeys();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove passkey. Check your password.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Device Biometric Passkeys
              </h2>
              <p className="text-xs text-slate-400">
                {user.role === 'student' ? `USN: ${user.usn}` : `Faculty ID: ${user.facultyId || user.name}`} • Hardware Authentication
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
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

          {/* Description */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Fast & Phishing-Resistant Biometric Authentication</span>
            </div>
            <p>
              Passkeys allow you to sign in with Windows Hello Face, Apple Face ID / Touch ID, or Android Biometrics directly from your hardware without sending raw biometric data.
            </p>
          </div>

          {/* Add Passkey Trigger */}
          <div className="flex items-center justify-between pt-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Enrolled Authenticators ({passkeys.length})
            </h3>
            <button
              onClick={() => {
                setShowAddDialog(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Passkey</span>
            </button>
          </div>

          {/* Add Passkey Modal / Form */}
          {showAddDialog && (
            <form onSubmit={handleStartPasskeyRegistration} className="p-4 bg-slate-950 border border-blue-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Password Verification Required
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                To link a new biometric passkey to your {user.role} profile, please confirm your account password:
              </p>
              <input
                type="password"
                required
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{isRegistering ? 'Prompting Device Biometrics...' : 'Verify Password & Launch Face / Passkey Prompt'}</span>
              </button>
            </form>
          )}

          {/* Remove Confirmation Form */}
          {removePasskeyId && (
            <form onSubmit={handleRemovePasskey} className="p-4 bg-slate-950 border border-rose-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirm Passkey Deletion
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRemovePasskeyId(null);
                    setRemovePassword('');
                  }}
                  className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Security Policy: Password verification is required before removing an enrolled biometric credential:
              </p>
              <input
                type="password"
                required
                value={removePassword}
                onChange={(e) => setRemovePassword(e.target.value)}
                placeholder="Enter account password to confirm"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={isRemoving}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isRemoving ? 'Revoking...' : 'Confirm & Revoke Passkey'}</span>
              </button>
            </form>
          )}

          {/* Passkeys List */}
          {isLoading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading registered passkeys...</div>
          ) : passkeys.length === 0 ? (
            <div className="text-center py-8 p-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl space-y-2">
              <Key className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">No passkeys enrolled yet</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Register your device&apos;s Face Recognition or Biometrics now for instant, passwordless 2-factor authentication.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk, idx) => (
                <div
                  key={pk.id}
                  className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      {pk.device_type === 'platform' ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <span>Biometric Passkey #{idx + 1}</span>
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded font-mono">
                          {pk.device_type || 'platform'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Registered: {new Date(pk.created_at).toLocaleDateString()}</span>
                        {pk.last_used_at && (
                          <>
                            <span>•</span>
                            <span>Last used: {new Date(pk.last_used_at).toLocaleTimeString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRemovePasskeyId(pk.id);
                      setRemovePassword('');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Remove passkey"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
