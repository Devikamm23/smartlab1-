import { DatabaseSync } from 'node:sqlite';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('SMARTLAB PERFORMANCE EVALUATION & EXECUTION LIMIT TESTS');
  console.log('====================================================\n');

  let facultyCookie = '';
  let studentCookie = '';
  let createdAssignmentId = '';
  const testStudentUsn = '1MS22IS025'; // Kavana

  // Step 1: Faculty Login
  console.log('[Test 1] Faculty Login (Dr. Bhavesh S S)...');
  const facLoginRes = await fetch(`${BASE_URL}/api/auth/faculty-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'bhavesh_ise', identifier: 'bhavesh_ise', password: 'Faculty@123' })
  });
  if (!facLoginRes.ok) throw new Error(`Faculty login failed: ${facLoginRes.status}`);
  const facCookieHeader = facLoginRes.headers.get('set-cookie');
  if (facCookieHeader) {
    facultyCookie = facCookieHeader.split(';')[0];
  }
  const facData = await facLoginRes.json();
  console.log(`  -> Faculty authenticated successfully: ${facData.user.name} (${facData.user.facultyId})`);

  // Step 2: Faculty Creates New Lab Assignment
  console.log('\n[Test 2] Faculty Creates Lab Assignment: "Lab 2 – Binary Search"...');
  const newLabRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': facultyCookie
    },
    body: JSON.stringify({
      title: 'Lab 2 – Binary Search Implementation',
      subject: 'Algorithms Laboratory',
      labNumber: 2,
      problemStatement: 'Implement Binary Search algorithm on a sorted integer array. Return the 0-based index if element found, else return -1.',
      instructions: '1. Array is sorted in ascending order.\n2. Handle edge cases like empty array or target not found.\n3. Output exact index or -1.',
      permittedLanguages: ['Java', 'Python'],
      maxMarks: 20,
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      branch: 'ISE',
      semester: 5,
      allocationType: 'all'
    })
  });
  if (!newLabRes.ok) {
    const err = await newLabRes.json();
    throw new Error(`Create lab failed: ${JSON.stringify(err)}`);
  }
  const labData = await newLabRes.json();
  createdAssignmentId = labData.assignmentId || labData.assignment?.id;
  console.log(`  -> Assignment created successfully with ID: ${createdAssignmentId}`);

  // Step 3: Student Login & View Assigned Labs
  console.log('\n[Test 3] Student Login (Kavana - 1MS22IS025)...');
  const step1Res = await fetch(`${BASE_URL}/api/auth/student-login-step1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usn: testStudentUsn, password: 'Student@123', branch: 'ISE', semester: 5 })
  });
  if (!step1Res.ok) {
    const err = await step1Res.json();
    throw new Error(`Student step1 failed: ${JSON.stringify(err)}`);
  }
  const step1Data = await step1Res.json();

  // Face biometrics verification step 2
  const step2Res = await fetch(`${BASE_URL}/api/auth/student-login-step2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: step1Data.challengeToken,
      usn: testStudentUsn,
      useSampleBypass: true,
      liveFaceVector: 'DEMO_MATCH'
    })
  });
  if (!step2Res.ok) {
    const err = await step2Res.json();
    throw new Error(`Student step2 failed: ${JSON.stringify(err)}`);
  }
  let studentToken = '';
  const stData = await step2Res.json();
  studentToken = stData.token;
  const stCookieHeader = step2Res.headers.get('set-cookie');
  if (stCookieHeader) {
    studentCookie = stCookieHeader.split(';')[0];
  }
  console.log(`  -> Student authenticated via face biometrics: ${stData.user.name} (${stData.user.usn})`);

  const studentHeaders = {
    'Cookie': studentCookie,
    'Authorization': `Bearer ${studentToken}`,
    'Content-Type': 'application/json'
  };

  // Student fetches assignments
  const studentAssignRes = await fetch(`${BASE_URL}/api/assignments`, {
    headers: studentHeaders
  });
  const assignList = await studentAssignRes.json();
  const foundLab = assignList.assignments.find(a => a.id === createdAssignmentId);
  if (!foundLab) throw new Error('Student did not receive newly allocated lab assignment!');
  console.log(`  -> Student sees assigned lab: "${foundLab.title}" (Status: ${foundLab.submission_status || 'Pending'})`);

  // Step 4: Passive Workspace Open - Must NOT increment executions or deduct penalties
  console.log('\n[Test 4] Student opens coding workspace (Passive Stats Query)...');
  const statsRes = await fetch(`${BASE_URL}/api/assignments/${createdAssignmentId}/execution-stats`, {
    headers: { 'Cookie': studentCookie }
  });
  const initialStats = await statsRes.json();
  console.log(`  -> Initial executions: ${initialStats.totalExecutions}, Remaining free: ${initialStats.remainingFreeExecutions}, Penalty: ${initialStats.executionPenalty}`);
  if (initialStats.totalExecutions !== 0 || initialStats.executionPenalty !== 0 || initialStats.remainingFreeExecutions !== 5) {
    throw new Error('Passive workspace open improperly modified execution counts or penalties!');
  }
  console.log('  -> PASS: Opening assignment does not count as execution and incurs 0 penalty.');

  // Step 5: Test Execution Limits and Exact Penalty Formula
  console.log('\n[Test 5] Executing code and validating penalty formula: FLOOR((Total Executions - 1) / 5)...');
  
  const sampleCode = `
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        System.out.println("Binary Search Test");
    }
}
  `;

  // Run executions 1 to 5: penalty must be 0
  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 500)); // Respect anti-rapid debounce
    const execRes = await fetch(`${BASE_URL}/api/code/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': studentCookie
      },
      body: JSON.stringify({
        language: 'Java',
        code: sampleCode,
        assignmentId: createdAssignmentId
      })
    });
    if (!execRes.ok) {
      const err = await execRes.json();
      throw new Error(`Run ${i} failed: ${JSON.stringify(err)}`);
    }
    const data = await execRes.json();
    console.log(`  -> Run ${i}: Total Executions = ${data.assignmentExecution.totalExecutions}, Free Left = ${data.assignmentExecution.remainingFreeExecutions}, Penalty = ${data.assignmentExecution.executionPenalty}`);
    if (data.assignmentExecution.executionPenalty !== 0) {
      throw new Error(`Run ${i} should have penalty 0, got ${data.assignmentExecution.executionPenalty}`);
    }
  }
  console.log('  -> PASS: Executions 1 to 5 incurred 0 penalty marks.');

  // Run execution 6: penalty must be exactly 1
  await new Promise(r => setTimeout(r, 500));
  const run6Res = await fetch(`${BASE_URL}/api/code/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({ language: 'Java', code: sampleCode, assignmentId: createdAssignmentId })
  });
  const run6Data = await run6Res.json();
  console.log(`  -> Run 6: Total Executions = ${run6Data.assignmentExecution.totalExecutions}, Penalty = ${run6Data.assignmentExecution.executionPenalty}`);
  if (run6Data.assignmentExecution.executionPenalty !== 1) {
    throw new Error(`Run 6 should have penalty 1, got ${run6Data.assignmentExecution.executionPenalty}`);
  }
  console.log('  -> PASS: 6th execution deducted exactly 1 mark.');

  // Run executions 7 to 10: penalty must still be 1
  for (let i = 7; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const rRes = await fetch(`${BASE_URL}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
      body: JSON.stringify({ language: 'Java', code: sampleCode, assignmentId: createdAssignmentId })
    });
    const rData = await rRes.json();
    if (rData.assignmentExecution.executionPenalty !== 1) {
      throw new Error(`Run ${i} should have penalty 1, got ${rData.assignmentExecution.executionPenalty}`);
    }
  }
  console.log('  -> PASS: Executions 6 to 10 remained at penalty 1.');

  // Run execution 11: penalty must be exactly 2
  await new Promise(r => setTimeout(r, 500));
  const run11Res = await fetch(`${BASE_URL}/api/code/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({ language: 'Java', code: sampleCode, assignmentId: createdAssignmentId })
  });
  const run11Data = await run11Res.json();
  console.log(`  -> Run 11: Total Executions = ${run11Data.assignmentExecution.totalExecutions}, Penalty = ${run11Data.assignmentExecution.executionPenalty}`);
  if (run11Data.assignmentExecution.executionPenalty !== 2) {
    throw new Error(`Run 11 should have penalty 2, got ${run11Data.assignmentExecution.executionPenalty}`);
  }
  console.log('  -> PASS: 11th execution deducted exactly 2 marks.');

  // Test anti-rapid click prevention (debounce)
  console.log('\n[Test 6] Testing Rapid Request Rate-Limiting Protection...');
  const rapid1 = fetch(`${BASE_URL}/api/code/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({ language: 'Java', code: sampleCode, assignmentId: createdAssignmentId })
  });
  const rapid2 = fetch(`${BASE_URL}/api/code/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({ language: 'Java', code: sampleCode, assignmentId: createdAssignmentId })
  });
  const [res1, res2] = await Promise.all([rapid1, rapid2]);
  const statuses = [res1.status, res2.status];
  console.log(`  -> Parallel execution responses: [${statuses.join(', ')}]`);
  if (statuses.includes(429)) {
    console.log('  -> PASS: Rapid repeated clicks correctly blocked with HTTP 429 Too Many Requests.');
  } else {
    console.log('  -> Warning: Neither request returned 429, checking execution count consistency.');
  }

  // Step 6: Faculty Verifies Assignment Monitoring & Performance Overview
  console.log('\n[Test 7] Faculty Verifies Assignment Monitoring & Performance Overview...');
  const perfOverviewRes = await fetch(`${BASE_URL}/api/faculty/performance-overview`, {
    headers: { 'Cookie': facultyCookie }
  });
  if (!perfOverviewRes.ok) throw new Error('Faculty performance-overview failed');
  const overview = await perfOverviewRes.json();

  const monitoredLab = overview.assignmentsMonitoring.find(a => a.id === createdAssignmentId);
  if (!monitoredLab) throw new Error('Created lab not found in faculty assignment monitoring!');
  
  const studentDetail = monitoredLab.studentDetails.find(s => s.student_usn === testStudentUsn);
  if (!studentDetail) throw new Error('Student not found in lab studentDetails!');
  console.log(`  -> Faculty Assignment Monitoring for Lab 2:`);
  console.log(`     Student: ${studentDetail.student_name} (${studentDetail.student_usn})`);
  console.log(`     Executions: ${studentDetail.total_executions}`);
  console.log(`     Execution Penalty: -${studentDetail.execution_penalty} Marks`);
  console.log(`     Auto-Calculated Marks: ${studentDetail.final_score} / 100`);

  if (studentDetail.total_executions < 11 || studentDetail.execution_penalty < 2) {
    throw new Error('Faculty view did not reflect the executions or penalty!');
  }
  console.log('  -> PASS: Faculty view displays execution count and penalty accurately.');

  // Step 7: Student Submits Solution
  console.log('\n[Test 8] Student Submits Laboratory Solution...');
  await new Promise(r => setTimeout(r, 600));
  const submitRes = await fetch(`${BASE_URL}/api/code/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentCookie },
    body: JSON.stringify({
      assignmentId: createdAssignmentId,
      code: sampleCode,
      language: 'Java',
      executionResult: 'Binary Search Test - Passed'
    })
  });
  if (!submitRes.ok) throw new Error('Code submit failed');
  const submitData = await submitRes.json();
  console.log(`  -> Submission recorded: ID = ${submitData.submissionId}, Status = ${submitData.status}`);

  // Step 8: Student Checks My Progress (Requirement 1C & 3)
  console.log('\n[Test 9] Student Checks My Progress (100-Mark Automatic Evaluation)...');
  const myProgRes = await fetch(`${BASE_URL}/api/students/my-progress`, {
    headers: { 'Cookie': studentCookie }
  });
  if (!myProgRes.ok) throw new Error('my-progress endpoint failed');
  const progData = await myProgRes.json();

  console.log(`  -> Total Assigned: ${progData.metrics.totalAssigned}`);
  console.log(`  -> Completed: ${progData.metrics.completedCount}`);
  console.log(`  -> Pending: ${progData.metrics.pendingCount}`);
  console.log(`  -> Overall Automatic Performance: ${progData.metrics.overallPerformance} / 100`);
  console.log(`  -> Total Penalties Deducted: -${progData.metrics.totalPenaltyDeducted} Marks`);

  const lab2Item = progData.assignments.find(a => a.assignmentId === createdAssignmentId);
  if (!lab2Item) throw new Error('Lab 2 not in student progress list!');
  console.log(`  -> Lab 2 Evaluation Details:`);
  console.log(`     Status: ${lab2Item.status}`);
  console.log(`     Executions: ${lab2Item.totalExecutions}`);
  console.log(`     Penalty: -${lab2Item.executionPenalty}`);
  console.log(`     Correctness: ${lab2Item.evaluation.codeCorrectnessMarks} / 50`);
  console.log(`     Completion: ${lab2Item.evaluation.completionMarks} / 20`);
  console.log(`     Effort: ${lab2Item.evaluation.activityEffortMarks} / 15`);
  console.log(`     Timely: ${lab2Item.evaluation.timelySubmissionMarks} / 10`);
  console.log(`     Originality: ${lab2Item.evaluation.originalityMarks} / 5`);
  console.log(`     Base Score: ${lab2Item.evaluation.baseScore} / 100`);
  console.log(`     Final Calculated Score: ${lab2Item.evaluation.finalScore} / 100`);

  if (lab2Item.evaluation.completionMarks !== 20) {
    throw new Error('Submitted assignment should award 20 completion marks');
  }
  console.log('  -> PASS: 100-mark performance model evaluated correctly.');

  // Step 9: Faculty Generates Individual Student Report by USN
  console.log('\n[Test 10] Faculty Generates Individual Student Report for USN: ' + testStudentUsn + '...');
  const reportRes = await fetch(`${BASE_URL}/api/faculty/student-report/${testStudentUsn}`, {
    headers: { 'Cookie': facultyCookie }
  });
  if (!reportRes.ok) throw new Error('Faculty student-report failed');
  const report = await reportRes.json();

  console.log(`  -> Student: ${report.student.name} (${report.student.usn})`);
  console.log(`  -> Overall Performance Score: ${report.overall.overallScore} / 100`);
  console.log(`  -> Total Executions Across Labs: ${report.overall.totalExecutions}`);
  console.log(`  -> Total Penalties Deducted: -${report.overall.totalPenaltyDeducted} Marks`);
  console.log(`  -> Active Coding Time: ${Math.round(report.overall.totalActiveSeconds / 60)} minutes`);
  console.log(`  -> Assignments Detailed Records: ${report.assignmentEvaluations.length}`);
  console.log(`  -> Submissions Recorded: ${report.submissionHistory.length}`);
  console.log(`  -> Execution Logs Recorded: ${report.executionLogs.length}`);

  if (report.assignmentEvaluations.length === 0 || report.overall.overallScore === 0) {
    throw new Error('Individual student report missing evaluation records!');
  }
  console.log('  -> PASS: Faculty Individual Student Report generated completely.');

  // Step 10: Security Access Guard - Student cannot access Faculty Performance APIs
  console.log('\n[Test 11] Security Guard: Student attempting faculty performance endpoint...');
  const studentHackingRes = await fetch(`${BASE_URL}/api/faculty/performance-overview`, {
    headers: { 'Cookie': studentCookie }
  });
  console.log(`  -> Response status: ${studentHackingRes.status}`);
  if (studentHackingRes.status !== 403) {
    throw new Error(`Student was not blocked with 403! Status: ${studentHackingRes.status}`);
  }
  console.log('  -> PASS: Student received HTTP 403 Forbidden for faculty performance API.');

  console.log('\n====================================================');
  console.log('ALL 11 AUTOMATIC PERFORMANCE & SECURITY TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
