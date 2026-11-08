import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  RotateCcw, 
  Save, 
  Terminal, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileCode2, 
  ChevronLeft, 
  ChevronRight, 
  Cpu, 
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Assignment, ProgrammingLanguage, ALL_LANGUAGES, ExecutionResponse } from '../../types.ts';
import { api } from '../../services/api.ts';

interface CodingWorkspaceTabProps {
  currentAssignment: Assignment | null;
  onClearAssignment?: () => void;
  onSubmissionSuccess?: () => void;
}

const DEFAULT_TEMPLATES: Record<ProgrammingLanguage, string> = {
  Java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
        System.out.println("Hello SmartLab!");
    }
}`,
  Python: `# Write your Python program below
def main():
    print("Hello SmartLab!")

if __name__ == "__main__":
    main()
`,
  C: `#include <stdio.h>

int main() {
    // Write your C program here
    printf("Hello SmartLab!\\n");
    return 0;
}
`,
  'C++': `#include <iostream>
using namespace std;

int main() {
    // Write your C++ program here
    cout << "Hello SmartLab!" << endl;
    return 0;
}
`,
  SQL: `-- Safe isolated SQLite environment with college schema
-- Available tables: students, courses, enrollments, faculty

SELECT usn, name, branch, gpa 
FROM students 
WHERE gpa >= 9.0;
`
};

export const CodingWorkspaceTab: React.FC<CodingWorkspaceTabProps> = ({
  currentAssignment,
  onClearAssignment,
  onSubmissionSuccess
}) => {
  // Determine available languages based on assignment permitted languages
  const availableLanguages: ProgrammingLanguage[] = currentAssignment?.permitted_languages?.length
    ? currentAssignment.permitted_languages
    : ALL_LANGUAGES;

  const [language, setLanguage] = useState<ProgrammingLanguage>(availableLanguages[0] || 'Java');
  const [code, setCode] = useState<string>('');
  const [stdin, setStdin] = useState<string>('');
  const [showStdin, setShowStdin] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResponse | null>(null);
  const [isProblemCollapsed, setIsProblemCollapsed] = useState<boolean>(false);
  const [compilationCount, setCompilationCount] = useState<number>(0);
  const [assignmentExecutions, setAssignmentExecutions] = useState<number>(0);
  const [remainingFree, setRemainingFree] = useState<number>(5);
  const [executionPenalty, setExecutionPenalty] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const editorRef = useRef<any>(null);

  // Sync code and language when currentAssignment changes
  useEffect(() => {
    if (currentAssignment) {
      const permitted = currentAssignment.permitted_languages;
      if (permitted && permitted.length > 0) {
        setLanguage(permitted[0]);
      }
      
      // Load saved code from local storage draft or default template
      const draftKey = `smartlab_code_${currentAssignment.id}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        setCode(savedDraft);
      } else {
        setCode(DEFAULT_TEMPLATES[permitted[0] || 'Java']);
      }

      // Fetch assignment-specific execution stats (Passive read: never deducts marks or increments count)
      api.getAssignmentExecutionStats(currentAssignment.id)
        .then(stats => {
          if (stats) {
            setAssignmentExecutions(stats.totalExecutions ?? 0);
            setRemainingFree(stats.remainingFreeExecutions ?? 5);
            setExecutionPenalty(stats.executionPenalty ?? 0);
          }
        })
        .catch(() => {});
    } else {
      setCode(DEFAULT_TEMPLATES[language]);
      setAssignmentExecutions(0);
      setRemainingFree(5);
      setExecutionPenalty(0);
    }
  }, [currentAssignment]);


  // Handle Monaco Editor mount and paste detection
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Detect and record paste events
    editor.onDidPaste((e: any) => {
      try {
        const pastedText = editor.getModel()?.getValueInRange(e.range) || '';
        const charCount = pastedText.length;
        
        // Log to backend for faculty monitoring audit
        api.logPasteEvent({
          assignmentId: currentAssignment?.id,
          characterCount: charCount,
          snippet: pastedText.substring(0, 150)
        });

        if (charCount > 150) {
          setStatusMessage({
            type: 'info',
            text: `Paste event (${charCount} characters) logged for faculty monitoring audit.`
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }
      } catch (err) {
        console.error('Paste recording error:', err);
      }
    });
  };

  const handleLanguageChange = (newLang: ProgrammingLanguage) => {
    setLanguage(newLang);
    // If empty or default template, replace with template for new language
    if (!code.trim() || Object.values(DEFAULT_TEMPLATES).some(t => t.trim() === code.trim())) {
      setCode(DEFAULT_TEMPLATES[newLang]);
    }
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      setStatusMessage({ type: 'error', text: 'Editor is empty. Write code before executing.' });
      return;
    }

    setIsRunning(true);
    setStatusMessage(null);

    try {
      const res = await api.runCode({
        language,
        code,
        stdin,
        assignmentId: currentAssignment?.id
      });

      setExecutionResult(res);
      if (res.studentCompilationCount !== undefined) {
        setCompilationCount(res.studentCompilationCount);
      }
      if (res.assignmentExecution) {
        setAssignmentExecutions(res.assignmentExecution.totalExecutions);
        setRemainingFree(res.assignmentExecution.remainingFreeExecutions);
        setExecutionPenalty(res.assignmentExecution.executionPenalty);
      }
    } catch (err: any) {
      setExecutionResult({
        status: 'runtime_error',
        output: '',
        error: err.message || 'Execution failed',
        executionTimeMs: 0,
        engine: 'error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!currentAssignment) {
      setStatusMessage({ type: 'error', text: 'No assignment selected to submit to.' });
      return;
    }

    if (!code.trim()) {
      setStatusMessage({ type: 'error', text: 'Please write and test your code before submitting.' });
      return;
    }

    const confirmSubmit = window.confirm(
      `Submit this ${language} solution for "${currentAssignment.title}"?\nYour submission will be evaluated by your faculty.`
    );
    if (!confirmSubmit) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await api.submitCode({
        assignmentId: currentAssignment.id,
        code,
        language,
        executionResult: executionResult?.output || 'Code submitted by student'
      });

      setStatusMessage({
        type: 'success',
        text: res.message || 'Solution submitted successfully! Status: Pending Faculty Evaluation.'
      });

      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    if (currentAssignment) {
      localStorage.setItem(`smartlab_code_${currentAssignment.id}`, code);
      setStatusMessage({ type: 'success', text: 'Code draft saved locally.' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClearCode = () => {
    if (window.confirm('Are you sure you want to clear the editor?')) {
      setCode('');
      setExecutionResult(null);
    }
  };

  const monacoLanguage = language === 'C++' ? 'cpp' : language.toLowerCase();

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Left: Assignment Context & Language */}
        <div className="flex items-center gap-3">
          {currentAssignment ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 font-mono font-bold text-[11px] border border-blue-500/30">
                Lab {currentAssignment.lab_number}
              </span>
              <span className="font-bold text-white max-w-xs truncate" title={currentAssignment.title}>
                {currentAssignment.title}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                ({currentAssignment.subject})
              </span>
            </div>
          ) : (
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-blue-400" />
              Scratchpad Mode
            </span>
          )}

          {/* Permitted Language Selector */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
            <span className="text-slate-400 font-medium">Language:</span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as ProgrammingLanguage)}
              disabled={availableLanguages.length === 1}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {availableLanguages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {availableLanguages.length === 1 && (
              <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                Enforced by Faculty
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions & Automatic Execution Limit Display */}
        <div className="flex items-center gap-2">
          
          {/* Automatic Execution Counter & Penalty Display (Requirement 2) */}
          {currentAssignment && (
            <div className="flex items-center">
              {assignmentExecutions <= 5 ? (
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
                  title="Each assignment allows 5 free code executions. Executions 1–5 do not reduce marks."
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Free Runs:</span>
                  <span className="font-bold text-white bg-emerald-900/60 px-1.5 py-0.2 rounded border border-emerald-500/40">
                    {remainingFree} / 5
                  </span>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono text-[11px]"
                  title={`Execution limit exceeded. Penalty formula FLOOR((${assignmentExecutions} - 1) / 5) = ${executionPenalty} mark(s) deducted.`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Runs: <strong className="text-white">{assignmentExecutions}</strong></span>
                  <span className="text-rose-300 font-bold bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30">
                    Penalty: -{executionPenalty} mark{executionPenalty === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowStdin(!showStdin)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
              showStdin 
                ? 'bg-blue-600/20 border-blue-500 text-blue-300' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Custom Stdin Input"
          >
            Custom Input
          </button>

          <button
            onClick={handleSaveDraft}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1"
            title="Save Draft Locally"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={handleClearCode}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-medium transition cursor-pointer"
            title="Clear Code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* RUN CODE BUTTON */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs tracking-wide shadow-md shadow-emerald-600/30 transition cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
          </button>

          {/* SUBMIT CODE BUTTON (If assignment active) */}
          {currentAssignment && (
            <button
              onClick={handleSubmitCode}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Body: Split View (Problem Details on Left, Monaco & Output on Right) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Problem Statement Panel */}
        {currentAssignment && (
          <div className={`${isProblemCollapsed ? 'w-10' : 'w-80 lg:w-96'} border-r border-slate-800 bg-slate-900/60 flex flex-col transition-all duration-200 shrink-0`}>
            
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              {!isProblemCollapsed && (
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-blue-400" />
                  Problem Statement
                </span>
              )}
              <button
                onClick={() => setIsProblemCollapsed(!isProblemCollapsed)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer ml-auto"
                title={isProblemCollapsed ? 'Expand Problem Statement' : 'Collapse Panel'}
              >
                {isProblemCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {!isProblemCollapsed && (
              <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
                <div>
                  <h4 className="text-sm font-bold text-white">{currentAssignment.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span>{currentAssignment.branch}</span>
                    <span>•</span>
                    <span>Semester {currentAssignment.semester}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-semibold">{currentAssignment.max_marks} Marks</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Question:</label>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100 whitespace-pre-wrap leading-relaxed font-sans">
                    {currentAssignment.problem_statement}
                  </div>
                </div>

                {currentAssignment.instructions && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Instructions:</label>
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-slate-300 whitespace-pre-wrap leading-relaxed text-[11px]">
                      {currentAssignment.instructions}
                    </div>
                  </div>
                )}

                {/* Execution Limit & Performance Rules Card (Requirement 2 & 3) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-slate-200 font-bold">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <Cpu className="w-3.5 h-3.5" />
                      Execution Limit Rules
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      5 Free Runs
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[10px]">
                    The first 5 code executions do not reduce marks. Starting from the 6th execution, 1 mark is deducted for every additional group of 5 executions.
                  </p>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-300">
                    <span className="text-purple-300 font-bold block mb-1">Formula:</span>
                    Execution Penalty = FLOOR((Total Executions - 1) / 5)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Executions:</span>
                      <strong className="text-white text-xs">{assignmentExecutions}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Penalty Deducted:</span>
                      <strong className={executionPenalty > 0 ? "text-rose-400 text-xs" : "text-emerald-400 text-xs"}>
                        -{executionPenalty} Marks
                      </strong>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Right: Monaco Editor & Output Console */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Status Message Strip */}
          {statusMessage && (
            <div className={`px-4 py-1.5 text-xs flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                : 'bg-blue-950/40 text-blue-300 border-blue-500/30'
            }`}>
              {statusMessage.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {statusMessage.type === 'error' && <AlertTriangle className="w-3.5 h-3.5" />}
              {statusMessage.type === 'info' && <Info className="w-3.5 h-3.5" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
            <Editor
              height="100%"
              language={monacoLanguage}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorDidMount}
              options={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                roundedSelection: false,
                automaticLayout: true,
                tabSize: 4
              }}
            />
          </div>

          {/* Optional Stdin Drawer */}
          {showStdin && (
            <div className="border-t border-slate-800 bg-slate-900/90 p-3 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Standard Input (stdin)
                </span>
                <span className="text-[10px] text-slate-500">Passed to program during execution</span>
              </div>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input values (e.g. integer 7 for Prime Check)..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Bottom Execution Output Console */}
          <div className="h-44 sm:h-52 border-t border-slate-800 bg-slate-950 flex flex-col shrink-0">
            
            {/* Console Header */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Execution Console
                </span>

                {executionResult && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    executionResult.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : executionResult.status === 'compilation_error'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {executionResult.status.replace('_', ' ')}
                  </span>
                )}
              </div>

              {executionResult && (
                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>Engine: <span className="text-slate-300">{executionResult.engine}</span></span>
                  <span>Time: <span className="text-slate-300">{executionResult.executionTimeMs}ms</span></span>
                  <button
                    onClick={() => setExecutionResult(null)}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer ml-2"
                  >
                    Clear Output
                  </button>
                </div>
              )}
            </div>

            {/* Console Content */}
            <div className="p-3 overflow-y-auto font-mono text-xs flex-1 space-y-2 select-text">
              {isRunning && (
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span>Executing program in secure sandbox container...</span>
                </div>
              )}

              {!isRunning && !executionResult && (
                <p className="text-slate-600 italic">
                  Click &quot;Run Code&quot; to compile and execute program. Output, compilation diagnostics, and test case results will appear here.
                </p>
              )}

              {executionResult && (
                <>
                  {/* Compilation / Runtime Errors */}
                  {executionResult.error && (
                    <div className="bg-rose-950/30 border border-rose-500/30 p-2.5 rounded-lg text-rose-300 whitespace-pre-wrap">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                        Compiler / Runtime Error:
                      </div>
                      {executionResult.error}
                    </div>
                  )}

                  {/* Program Output */}
                  {executionResult.output && (
                    <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {executionResult.output}
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
