'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function AssignmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id;

  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classroomStudents, setClassroomStudents] = useState([]);
  const [showUnsubmittedModal, setShowUnsubmittedModal] = useState(false);

  // Uploading / Auto-Grading statuses: null | 'uploading' | 'extracting' | 'evaluating' | 'done' | 'failed'
  const [gradingProgress, setGradingProgress] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  // Faculty Grading details
  const [selectedSub, setSelectedSub] = useState(null);
  const [manualMarks, setManualMarks] = useState('');
  const [gradingActionMsg, setGradingActionMsg] = useState(null);

  // File Upload
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // In-Screen Custom Popups / Alerts & Modals
  const [toast, setToast] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Edit Assignment Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editMaxMarks, setEditMaxMarks] = useState('');
  const [editRubric, setEditRubric] = useState('');
  const [editAnswerKey, setEditAnswerKey] = useState('');
  const [editFile, setEditFile] = useState(null);

  // Student Typed Answer States
  const [submissionMethod, setSubmissionMethod] = useState('file'); // 'file' | 'text'
  const [typedAnswer, setTypedAnswer] = useState('');

  const triggerToast = (title, body) => {
    setToast({ title, body });
    setTimeout(() => {
      setToast(prev => {
        if (prev && prev.title === title && prev.body === body) {
          return null;
        }
        return prev;
      });
    }, 4000);
  };

  useEffect(() => {
    if (!assignmentId) return;
    loadAssignmentData();
  }, [assignmentId]);

  const loadAssignmentData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    // Fetch user details
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
    setUser(profile);

    // Fetch Assignment Details
    const { data: assign } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();
    setAssignment(assign);

    if (assign) {
      setEditTitle(assign.title || '');
      setEditDesc(assign.description || '');
      if (assign.deadline) {
        const dt = new Date(assign.deadline);
        const tzoffset = dt.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dt.getTime() - tzoffset)).toISOString().slice(0, 16);
        setEditDeadline(localISOTime);
      }
      setEditMaxMarks(assign.max_marks || '');
      setEditRubric(assign.rubric || '');
      setEditAnswerKey(assign.answer_key || '');
    }

    if (assign && profile) {
      const isFacultyUser = profile.role === 'Faculty' || profile.role === 'Administrator';

      if (isFacultyUser) {
        // Teacher: load all student submissions for this assignment
        const { data: subs } = await supabase
          .from('assignment_submissions')
          .select('*, users(name, email, username, reg_no)')
          .eq('assignment_id', assignmentId)
          .order('submitted_at', { ascending: false });
        setSubmissionsList(subs || []);

        // Fetch classroom members (students)
        const { data: membersData } = await supabase
          .from('classroom_members')
          .select('*, users!user_id(id, name, username, reg_no, role)')
          .eq('classroom_id', assign.classroom_id);
          
        if (membersData) {
          const students = membersData.filter(m => m.users?.role === 'Student' || m.users?.role === 'Teaching Assistant' || m.users?.role === 'Research Scholar' || m.users?.role === 'Mentor');
          setClassroomStudents(students);
        }
      } else {
        // Student: load their own submission if already uploaded
        const { data: sub } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('student_id', profile.id)
          .maybeSingle();
        setSubmission(sub);
      }
    }

    setLoading(false);
  };

  // Student upload & evaluation routine
  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (submissionMethod === 'file' && !fileToUpload) return;
    if (submissionMethod === 'text' && !typedAnswer.trim()) return;

    setSubmissionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      let extractedText = "";
      let publicUrl = null;

      if (submissionMethod === 'file') {
        setGradingProgress('uploading');
        const uploadFormData = new FormData();
        uploadFormData.append('file', fileToUpload);
        uploadFormData.append('folder', 'submissions');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: authHeaders,
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const uploadErrJson = await uploadRes.json();
          throw new Error(uploadErrJson.error || 'Failed to upload submission file.');
        }

        const { url } = await uploadRes.json();
        publicUrl = url;

        // 2. OCR Text Extraction API
        setGradingProgress('extracting');
        const ocrFormData = new FormData();
        ocrFormData.append('file', fileToUpload);

        const ocrRes = await fetch('/api/ocr', {
          method: 'POST',
          headers: authHeaders,
          body: ocrFormData,
        });

        if (!ocrRes.ok) {
          const errJson = await ocrRes.json();
          throw new Error(errJson.error || 'Failed to extract text from file.');
        }

        const { text } = await ocrRes.json();
        extractedText = text;

        if (!extractedText || extractedText.trim() === '') {
          throw new Error('Empty text extracted. Please ensure the document is clear and readable.');
        }
      } else {
        extractedText = typedAnswer.trim();
      }

      // 3. AI Grading / Evaluation API (Fixed route URL path)
      setGradingProgress('evaluating');
      const evalRes = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          question: `${assignment.title}\n${assignment.description}`,
          questionPaperUrl: assignment.file_path,
          answerKey: assignment.answer_key || 'No ideal answer key specified.',
          rubric: assignment.rubric || 'Grade based on accuracy and logic.',
          maxMarks: assignment.max_marks,
          studentAnswer: extractedText,
        }),
      });

      if (!evalRes.ok) {
        const errJson = await evalRes.json();
        throw new Error(errJson.error || 'AI Evaluation endpoint failed.');
      }

      const evalData = await evalRes.json();

      // 4. Save Submission Details
      const submissionPayload = {
        assignment_id: assignmentId,
        student_id: user.id,
        file_path: publicUrl,
        ocr_text: extractedText,
        ai_marks: evalData.score,
        confidence_score: evalData.confidence,
        ai_feedback: evalData.feedback,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        missing_concepts: evalData.missing_concepts,
        review_status: 'PENDING',
      };

      let saveError = null;
      let savedSub = null;

      if (submission) {
        // Update existing draft
        const { data, error } = await supabase
          .from('assignment_submissions')
          .update(submissionPayload)
          .eq('id', submission.id)
          .select()
          .single();
        saveError = error;
        savedSub = data;
      } else {
        // Insert new draft
        const { data, error } = await supabase
          .from('assignment_submissions')
          .insert(submissionPayload)
          .select()
          .single();
        saveError = error;
        savedSub = data;
      }

      if (saveError) throw saveError;

      setSubmission(savedSub);
      setIsResubmitting(false);
      setGradingProgress('done');
      triggerToast('Submission Successful', `Assignment submitted successfully! AI score: ${evalData.score}/${assignment.max_marks}`);
    } catch (err) {
      setGradingProgress('failed');
      setSubmissionError(err.message);
    }
  };

  // Faculty: approve AI grades or override marks
  const handleFacultyGrade = async (action) => {
    if (!selectedSub) return;
    setGradingActionMsg(null);

    const finalMarks = action === 'approve'
      ? selectedSub.ai_marks
      : Number(manualMarks);

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          teacher_marks: finalMarks,
          review_status: 'APPROVED',
        })
        .eq('id', selectedSub.id);

      if (error) throw error;

      setSelectedSub({ ...selectedSub, teacher_marks: finalMarks, review_status: 'APPROVED' });
      setGradingActionMsg(`Marks published successfully! Final Score: ${finalMarks}/${assignment.max_marks}`);
      loadAssignmentData(); // Reload list
    } catch (err) {
      triggerToast('Error publishing marks', err.message);
    }
  };

  const handleDeleteSubmission = (submissionId) => {
    setDeleteTargetId(submissionId);
  };

  const handleEditAssignment = async (e) => {
    e.preventDefault();
    try {
      let finalFilePath = assignment.file_path;

      if (editFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

        const uploadFormData = new FormData();
        uploadFormData.append('file', editFile);
        uploadFormData.append('folder', 'assignments');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: authHeaders,
          body: uploadFormData,
        });

        if (!uploadRes.ok) throw new Error('Failed to upload new question sheet.');
        const { url } = await uploadRes.json();
        finalFilePath = url;
      }

      const { data: updatedAssign, error } = await supabase
        .from('assignments')
        .update({
          title: editTitle,
          description: editDesc,
          max_marks: Number(editMaxMarks),
          deadline: new Date(editDeadline).toISOString(),
          rubric: editRubric,
          answer_key: editAnswerKey,
          file_path: finalFilePath
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) throw error;
      setAssignment(updatedAssign);
      setShowEditModal(false);
      triggerToast('Success', 'Assignment updated successfully.');
    } catch (err) {
      triggerToast('Update failed', err.message);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!confirm("Are you sure you want to delete this assignment? All submissions and grades will be permanently deleted.")) return;
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      router.replace(`/classroom/${assignment.classroom_id}`);
    } catch (err) {
      triggerToast('Delete failed', err.message);
    }
  };

  const executeDeleteSubmission = async (submissionId) => {
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .delete()
        .eq('id', submissionId);

      if (error) throw error;

      triggerToast('Success', 'Submission deleted successfully.');
      setSelectedSub(null);
      loadAssignmentData(); // Reload student list
    } catch (err) {
      triggerToast('Delete failed', err.message);
    }
  };

  const handleDownloadExcel = () => {
    const rows = [];

    // Map classroom students
    classroomStudents.forEach(student => {
      const u = student.users;
      if (!u) return;

      const sub = submissionsList.find(s => s.student_id === u.id);
      const reg = u.reg_no || 'N/A';
      const name = u.name || 'Unknown';
      const maxMarks = assignment?.max_marks || 10;

      if (sub) {
        const marks = sub.teacher_marks !== null ? sub.teacher_marks : (sub.ai_marks || 0);
        const aiScore = sub.ai_marks || 0;
        const override = sub.teacher_marks !== null ? sub.teacher_marks : 'None';
        const status = sub.review_status || 'PENDING';
        rows.push({
          reg,
          name,
          marks,
          maxMarks,
          aiScore,
          override,
          status,
          isAbsent: false
        });
      } else {
        rows.push({
          reg,
          name,
          marks: 'ABSENT',
          maxMarks,
          aiScore: 0,
          override: '',
          status: 'ABSENT (No Submission)',
          isAbsent: true
        });
      }
    });

    // Sort rows, putting absentees at the bottom
    rows.sort((a, b) => {
      if (a.isAbsent !== b.isAbsent) {
        return a.isAbsent ? 1 : -1;
      }
      return a.reg.localeCompare(b.reg, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Generate Excel HTML Content with Red Highlighting
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Assignment Grades</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th { background-color: #f2f2f2; font-weight: bold; border: 1px solid #dddddd; padding: 8px; text-align: left; }
          td { border: 1px solid #dddddd; padding: 8px; text-align: left; }
          .absent { background-color: #ffebeb; color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Marks Obtained</th>
              <th>Max Marks</th>
              <th>AI Score</th>
              <th>Teacher Override</th>
              <th>Review Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.isAbsent ? 'absent' : ''}">
                <td>${r.reg}</td>
                <td>${r.name}</td>
                <td>${r.marks}</td>
                <td>${r.maxMarks}</td>
                <td>${r.aiScore}</td>
                <td>${r.override}</td>
                <td>${r.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${assignment.title.replace(/\s+/g, '_')}_grades.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Assignment...</h2>
      </div>
    );
  }

  const isFaculty = user?.role === 'Faculty' || user?.role === 'Administrator';

  return (
    <div>
      <Navbar />
      <div className="container">
        
        {/* Assignment Details Header */}
        <div className="glass card" style={{ padding: '2rem', marginBottom: '2.5rem', position: 'relative' }}>
          {isFaculty && (
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowEditModal(true)} 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
              >
                ✏️ Edit
              </button>
              <button 
                onClick={handleDeleteAssignment} 
                className="btn btn-danger" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', background: '#dc2626', color: '#FFF', border: 'none', borderRadius: '4px' }}
              >
                🗑️ Delete
              </button>
            </div>
          )}
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', paddingRight: isFaculty ? '160px' : '0' }}>{assignment?.title}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
            {assignment?.description}
          </p>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>MAX SCORE</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{assignment?.max_marks} pts</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>DEADLINE</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {new Date(assignment?.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>
          {assignment?.file_path && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <a
                href={assignment.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}
              >
                📄 Download Question Sheet
              </a>
            </div>
          )}
        </div>

        {/* Dynamic Panels */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: isFaculty ? '350px 1fr' : '1fr' }}>
          
          {/* TEACHER PANEL: Submissions List */}
           {isFaculty && (
             <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📥 Student Submissions</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={handleDownloadExcel}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                  >
                    📊 Export Grades
                  </button>
                  <button
                    onClick={() => setShowUnsubmittedModal(true)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                  >
                    ⚠️ Unsubmitted Students
                  </button>
                </div>
              </div>
              {submissionsList.length === 0 ? (
                <div className="glass card" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No submissions uploaded by students yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {submissionsList.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => {
                        setSelectedSub(sub);
                        setManualMarks(sub.teacher_marks !== null ? sub.teacher_marks : sub.ai_marks || '');
                      }}
                      className="glass card"
                      style={{
                        cursor: 'pointer',
                        padding: '1rem',
                        border: selectedSub?.id === sub.id ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      }}
                    >
                      <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{sub.users?.name}</h4>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span className="badge badge-student" style={{ fontSize: '0.6rem' }}>
                          Status: {sub.review_status}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-secondary)' }}>
                          {sub.teacher_marks !== null ? `${sub.teacher_marks}/${assignment.max_marks}` : sub.ai_marks ? `AI: ${sub.ai_marks}/${assignment.max_marks}` : 'Ungraded'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RIGHT SIDE: Student Upload/Results OR Teacher Detailed Review */}
          <div>
            
            {/* 1. STUDENT VIEW */}
            {!isFaculty && (
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Upload Submission</h3>
                
                {/* Grading Steps Loader */}
                {gradingProgress && gradingProgress !== 'done' && gradingProgress !== 'failed' && (
                  <div className="glass card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ border: '3px solid rgba(0,0,0,0.05)', borderLeftColor: 'var(--color-secondary)', borderRadius: '50%', width: '35px', height: '35px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                    <p style={{ fontWeight: 600 }}>
                      {gradingProgress === 'uploading' && 'Uploading document to Supabase storage...'}
                      {gradingProgress === 'extracting' && 'Running serverless document parser (OCR)...'}
                      {gradingProgress === 'evaluating' && 'Comparing with answer key via AI grader...'}
                    </p>
                  </div>
                )}

                {/* Upload Form */}
                {(!submission || isResubmitting || gradingProgress === 'failed') && (
                  <form onSubmit={handleSubmitAssignment} className="glass card" style={{ padding: '2rem', textAlign: 'center' }}>
                    {submissionError && <div className="alert alert-error">{submissionError}</div>}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <button
                        type="button"
                        className={submissionMethod === 'file' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                        onClick={() => setSubmissionMethod('file')}
                      >
                        📄 Upload File
                      </button>
                      <button
                        type="button"
                        className={submissionMethod === 'text' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                        onClick={() => setSubmissionMethod('text')}
                      >
                        ✍️ Type Answer
                      </button>
                    </div>

                    {submissionMethod === 'file' ? (
                      <div style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius)', padding: '2.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.01)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                          Drag and drop your assignment document here (PDF, DOCX, PNG, JPG).
                        </p>
                        <input
                          type="file"
                          required
                          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                          onChange={(e) => setFileToUpload(e.target.files[0])}
                          style={{ display: 'block', margin: '0 auto', fontSize: '0.85rem' }}
                        />
                        <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Maximum File Size: 1.5MB
                        </span>
                      </div>
                    ) : (
                      <div className="input-group" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <label className="label">Type your Answer here</label>
                        <textarea
                          required
                          className="input"
                          style={{ minHeight: '200px', resize: 'vertical' }}
                          placeholder="Type or paste your complete answer or essay here..."
                          value={typedAnswer}
                          onChange={(e) => setTypedAnswer(e.target.value)}
                        />
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 2.0rem' }}>
                      Submit & Auto-Grade
                    </button>
                    {isResubmitting && (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '0.6rem 2.0rem', marginLeft: '1rem' }} 
                        onClick={() => setIsResubmitting(false)}
                      >
                        Cancel
                      </button>
                    )}
                  </form>
                )}

                {/* Submission Results / AI Evaluation */}
                {submission && !isResubmitting && gradingProgress !== 'uploading' && (
                  <div className="glass card animate-fade-in" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Grading Outcome</h4>
                        <span className="badge badge-student" style={{ fontSize: '0.65rem' }}>
                          Status: {submission.review_status}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success)' }}>
                          {submission.teacher_marks !== null ? submission.teacher_marks : submission.ai_marks}/{assignment.max_marks}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Confidence: {submission.confidence_score}%
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                      <div>
                        <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>📝 AI Feedback & Mark Breakdown</h5>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                          {submission.ai_feedback}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <h5 style={{ fontWeight: 700, color: '#059669', marginBottom: '0.4rem' }}>✔️ Strengths</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{submission.strengths}</p>
                        </div>
                        <div>
                          <h5 style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.4rem' }}>❌ Weaknesses</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{submission.weaknesses}</p>
                        </div>
                      </div>
                      {submission.missing_concepts && (
                        <div>
                          <h5 style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: '0.4rem' }}>🔍 Missing Key Concepts</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{submission.missing_concepts}</p>
                        </div>
                      )}
                      {/* Re-submission disabled per policy */}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. FACULTY REVIEW DETAIL VIEW */}
            {isFaculty && (
              <div>
                {!selectedSub ? (
                  <div className="glass card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Select a student submission from the left sidebar to review extracted text, check AI scoring breakdown, and publish marks.
                  </div>
                ) : (
                  <div className="glass card animate-fade-in" style={{ padding: '2rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Grading Review: {selectedSub.users?.name}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Email: {selectedSub.users?.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {selectedSub.file_path && (
                          <a
                            href={selectedSub.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                          >
                            📄 View Uploaded File
                          </a>
                        )}
                        {selectedSub.ocr_text && (
                          <button
                            onClick={() => {
                              const blob = new Blob([selectedSub.ocr_text], { type: 'text/plain;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.setAttribute('href', url);
                              link.setAttribute('download', `${(selectedSub.users?.name || 'student').replace(/\s+/g, '_')}_Answer.txt`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            📥 Download Answer (TXT)
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSubmission(selectedSub.id)}
                          className="btn"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#fee2e2', color: '#dc2626', border: 'none' }}
                        >
                          🗑️ Delete Submission
                        </button>
                      </div>
                    </div>

                    {gradingActionMsg && <div className="alert alert-success">{gradingActionMsg}</div>}

                    {/* AI Scoring Draft */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99,102,241,0.06)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: '1.5rem' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>AI Recommended Marks</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>AI confidence score: {selectedSub.confidence_score}%</p>
                      </div>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {selectedSub.ai_marks}/{assignment.max_marks}
                      </span>
                    </div>

                    {/* Published Marks Controls */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap' }}>
                      <div className="input-group" style={{ margin: 0, flex: 1 }}>
                        <label className="label">Final Marks Published</label>
                        <input
                          type="number"
                          className="input"
                          max={assignment.max_marks}
                          value={manualMarks}
                          onChange={(e) => setManualMarks(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => handleFacultyGrade('approve')}>
                          Approve AI Recommended
                        </button>
                        <button className="btn btn-primary" onClick={() => handleFacultyGrade('manual')}>
                          Publish Override
                        </button>
                      </div>
                    </div>

                    {/* AI breakdown tabs */}
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                      <div>
                        <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>📖 Extracted Student Document Text</h5>
                        <div style={{ background: '#F8FAFC', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {selectedSub.ocr_text}
                        </div>
                      </div>

                      <div>
                        <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>📝 AI Scoring Analysis</h5>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                          {selectedSub.ai_feedback}
                        </p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                          <h5 style={{ fontWeight: 700, color: '#059669', marginBottom: '0.3rem' }}>✔️ Strengths</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{selectedSub.strengths}</p>
                        </div>
                        <div>
                          <h5 style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.3rem' }}>❌ Weaknesses</h5>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{selectedSub.weaknesses}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      {/* ================= CUSTOM CONFIRM DELETE SUBMISSION ================= */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Delete Submission</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to permanently delete this student submission? All grading, feedback, and records will be deleted, and the student will be allowed to submit again.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteTargetId(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const targetId = deleteTargetId;
                  setDeleteTargetId(null);
                  await executeDeleteSubmission(targetId);
                }} 
                className="btn btn-danger" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= IN-SCREEN CUSTOM TOAST NOTIFICATIONS ================= */}
      {/* ================= EDIT ASSIGNMENT MODAL ================= */}
      {showEditModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Edit Assignment</h3>
            <form onSubmit={handleEditAssignment}>
              <div className="input-group">
                <label className="label">Title</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Description / Instructions</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="label">Deadline</label>
                  <input
                    type="datetime-local"
                    required
                    className="input"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Max Marks</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={editMaxMarks}
                    onChange={(e) => setEditMaxMarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="label">Grading Rubric (For AI Evaluator)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={editRubric}
                  onChange={(e) => setEditRubric(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Answer Key / Ideal Concepts (For AI Comparison)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={editAnswerKey}
                  onChange={(e) => setEditAnswerKey(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Upload New Question Sheet (Optional PDF/DOCX/Image)</label>
                <input
                  type="file"
                  className="input"
                  onChange={(e) => setEditFile(e.target.files[0])}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unsubmitted Students Modal */}
      {showUnsubmittedModal && (() => {
        const unsubmittedStudents = classroomStudents.filter(student => {
          return !submissionsList.some(sub => sub.student_id === student.user_id);
        });
        return (
          <div className="modal-overlay" onClick={() => setShowUnsubmittedModal(false)}>
            <div className="glass modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  ⚠️ Unsubmitted Students ({unsubmittedStudents.length})
                </h3>
                <button onClick={() => setShowUnsubmittedModal(false)} className="btn-close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>&times;</button>
              </div>
              {unsubmittedStudents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '2rem 0' }}>All enrolled students have submitted the assignment! 🎉</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '0.75rem', paddingRight: '0.5rem' }}>
                  {unsubmittedStudents.map(student => (
                    <div key={student.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.users?.name || 'Unknown Student'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{student.users?.username}</div>
                      </div>
                      {student.users?.reg_no && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          Reg No: {student.users.reg_no}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-primary)' }}>{toast.title}</span>
            <button 
              onClick={() => setToast(null)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0 0 10px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{toast.body}</p>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </div>
  );
}
