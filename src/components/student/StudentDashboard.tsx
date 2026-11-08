import React, { useState, useEffect, useRef } from 'react';
import { User, Assignment } from '../../types.ts';
import { api } from '../../services/api.ts';
import { 
  FileCode2, 
  Terminal, 
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { AssignedLabsTab } from './AssignedLabsTab.tsx';
import { CodingWorkspaceTab } from './CodingWorkspaceTab.tsx';
import { MyProgressTab } from './MyProgressTab.tsx';
import { UnauthorizedAccess } from '../common/UnauthorizedAccess.tsx';

interface StudentDashboardProps {
  user: User;
}

export type StudentSection = 'labs' | 'workspace' | 'progress';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  // Strict Role Guard: Students only
  if (user.role !== 'student') {
    return <UnauthorizedAccess user={user} attemptedRole="student" />;
  }

  const [activeSection, setActiveSection] = useState<StudentSection>('labs');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Background Heartbeat and Idle/Active Activity Tracker
  const lastActivityTimeRef = useRef<number>(Date.now());
  const activeSecondsAccumulator = useRef<number>(0);
  const idleSecondsAccumulator = useRef<number>(0);

  useEffect(() => {
    // Activity listener for keyboard and mouse
    const recordUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    window.addEventListener('mousemove', recordUserActivity, { passive: true });
    window.addEventListener('keydown', recordUserActivity, { passive: true });
    window.addEventListener('mousedown', recordUserActivity, { passive: true });
    window.addEventListener('scroll', recordUserActivity, { passive: true });

    // Ticker every second to track active vs idle
    const ticker = setInterval(() => {
      const now = Date.now();
      const secondsSinceLastActivity = (now - lastActivityTimeRef.current) / 1000;
      if (secondsSinceLastActivity > 120) {
        idleSecondsAccumulator.current += 1;
      } else {
        activeSecondsAccumulator.current += 1;
      }
    }, 1000);

    // Periodic Heartbeat to server every 30 seconds
    const heartbeatTimer = setInterval(async () => {
      const active = activeSecondsAccumulator.current;
      const idle = idleSecondsAccumulator.current;
      activeSecondsAccumulator.current = 0;
      idleSecondsAccumulator.current = 0;

      const isCurrentlyIdle = (Date.now() - lastActivityTimeRef.current) / 1000 > 120;

      try {
        await api.sendHeartbeat({
          activeSeconds: active,
          idleSeconds: idle,
          isCurrentlyIdle
        });
      } catch (e) {
        // Silent background catch
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', recordUserActivity);
      window.removeEventListener('keydown', recordUserActivity);
      window.removeEventListener('mousedown', recordUserActivity);
      window.removeEventListener('scroll', recordUserActivity);
      clearInterval(ticker);
      clearInterval(heartbeatTimer);
    };
  }, []);

  // Fetch initial assignments
  const loadData = async () => {
    try {
      setIsLoading(true);
      const assignRes = await api.getAssignments();
      setAssignments(assignRes.assignments || []);

      // If no assignment selected yet and there are assignments, select the first one by default
      if (!currentAssignment && assignRes.assignments?.length > 0) {
        setCurrentAssignment(assignRes.assignments[0]);
      }
    } catch (err) {
      console.error('Failed to load student dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When student clicks "Start Assignment" or opens lab from Section A:
  const handleStartAssignment = (assignment: Assignment) => {
    setCurrentAssignment(assignment);
    setActiveSection('workspace'); // Automatically transitions to coding workspace
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 3 Main Sections Navigation Bar (Strictly Assigned Labs, Coding Workspace, My Progress) */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex flex-wrap items-center gap-2 shadow-lg">
        
        {/* Section A: Assigned Lab Works */}
        <button
          onClick={() => setActiveSection('labs')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'labs'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>A. Assigned Lab Works</span>
          {assignments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-950/60 text-[10px] font-mono">
              {assignments.length}
            </span>
          )}
        </button>

        {/* Section B: Coding Workspace */}
        <button
          onClick={() => setActiveSection('workspace')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'workspace'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>B. Coding Workspace</span>
          {currentAssignment && (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 text-[10px] font-mono hidden sm:inline">
              Lab {currentAssignment.lab_number}
            </span>
          )}
        </button>

        {/* Section C: My Progress */}
        <button
          onClick={() => setActiveSection('progress')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSection === 'progress'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>C. My Progress</span>
        </button>

      </div>

      {/* Render Active Section Component */}
      <div>
        {activeSection === 'labs' && (
          <AssignedLabsTab
            assignments={assignments}
            onStartAssignment={handleStartAssignment}
            isLoading={isLoading}
          />
        )}

        {activeSection === 'workspace' && (
          <CodingWorkspaceTab
            currentAssignment={currentAssignment}
            onClearAssignment={() => setCurrentAssignment(null)}
            onSubmissionSuccess={loadData}
          />
        )}

        {activeSection === 'progress' && (
          <MyProgressTab />
        )}
      </div>

    </div>
  );
};

