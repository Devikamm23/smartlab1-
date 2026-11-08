import React, { useState, useEffect } from 'react';
import { ALL_BRANCHES, ALL_SEMESTERS, Branch } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  Users, 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  Camera, 
  User as UserIcon, 
  Mail, 
  Calendar, 
  Building2, 
  Cpu, 
  Award,
  X,
  CheckCircle2
} from 'lucide-react';
import { FaceCaptureModal } from '../auth/FaceCaptureModal.tsx';

export const StudentEnrollmentView: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected student for Profile modal or Face re-enrollment
  const [profileModalStudent, setProfileModalStudent] = useState<any | null>(null);
  const [reEnrollUsn, setReEnrollUsn] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const res = await api.getStudents({
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
        semester: selectedSemester !== 'all' ? selectedSemester : undefined,
        search: searchQuery || undefined
      });
      setStudents(res.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [selectedBranch, selectedSemester]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const handleFaceReEnrolled = async (faceVector: number[], qualityScore: number) => {
    if (!reEnrollUsn) return;
    try {
      await fetch('/api/auth/re-enroll-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('smartlab_auth_token')}`
        },
        body: JSON.stringify({
          usn: reEnrollUsn,
          faceVector,
          qualityScore
        })
      });

      setActionSuccessMsg(`Face biometric re-enrolled successfully for ${reEnrollUsn}.`);
      setReEnrollUsn(null);
      loadStudents();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Face re-enrollment failed');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Student Enrollment Directory
        </h2>
        <p className="text-xs text-slate-400">
          Search, filter, inspect biometric enrollment status, and manage face re-enrollment for registered students.
        </p>
      </div>

      {actionSuccessMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name or USN..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Branches</option>
              {ALL_BRANCHES.map(b => (
                <option key={b.id} value={b.id}>{b.id}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Semesters</option>
              {ALL_SEMESTERS.map(s => (
                <option key={s} value={s}>Sem {s}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Enrolled Students ({students.length})
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading student directory...
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No students found matching the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">USN</th>
                  <th className="py-3 px-4">Branch & Semester</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Face Biometrics</th>
                  <th className="py-3 px-4">Total Runs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {students.map((st) => (
                  <tr key={st.usn} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {st.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {st.usn}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-300">
                        {st.branch} • Sem {st.semester}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {st.email}
                    </td>
                    <td className="py-3.5 px-4">
                      {st.face_enrolled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-blue-300">
                      {st.total_compilations}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setProfileModalStudent(st)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => setReEnrollUsn(st.usn)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-blue-900/40 text-slate-400 hover:text-blue-300 transition cursor-pointer"
                          title="Re-enroll Face Biometric"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Profile Modal */}
      {profileModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-400" />
                <span>Student Academic Record</span>
              </h3>
              <button
                onClick={() => setProfileModalStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold font-mono text-xl flex items-center justify-center">
                  {profileModalStudent.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{profileModalStudent.name}</h4>
                  <p className="text-slate-400 font-mono">USN: {profileModalStudent.usn}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Branch:</span>
                  <span className="font-semibold text-white">{profileModalStudent.branch}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Semester:</span>
                  <span className="font-semibold text-white">Semester {profileModalStudent.semester}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Official Email:</span>
                  <span className="font-mono text-white text-[11px] truncate block">{profileModalStudent.email}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Total Compilations:</span>
                  <span className="font-bold text-blue-400 font-mono">{profileModalStudent.total_compilations} Runs</span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">Biometric Status:</span>
                  <span className="font-bold text-emerald-400">
                    {profileModalStudent.face_enrolled ? '128-D Facial Embedding Active' : 'Not Enrolled'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const target = profileModalStudent.usn;
                    setProfileModalStudent(null);
                    setReEnrollUsn(target);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
                >
                  Re-enroll Face
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Re-Enrollment Modal */}
      {reEnrollUsn && (
        <FaceCaptureModal
          mode="reenroll"
          usn={reEnrollUsn}
          onConfirm={handleFaceReEnrolled}
          onCancel={() => setReEnrollUsn(null)}
        />
      )}

    </div>
  );
};
