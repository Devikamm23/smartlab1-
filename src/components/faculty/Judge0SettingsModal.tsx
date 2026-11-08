import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Globe, 
  Play, 
  X,
  Info,
  Server
} from 'lucide-react';

interface Judge0SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Judge0SettingsModal: React.FC<Judge0SettingsModalProps> = ({ isOpen, onClose }) => {
  const [endpoint, setEndpoint] = useState<string>('https://judge0-ce.p.rapidapi.com');
  const [apiKey, setApiKey] = useState<string>('');
  const [useBuiltinFallback, setUseBuiltinFallback] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        const res = await api.getJudge0Config();
        if (res.config) {
          setEndpoint(res.config.endpoint || 'https://judge0-ce.p.rapidapi.com');
          setApiKey(res.config.apiKey || '');
          setUseBuiltinFallback(res.config.useBuiltinFallback !== false);
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    try {
      await api.updateJudge0Config({
        endpoint,
        apiKey,
        useBuiltinFallback
      });
      setSaveStatus('Configuration saved successfully.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestExecution = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.runCode({
        language: 'Python',
        code: 'print("SmartLab Judge0 Sandbox Connection Successful!")'
      });

      if (res.status === 'success') {
        setTestResult({
          success: true,
          message: `Execution verified via ${res.engine}. Duration: ${res.executionTimeMs}ms.`
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Execution check returned an error.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Execution test failed.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Judge0 & Code Execution Gateway</h3>
              <p className="text-xs text-slate-400">Sandboxed multi-language compilation configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {saveStatus && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveStatus}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Judge0 API Endpoint URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://judge0-ce.p.rapidapi.com or your custom CE host"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Supports Judge0 CE, RapidAPI Judge0, or self-hosted Docker Judge0 instances.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              RapidAPI Key / Gateway Token (Optional)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank if using self-hosted or local sandbox runner"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={useBuiltinFallback}
              onChange={(e) => setUseBuiltinFallback(e.target.checked)}
              className="accent-blue-600 mt-0.5"
            />
            <div>
              <span className="font-bold text-white block">Enable Native High-Performance Execution Engine</span>
              <span className="text-[11px] text-slate-400">
                Instantly runs Python and SQL natively in an isolated memory container with timeout and resource bounds, with simulated testing for C, C++, and Java if Judge0 API is unreachable.
              </span>
            </div>
          </label>

          {/* Test Execution Output */}
          {testResult && (
            <div className={`p-3 rounded-xl border ${
              testResult.success
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-0.5">
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testResult.success ? 'Engine Ready' : 'Execution Notice'}</span>
              </div>
              <p className="font-mono text-[11px]">{testResult.message}</p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestExecution}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Execution Gateway'}</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
