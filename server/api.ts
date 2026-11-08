import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { db, hashPassword, verifyPassword, calculateExecutionPenalty, syncPerformanceAndCounters } from './db.js';
import { compareFaceEmbeddings } from './faceBiometrics.js';
import { executeCode } from './codeRunner.js';

// Anti-spam debounce for code execution requests
const lastExecutionTimes = new Map<string, number>();

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '10mb' }));
apiRouter.use(cookieParser());

// Dynamic Relying Party resolver for WebAuthn passkeys
export function getRelyingParty(req: Request) {
  const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  const hostname = hostHeader.split(':')[0];
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  const origin = (req.headers.origin as string) || `${proto}://${hostHeader}`;
  return { rpID: hostname, rpName: 'SmartLab Security Gateway', origin };
}

// In-memory token store for active sessions (backed up by user_sessions table)
export interface SessionData {
  userId: string;
  role: 'student' | 'faculty' | 'admin';
  name: string;
  usn?: string;
  facultyId?: string;
  branch?: string;
  semester?: number;
  loginTime: number;
}
export const activeSessions = new Map<string, SessionData>();

// Temporary challenge tokens for 2-step face / passkey login
interface ChallengeData {
  userId: string;
  identifier: string;
  usn?: string;
  name: string;
  role: 'student' | 'faculty' | 'admin';
  branch?: string;
  semester?: number;
  expiresAt: number;
}
const faceChallenges = new Map<string, ChallengeData>();

// Helper to revoke a session everywhere
export function revokeSession(token: string) {
  activeSessions.delete(token);
  try {
    db.prepare('UPDATE user_sessions SET is_valid = 0 WHERE token = ?').run(token);
  } catch (e) {
    // ignore if table error
  }
}

// Helper to issue an authenticated session
export function issueSession(res: Response, user: any): { token: string; sessionData: SessionData } {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionData: SessionData = {
    userId: user.id,
    role: user.role,
    name: user.name,
    usn: user.usn,
    facultyId: user.faculty_id,
    branch: user.branch,
    semester: user.semester,
    loginTime: Date.now(),
  };

  activeSessions.set(token, sessionData);

  // Persist to SQLite user_sessions table
  const expiresAt = Date.now() + 8 * 3600 * 1000; // 8 hours
  try {
    db.prepare(`
      INSERT INTO user_sessions (token, user_id, role, login_time, expires_at, is_valid)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(token, user.id, user.role, sessionData.loginTime, expiresAt);
  } catch (e) {
    console.error('Session persistence error:', e);
  }

  // Set HTTP-only secure cookie
  res.cookie('smartlab_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 3600 * 1000,
  });

  return { token, sessionData };
}

// Auth Middleware: checks Bearer header & HTTP-only cookies, validates against SQLite database
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.split(' ')[1];
  const cookieToken = req.cookies && req.cookies['smartlab_session'];
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // 1. Check in-memory store
  let session = activeSessions.get(token);

  // 2. Fallback to user_sessions table in SQLite
  if (!session) {
    try {
      const dbSession = db.prepare('SELECT * FROM user_sessions WHERE token = ? AND is_valid = 1').get(token) as any;
      if (dbSession && dbSession.expires_at > Date.now()) {
        const user = db.prepare('SELECT id, role, name, usn, faculty_id, branch, semester, status FROM users WHERE id = ?').get(dbSession.user_id) as any;
        if (user && user.status === 'active') {
          session = {
            userId: user.id,
            role: user.role,
            name: user.name,
            usn: user.usn,
            facultyId: user.faculty_id,
            branch: user.branch,
            semester: user.semester,
            loginTime: dbSession.login_time,
          };
          activeSessions.set(token, session);
        }
      }
    } catch (e) {
      console.error('Auth lookup error:', e);
    }
  }

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  // CRITICAL REQUIREMENT 1: Always verify actual user role and status from the backend database!
  const dbUser = db.prepare('SELECT role, status FROM users WHERE id = ?').get(session.userId) as any;
  if (!dbUser || dbUser.status !== 'active') {
    revokeSession(token);
    res.clearCookie('smartlab_session');
    return res.status(401).json({ error: 'User account is inactive or revoked.' });
  }

  // Enforce DB role over session if any tampering occurred
  session.role = dbUser.role;

  (req as any).user = session;
  (req as any).token = token;
  next();
}

// Strict Faculty Middleware: Re-verifies role directly in SQLite DB, rejects students with HTTP 403
export function requireFaculty(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as SessionData;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Re-verify role directly against SQLite database to prevent any browser inspection or URL tampering
  const dbUser = db.prepare('SELECT role, status FROM users WHERE id = ?').get(user.userId) as any;
  if (!dbUser || (dbUser.role !== 'faculty' && dbUser.role !== 'admin') || dbUser.status !== 'active') {
    return res.status(403).json({ 
      error: 'Unauthorized Access: You do not have faculty credentials. Access forbidden.',
      role: dbUser?.role || user.role,
      requiredRole: 'faculty'
    });
  }
  next();
}

// Strict Student Middleware: Re-verifies role directly in SQLite DB
export function requireStudent(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as SessionData;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const dbUser = db.prepare('SELECT role, status FROM users WHERE id = ?').get(user.userId) as any;
  if (!dbUser || dbUser.role !== 'student' || dbUser.status !== 'active') {
    return res.status(403).json({ 
      error: 'Unauthorized Access: Student credentials required.',
      role: dbUser?.role || user.role,
      requiredRole: 'student'
    });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION & WEBAUTHN PASSKEYS ROUTES
// ==========================================

// Student Registration with Biometric Face Enrollment
apiRouter.post('/auth/student-register', (req, res) => {
  try {
    const {
      fullName,
      usn,
      username,
      password,
      confirmPassword,
      email,
      branch,
      semester,
      faceVector, // 128-D float array from webcam
      qualityScore = 95
    } = req.body;

    if (!fullName || !usn || !username || !password || !email || !branch || !semester) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Biometric validation
    if (!faceVector || !Array.isArray(faceVector) || faceVector.length !== 128) {
      return res.status(400).json({
        error: 'Face enrollment is mandatory. Please capture a clear photograph to generate your face template.'
      });
    }

    const cleanUsn = usn.trim().toUpperCase();
    const cleanUsername = username.trim().toLowerCase();

    // Check uniqueness
    const existing = db.prepare('SELECT id, usn, username FROM users WHERE usn = ? OR username = ?').get(cleanUsn, cleanUsername) as any;
    if (existing) {
      if (existing.usn === cleanUsn) {
        return res.status(400).json({ error: `A student with USN ${cleanUsn} already exists.` });
      }
      return res.status(400).json({ error: `Username ${cleanUsername} is already taken.` });
    }

    const { hash, salt } = hashPassword(password);
    const userId = `usr_${cleanUsn.toLowerCase()}`;
    const now = new Date().toISOString();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, role, name, username, password_hash, salt, email, branch, semester, usn, status, created_at)
      VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(userId, fullName.trim(), cleanUsername, hash, salt, email.trim(), branch, Number(semester), cleanUsn, now);

    // Insert face template
    db.prepare(`
      INSERT OR REPLACE INTO face_templates (id, usn, template_data, quality_score, registered_at, last_verified_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`face_${cleanUsn}`, cleanUsn, JSON.stringify(faceVector), Number(qualityScore), now, now);

    // Auto-allocate existing published assignments & quizzes for this branch & semester
    const matchingAssignments = db.prepare('SELECT id FROM assignments WHERE branch = ? AND semester = ? AND status = ?').all(branch, Number(semester), 'published') as { id: string }[];
    for (const a of matchingAssignments) {
      db.prepare('INSERT OR IGNORE INTO assignment_allocations (id, assignment_id, student_usn) VALUES (?, ?, ?)')
        .run(`alloc_${a.id}_${cleanUsn}`, a.id, cleanUsn);
    }

    const matchingQuizzes = db.prepare('SELECT id FROM quizzes WHERE branch = ? AND semester = ? AND status = ?').all(branch, Number(semester), 'published') as { id: string }[];
    for (const q of matchingQuizzes) {
      db.prepare('INSERT OR IGNORE INTO quiz_allocations (id, quiz_id, student_usn) VALUES (?, ?, ?)')
        .run(`qalloc_${q.id}_${cleanUsn}`, q.id, cleanUsn);
    }

    res.json({
      success: true,
      message: 'Student Registration & Face Biometric Enrollment completed successfully. You can now sign in.'
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Student Login Step 1: Validate USN, Password, Branch, Semester
apiRouter.post('/auth/student-login-step1', (req, res) => {
  try {
    const { usn, password, branch, semester } = req.body;

    if (!usn || !password || !branch || !semester) {
      return res.status(400).json({ error: 'USN, Password, Branch, and Semester are all required.' });
    }

    const cleanUsn = usn.trim().toUpperCase();
    const user = db.prepare('SELECT * FROM users WHERE usn = ? AND role = ?').get(cleanUsn, 'student') as any;

    if (!user) {
      return res.status(401).json({ error: 'Student not found with this USN.' });
    }

    if (user.branch !== branch || Number(user.semester) !== Number(semester)) {
      return res.status(401).json({
        error: `Registered branch/semester (${user.branch}, Sem ${user.semester}) does not match entered values.`
      });
    }

    const passwordOk = verifyPassword(password, user.password_hash, user.salt);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid password credentials.' });
    }

    // Check registered face template
    const faceRow = db.prepare('SELECT id FROM face_templates WHERE usn = ?').get(cleanUsn) as any;
    if (!faceRow) {
      return res.status(400).json({
        error: 'No registered face template found for this student. Please contact faculty for biometric enrollment.'
      });
    }

    // Issue challenge token
    const challengeToken = crypto.randomBytes(24).toString('hex');
    faceChallenges.set(challengeToken, {
      userId: user.id,
      identifier: cleanUsn,
      usn: cleanUsn,
      role: 'student',
      name: user.name,
      branch: user.branch,
      semester: user.semester,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    res.json({
      success: true,
      challengeToken,
      usn: cleanUsn,
      name: user.name,
      message: 'Credentials verified. Please proceed to live camera face authentication.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login step 1 failed' });
  }
});

// Student Login Step 2: Live Face Verification
apiRouter.post('/auth/student-login-step2', (req, res) => {
  try {
    const { challengeToken, usn, liveFaceVector, useSampleBypass = false } = req.body;

    if (!challengeToken || !usn) {
      return res.status(400).json({ error: 'Challenge token and USN are required.' });
    }

    const cleanUsn = usn.trim().toUpperCase();
    const challenge = faceChallenges.get(challengeToken);

    if (!challenge || challenge.usn !== cleanUsn) {
      return res.status(401).json({ error: 'Face verification session expired or invalid. Please sign in again.' });
    }

    if (Date.now() > challenge.expiresAt) {
      faceChallenges.delete(challengeToken);
      return res.status(401).json({ error: 'Face authentication window timed out. Please retry.' });
    }

    // Retrieve registered template
    const templateRow = db.prepare('SELECT template_data FROM face_templates WHERE usn = ?').get(cleanUsn) as { template_data: string } | undefined;
    if (!templateRow) {
      return res.status(404).json({ error: 'No registered face template found for this student.' });
    }

    const registeredVector: number[] = JSON.parse(templateRow.template_data);
    let matchResult;

    if (useSampleBypass && liveFaceVector === 'DEMO_MATCH') {
      // Demo testing helper
      matchResult = {
        matched: true,
        similarity: 0.985,
        euclideanDistance: 0.12,
        confidencePercent: 99,
        threshold: 0.38
      };
    } else {
      if (!liveFaceVector || !Array.isArray(liveFaceVector) || liveFaceVector.length !== 128) {
        return res.status(400).json({
          matched: false,
          error: 'No valid live face embedding detected. Please ensure your face is well-lit and centered in the camera preview.'
        });
      }
      matchResult = compareFaceEmbeddings(liveFaceVector, registeredVector);
    }

    if (!matchResult.matched) {
      return res.status(401).json({
        matched: false,
        error: matchResult.reason || 'Face does not match registered profile. Please try again.',
        similarity: matchResult.similarity,
        distance: matchResult.euclideanDistance
      });
    }

    // Successful Face Authentication!
    faceChallenges.delete(challengeToken);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessionData: SessionData = {
      userId: challenge.userId,
      role: 'student',
      name: challenge.name,
      usn: cleanUsn,
      branch: challenge.branch,
      semester: challenge.semester,
      loginTime: Date.now()
    };
    activeSessions.set(token, sessionData);

    // Update last_verified_at
    const now = new Date().toISOString();
    db.prepare('UPDATE face_templates SET last_verified_at = ? WHERE usn = ?').run(now, cleanUsn);

    // Record activity session
    const sessionId = `sess_${cleanUsn}_${Date.now()}`;
    db.prepare(`
      INSERT INTO activity_sessions (id, student_usn, student_name, login_time, last_heartbeat, active_seconds, idle_seconds, status)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'Active')
    `).run(sessionId, cleanUsn, challenge.name, now, now);

    // Record activity event
    db.prepare(`
      INSERT INTO activity_events (id, session_id, student_usn, event_type, details, timestamp)
      VALUES (?, ?, ?, 'login', 'Facial biometric authentication verified successfully', ?)
    // Persist to SQLite user_sessions table
    const expiresAt = Date.now() + 8 * 3600 * 1000;
    try {
      db.prepare(`
        INSERT INTO user_sessions (token, user_id, role, login_time, expires_at, is_valid)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(token, challenge.userId, 'student', sessionData.loginTime, expiresAt);
    } catch (e) {
      console.error('Session persistence error:', e);
    }

    // Set HTTP-only secure cookie
    res.cookie('smartlab_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000,
    });

    res.json({
      success: true,
      matched: true,
      token,
      sessionId,
      user: {
        id: challenge.userId,
        role: 'student',
        name: challenge.name,
        usn: cleanUsn,
        branch: challenge.branch,
        semester: challenge.semester
      },
      matchStats: {
        similarity: matchResult.similarity,
        confidence: matchResult.confidencePercent,
        verifiedAt: now
      }
    });
  } catch (err: any) {
    console.error('Face verification error:', err);
    res.status(500).json({ error: err.message || 'Face verification failed' });
  }
});

// ------------------------------------------------------------------
// WebAuthn Passkeys & Biometric Authentication Routes
// ------------------------------------------------------------------

// 1. WebAuthn Login Challenge: Validates credentials and generates biometric assertion options
apiRouter.post('/auth/webauthn/login-challenge', async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password || !role) {
      return res.status(400).json({ error: 'USN / Faculty ID, Password, and Role are required.' });
    }

    if (role !== 'student' && role !== 'faculty') {
      return res.status(400).json({ error: 'Invalid role specified. Role must be student or faculty.' });
    }

    const cleanId = identifier.trim();
    let user: any;

    if (role === 'student') {
      user = db.prepare(`
        SELECT * FROM users 
        WHERE (UPPER(usn) = ? OR LOWER(username) = ?) AND role = 'student'
      `).get(cleanId.toUpperCase(), cleanId.toLowerCase()) as any;
    } else {
      user = db.prepare(`
        SELECT * FROM users 
        WHERE (UPPER(faculty_id) = ? OR LOWER(username) = ? OR LOWER(email) = ?) AND (role = 'faculty' OR role = 'admin')
      `).get(cleanId.toUpperCase(), cleanId.toLowerCase(), cleanId.toLowerCase()) as any;
    }

    if (!user) {
      return res.status(401).json({ error: `${role === 'faculty' ? 'Faculty' : 'Student'} account not found with this ID / Username.` });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: user.status === 'pending_approval' 
          ? 'Faculty account registration is awaiting administrative approval.' 
          : 'User account is inactive or disabled. Please contact administration.'
      });
    }

    // Verify password
    const passwordOk = verifyPassword(password, user.password_hash, user.salt);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    // Credentials verified! Generate WebAuthn challenge
    const { rpID } = getRelyingParty(req);
    const challengeToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

    // Fetch existing registered passkeys for this user
    const existingPasskeys = db.prepare('SELECT id, transports, public_key FROM passkeys WHERE user_id = ?').all(user.id) as any[];

    let options: any;
    let mode: 'authentication' | 'registration';

    if (existingPasskeys.length > 0) {
      mode = 'authentication';
      options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: existingPasskeys.map(pk => ({
          id: pk.id,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        })),
        userVerification: 'required', // Windows Hello Face / Apple Face ID / Touch ID / Android biometrics
      });
    } else {
      mode = 'registration';
      options = await generateRegistrationOptions({
        rpName: 'SmartLab Security Gateway',
        rpID,
        userID: Buffer.from(user.id),
        userName: user.username || user.usn || user.faculty_id,
        userDisplayName: user.name,
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
      });
    }

    // Store challenge in SQLite webauthn_challenges table
    db.prepare(`
      INSERT OR REPLACE INTO webauthn_challenges (id, user_id, user_identifier, role, type, challenge, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(challengeToken, user.id, cleanId, user.role, mode, options.challenge, expiresAt, new Date().toISOString());

    // Also cache in-memory for fast lookup
    faceChallenges.set(challengeToken, {
      userId: user.id,
      identifier: cleanId,
      name: user.name,
      role: user.role,
      branch: user.branch,
      semester: user.semester,
      expiresAt,
    });

    res.json({
      success: true,
      challengeToken,
      mode,
      hasPasskey: existingPasskeys.length > 0,
      options,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        identifier: user.usn || user.faculty_id || user.username,
        email: user.email,
        branch: user.branch,
        semester: user.semester
      },
      message: existingPasskeys.length > 0 
        ? 'Credentials verified. Device requesting biometric face/passkey verification.'
        : 'Credentials verified. Please complete device biometric passkey registration.'
    });
  } catch (err: any) {
    console.error('WebAuthn challenge error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate biometric authentication challenge.' });
  }
});

// 2. WebAuthn Login Verify: Cryptographically verifies the device passkey assertion
apiRouter.post('/auth/webauthn/login-verify', async (req, res) => {
  try {
    const { challengeToken, credential } = req.body;

    if (!challengeToken || !credential) {
      return res.status(400).json({ error: 'Challenge token and credential assertion are required.' });
    }

    const challengeRecord = db.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').get(challengeToken) as any;
    if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
      return res.status(401).json({ error: 'Biometric challenge expired or invalid. Please sign in again.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challengeRecord.user_id) as any;
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'User account is inactive or disabled.' });
    }

    const { rpID, origin } = getRelyingParty(req);
    const now = new Date().toISOString();

    if (challengeRecord.type === 'registration') {
      // Complete initial passkey registration
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(401).json({ error: 'Failed to verify device biometric passkey registration.' });
      }

      const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const pubKeyBase64 = Buffer.from(cred.publicKey).toString('base64url');

      // Save passkey in DB
      db.prepare(`
        INSERT OR REPLACE INTO passkeys (id, user_id, user_identifier, role, public_key, counter, device_type, backed_up, transports, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cred.id,
        user.id,
        challengeRecord.user_identifier,
        user.role,
        pubKeyBase64,
        cred.counter,
        credentialDeviceType,
        credentialBackedUp ? 1 : 0,
        JSON.stringify(credential.response.transports || ['internal']),
        now,
        now
      );
    } else {
      // Verify existing passkey authentication
      const passkey = db.prepare('SELECT * FROM passkeys WHERE id = ? AND user_id = ?').get(credential.id, user.id) as any;
      if (!passkey) {
        return res.status(401).json({ error: 'Unrecognized passkey. Please use the device registered for this account.' });
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.public_key, 'base64url'),
          counter: passkey.counter,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        return res.status(401).json({ error: 'Biometric verification failed. Please try again.' });
      }

      // Update counter and last_used_at
      db.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').run(
        verification.authenticationInfo.newCounter,
        now,
        passkey.id
      );
    }

    // Invalidate used challenge
    db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(challengeToken);
    faceChallenges.delete(challengeToken);

    // Issue secure session token & HTTP-only cookie
    const { token, sessionData } = issueSession(res, user);

    // Record login in activity_sessions if student
    let sessionId: string | undefined;
    if (user.role === 'student') {
      sessionId = `sess_${user.usn}_${Date.now()}`;
      db.prepare(`
        INSERT INTO activity_sessions (id, student_usn, student_name, login_time, last_heartbeat, active_seconds, idle_seconds, status)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Active')
      `).run(sessionId, user.usn, user.name, now, now);

      db.prepare(`
        INSERT INTO activity_events (id, session_id, student_usn, event_type, details, timestamp)
        VALUES (?, ?, ?, 'login', 'WebAuthn platform biometric authentication verified successfully', ?)
      `).run(`evt_${Date.now()}`, sessionId, user.usn, now);
    }

    res.json({
      success: true,
      token,
      sessionId,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        usn: user.usn,
        facultyId: user.faculty_id,
        email: user.email,
        branch: user.branch,
        semester: user.semester,
      },
      message: 'Device biometric authentication verified successfully.'
    });
  } catch (err: any) {
    console.error('WebAuthn verification error:', err);
    res.status(401).json({ error: err.message || 'Biometric verification failed' });
  }
});

// 3. Register Passkey Options (for authenticated user adding/updating passkey)
apiRouter.post('/auth/webauthn/register-options', authenticateToken, async (req, res) => {
  try {
    const session = (req as any).user as SessionData;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Current password verification is required before registering a passkey.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any;
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ error: 'Incorrect password. Passkey registration aborted.' });
    }

    const { rpID } = getRelyingParty(req);
    const challengeToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000;

    const options = await generateRegistrationOptions({
      rpName: 'SmartLab Security Gateway',
      rpID,
      userID: Buffer.from(user.id),
      userName: user.username || user.usn || user.faculty_id,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
    });

    db.prepare(`
      INSERT OR REPLACE INTO webauthn_challenges (id, user_id, user_identifier, role, type, challenge, expires_at, created_at)
      VALUES (?, ?, ?, ?, 'registration', ?, ?, ?)
    `).run(challengeToken, user.id, user.usn || user.faculty_id || user.username, user.role, options.challenge, expiresAt, new Date().toISOString());

    res.json({ success: true, challengeToken, options });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate passkey registration options' });
  }
});

// 4. Register Passkey Verify (for authenticated user)
apiRouter.post('/auth/webauthn/register-verify', authenticateToken, async (req, res) => {
  try {
    const session = (req as any).user as SessionData;
    const { challengeToken, credential } = req.body;

    if (!challengeToken || !credential) {
      return res.status(400).json({ error: 'Challenge token and credential are required.' });
    }

    const challengeRecord = db.prepare('SELECT * FROM webauthn_challenges WHERE id = ? AND user_id = ?').get(challengeToken, session.userId) as any;
    if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
      return res.status(401).json({ error: 'Passkey registration challenge expired or invalid.' });
    }

    const { rpID, origin } = getRelyingParty(req);
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(401).json({ error: 'Failed to verify passkey registration response.' });
    }

    const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const pubKeyBase64 = Buffer.from(cred.publicKey).toString('base64url');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO passkeys (id, user_id, user_identifier, role, public_key, counter, device_type, backed_up, transports, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cred.id,
      session.userId,
      session.usn || session.facultyId || session.name,
      session.role,
      pubKeyBase64,
      cred.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      JSON.stringify(credential.response.transports || ['internal']),
      now,
      now
    );

    db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(challengeToken);

    res.json({
      success: true,
      message: 'New biometric passkey registered successfully and linked to your account.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Passkey registration failed' });
  }
});

// 5. Device Without Biometric Support Fallback (Requirement 5 & Test scenario 12)
apiRouter.post('/auth/recovery/request-code', (req, res) => {
  try {
    const { challengeToken } = req.body;
    if (!challengeToken) {
      return res.status(400).json({ error: 'Challenge token is required.' });
    }

    const challengeRecord = db.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').get(challengeToken) as any;
    if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
      return res.status(401).json({ error: 'Authentication challenge expired. Please enter your credentials again.' });
    }

    const user = db.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').get(challengeRecord.user_id) as any;
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'User account is inactive or not found.' });
    }

    // Generate secure 6-digit recovery code
    const recoveryCode = (Math.floor(100000 + crypto.randomInt(900000))).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    db.prepare(`
      INSERT INTO recovery_codes (id, user_id, user_identifier, code, purpose, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 'login_fallback', ?, 0, ?)
    `).run(`rec_${Date.now()}`, user.id, challengeRecord.user_identifier, recoveryCode, expiresAt, new Date().toISOString());

    console.log(`[SmartLab 2FA Fallback] Generated 2FA Device Verification Code for ${user.name} (${user.email}): ${recoveryCode}`);

    // Masked email for display
    const parts = user.email.split('@');
    const maskedEmail = parts[0].slice(0, 2) + '***@' + parts[1];

    res.json({
      success: true,
      message: `2FA Device Recovery Code generated for ${user.name}.`,
      recoveryCode, // Provided for academic lab environment and verification
      maskedEmail,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to request recovery code.' });
  }
});

apiRouter.post('/auth/recovery/verify-code', (req, res) => {
  try {
    const { challengeToken, code } = req.body;
    if (!challengeToken || !code) {
      return res.status(400).json({ error: 'Challenge token and 6-digit recovery code are required.' });
    }

    const challengeRecord = db.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').get(challengeToken) as any;
    if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
      return res.status(401).json({ error: 'Authentication challenge expired. Please start over.' });
    }

    const cleanCode = code.toString().trim();
    const recRow = db.prepare(`
      SELECT * FROM recovery_codes 
      WHERE user_id = ? AND code = ? AND purpose = 'login_fallback' AND used = 0 AND expires_at > ?
      ORDER BY expires_at DESC LIMIT 1
    `).get(challengeRecord.user_id, cleanCode, Date.now()) as any;

    if (!recRow) {
      return res.status(401).json({ error: 'Invalid or expired 2FA recovery code.' });
    }

    // Mark code used
    db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(recRow.id);
    db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(challengeToken);
    faceChallenges.delete(challengeToken);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(challengeRecord.user_id) as any;
    const { token, sessionData } = issueSession(res, user);
    const now = new Date().toISOString();

    let sessionId: string | undefined;
    if (user.role === 'student') {
      sessionId = `sess_${user.usn}_${Date.now()}`;
      db.prepare(`
        INSERT INTO activity_sessions (id, student_usn, student_name, login_time, last_heartbeat, active_seconds, idle_seconds, status)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Active')
      `).run(sessionId, user.usn, user.name, now, now);

      db.prepare(`
        INSERT INTO activity_events (id, session_id, student_usn, event_type, details, timestamp)
        VALUES (?, ?, ?, 'login', '2FA verified device recovery authentication', ?)
      `).run(`evt_${Date.now()}`, sessionId, user.usn, now);
    }

    res.json({
      success: true,
      token,
      sessionId,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        usn: user.usn,
        facultyId: user.faculty_id,
        email: user.email,
        branch: user.branch,
        semester: user.semester,
      },
      message: '2FA device fallback verified successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Recovery verification failed.' });
  }
});

// 6. Password Recovery / Forgot Password (Requirement 5 & 7 & Test scenario 10)
apiRouter.post('/auth/password-recovery/request', (req, res) => {
  try {
    const { identifier, email, role } = req.body;
    if (!identifier || !email || !role) {
      return res.status(400).json({ error: 'USN / Faculty ID, registered email, and role are required.' });
    }

    const cleanId = identifier.trim();
    const cleanEmail = email.trim().toLowerCase();

    let user: any;
    if (role === 'student') {
      user = db.prepare(`
        SELECT * FROM users 
        WHERE (UPPER(usn) = ? OR LOWER(username) = ?) AND LOWER(email) = ? AND role = 'student'
      `).get(cleanId.toUpperCase(), cleanId.toLowerCase(), cleanEmail) as any;
    } else {
      user = db.prepare(`
        SELECT * FROM users 
        WHERE (UPPER(faculty_id) = ? OR LOWER(username) = ?) AND LOWER(email) = ? AND (role = 'faculty' OR role = 'admin')
      `).get(cleanId.toUpperCase(), cleanId.toLowerCase(), cleanEmail) as any;
    }

    if (!user) {
      return res.status(404).json({ error: 'No matching user found with the provided identifier and email.' });
    }

    const pin = (Math.floor(100000 + crypto.randomInt(900000))).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    db.prepare(`
      INSERT INTO recovery_codes (id, user_id, user_identifier, code, purpose, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 'password_reset', ?, 0, ?)
    `).run(`pwd_${Date.now()}`, user.id, cleanId, pin, expiresAt, new Date().toISOString());

    console.log(`[SmartLab Password Reset] Verification PIN for ${user.name} (${user.email}): ${pin}`);

    res.json({
      success: true,
      message: `Password reset PIN generated for ${user.email}.`,
      recoveryPin: pin,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Password recovery request failed.' });
  }
});

apiRouter.post('/auth/password-recovery/reset', (req, res) => {
  try {
    const { identifier, email, recoveryPin, newPassword, confirmPassword } = req.body;
    if (!identifier || !email || !recoveryPin || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanId = identifier.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = recoveryPin.toString().trim();

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE (UPPER(usn) = ? OR UPPER(faculty_id) = ? OR LOWER(username) = ?) AND LOWER(email) = ?
    `).get(cleanId.toUpperCase(), cleanId.toUpperCase(), cleanId.toLowerCase(), cleanEmail) as any;

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const recRow = db.prepare(`
      SELECT * FROM recovery_codes 
      WHERE user_id = ? AND code = ? AND purpose = 'password_reset' AND used = 0 AND expires_at > ?
      ORDER BY expires_at DESC LIMIT 1
    `).get(user.id, cleanPin, Date.now()) as any;

    if (!recRow) {
      return res.status(401).json({ error: 'Invalid or expired password reset PIN.' });
    }

    // Mark PIN used
    db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(recRow.id);

    // Hash new password
    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);

    // Invalidate all existing sessions for this user (security hygiene)
    try {
      db.prepare('UPDATE user_sessions SET is_valid = 0 WHERE user_id = ?').run(user.id);
      for (const [token, sess] of activeSessions.entries()) {
        if (sess.userId === user.id) {
          activeSessions.delete(token);
        }
      }
    } catch (e) {}

    res.json({
      success: true,
      message: 'Password reset successfully. All previous sessions revoked. Please sign in with your new password.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Password reset failed.' });
  }
});

// 7. Passkey Management (Requirement 4)
apiRouter.get('/auth/passkeys', authenticateToken, (req, res) => {
  const session = (req as any).user as SessionData;
  const passkeys = db.prepare('SELECT id, device_type, backed_up, created_at, last_used_at FROM passkeys WHERE user_id = ?').all(session.userId) as any[];
  res.json({ passkeys });
});

apiRouter.post('/auth/passkeys/remove', authenticateToken, (req, res) => {
  try {
    const session = (req as any).user as SessionData;
    const { passkeyId, password } = req.body;

    if (!passkeyId || !password) {
      return res.status(400).json({ error: 'Passkey ID and current password are required.' });
    }

    const user = db.prepare('SELECT password_hash, salt FROM users WHERE id = ?').get(session.userId) as any;
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ error: 'Incorrect password. Password verification is required to remove a passkey.' });
    }

    db.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?').run(passkeyId, session.userId);
    res.json({ success: true, message: 'Passkey removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove passkey.' });
  }
});

// ------------------------------------------------------------------
// Faculty Registration Security (Requirement 2 & Test scenario 6)
// Only administrators can create faculty accounts. Public self-registration is rejected.
// ------------------------------------------------------------------
apiRouter.post('/auth/faculty-register', (req, res) => {
  try {
    const adminSecret = req.headers['x-admin-secret'] || req.body.adminSecret;
    if (adminSecret !== 'SMARTLAB_ADMIN_2026') {
      return res.status(403).json({
        error: 'Unauthorized Access: Faculty accounts must be created or approved only by an administrator. Public faculty registration is restricted.'
      });
    }

    const { fullName, facultyId, username, email, department, password, confirmPassword } = req.body;

    if (!fullName || !facultyId || !username || !email || !department || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const cleanFacId = facultyId.trim().toUpperCase();
    const cleanUsername = username.trim().toLowerCase();

    // Check uniqueness
    const existing = db.prepare('SELECT id, faculty_id, username FROM users WHERE faculty_id = ? OR username = ?').get(cleanFacId, cleanUsername) as any;
    if (existing) {
      if (existing.faculty_id === cleanFacId) {
        return res.status(400).json({ error: `Faculty ID ${cleanFacId} is already registered.` });
      }
      return res.status(400).json({ error: `Username ${cleanUsername} is already taken.` });
    }

    const { hash, salt } = hashPassword(password);
    const userId = `fac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, role, name, username, password_hash, salt, email, branch, faculty_id, status, created_at)
      VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(userId, fullName.trim(), cleanUsername, hash, salt, email.trim(), department, cleanFacId, now);

    res.json({
      success: true,
      status: 'active',
      message: 'Faculty Account created successfully with administrator authorization.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Faculty registration failed' });
  }
});

// Legacy direct faculty login (now guarded with issueSession and DB status check)
apiRouter.post('/auth/faculty-login', (req, res) => {
  try {
    const username = req.body.username || req.body.identifier;
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }

    const cleanLogin = username.trim().toLowerCase();
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE (LOWER(username) = ? OR LOWER(email) = ? OR UPPER(faculty_id) = ?) 
      AND (role = 'faculty' OR role = 'admin')
    `).get(cleanLogin, cleanLogin, cleanLogin.toUpperCase()) as any;

    if (!user) {
      return res.status(401).json({ error: 'Faculty account not found.' });
    }

    if (user.status === 'pending_approval') {
      return res.status(403).json({
        error: 'Faculty registration awaiting administrator approval. Please contact administration.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Faculty account is disabled or rejected by administration.'
      });
    }

    const passwordOk = verifyPassword(password, user.password_hash, user.salt);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const { token, sessionData } = issueSession(res, user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        facultyId: user.faculty_id,
        email: user.email,
        branch: user.branch
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Faculty login failed' });
  }
});

// Current User Profile: Verifies against SQLite database
apiRouter.get('/auth/me', authenticateToken, (req, res) => {
  const session = (req as any).user as SessionData;
  const user = db.prepare('SELECT id, role, name, username, email, branch, semester, usn, faculty_id, status FROM users WHERE id = ?').get(session.userId) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// Logout: Invalidation of sessions in database & cookie clearing (Requirement 6 & Test scenario 11)
apiRouter.post('/auth/logout', authenticateToken, (req, res) => {
  const token = (req as any).token;
  const user = (req as any).user as SessionData;

  if (token) {
    revokeSession(token);
  }

  res.clearCookie('smartlab_session');

  if (user && user.usn) {
    const now = new Date().toISOString();
    try {
      db.prepare(`
        UPDATE activity_sessions 
        SET logout_time = ?, status = 'Logged Out' 
        WHERE student_usn = ? AND logout_time IS NULL
      `).run(now, user.usn);

      db.prepare(`
        INSERT INTO activity_events (id, student_usn, event_type, details, timestamp)
        VALUES (?, ?, 'logout', 'User logged out - session invalidated', ?)
      `).run(`evt_${Date.now()}`, user.usn, now);
    } catch (e) {}
  }

  res.json({ success: true, message: 'Logged out successfully. Session invalidated.' });
});

// Faculty Approval Management (for Admin / HOD)
apiRouter.get('/auth/pending-faculty', authenticateToken, requireFaculty, (req, res) => {
  const pending = db.prepare(`
    SELECT id, name, username, email, branch, faculty_id, status, created_at 
    FROM users 
    WHERE role = 'faculty' AND status = 'pending_approval'
    ORDER BY created_at DESC
  `).all();
  res.json({ pending });
});

apiRouter.post('/auth/approve-faculty', authenticateToken, requireFaculty, (req, res) => {
  const { facultyId, action } = req.body; // action: 'approve' | 'reject'
  if (!facultyId || !action) {
    return res.status(400).json({ error: 'facultyId and action (approve/reject) required' });
  }

  const newStatus = action === 'approve' ? 'active' : 'rejected';
  db.prepare('UPDATE users SET status = ? WHERE faculty_id = ? AND role = ?').run(newStatus, facultyId, 'faculty');

  res.json({
    success: true,
    message: `Faculty account ${newStatus === 'active' ? 'Approved' : 'Rejected'} successfully.`
  });
});

// Authorized Face Re-Enrollment (Faculty / Admin utility)
apiRouter.post('/auth/re-enroll-face', authenticateToken, requireFaculty, (req, res) => {
  const { usn, faceVector, qualityScore = 95 } = req.body;
  if (!usn || !faceVector || faceVector.length !== 128) {
    return res.status(400).json({ error: 'Valid USN and 128-D face embedding vector are required' });
  }

  const cleanUsn = usn.trim().toUpperCase();
  const student = db.prepare('SELECT id, name FROM users WHERE usn = ?').get(cleanUsn);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO face_templates (id, usn, template_data, quality_score, registered_at, last_verified_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`face_${cleanUsn}`, cleanUsn, JSON.stringify(faceVector), Number(qualityScore), now, now);

  res.json({ success: true, message: `Face biometric re-enrolled successfully for USN ${cleanUsn}.` });
});

// ==========================================
// 2. ASSIGNMENTS ROUTES
// ==========================================

// Get Assignments (Filtered by role)
apiRouter.get('/assignments', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user as SessionData;

    if (user.role === 'student') {
      // Return only lab programs allocated to this student!
      const rows = db.prepare(`
        SELECT a.*, 
          COALESCE(s.status, 'Pending') as submission_status,
          s.marks_obtained,
          s.feedback,
          s.submitted_at,
          COALESCE(s.compilation_count, 0) as student_compilation_count
        FROM assignments a
        JOIN assignment_allocations alloc ON a.id = alloc.assignment_id
        LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_usn = ?
        WHERE alloc.student_usn = ? AND a.status = 'published'
        ORDER BY a.lab_number ASC, a.created_at DESC
      `).all(user.usn || '', user.usn || '') as any[];

      const assignments = rows.map(r => ({
        ...r,
        permitted_languages: JSON.parse(r.permitted_languages || '["Java"]')
      }));

      return res.json({ assignments });
    }

    // Faculty: Return assignments created by faculty or for department
    const assignments = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM assignment_allocations WHERE assignment_id = a.id) as allocated_count,
        (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) as submitted_count,
        (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id AND status = 'Evaluated') as evaluated_count
      FROM assignments a
      ORDER BY a.created_at DESC
    `).all().map((r: any) => ({
      ...r,
      permitted_languages: JSON.parse(r.permitted_languages || '["Java"]')
    }));

    res.json({ assignments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Assignment Details
apiRouter.get('/assignments/:id', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { id } = req.params;

    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as any;
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    assignment.permitted_languages = JSON.parse(assignment.permitted_languages || '["Java"]');

    if (user.role === 'student') {
      // Check allocation
      const isAllocated = db.prepare('SELECT id FROM assignment_allocations WHERE assignment_id = ? AND student_usn = ?').get(id, user.usn || '');
      if (!isAllocated) {
        return res.status(403).json({ error: 'This assignment is not assigned to you.' });
      }

      // Get student's submission if any
      const submission = db.prepare('SELECT * FROM submissions WHERE assignment_id = ? AND student_usn = ?').get(id, user.usn || '');

      return res.json({ assignment, submission });
    }

    // Faculty: include list of allocated students and submissions
    const allocations = db.prepare(`
      SELECT alloc.student_usn, u.name, u.branch, u.semester, s.status as submission_status, s.marks_obtained, s.submitted_at, s.compilation_count
      FROM assignment_allocations alloc
      JOIN users u ON alloc.student_usn = u.usn
      LEFT JOIN submissions s ON alloc.assignment_id = s.assignment_id AND alloc.student_usn = s.student_usn
      WHERE alloc.assignment_id = ?
      ORDER BY u.usn ASC
    `).all(id);

    res.json({ assignment, allocations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Lab Program (Faculty only)
apiRouter.post('/assignments', authenticateToken, requireFaculty, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const {
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
      allocationType, // 'all' | 'specific'
      selectedStudents = [], // Array of USNs
      status = 'published'
    } = req.body;

    if (!title || !subject || !labNumber || !problemStatement || !permittedLanguages || !maxMarks || !branch || !semester) {
      return res.status(400).json({ error: 'All required assignment fields must be filled.' });
    }

    const assignId = `assign_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO assignments (
        id, faculty_id, faculty_name, title, subject, lab_number, problem_statement,
        instructions, permitted_languages, max_marks, assigned_date, due_date,
        branch, semester, allocation_type, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignId,
      user.facultyId || user.userId,
      user.name,
      title.trim(),
      subject.trim(),
      Number(labNumber),
      problemStatement.trim(),
      instructions?.trim() || '',
      JSON.stringify(Array.isArray(permittedLanguages) ? permittedLanguages : [permittedLanguages]),
      Number(maxMarks),
      assignedDate || now.split('T')[0],
      dueDate || now.split('T')[0],
      branch,
      Number(semester),
      allocationType,
      status,
      now
    );

    // Allocate students
    let targetUsns: string[] = [];
    if (allocationType === 'all') {
      const branchStudents = db.prepare("SELECT usn FROM users WHERE role = 'student' AND branch = ? AND semester = ? AND status = 'active'")
        .all(branch, Number(semester)) as { usn: string }[];
      targetUsns = branchStudents.map(s => s.usn);
    } else {
      targetUsns = selectedStudents;
    }

    for (const usn of targetUsns) {
      db.prepare('INSERT OR IGNORE INTO assignment_allocations (id, assignment_id, student_usn) VALUES (?, ?, ?)')
        .run(`alloc_${assignId}_${usn}`, assignId, usn);
    }

    res.json({
      success: true,
      assignmentId: assignId,
      allocatedCount: targetUsns.length,
      message: `Lab Program "${title}" ${status === 'published' ? 'published and assigned' : 'saved as draft'} successfully.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Assignment
apiRouter.put('/assignments/:id', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { id } = req.params;
    const {
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
      selectedStudents = [],
      status
    } = req.body;

    db.prepare(`
      UPDATE assignments SET
        title = ?, subject = ?, lab_number = ?, problem_statement = ?, instructions = ?,
        permitted_languages = ?, max_marks = ?, assigned_date = ?, due_date = ?,
        branch = ?, semester = ?, allocation_type = ?, status = ?
      WHERE id = ?
    `).run(
      title,
      subject,
      Number(labNumber),
      problemStatement,
      instructions || '',
      JSON.stringify(Array.isArray(permittedLanguages) ? permittedLanguages : [permittedLanguages]),
      Number(maxMarks),
      assignedDate,
      dueDate,
      branch,
      Number(semester),
      allocationType,
      status || 'published',
      id
    );

    // Refresh allocations if requested
    if (allocationType === 'all') {
      const branchStudents = db.prepare("SELECT usn FROM users WHERE role = 'student' AND branch = ? AND semester = ? AND status = 'active'")
        .all(branch, Number(semester)) as { usn: string }[];
      for (const s of branchStudents) {
        db.prepare('INSERT OR IGNORE INTO assignment_allocations (id, assignment_id, student_usn) VALUES (?, ?, ?)').run(`alloc_${id}_${s.usn}`, id, s.usn);
      }
    } else if (selectedStudents.length > 0) {
      db.prepare('DELETE FROM assignment_allocations WHERE assignment_id = ?').run(id);
      for (const usn of selectedStudents) {
        db.prepare('INSERT INTO assignment_allocations (id, assignment_id, student_usn) VALUES (?, ?, ?)').run(`alloc_${id}_${usn}`, id, usn);
      }
    }

    res.json({ success: true, message: 'Assignment updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Assignment
apiRouter.delete('/assignments/:id', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
    db.prepare('DELETE FROM assignment_allocations WHERE assignment_id = ?').run(id);
    res.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. CODE EXECUTION & SUBMISSION WITH AUTOMATIC PENALTY CALCULATION
// ==========================================

// Get Assignment Execution Stats (Passive read: opening assignment never deducts marks or increments count)
apiRouter.get('/assignments/:id/execution-stats', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { id } = req.params;
    const studentUsn = user.role === 'student' ? user.usn : (req.query.usn as string);

    if (!studentUsn) {
      return res.status(400).json({ error: 'Student USN is required' });
    }

    const row = db.prepare(`
      SELECT total_executions, execution_penalty, last_executed_at
      FROM assignment_execution_counters
      WHERE assignment_id = ? AND student_usn = ?
    `).get(id, studentUsn) as { total_executions: number; execution_penalty: number; last_executed_at: string } | undefined;

    const totalExecutions = row ? row.total_executions : 0;
    const executionPenalty = calculateExecutionPenalty(totalExecutions);
    const remainingFreeExecutions = Math.max(0, 5 - totalExecutions);
    const nextPenaltyAt = totalExecutions < 5 ? 6 : (Math.floor((totalExecutions - 1) / 5) + 1) * 5 + 1;

    res.json({
      assignmentId: id,
      studentUsn,
      totalExecutions,
      remainingFreeExecutions,
      executionPenalty,
      freeLimit: 5,
      nextPenaltyAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run Code in Workspace
apiRouter.post('/code/run', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { language, code, stdin = '', assignmentId } = req.body;

    if (!language || !code) {
      return res.status(400).json({ error: 'Language and Code are required.' });
    }

    // Prevent rapid repeated clicks / abuse
    if (user.usn && assignmentId) {
      const execKey = `${user.usn}:${assignmentId}`;
      const now = Date.now();
      const lastTime = lastExecutionTimes.get(execKey) || 0;
      if (now - lastTime < 450) {
        return res.status(429).json({ error: 'Please wait a moment before executing code again.' });
      }
      lastExecutionTimes.set(execKey, now);
    }

    // Execute through sandbox / Judge0
    const result = await executeCode({
      language,
      code,
      stdin,
      studentUsn: user.usn,
      assignmentId
    });

    let assignmentExecution = null;

    // Backend Authoritative Execution Counter & Penalty Calculation
    if (user.usn && assignmentId) {
      const nowIso = new Date().toISOString();
      const existing = db.prepare(`
        SELECT total_executions FROM assignment_execution_counters
        WHERE assignment_id = ? AND student_usn = ?
      `).get(assignmentId, user.usn) as { total_executions: number } | undefined;

      const newExecCount = (existing?.total_executions || 0) + 1;
      const penalty = calculateExecutionPenalty(newExecCount);

      db.prepare(`
        INSERT INTO assignment_execution_counters (
          id, assignment_id, student_usn, total_executions, execution_penalty, last_executed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(assignment_id, student_usn) DO UPDATE SET
          total_executions = excluded.total_executions,
          execution_penalty = excluded.execution_penalty,
          last_executed_at = excluded.last_executed_at
      `).run(
        `cnt_${assignmentId}_${user.usn}`,
        assignmentId,
        user.usn,
        newExecCount,
        penalty,
        nowIso
      );

      // Trigger automatic performance re-evaluation
      syncPerformanceAndCounters();

      assignmentExecution = {
        totalExecutions: newExecCount,
        remainingFreeExecutions: Math.max(0, 5 - newExecCount),
        executionPenalty: penalty,
        freeLimit: 5,
        nextPenaltyAt: newExecCount < 5 ? 6 : (Math.floor((newExecCount - 1) / 5) + 1) * 5 + 1
      };
    }

    // Query exact total compilation count across all works for this student
    let totalCompilationCount = 0;
    if (user.usn) {
      const countRow = db.prepare('SELECT COUNT(*) as count FROM code_executions WHERE student_usn = ?').get(user.usn) as { count: number };
      totalCompilationCount = countRow ? countRow.count : 0;
    }

    res.json({
      ...result,
      assignmentExecution,
      studentCompilationCount: totalCompilationCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Code for an Assignment
apiRouter.post('/code/submit', authenticateToken, requireStudent, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { assignmentId, code, language, executionResult = '' } = req.body;

    if (!assignmentId || !code || !language) {
      return res.status(400).json({ error: 'Assignment ID, Code, and Language are required.' });
    }

    // Verify assignment exists
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as any;
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const studentUsn = user.usn!;

    // Verify student is allocated
    const alloc = db.prepare('SELECT id FROM assignment_allocations WHERE assignment_id = ? AND student_usn = ?').get(assignmentId, studentUsn);
    if (!alloc) {
      return res.status(403).json({ error: 'You are not assigned to this laboratory program.' });
    }

    // Get exact execution count for this assignment
    const counterRow = db.prepare(`
      SELECT total_executions, execution_penalty FROM assignment_execution_counters
      WHERE assignment_id = ? AND student_usn = ?
    `).get(assignmentId, studentUsn) as { total_executions: number; execution_penalty: number } | undefined;

    const assignmentExecutions = counterRow?.total_executions || 0;
    const executionPenalty = counterRow?.execution_penalty || 0;

    const subId = `sub_${assignmentId}_${studentUsn}`;
    const now = new Date().toISOString();
    const isLate = assignment.due_date && new Date().toISOString().split('T')[0] > assignment.due_date;

    db.prepare(`
      INSERT INTO submissions (
        id, assignment_id, student_usn, student_name, code, language,
        submitted_at, status, compilation_count, execution_result
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        language = excluded.language,
        submitted_at = excluded.submitted_at,
        status = excluded.status,
        compilation_count = excluded.compilation_count,
        execution_result = excluded.execution_result
    `).run(
      subId,
      assignmentId,
      studentUsn,
      user.name,
      code,
      language,
      now,
      isLate ? 'Late' : 'Submitted',
      assignmentExecutions,
      executionResult
    );

    // Record activity event
    db.prepare(`
      INSERT INTO activity_events (id, student_usn, event_type, details, timestamp)
      VALUES (?, ?, 'submission', ?, ?)
    `).run(
      `evt_${Date.now()}`,
      studentUsn,
      JSON.stringify({ assignmentId, title: assignment.title, language }),
      now
    );

    // Sync automatic performance evaluations
    syncPerformanceAndCounters();

    res.json({
      success: true,
      submissionId: subId,
      status: isLate ? 'Late' : 'Submitted',
      submittedAt: now,
      compilationCount: assignmentExecutions,
      executionPenalty,
      message: 'Assignment submitted successfully. Automatic performance updated.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Faculty: View all submissions for an assignment
apiRouter.get('/submissions/assignment/:id', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { id } = req.params;
    const submissions = db.prepare(`
      SELECT s.*, u.branch, u.semester
      FROM submissions s
      JOIN users u ON s.student_usn = u.usn
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `).all(id);

    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty: Evaluate a submission
apiRouter.post('/submissions/:id/evaluate', authenticateToken, requireFaculty, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { id } = req.params;
    const { marksObtained, feedback } = req.body;

    if (marksObtained === undefined || marksObtained === null) {
      return res.status(400).json({ error: 'Marks obtained is required.' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE submissions SET
        marks_obtained = ?,
        feedback = ?,
        status = 'Evaluated',
        evaluated_at = ?,
        evaluated_by = ?
      WHERE id = ?
    `).run(
      Number(marksObtained),
      feedback?.trim() || '',
      now,
      user.name,
      id
    );

    res.json({
      success: true,
      message: 'Submission evaluated and marks awarded successfully.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. QUIZ MANAGEMENT & TAKING
// ==========================================

// Get Quizzes
apiRouter.get('/quizzes', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user as SessionData;

    if (user.role === 'student') {
      const rows = db.prepare(`
        SELECT q.id, q.title, q.instructions, q.branch, q.semester, q.total_marks,
               q.marks_per_question, q.duration_minutes, q.start_time, q.end_time,
               q.status, q.faculty_name,
               qa.id as attempt_id, qa.score, qa.submitted_at as attempted_at
        FROM quizzes q
        JOIN quiz_allocations alloc ON q.id = alloc.quiz_id
        LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_usn = ?
        WHERE alloc.student_usn = ? AND q.status = 'published'
        ORDER BY q.created_at DESC
      `).all(user.usn || '', user.usn || '');

      return res.json({ quizzes: rows });
    }

    // Faculty: view created quizzes
    const quizzes = db.prepare(`
      SELECT q.*,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as question_count,
        (SELECT COUNT(*) FROM quiz_allocations WHERE quiz_id = q.id) as allocated_count,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempt_count
      FROM quizzes q
      ORDER BY q.created_at DESC
    `).all();

    res.json({ quizzes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Quiz
apiRouter.get('/quizzes/:id', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { id } = req.params;

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as any;
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsRaw = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_num ASC').all(id) as any[];

    if (user.role === 'student') {
      // Check allocation
      const isAllocated = db.prepare('SELECT id FROM quiz_allocations WHERE quiz_id = ? AND student_usn = ?').get(id, user.usn || '');
      if (!isAllocated) {
        return res.status(403).json({ error: 'This quiz is not assigned to you.' });
      }

      // Check existing attempt
      const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_usn = ?').get(id, user.usn || '') as any;

      if (attempt) {
        // If already submitted, reveal results
        const questions = questionsRaw.map(q => ({
          ...q,
          options: JSON.parse(q.options)
        }));
        return res.json({
          quiz,
          questions,
          attempt: {
            ...attempt,
            answers: JSON.parse(attempt.answers)
          }
        });
      }

      // Student taking quiz: DO NOT REVEAL correct answers!
      const sanitizedQuestions = questionsRaw.map(q => ({
        id: q.id,
        quiz_id: q.quiz_id,
        question_text: q.question_text,
        options: JSON.parse(q.options),
        marks: q.marks,
        order_num: q.order_num
      }));

      return res.json({ quiz, questions: sanitizedQuestions, attempt: null });
    }

    // Faculty: include correct answers and student attempts
    const questions = questionsRaw.map(q => ({
      ...q,
      options: JSON.parse(q.options)
    }));
    const attempts = db.prepare(`
      SELECT qa.*, u.branch, u.semester
      FROM quiz_attempts qa
      JOIN users u ON qa.student_usn = u.usn
      WHERE qa.quiz_id = ?
      ORDER BY qa.submitted_at DESC
    `).all(id);

    res.json({ quiz, questions, attempts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty: Create Quiz
apiRouter.post('/quizzes', authenticateToken, requireFaculty, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const {
      title,
      instructions,
      branch,
      semester,
      allocationType,
      selectedStudents = [],
      totalMarks, // 10, 15, or 20
      durationMinutes,
      startTime,
      endTime,
      questions = []
    } = req.body;

    if (!title || !branch || !semester || !totalMarks || questions.length === 0) {
      return res.status(400).json({ error: 'Title, branch, semester, total marks, and questions are required.' });
    }

    const validMarks = [10, 15, 20];
    if (!validMarks.includes(Number(totalMarks))) {
      return res.status(400).json({ error: 'Total marks must be either 10, 15, or 20.' });
    }

    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const marksPerQ = Math.round(Number(totalMarks) / questions.length) || 1;

    db.prepare(`
      INSERT INTO quizzes (
        id, faculty_id, faculty_name, title, instructions, branch, semester,
        allocation_type, total_marks, marks_per_question, duration_minutes,
        start_time, end_time, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
    `).run(
      quizId,
      user.facultyId || user.userId,
      user.name,
      title.trim(),
      instructions?.trim() || '',
      branch,
      Number(semester),
      allocationType,
      Number(totalMarks),
      marksPerQ,
      Number(durationMinutes || 20),
      startTime || now,
      endTime || new Date(Date.now() + 86400000 * 7).toISOString(),
      now
    );

    // Insert Questions
    questions.forEach((q: any, idx: number) => {
      db.prepare(`
        INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer, marks, order_num)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `q_${quizId}_${idx + 1}`,
        quizId,
        q.questionText.trim(),
        JSON.stringify(q.options),
        q.correctAnswer.trim(),
        q.marks || marksPerQ,
        idx + 1
      );
    });

    // Allocations
    let targetUsns: string[] = [];
    if (allocationType === 'all') {
      const branchStudents = db.prepare("SELECT usn FROM users WHERE role = 'student' AND branch = ? AND semester = ? AND status = 'active'")
        .all(branch, Number(semester)) as { usn: string }[];
      targetUsns = branchStudents.map(s => s.usn);
    } else {
      targetUsns = selectedStudents;
    }

    for (const usn of targetUsns) {
      db.prepare('INSERT OR IGNORE INTO quiz_allocations (id, quiz_id, student_usn) VALUES (?, ?, ?)')
        .run(`qalloc_${quizId}_${usn}`, quizId, usn);
    }

    res.json({
      success: true,
      quizId,
      message: `Quiz "${title}" published and assigned to ${targetUsns.length} students.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Student: Submit Quiz
apiRouter.post('/quizzes/:id/submit', authenticateToken, requireStudent, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const { id } = req.params;
    const { answers } = req.body; // map: { [questionId]: selectedOption }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Submitted answers object is required.' });
    }

    const studentUsn = user.usn!;

    // Check if already attempted
    const existing = db.prepare('SELECT id FROM quiz_attempts WHERE quiz_id = ? AND student_usn = ?').get(id, studentUsn);
    if (existing) {
      return res.status(400).json({ error: 'You have already submitted this quiz. Multiple attempts are not permitted.' });
    }

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as any;
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(id) as any[];
    let totalScore = 0;

    for (const q of questions) {
      const studentAnswer = answers[q.id];
      if (studentAnswer && studentAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
        totalScore += q.marks;
      }
    }

    const attemptId = `att_${id}_${studentUsn}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO quiz_attempts (id, quiz_id, student_usn, student_name, answers, score, total_marks, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId,
      id,
      studentUsn,
      user.name,
      JSON.stringify(answers),
      totalScore,
      quiz.total_marks,
      now
    );

    res.json({
      success: true,
      attemptId,
      score: totalScore,
      totalMarks: quiz.total_marks,
      submittedAt: now,
      message: `Quiz submitted successfully! You scored ${totalScore} out of ${quiz.total_marks} marks.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. MONITORING & ACTIVITY TRACKING
// ==========================================

// Periodic Heartbeat from student client
apiRouter.post('/monitoring/heartbeat', authenticateToken, requireStudent, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const studentUsn = user.usn!;
    const { activeSeconds = 30, idleSeconds = 0, isCurrentlyIdle = false } = req.body;

    const now = new Date().toISOString();
    const status = isCurrentlyIdle ? 'Idle' : 'Active';

    // Find active session
    const session = db.prepare(`
      SELECT id, active_seconds, idle_seconds 
      FROM activity_sessions 
      WHERE student_usn = ? AND logout_time IS NULL 
      ORDER BY login_time DESC LIMIT 1
    `).get(studentUsn) as any;

    if (session) {
      db.prepare(`
        UPDATE activity_sessions SET
          last_heartbeat = ?,
          active_seconds = active_seconds + ?,
          idle_seconds = idle_seconds + ?,
          status = ?
        WHERE id = ?
      `).run(now, Number(activeSeconds), Number(idleSeconds), status, session.id);
    } else {
      // Create new session if missing
      const sessId = `sess_${studentUsn}_${Date.now()}`;
      db.prepare(`
        INSERT INTO activity_sessions (id, student_usn, student_name, login_time, last_heartbeat, active_seconds, idle_seconds, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sessId, studentUsn, user.name, now, now, Number(activeSeconds), Number(idleSeconds), status);
    }

    res.json({ success: true, timestamp: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Monaco Editor Paste Event Logger
apiRouter.post('/monitoring/paste', authenticateToken, requireStudent, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const studentUsn = user.usn!;
    const { assignmentId, characterCount, snippet = '' } = req.body;

    const isSuspicious = characterCount > 150 ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO paste_events (id, student_usn, assignment_id, character_count, pasted_snippet, flagged_suspicious, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `paste_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentUsn,
      assignmentId || null,
      Number(characterCount || 0),
      snippet.substring(0, 300),
      isSuspicious,
      now
    );

    // Also record an activity event
    db.prepare(`
      INSERT INTO activity_events (id, student_usn, event_type, details, timestamp)
      VALUES (?, ?, 'paste', ?, ?)
    `).run(
      `evt_${Date.now()}`,
      studentUsn,
      JSON.stringify({ characterCount, isSuspicious, assignmentId }),
      now
    );

    res.json({ success: true, recorded: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty Live Monitoring View
apiRouter.get('/monitoring/live', authenticateToken, requireFaculty, (req, res) => {
  try {
    const students = db.prepare(`
      SELECT u.usn, u.name, u.branch, u.semester,
        s.id as session_id, s.login_time, s.last_heartbeat, s.status, s.active_seconds, s.idle_seconds,
        (SELECT COUNT(*) FROM code_executions WHERE student_usn = u.usn) as total_compilations,
        (SELECT COUNT(*) FROM paste_events WHERE student_usn = u.usn) as paste_count
      FROM users u
      LEFT JOIN activity_sessions s ON u.usn = s.student_usn AND s.logout_time IS NULL
      WHERE u.role = 'student'
      ORDER BY u.branch, u.semester, u.usn
    `).all() as any[];

    // Calculate real-time status based on last heartbeat
    const now = Date.now();
    const liveStudents = students.map(st => {
      let liveStatus = 'Logged Out';
      if (st.session_id) {
        const lastHb = new Date(st.last_heartbeat).getTime();
        const diffSeconds = (now - lastHb) / 1000;
        if (diffSeconds > 180) {
          liveStatus = 'Disconnected';
        } else if (st.status === 'Idle' || diffSeconds > 120) {
          liveStatus = 'Idle';
        } else {
          liveStatus = 'Active';
        }
      }
      return {
        ...st,
        liveStatus
      };
    });

    res.json({ students: liveStudents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty Activity History View
apiRouter.get('/monitoring/history', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { usn } = req.query;

    let sessionsQuery = `
      SELECT s.*, u.name as student_name, u.branch, u.semester
      FROM activity_sessions s
      JOIN users u ON s.student_usn = u.usn
    `;
    const params: any[] = [];
    if (usn) {
      sessionsQuery += ` WHERE s.student_usn = ?`;
      params.push(usn);
    }
    sessionsQuery += ` ORDER BY s.login_time DESC LIMIT 50`;

    const sessions = db.prepare(sessionsQuery).all(...params);

    const pasteEventsQuery = `
      SELECT p.*, u.name as student_name, a.title as assignment_title
      FROM paste_events p
      JOIN users u ON p.student_usn = u.usn
      LEFT JOIN assignments a ON p.assignment_id = a.id
      ${usn ? 'WHERE p.student_usn = ?' : ''}
      ORDER BY p.timestamp DESC LIMIT 50
    `;
    const pasteEvents = db.prepare(pasteEventsQuery).all(...params);

    res.json({ sessions, pasteEvents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. STUDENT DIRECTORY & PROGRESS
// ==========================================

// Faculty: Student Enrollment Directory
apiRouter.get('/students', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { branch, semester, search } = req.query;

    let query = `
      SELECT u.id, u.name, u.usn, u.username, u.email, u.branch, u.semester, u.status, u.created_at,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as face_enrolled,
        (SELECT COUNT(*) FROM code_executions WHERE student_usn = u.usn) as total_compilations,
        (SELECT COUNT(*) FROM assignment_allocations WHERE student_usn = u.usn) as assigned_assignments,
        (SELECT COUNT(*) FROM submissions WHERE student_usn = u.usn) as submitted_assignments,
        (SELECT COUNT(*) FROM submissions WHERE student_usn = u.usn AND status = 'Evaluated') as evaluated_assignments
      FROM users u
      LEFT JOIN face_templates f ON u.usn = f.usn
      WHERE u.role = 'student'
    `;
    const params: any[] = [];

    if (branch && branch !== 'all') {
      query += ` AND u.branch = ?`;
      params.push(branch);
    }
    if (semester && semester !== 'all') {
      query += ` AND u.semester = ?`;
      params.push(Number(semester));
    }
    if (search) {
      query += ` AND (LOWER(u.name) LIKE ? OR UPPER(u.usn) LIKE ? OR LOWER(u.username) LIKE ?)`;
      const s = `%${String(search).toLowerCase()}%`;
      params.push(s, s.toUpperCase(), s);
    }

    query += ` ORDER BY u.branch, u.semester, u.usn`;

    const students = db.prepare(query).all(...params);
    res.json({ students });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Student Progress & Performance Summary (Simplified strictly to 3 core sections: Labs, Workspace, Progress)
apiRouter.get('/students/my-progress', authenticateToken, requireStudent, (req, res) => {
  try {
    const user = (req as any).user as SessionData;
    const studentUsn = user.usn!;

    // Ensure performance evaluations and counters are in sync
    syncPerformanceAndCounters();

    // 1. Fetch allocated assignments for this student
    const allocatedAssignments = db.prepare(`
      SELECT a.id, a.title, a.subject, a.lab_number, a.due_date, a.max_marks, a.permitted_languages
      FROM assignment_allocations aa
      JOIN assignments a ON aa.assignment_id = a.id
      WHERE aa.student_usn = ?
      ORDER BY a.lab_number ASC
    `).all(studentUsn) as any[];

    const totalAssigned = allocatedAssignments.length;

    // 2. Query execution counters, submissions, and evaluations
    const counters = db.prepare(`
      SELECT assignment_id, total_executions, execution_penalty, last_executed_at
      FROM assignment_execution_counters
      WHERE student_usn = ?
    `).all(studentUsn) as any[];
    const countersMap = new Map<string, any>(counters.map(c => [c.assignment_id, c]));

    const submissions = db.prepare(`
      SELECT * FROM submissions WHERE student_usn = ?
    `).all(studentUsn) as any[];
    const subsMap = new Map<string, any>(submissions.map(s => [s.assignment_id, s]));

    const evaluations = db.prepare(`
      SELECT * FROM student_performance_evaluations WHERE student_usn = ?
    `).all(studentUsn) as any[];
    const evalsMap = new Map<string, any>(evaluations.map(e => [e.assignment_id, e]));

    let completedCount = 0;
    let pendingCount = 0;
    let totalScoreSum = 0;
    let totalExecutionsSum = 0;
    let totalPenaltySum = 0;

    const assignmentItems = allocatedAssignments.map(a => {
      const counter = countersMap.get(a.id);
      const sub = subsMap.get(a.id);
      const ev = evalsMap.get(a.id);

      const totalExec = counter?.total_executions || 0;
      const penalty = counter?.execution_penalty || calculateExecutionPenalty(totalExec);
      totalExecutionsSum += totalExec;
      totalPenaltySum += penalty;

      let status = 'Pending';
      if (sub) {
        status = 'Submitted';
        completedCount++;
      } else if (totalExec > 0) {
        status = 'In Progress';
        pendingCount++;
      } else {
        pendingCount++;
      }

      const finalScore = ev ? ev.final_score : (status === 'Submitted' ? 85 : 0);
      totalScoreSum += finalScore;

      return {
        assignmentId: a.id,
        labNumber: a.lab_number,
        title: a.title,
        subject: a.subject,
        dueDate: a.due_date,
        maxMarks: a.max_marks,
        status,
        totalExecutions: totalExec,
        remainingFreeExecutions: Math.max(0, 5 - totalExec),
        executionPenalty: penalty,
        evaluation: ev ? {
          codeCorrectnessMarks: ev.code_correctness_marks,
          completionMarks: ev.completion_marks,
          activityEffortMarks: ev.activity_effort_marks,
          timelySubmissionMarks: ev.timely_submission_marks,
          originalityMarks: ev.originality_marks,
          baseScore: ev.base_score,
          executionPenalty: ev.execution_penalty,
          finalScore: ev.final_score
        } : null,
        submission: sub ? {
          submittedAt: sub.submitted_at,
          language: sub.language,
          marksObtained: sub.marks_obtained,
          feedback: sub.feedback,
          status: sub.status,
          compilationCount: sub.compilation_count,
          executionResult: sub.execution_result
        } : null
      };
    });

    const overallPerformance = totalAssigned > 0 ? Math.round(totalScoreSum / totalAssigned) : 0;

    res.json({
      student: {
        name: user.name,
        usn: user.usn,
        branch: user.branch,
        semester: user.semester
      },
      metrics: {
        totalAssigned,
        completedCount,
        pendingCount,
        overallPerformance,
        totalExecutions: totalExecutionsSum,
        totalPenaltyDeducted: totalPenaltySum
      },
      assignments: assignmentItems
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. FACULTY AUTOMATIC PERFORMANCE ANALYSIS
// ==========================================

// Faculty: Comprehensive Automatic Performance Overview (Requirement 4A & 4B)
apiRouter.get('/faculty/performance-overview', authenticateToken, requireFaculty, (req, res) => {
  try {
    // Ensure all tables are synced
    syncPerformanceAndCounters();

    // 1. All registered students with performance metrics
    const studentUsers = db.prepare(`
      SELECT u.id, u.name, u.usn, u.branch, u.semester, u.email, u.created_at
      FROM users u
      WHERE u.role = 'student'
      ORDER BY u.usn ASC
    `).all() as any[];

    const students = studentUsers.map(st => {
      // Get allocations count
      const allocRow = db.prepare('SELECT COUNT(*) as count FROM assignment_allocations WHERE student_usn = ?').get(st.usn) as { count: number };
      const assignedCount = allocRow?.count || 0;

      // Get evaluations
      const evals = db.prepare('SELECT * FROM student_performance_evaluations WHERE student_usn = ?').all(st.usn) as any[];
      const completedCount = evals.filter(e => e.status === 'Submitted').length;
      const completionPercentage = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;

      const totalExecutions = evals.reduce((sum, e) => sum + (e.execution_count || 0), 0);
      const totalPenalty = evals.reduce((sum, e) => sum + (e.execution_penalty || 0), 0);
      const avgCorrectness = evals.length > 0 ? Math.round(evals.reduce((sum, e) => sum + (e.code_correctness_marks || 0), 0) / evals.length) : 0;
      const avgFinalScore = evals.length > 0 ? Math.round(evals.reduce((sum, e) => sum + (e.final_score || 0), 0) / evals.length) : 0;

      // Activity time
      const actRow = db.prepare('SELECT SUM(active_seconds) as total_active, SUM(idle_seconds) as total_idle FROM activity_sessions WHERE student_usn = ?').get(st.usn) as any;
      const activeSeconds = actRow?.total_active || 0;
      const idleSeconds = actRow?.total_idle || 0;

      // Latest submission timestamp
      const subRow = db.prepare('SELECT MAX(submitted_at) as last_sub FROM submissions WHERE student_usn = ?').get(st.usn) as any;
      const latestSubmissionTime = subRow?.last_sub || null;

      return {
        name: st.name,
        usn: st.usn,
        branch: st.branch,
        semester: st.semester,
        assignedCount,
        completedCount,
        completionPercentage,
        codeCorrectnessMarks: avgCorrectness,
        totalExecutions,
        executionPenaltyMarksDeducted: totalPenalty,
        activeSeconds,
        idleSeconds,
        submissionTimestamp: latestSubmissionTime,
        finalCalculatedMarks: avgFinalScore,
        evaluations: evals
      };
    });

    // 2. All Published Lab Programs Monitoring (Requirement 4B)
    const assignmentsList = db.prepare(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM assignment_allocations WHERE assignment_id = a.id) as allocated_count,
        (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) as submitted_count
      FROM assignments a
      ORDER BY a.lab_number ASC
    `).all() as any[];

    const assignmentsMonitoring = assignmentsList.map(a => {
      const allocatedCount = a.allocated_count || 0;
      const submittedCount = a.submitted_count || 0;
      const pendingCount = Math.max(0, allocatedCount - submittedCount);

      // Student details for this assignment
      const studentDetails = db.prepare(`
        SELECT aa.student_usn, u.name as student_name,
               ec.total_executions, ec.execution_penalty,
               s.status as submission_status, s.submitted_at, s.marks_obtained, s.execution_result, s.code, s.language,
               spe.code_correctness_marks, spe.completion_marks, spe.activity_effort_marks,
               spe.timely_submission_marks, spe.originality_marks, spe.base_score, spe.final_score
        FROM assignment_allocations aa
        JOIN users u ON aa.student_usn = u.usn
        LEFT JOIN assignment_execution_counters ec ON aa.assignment_id = ec.assignment_id AND aa.student_usn = ec.student_usn
        LEFT JOIN submissions s ON aa.assignment_id = s.assignment_id AND aa.student_usn = s.student_usn
        LEFT JOIN student_performance_evaluations spe ON aa.assignment_id = spe.assignment_id AND aa.student_usn = spe.student_usn
        WHERE aa.assignment_id = ?
        ORDER BY aa.student_usn ASC
      `).all(a.id);

      return {
        id: a.id,
        labNumber: a.lab_number,
        title: a.title,
        subject: a.subject,
        dueDate: a.due_date,
        maxMarks: a.max_marks,
        allocatedCount,
        submittedCount,
        pendingCount,
        studentDetails
      };
    });

    res.json({
      students,
      assignmentsMonitoring
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Faculty: Individual Student Performance Report by USN (Requirement 4C)
apiRouter.get('/faculty/student-report/:usn', authenticateToken, requireFaculty, (req, res) => {
  try {
    const { usn } = req.params;
    const cleanUsn = usn.trim().toUpperCase();

    syncPerformanceAndCounters();

    const student = db.prepare(`
      SELECT id, name, usn, username, email, branch, semester, created_at
      FROM users
      WHERE usn = ? AND role = 'student'
    `).get(cleanUsn) as any;

    if (!student) {
      return res.status(404).json({ error: `Student with USN ${cleanUsn} not found.` });
    }

    // 1. Detailed assignment-wise marks breakdown
    const assignmentEvaluations = db.prepare(`
      SELECT spe.*, a.lab_number, a.title, a.subject, a.due_date, a.max_marks,
             s.submitted_at, s.status as submission_status, s.marks_obtained as faculty_marks, s.feedback as faculty_feedback,
             s.language, s.execution_result
      FROM student_performance_evaluations spe
      JOIN assignments a ON spe.assignment_id = a.id
      LEFT JOIN submissions s ON spe.assignment_id = s.assignment_id AND spe.student_usn = s.student_usn
      WHERE spe.student_usn = ?
      ORDER BY a.lab_number ASC
    `).all(cleanUsn) as any[];

    // 2. Activity time
    const actRow = db.prepare(`
      SELECT SUM(active_seconds) as total_active, SUM(idle_seconds) as total_idle
      FROM activity_sessions WHERE student_usn = ?
    `).get(cleanUsn) as any;
    const totalActiveSeconds = actRow?.total_active || 0;
    const totalIdleSeconds = actRow?.total_idle || 0;

    // 3. Copy-Paste events log
    const pasteLogs = db.prepare(`
      SELECT p.*, a.title as assignment_title, a.lab_number
      FROM paste_events p
      LEFT JOIN assignments a ON p.assignment_id = a.id
      WHERE p.student_usn = ?
      ORDER BY p.timestamp DESC
    `).all(cleanUsn) as any[];

    // 4. Complete submission history
    const submissionHistory = db.prepare(`
      SELECT s.*, a.title as assignment_title, a.lab_number
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.student_usn = ?
      ORDER BY s.submitted_at DESC
    `).all(cleanUsn) as any[];

    // 5. Code execution logs
    const executionLogs = db.prepare(`
      SELECT ce.*, a.title as assignment_title, a.lab_number
      FROM code_executions ce
      LEFT JOIN assignments a ON ce.assignment_id = a.id
      WHERE ce.student_usn = ?
      ORDER BY ce.created_at DESC
      LIMIT 30
    `).all(cleanUsn) as any[];

    // Summary calculation
    const totalExecutions = assignmentEvaluations.reduce((acc, ev) => acc + (ev.execution_count || 0), 0);
    const totalPenalty = assignmentEvaluations.reduce((acc, ev) => acc + (ev.execution_penalty || 0), 0);
    const overallScore = assignmentEvaluations.length > 0 
      ? Math.round(assignmentEvaluations.reduce((acc, ev) => acc + (ev.final_score || 0), 0) / assignmentEvaluations.length)
      : 0;

    res.json({
      student,
      overall: {
        overallScore,
        totalAssignments: assignmentEvaluations.length,
        completedAssignments: assignmentEvaluations.filter(e => e.status === 'Submitted').length,
        totalExecutions,
        totalPenaltyDeducted: totalPenalty,
        totalActiveSeconds,
        totalIdleSeconds,
        suspiciousPastesCount: pasteLogs.filter(p => p.flagged_suspicious).length
      },
      assignmentEvaluations,
      pasteLogs,
      submissionHistory,
      executionLogs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Judge0 Configuration management
apiRouter.get('/system/judge0', authenticateToken, requireFaculty, (req, res) => {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get('judge0_config') as any;
  const config = row ? JSON.parse(row.value) : { endpoint: '', apiKey: '', useBuiltinFallback: true };
  res.json({ config: { ...config, apiKey: config.apiKey ? '••••••••' : '' } });
});

apiRouter.post('/system/judge0', authenticateToken, requireFaculty, (req, res) => {
  const { endpoint, apiKey, useBuiltinFallback } = req.body;
  const existingRow = db.prepare('SELECT value FROM system_config WHERE key = ?').get('judge0_config') as any;
  const current = existingRow ? JSON.parse(existingRow.value) : {};

  const updated = {
    endpoint: endpoint || current.endpoint || 'https://judge0-ce.p.rapidapi.com',
    apiKey: apiKey !== undefined ? (apiKey === '••••••••' ? current.apiKey : apiKey) : current.apiKey,
    useBuiltinFallback: useBuiltinFallback !== undefined ? useBuiltinFallback : true
  };

  db.prepare('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)').run('judge0_config', JSON.stringify(updated));
  res.json({ success: true, message: 'Judge0 configuration updated.' });
});
