import { User, Assignment, Submission, Quiz, QuizAttempt, LiveStudentStatus, PasteEvent, ActivitySession, ExecutionResponse } from '../types.ts';

const TOKEN_KEY = 'smartlab_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  async studentRegister(payload: {
    fullName: string;
    usn: string;
    username: string;
    password: string;
    confirmPassword: string;
    email: string;
    branch: string;
    semester: number;
    faceVector: number[];
    qualityScore?: number;
  }) {
    return fetchWithAuth('/api/auth/student-register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async studentLoginStep1(credentials: {
    usn: string;
    password: string;
    branch: string;
    semester: number;
  }) {
    return fetchWithAuth('/api/auth/student-login-step1', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  async studentLoginStep2(payload: {
    challengeToken: string;
    usn: string;
    liveFaceVector?: number[] | string;
    useSampleBypass?: boolean;
  }) {
    const data = await fetchWithAuth('/api/auth/student-login-step2', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async facultyRegister(payload: {
    fullName: string;
    facultyId: string;
    username: string;
    email: string;
    department: string;
    password: string;
    confirmPassword: string;
  }) {
    return fetchWithAuth('/api/auth/faculty-register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async facultyLogin(credentials: { username: string; password: string }) {
    const data = await fetchWithAuth('/api/auth/faculty-login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  // WebAuthn Passkeys & Biometric Authentication
  async webauthnLoginChallenge(payload: {
    identifier: string;
    password: string;
    role: 'student' | 'faculty';
  }) {
    return fetchWithAuth('/api/auth/webauthn/login-challenge', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async webauthnLoginVerify(payload: {
    challengeToken: string;
    credential: any;
  }) {
    const data = await fetchWithAuth('/api/auth/webauthn/login-verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async webauthnRegisterOptions(password: string) {
    return fetchWithAuth('/api/auth/webauthn/register-options', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  async webauthnRegisterVerify(payload: {
    challengeToken: string;
    credential: any;
  }) {
    return fetchWithAuth('/api/auth/webauthn/register-verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 2FA Fallback Verification (Device Without Biometric Hardware)
  async recoveryRequestCode(challengeToken: string) {
    return fetchWithAuth('/api/auth/recovery/request-code', {
      method: 'POST',
      body: JSON.stringify({ challengeToken })
    });
  },

  async recoveryVerifyCode(payload: {
    challengeToken: string;
    code: string;
  }) {
    const data = await fetchWithAuth('/api/auth/recovery/verify-code', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  // Password Recovery / Reset
  async passwordRecoveryRequest(payload: {
    identifier: string;
    email: string;
    role: 'student' | 'faculty';
  }) {
    return fetchWithAuth('/api/auth/password-recovery/request', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async passwordRecoveryReset(payload: {
    identifier: string;
    email: string;
    recoveryPin: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    return fetchWithAuth('/api/auth/password-recovery/reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Passkey Management
  async getPasskeys() {
    return fetchWithAuth('/api/auth/passkeys');
  },

  async removePasskey(payload: { passkeyId: string; password: string }) {
    return fetchWithAuth('/api/auth/passkeys/remove', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return fetchWithAuth('/api/auth/me');
  },

  async logout() {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredToken();
    }
  },

  async getPendingFaculty() {
    return fetchWithAuth('/api/auth/pending-faculty');
  },

  async approveFaculty(facultyId: string, action: 'approve' | 'reject') {
    return fetchWithAuth('/api/auth/approve-faculty', {
      method: 'POST',
      body: JSON.stringify({ facultyId, action })
    });
  },

  // Assignments
  async getAssignments(): Promise<{ assignments: Assignment[] }> {
    return fetchWithAuth('/api/assignments');
  },

  async getAssignment(id: string): Promise<{ assignment: Assignment; submission?: Submission; allocations?: any[] }> {
    return fetchWithAuth(`/api/assignments/${id}`);
  },

  async createAssignment(payload: any) {
    return fetchWithAuth('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAssignment(id: string, payload: any) {
    return fetchWithAuth(`/api/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteAssignment(id: string) {
    return fetchWithAuth(`/api/assignments/${id}`, {
      method: 'DELETE'
    });
  },

  // Code Execution & Submissions
  async runCode(payload: {
    language: string;
    code: string;
    stdin?: string;
    assignmentId?: string;
  }): Promise<ExecutionResponse> {
    return fetchWithAuth('/api/code/run', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async submitCode(payload: {
    assignmentId: string;
    code: string;
    language: string;
    executionResult?: string;
  }) {
    return fetchWithAuth('/api/code/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getAssignmentSubmissions(assignmentId: string): Promise<{ submissions: Submission[] }> {
    return fetchWithAuth(`/api/submissions/assignment/${assignmentId}`);
  },

  async evaluateSubmission(submissionId: string, marksObtained: number, feedback: string) {
    return fetchWithAuth(`/api/submissions/${submissionId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ marksObtained, feedback })
    });
  },

  // Quizzes
  async getQuizzes(): Promise<{ quizzes: Quiz[] }> {
    return fetchWithAuth('/api/quizzes');
  },

  async getQuiz(id: string): Promise<{ quiz: Quiz; questions: any[]; attempt?: QuizAttempt | null; attempts?: QuizAttempt[] }> {
    return fetchWithAuth(`/api/quizzes/${id}`);
  },

  async createQuiz(payload: any) {
    return fetchWithAuth('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async submitQuiz(id: string, answers: Record<string, string>) {
    return fetchWithAuth(`/api/quizzes/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  },

  // Monitoring
  async sendHeartbeat(data: { activeSeconds: number; idleSeconds: number; isCurrentlyIdle: boolean }) {
    return fetchWithAuth('/api/monitoring/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async logPasteEvent(data: { assignmentId?: string; characterCount: number; snippet?: string }) {
    return fetchWithAuth('/api/monitoring/paste', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getLiveMonitoring(): Promise<{ students: LiveStudentStatus[] }> {
    return fetchWithAuth('/api/monitoring/live');
  },

  async getActivityHistory(usn?: string): Promise<{ sessions: ActivitySession[]; pasteEvents: PasteEvent[] }> {
    const q = usn ? `?usn=${encodeURIComponent(usn)}` : '';
    return fetchWithAuth(`/api/monitoring/history${q}`);
  },

  // Students & Progress
  async getStudents(params?: { branch?: string; semester?: string | number; search?: string }): Promise<{ students: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.branch) searchParams.set('branch', params.branch);
    if (params?.semester) searchParams.set('semester', String(params.semester));
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchWithAuth(`/api/students${qs}`);
  },

  async getMyProgress(): Promise<any> {
    return fetchWithAuth('/api/students/my-progress');
  },

  async getAssignmentExecutionStats(assignmentId: string, usn?: string): Promise<any> {
    const q = usn ? `?usn=${encodeURIComponent(usn)}` : '';
    return fetchWithAuth(`/api/assignments/${assignmentId}/execution-stats${q}`);
  },

  async getFacultyPerformanceOverview(): Promise<any> {
    return fetchWithAuth('/api/faculty/performance-overview');
  },

  async getStudentReport(usn: string): Promise<any> {
    return fetchWithAuth(`/api/faculty/student-report/${encodeURIComponent(usn)}`);
  },

  async getJudge0Config(): Promise<any> {
    return fetchWithAuth('/api/system/judge0');
  },

  async updateJudge0Config(payload: any): Promise<any> {
    return fetchWithAuth('/api/system/judge0', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

