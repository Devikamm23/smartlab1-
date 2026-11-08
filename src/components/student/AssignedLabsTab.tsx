import React from 'react';
import { Assignment } from '../../types.ts';
import { 
  FileCode2, 
  Calendar, 
  Clock, 
  Award, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  Code,
  CheckCheck
} from 'lucide-react';

interface AssignedLabsTabProps {
  assignments: Assignment[];
  onStartAssignment: (assignment: Assignment) => void;
  isLoading: boolean;
}

export const AssignedLabsTab: React.FC<AssignedLabsTabProps> = ({
  assignments,
  onStartAssignment,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading assigned laboratory works...</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <FileCode2 className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No Assigned Lab Programs</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You currently have no active laboratory programs assigned by your faculty for your branch and semester.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Evaluated':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <CheckCheck className="w-3.5 h-3.5" />
            Evaluated
          </span>
        );
      case 'Submitted':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submitted
          </span>
        );
      case 'In Progress':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            In Progress
          </span>
        );
      case 'Late':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Late Submission
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Assigned Laboratory Works</h2>
          <p className="text-xs text-slate-400">
            Programs assigned by faculty specifically to your branch and semester.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          Total Assigned: <span className="text-white font-bold">{assignments.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group"
          >
            <div className="space-y-3">
              {/* Header Badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 font-mono text-xs font-bold">
                    Lab {assignment.lab_number}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {assignment.subject}
                  </span>
                </div>
                {getStatusBadge(assignment.submission_status)}
              </div>

              {/* Title & Question Preview */}
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition">
                  {assignment.title}
                </h3>
                <p className="text-xs text-slate-300 line-clamp-3 mt-1.5 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-sans">
                  {assignment.problem_statement}
                </p>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-blue-400" />
                  <span>Languages:</span>
                  <span className="text-slate-200 font-semibold font-mono">
                    {assignment.permitted_languages.join(', ')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Max Marks:</span>
                  <span className="text-slate-200 font-semibold">{assignment.max_marks} pts</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assigned:</span>
                  <span className="text-slate-300">{assignment.assigned_date}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Deadline:</span>
                  <span className="text-slate-300">{assignment.due_date}</span>
                </div>
              </div>

              {/* Evaluation Card if Evaluated */}
              {assignment.submission_status === 'Evaluated' && assignment.marks_obtained !== null && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span>Awarded Marks:</span>
                    <span>{assignment.marks_obtained} / {assignment.max_marks}</span>
                  </div>
                  {assignment.feedback && (
                    <p className="text-[11px] text-emerald-200/80 italic mt-0.5">
                      &quot;{assignment.feedback}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Faculty: {assignment.faculty_name}
              </span>

              <button
                onClick={() => onStartAssignment(assignment)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                <span>
                  {assignment.submission_status === 'Evaluated'
                    ? 'Review Code in Workspace'
                    : assignment.submission_status === 'Submitted'
                    ? 'View / Update in Workspace'
                    : 'Start Assignment'}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
