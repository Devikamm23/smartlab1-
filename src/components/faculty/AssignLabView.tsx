import React, { useState, useEffect } from 'react';
import { Assignment, ALL_BRANCHES, ALL_SEMESTERS, ALL_LANGUAGES, Branch, ProgrammingLanguage } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  FileCode2, 
  Plus, 
  Trash2, 
  Edit3, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Calendar, 
  Award,
  Layers,
  Sparkles,
  BookOpen,
  Code
} from 'lucide-react';

interface AssignLabViewProps {
  onAssignmentCreated?: () => void;
}

export const AssignLabView: React.FC<AssignLabViewProps> = ({ onAssignmentCreated }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [labNumber, setLabNumber] = useState<number>(1);
  const [problemStatement, setProblemStatement] = useState('');
  const [instructions, setInstructions] = useState('');
  const [permittedLanguages, setPermittedLanguages] = useState<ProgrammingLanguage[]>(['Java']);
  const [maxMarks, setMaxMarks] = useState<number>(20);
  const [assignedDate, setAssignedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
  const [branch, setBranch] = useState<Branch>('ISE');
  const [semester, setSemester] = useState<number>(5);
  const [allocationType, setAllocationType] = useState<'all' | 'specific'>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAssignments();
      setAssignments(res.assignments || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudentsForBranch = async (b: Branch, s: number) => {
    try {
      const res = await api.getStudents({ branch: b, semester: s });
      setStudents(res.students || []);
    } catch {}
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    if (allocationType === 'specific') {
      loadStudentsForBranch(branch, semester);
    }
  }, [branch, semester, allocationType]);

  const toggleLanguage = (lang: ProgrammingLanguage) => {
    if (permittedLanguages.includes(lang)) {
      if (permittedLanguages.length === 1) return; // Keep at least one
      setPermittedLanguages(permittedLanguages.filter(l => l !== lang));
    } else {
      setPermittedLanguages([...permittedLanguages, lang]);
    }
  };

  const toggleStudentSelection = (usn: string) => {
    if (selectedStudents.includes(usn)) {
      setSelectedStudents(selectedStudents.filter(u => u !== usn));
    } else {
      setSelectedStudents([...selectedStudents, usn]);
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title || !subject || !problemStatement) {
      setErrorMsg('Please fill in all required fields (Title, Subject, Question).');
      return;
    }

    if (allocationType === 'specific' && selectedStudents.length === 0) {
      setErrorMsg('Please select at least one student for specific allocation.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        await api.updateAssignment(editingId, {
          title,
          subject,
          labNumber,
          problemStatement,
          instructions,
          permittedLanguages,
          maxMarks,
          assignedDate,
          dueDate,
          branch,
          semester,
          allocationType,
          selectedStudents,
          status
        });
        setSuccessMsg('Lab assignment updated successfully.');
      } else {
        await api.createAssignment({
          title,
          subject,
          labNumber,
          problemStatement,
          instructions,
          permittedLanguages,
          maxMarks,
          assignedDate,
          dueDate,
          branch,
          semester,
          allocationType,
          selectedStudents,
          status
        });
        setSuccessMsg(`Lab assignment ${status === 'published' ? 'published and assigned' : 'saved as draft'}!`);
      }

      setShowCreateModal(false);
      resetForm();
      loadAssignments();
      if (onAssignmentCreated) onAssignmentCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, assignTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${assignTitle}"? All student allocations will be removed.`)) return;

    try {
      await api.deleteAssignment(id);
      loadAssignments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (a: Assignment) => {
    setEditingId(a.id);
    setTitle(a.title);
    setSubject(a.subject);
    setLabNumber(a.lab_number);
    setProblemStatement(a.problem_statement);
    setInstructions(a.instructions || '');
    setPermittedLanguages(a.permitted_languages || ['Java']);
    setMaxMarks(a.max_marks);
    setAssignedDate(a.assigned_date);
    setDueDate(a.due_date);
    setBranch(a.branch);
    setSemester(a.semester);
    setAllocationType(a.allocation_type);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubject('');
    setLabNumber(assignments.length + 1);
    setProblemStatement('');
    setInstructions('');
    setPermittedLanguages(['Java']);
    setMaxMarks(20);
    setBranch('ISE');
    setSemester(5);
    setAllocationType('all');
    setSelectedStudents([]);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.usn.toUpperCase().includes(studentSearch.toUpperCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Top Header & Create Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-blue-400" />
            Assign Laboratory Programs
          </h2>
          <p className="text-xs text-slate-400">
            Create, configure, allocate, and publish programming laboratory problems for engineering branches.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-600/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Lab Program</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Assignment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.map((a) => (
          <div
            key={a.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 font-mono text-xs font-bold">
                    Lab {a.lab_number}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">{a.subject}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  a.status === 'published'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {a.status}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{a.title}</h3>
                <p className="text-xs text-slate-300 line-clamp-3 mt-1.5 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {a.problem_statement}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-blue-400" />
                  <span>Languages:</span>
                  <span className="text-white font-mono font-semibold">
                    {a.permitted_languages.join(', ')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Max Marks:</span>
                  <span className="text-white font-semibold">{a.max_marks} pts</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span>Target:</span>
                  <span className="text-white font-semibold">{a.branch} Sem {a.semester}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Allocated:</span>
                  <span className="text-white font-semibold">
                    {a.allocated_count || 0} Students
                  </span>
                </div>
              </div>

              {/* Submission Statistics Bar */}
              <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Submissions:</span>
                <div className="flex items-center gap-3 font-mono font-semibold">
                  <span className="text-blue-400">{a.submitted_count || 0} Submitted</span>
                  <span>•</span>
                  <span className="text-emerald-400">{a.evaluated_count || 0} Evaluated</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Deadline: {a.due_date}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(a)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Edit Assignment"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(a.id, a.title)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                  title="Delete Assignment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-blue-400" />
                <span>{editingId ? 'Edit Laboratory Program' : 'Create & Assign Laboratory Program'}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Lab / Program Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Lab 1 – Check Whether a Number Is Prime"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Lab Number *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={labNumber}
                    onChange={(e) => setLabNumber(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Java Programming Laboratory"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Maximum Marks *</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={100}
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Problem Statement / Question *
                </label>
                <textarea
                  required
                  rows={3}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="e.g. Write a Java program to check whether a given number is prime. Read an integer and display 'Prime Number' if it is prime; otherwise display 'Not a Prime Number'."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Instructions / Test Case Guidelines
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Use Scanner to read input. Handle edge cases where n <= 1."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                />
              </div>

              {/* Permitted Languages Selector */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Permitted Programming Languages * (Student editor enforces this)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGUAGES.map((lang) => {
                    const isSelected = permittedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates & Target Branch / Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Branch *</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value as Branch)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {ALL_BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Semester *</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {ALL_SEMESTERS.map(s => (
                      <option key={s} value={s}>Sem {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Assigned Date</label>
                  <input
                    type="date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Student Allocation Type */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block font-semibold text-slate-300">
                  Student Allocation Strategy *
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="allocation"
                      checked={allocationType === 'all'}
                      onChange={() => setAllocationType('all')}
                      className="accent-blue-600"
                    />
                    <span>Entire Branch & Semester ({branch} Sem {semester})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="allocation"
                      checked={allocationType === 'specific'}
                      onChange={() => setAllocationType('specific')}
                      className="accent-blue-600"
                    />
                    <span>Selected Individual Students</span>
                  </label>
                </div>

                {allocationType === 'specific' && (
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 mt-2">
                    <input
                      type="text"
                      placeholder="Search student by name or USN..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {filteredStudents.length === 0 ? (
                        <p className="text-slate-500 italic p-1">No registered students found for {branch} Sem {semester}.</p>
                      ) : (
                        filteredStudents.map((st) => (
                          <label key={st.usn} className="flex items-center gap-2 p-1 hover:bg-slate-900 rounded cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(st.usn)}
                              onChange={() => toggleStudentSelection(st.usn)}
                              className="accent-blue-600"
                            />
                            <span className="font-mono text-blue-400 font-semibold">{st.usn}</span>
                            <span className="text-white">{st.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSave('published')}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{editingId ? 'Update & Publish' : 'Publish & Assign to Students'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
