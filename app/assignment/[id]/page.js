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
    if (!fileToUpload) return;
    setSubmissionError(null);
    setGradingProgress('uploading');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

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

      const { url: publicUrl } = await uploadRes.json();

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

      const { text: extractedText } = await ocrRes.json();

      if (!extractedText || extractedText.trim() === '') {
        throw new Error('Empty text extracted. Please ensure the document is clear and readable.');
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
      alert(`Assignment submitted successfully! AI score: ${evalData.score}/${assignment.max_marks}`);
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
      alert(`Error publication: ${err.message}`);
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!confirm('Are you sure you want to permanently delete this student submission? All grading, feedback, and records will be deleted, and the student will be allowed to submit again.')) return;
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .delete()
        .eq('id', submissionId);

      if (error) throw error;

      alert('Submission deleted successfully.');
      setSelectedSub(null);
      loadAssignmentData(); // Reload student list
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDownloadExcel = () => {
    if (!submissionsList || submissionsList.length === 0) {
      alert('No submissions available to download.');
      return;
    }

    const headers = ['Register Number', 'Student Name', 'Marks Obtained', 'Max Marks', 'AI Score', 'Teacher Override', 'Review Status'];
    const rows = submissionsList.map(sub => [
      `"\t${sub.users?.reg_no || 'N/A'}"`,
      `"${sub.users?.name || 'Unknown'}"`,
      sub.teacher_marks !== null ? sub.teacher_marks : sub.ai_marks,
      assignment.max_marks,
      sub.ai_marks || 0,
      sub.teacher_marks !== null ? sub.teacher_marks : 'None',
      sub.review_status
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${assignment.title.replace(/\s+/g, '_')}_grades.csv`);
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
        <div className="glass card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assignment?.title}</h2>
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
                {new Date(assignment?.deadline).toLocaleString()}
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
                <button
                  onClick={handleDownloadExcel}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                >
                  📊 Export Grades
                </button>
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
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</p>
                      
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

      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
