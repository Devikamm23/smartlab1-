export type Role = 'student' | 'faculty' | 'admin';

export type Branch = 
  | 'CSE'
  | 'ISE'
  | 'AI & ML'
  | 'AI & DS'
  | 'ECE'
  | 'EEE'
  | 'ME';

export const ALL_BRANCHES: { id: Branch; name: string }[] = [
  { id: 'CSE', name: 'Computer Science and Engineering (CSE)' },
  { id: 'ISE', name: 'Information Science and Engineering (ISE)' },
  { id: 'AI & ML', name: 'Artificial Intelligence and Machine Learning (AI & ML)' },
  { id: 'AI & DS', name: 'Artificial Intelligence and Data Science (AI & DS)' },
  { id: 'ECE', name: 'Electronics and Communication Engineering (ECE)' },
  { id: 'EEE', name: 'Electrical and Electronics Engineering (EEE)' },
  { id: 'ME', name: 'Mechanical Engineering (ME)' }
];

export const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export type ProgrammingLanguage = 'C' | 'C++' | 'Java' | 'Python' | 'SQL';
export const ALL_LANGUAGES: ProgrammingLanguage[] = ['C', 'C++', 'Java', 'Python', 'SQL'];

export interface User {
  id: string;
  role: Role;
  name: string;
  username: string;
  email: string;
  branch?: Branch;
  semester?: number;
  usn?: string;
  facultyId?: string;
  status: 'active' | 'pending_approval' | 'rejected';
  created_at?: string;
}

export interface Assignment {
  id: string;
  faculty_id: string;
  faculty_name: string;
  title: string;
  subject: string;
  lab_number: number;
  problem_statement: string;
  instructions?: string;
  permitted_languages: ProgrammingLanguage[];
  max_marks: number;
  assigned_date: string;
  due_date: string;
  branch: Branch;
  semester: number;
  allocation_type: 'all' | 'specific';
  status: 'draft' | 'published';
  created_at: string;
  // Dynamic student fields
  submission_status?: 'Pending' | 'In Progress' | 'Submitted' | 'Evaluated' | 'Late';
  marks_obtained?: number | null;
  feedback?: string | null;
  student_compilation_count?: number;
  submitted_at?: string | null;
  allocated_count?: number;
  submitted_count?: number;
  evaluated_count?: number;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_usn: string;
  student_name: string;
  code: string;
  language: ProgrammingLanguage;
  submitted_at: string;
  status: 'Submitted' | 'Evaluated' | 'Late';
  marks_obtained?: number | null;
  feedback?: string | null;
  evaluated_at?: string | null;
  evaluated_by?: string | null;
  compilation_count: number;
  execution_result?: string;
  branch?: string;
  semester?: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id?: string;
  question_text: string;
  options: string[];
  correct_answer?: string; // Hidden from student until evaluation
  marks: number;
  order_num: number;
}

export interface Quiz {
  id: string;
  faculty_id: string;
  faculty_name: string;
  title: string;
  instructions: string;
  branch: Branch;
  semester: number;
  allocation_type: 'all' | 'specific';
  total_marks: 10 | 15 | 20;
  marks_per_question: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  status: 'draft' | 'published';
  created_at: string;
  attempt_id?: string | null;
  score?: number | null;
  attempted_at?: string | null;
  question_count?: number;
  allocated_count?: number;
  attempt_count?: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_usn: string;
  student_name: string;
  answers: Record<string, string>;
  score: number;
  total_marks: number;
  submitted_at: string;
  branch?: string;
  semester?: number;
}

export interface LiveStudentStatus {
  usn: string;
  name: string;
  branch: Branch;
  semester: number;
  session_id?: string;
  login_time?: string;
  last_heartbeat?: string;
  liveStatus: 'Active' | 'Idle' | 'Logged Out' | 'Disconnected';
  active_seconds?: number;
  idle_seconds?: number;
  total_compilations?: number;
  paste_count?: number;
}

export interface PasteEvent {
  id: string;
  student_usn: string;
  student_name?: string;
  assignment_id?: string;
  assignment_title?: string;
  character_count: number;
  pasted_snippet: string;
  flagged_suspicious: number;
  timestamp: string;
}

export interface ActivitySession {
  id: string;
  student_usn: string;
  student_name: string;
  login_time: string;
  logout_time?: string;
  last_heartbeat: string;
  active_seconds: number;
  idle_seconds: number;
  status: string;
  branch?: string;
  semester?: number;
}

export interface ExecutionResponse {
  status: 'success' | 'compilation_error' | 'runtime_error' | 'timeout';
  output: string;
  error?: string;
  executionTimeMs: number;
  memoryKb?: number;
  engine: string;
  studentCompilationCount?: number;
  assignmentExecution?: {
    totalExecutions: number;
    remainingFreeExecutions: number;
    executionPenalty: number;
    freeLimit: number;
    nextPenaltyAt: number;
  };
}

export interface AssignmentExecutionStats {
  assignmentId: string;
  studentUsn: string;
  totalExecutions: number;
  remainingFreeExecutions: number;
  executionPenalty: number;
  freeLimit: number;
  nextPenaltyAt: number;
}

export interface StudentPerformanceEvaluation {
  id: string;
  assignment_id: string;
  student_usn: string;
  student_name: string;
  code_correctness_marks: number;
  completion_marks: number;
  activity_effort_marks: number;
  timely_submission_marks: number;
  originality_marks: number;
  base_score: number;
  execution_count: number;
  execution_penalty: number;
  final_score: number;
  flagged_suspicious?: number;
  flag_reason?: string | null;
  active_seconds?: number;
  idle_seconds?: number;
  paste_count?: number;
  status: string;
  last_updated_at: string;
  lab_number?: number;
  title?: string;
  subject?: string;
  due_date?: string;
  max_marks?: number;
  submitted_at?: string | null;
  faculty_marks?: number | null;
  faculty_feedback?: string | null;
}

export interface MyProgressAssignment {
  assignmentId: string;
  labNumber: number;
  title: string;
  subject: string;
  dueDate: string;
  maxMarks: number;
  status: 'Pending' | 'In Progress' | 'Submitted';
  totalExecutions: number;
  remainingFreeExecutions: number;
  executionPenalty: number;
  evaluation: {
    codeCorrectnessMarks: number;
    completionMarks: number;
    activityEffortMarks: number;
    timelySubmissionMarks: number;
    originalityMarks: number;
    baseScore: number;
    executionPenalty: number;
    finalScore: number;
  } | null;
  submission: {
    submittedAt: string;
    language: string;
    marksObtained?: number | null;
    feedback?: string | null;
    status: string;
    compilationCount: number;
    executionResult?: string;
  } | null;
}

export interface MyProgressResponse {
  student: {
    name: string;
    usn: string;
    branch?: string;
    semester?: number;
  };
  metrics: {
    totalAssigned: number;
    completedCount: number;
    pendingCount: number;
    overallPerformance: number;
    totalExecutions: number;
    totalPenaltyDeducted: number;
  };
  assignments: MyProgressAssignment[];
}

export interface PerformanceStudentRow {
  name: string;
  usn: string;
  branch: string;
  semester: number;
  assignedCount: number;
  completedCount: number;
  completionPercentage: number;
  codeCorrectnessMarks: number;
  totalExecutions: number;
  executionPenaltyMarksDeducted: number;
  activeSeconds: number;
  idleSeconds: number;
  submissionTimestamp: string | null;
  finalCalculatedMarks: number;
  evaluations: any[];
}

export interface AssignmentMonitoringItem {
  id: string;
  labNumber: number;
  title: string;
  subject: string;
  dueDate: string;
  maxMarks: number;
  allocatedCount: number;
  submittedCount: number;
  pendingCount: number;
  studentDetails: any[];
}

export interface PerformanceOverviewResponse {
  students: PerformanceStudentRow[];
  assignmentsMonitoring: AssignmentMonitoringItem[];
}

export interface StudentReportResponse {
  student: {
    id: string;
    name: string;
    usn: string;
    username: string;
    email: string;
    branch: string;
    semester: number;
    created_at: string;
  };
  overall: {
    overallScore: number;
    totalAssignments: number;
    completedAssignments: number;
    totalExecutions: number;
    totalPenaltyDeducted: number;
    totalActiveSeconds: number;
    totalIdleSeconds: number;
    suspiciousPastesCount: number;
  };
  assignmentEvaluations: StudentPerformanceEvaluation[];
  pasteLogs: any[];
  submissionHistory: any[];
  executionLogs: any[];
}

