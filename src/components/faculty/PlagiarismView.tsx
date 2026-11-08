import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Assignment, Submission, PasteEvent } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  Copy, 
  AlertTriangle, 
  FileCode2, 
  Search, 
  Info, 
  CheckCircle2, 
  Sparkles,
  GitCompare,
  ArrowRight
} from 'lucide-react';

interface PlagiarismViewProps {
  assignments: Assignment[];
}

export const PlagiarismView: React.FC<PlagiarismViewProps> = ({ assignments }) => {
  const [selectedAssignId, setSelectedAssignId] = useState<string>(assignments[0]?.id || '');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pasteEvents, setPasteEvents] = useState<PasteEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Side-by-side comparison state
  const [studentA, setStudentA] = useState<string>('');
  const [studentB, setStudentB] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!selectedAssignId) return;
      setIsLoading(true);
      try {
        const [subRes, histRes] = await Promise.all([
          api.getAssignmentSubmissions(selectedAssignId),
          api.getActivityHistory()
        ]);
        setSubmissions(subRes.submissions || []);
        setPasteEvents((histRes.pasteEvents || []).filter(p => !p.assignment_id || p.assignment_id === selectedAssignId));

        if (subRes.submissions?.length >= 2) {
          setStudentA(subRes.submissions[0].student_usn);
          setStudentB(subRes.submissions[1].student_usn);
        } else if (subRes.submissions?.length === 1) {
          setStudentA(subRes.submissions[0].student_usn);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [selectedAssignId]);

  const subA = submissions.find(s => s.student_usn === studentA);
  const subB = submissions.find(s => s.student_usn === studentB);

  // Compute text similarity metric (Dice coefficient / Jaccard on tokens)
  const computeSimilarity = (code1?: string, code2?: string): number => {
    if (!code1 || !code2) return 0;
    const tokenize = (s: string) => s.replace(/[^\w]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const set1 = new Set(tokenize(code1));
    const set2 = new Set(tokenize(code2));
    if (set1.size === 0 || set2.size === 0) return 0;

    let common = 0;
    set1.forEach(token => {
      if (set2.has(token)) common++;
    });

    const dice = (2 * common) / (set1.size + set2.size);
    return Math.round(dice * 100);
  };

  const similarityScore = computeSimilarity(subA?.code, subB?.code);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-amber-400" />
            Paste Activity & Code Similarity Inspector
          </h2>
          <p className="text-xs text-slate-400">
            Audit clipboard paste occurrences and inspect lexical similarity between student submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Select Lab:</span>
          <select
            value={selectedAssignId}
            onChange={(e) => setSelectedAssignId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            {assignments.map(a => (
              <option key={a.id} value={a.id}>
                Lab {a.lab_number}: {a.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fairness Notice as requested in Section 16 */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-slate-300">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-200">Faculty Academic Integrity Notice:</strong> Paste events and similarity metrics are advisory indicators to guide faculty review. They must never automatically deduct marks or accuse students of misconduct without manual faculty inspection, as external copy actions and manual retyping vary widely.
        </div>
      </div>

      {/* Side-by-Side Submission Similarity Comparator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Side-by-Side Code Comparator</h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Similarity Metric:</span>
            <span className={`px-3 py-1 rounded-full font-mono font-bold text-xs ${
              similarityScore > 75
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : similarityScore > 45
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {similarityScore}% Token Match
            </span>
          </div>
        </div>

        {/* Student Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Student A:</label>
            <select
              value={studentA}
              onChange={(e) => setStudentA(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {submissions.map(s => (
                <option key={s.student_usn} value={s.student_usn}>
                  {s.student_name} ({s.student_usn})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Student B:</label>
            <select
              value={studentB}
              onChange={(e) => setStudentB(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              {submissions.map(s => (
                <option key={s.student_usn} value={s.student_usn}>
                  {s.student_name} ({s.student_usn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Editors Dual View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-blue-400 block font-semibold">
              {subA ? `${subA.student_name} (${subA.language})` : 'No submission'}
            </span>
            <div className="h-64 rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={subA?.language.toLowerCase() === 'c++' ? 'cpp' : subA?.language.toLowerCase() || 'java'}
                theme="vs-dark"
                value={subA?.code || '// No code submitted'}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 11 }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono text-purple-400 block font-semibold">
              {subB ? `${subB.student_name} (${subB.language})` : 'No submission'}
            </span>
            <div className="h-64 rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={subB?.language.toLowerCase() === 'c++' ? 'cpp' : subB?.language.toLowerCase() || 'java'}
                theme="vs-dark"
                value={subB?.code || '// No code submitted'}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 11 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Paste Events List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Copy className="w-4 h-4 text-amber-400" />
            Monaco Editor Paste Events Audit
          </span>
          <span className="text-slate-400 font-mono">
            {pasteEvents.length} Recorded Pastes
          </span>
        </div>

        {pasteEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No clipboard paste events detected for this lab work.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student USN</th>
                  <th className="py-3 px-4">Character Volume</th>
                  <th className="py-3 px-4">Audit Timestamp</th>
                  <th className="py-3 px-4">Flagged Status</th>
                  <th className="py-3 px-4">Pasted Text Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pasteEvents.map((pe) => (
                  <tr key={pe.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {pe.student_usn}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      {pe.character_count} chars
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                      {new Date(pe.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {pe.character_count > 150 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Review Recommended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] max-w-xs truncate">
                      {pe.pasted_snippet}
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
