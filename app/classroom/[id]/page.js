'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function ClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.id;

  const [user, setUser] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tabs: 'assignments' | 'quizzes' | 'materials' | 'forum' | 'members'
  const [activeTab, setActiveTab] = useState('assignments');

  // Classroom lists
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [threads, setThreads] = useState([]);
  const [members, setMembers] = useState([]);

  // Create modals/forms
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);

  // Edit Exam / Quiz States
  const [selectedQuizToEdit, setSelectedQuizToEdit] = useState(null);
  const [editQuizQuestions, setEditQuizQuestions] = useState([]);
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizDuration, setEditQuizDuration] = useState(30);
  const [editQuizMaxMarks, setEditQuizMaxMarks] = useState(100);
  const [editQuizStart, setEditQuizStart] = useState('');
  const [editQuizEnd, setEditQuizEnd] = useState('');
  const [editQuizShuffle, setEditQuizShuffle] = useState(false);
  const [editQuizNegative, setEditQuizNegative] = useState(false);
  const [showEditQuizModal, setShowEditQuizModal] = useState(false);

  // In-Screen Modal Confirmations & Toasts
  const [toast, setToast] = useState(null);
  const [deleteQuizTargetId, setDeleteQuizTargetId] = useState(null);
  const [deleteThreadTargetId, setDeleteThreadTargetId] = useState(null);

  const toIndianISOTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const istOffset = 330 * 60 * 1000; 
    const istTime = new Date(date.getTime() + istOffset);
    return istTime.toISOString().slice(0, 16);
  };

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

  const updateEditQuestion = (index, key, value) => {
    setEditQuizQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const updateEditQuestionOption = (qIndex, optIndex, value) => {
    setEditQuizQuestions(prev => {
      const updated = [...prev];
      const opts = [...(updated[qIndex].options || [])];
      opts[optIndex] = value;
      updated[qIndex] = { ...updated[qIndex], options: opts };
      return updated;
    });
  };

  // Form states
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignRubric, setAssignRubric] = useState('');
  const [assignAnswerKey, setAssignAnswerKey] = useState('');
  const [assignMaxMarks, setAssignMaxMarks] = useState(100);
  const [assignFile, setAssignFile] = useState(null);
  const [assignQuestionText, setAssignQuestionText] = useState('');
  const [submissionsCounts, setSubmissionsCounts] = useState({});

  const [matTitle, setMatTitle] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matLink, setMatLink] = useState('');
  const [matCategory, setMatCategory] = useState('Notes');

  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [threadAnon, setThreadAnon] = useState(false);

  // Quiz / Exam form states
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(30);
  const [quizNegative, setQuizNegative] = useState(false);
  const [quizShuffle, setQuizShuffle] = useState(false);
  const [quizDesc, setQuizDesc] = useState('');
  const [quizScheduledStart, setQuizScheduledStart] = useState('');
  const [quizScheduledEnd, setQuizScheduledEnd] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);

  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!classroomId) return;
    fetchClassroomData();
  }, [classroomId]);

  // Sync activeTab with URL query parameter to simulate separate pages
  useEffect(() => {
    const handlePop = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab') || 'assignments';
        setActiveTab(urlTab);
      }
    };
    window.addEventListener('popstate', handlePop);
    
    // Initial load tab selection
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab) {
        setActiveTab(urlTab);
      }
    }

    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tab);
      window.history.pushState(null, '', `?${params.toString()}`);
    }
  };

  const fetchClassroomData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
    setUser(profile);

    // Fetch Classroom Details
    const { data: cls } = await supabase
      .from('classrooms')
      .select('*')
      .eq('id', classroomId)
      .single();
    setClassroom(cls);

    if (cls) {
      // Fetch Assignments
      const { data: assigns } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('deadline', { ascending: true });
      setAssignments(assigns || []);

      if (assigns && assigns.length > 0) {
        const { data: allSubs } = await supabase
          .from('assignment_submissions')
          .select('assignment_id')
          .in('assignment_id', assigns.map(a => a.id));
        
        const counts = {};
        assigns.forEach(a => { counts[a.id] = 0; });
        allSubs?.forEach(s => {
          if (counts[s.assignment_id] !== undefined) {
            counts[s.assignment_id]++;
          }
        });
        setSubmissionsCounts(counts);
      }

      // Fetch Quizzes/Exams
      const { data: qzs } = await supabase
        .from('quizzes')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });
      setQuizzes(qzs || []);

      // Fetch student's quiz attempts in classroom
      if (profile) {
        const { data: atts } = await supabase
          .from('quiz_attempts')
          .select('quiz_id, score, max_score')
          .eq('student_id', profile.id);
        setMyAttempts(atts || []);
      }

      // Fetch Materials
      const { data: mats } = await supabase
        .from('materials')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });
      setMaterials(mats || []);

      const { data: forumThreads } = await supabase
        .from('discussion_threads')
        .select('*, users!user_id(name, username, avatar_path)')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });
      setThreads(forumThreads || []);

      // Fetch Members
      const { data: classMembers } = await supabase
        .from('classroom_members')
        .select('*, users!user_id(name, username, role, avatar_path)')
        .eq('classroom_id', classroomId);
      setMembers(classMembers || []);
    }
    setLoading(false);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setActionError(null);

    if (!assignDesc.trim() && !assignQuestionText.trim() && !assignFile) {
      setActionError("Please provide either Description instructions, Question Text, or upload a Question Sheet file.");
      return;
    }

    try {
      let uploadedFilePath = null;
      let questionSheetText = "";

      if (assignFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

        // 1. Upload file
        const uploadFormData = new FormData();
        uploadFormData.append('file', assignFile);
        uploadFormData.append('folder', 'assignments');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: authHeaders,
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const uploadErrJson = await uploadRes.json();
          throw new Error(uploadErrJson.error || 'Failed to upload question sheet.');
        }

        const { url } = await uploadRes.json();
        uploadedFilePath = url;

        // 2. Perform OCR on the question sheet file
        try {
          const ocrFormData = new FormData();
          ocrFormData.append('file', assignFile);
          const ocrRes = await fetch('/api/ocr', {
            method: 'POST',
            headers: authHeaders,
            body: ocrFormData,
          });
          if (ocrRes.ok) {
            const { text } = await ocrRes.json();
            if (text && text.trim() !== '') {
              questionSheetText = text;
            }
          }
        } catch (ocrErr) {
          console.error("Failed to run OCR on question sheet:", ocrErr.message);
        }
      }

      // 3. Save assignment in database
      let finalDescription = assignDesc;
      if (assignQuestionText.trim()) {
        finalDescription += `\n\n[Question Text]:\n${assignQuestionText.trim()}`;
      }
      if (questionSheetText) {
        finalDescription += `\n\n[Question Paper Content]:\n${questionSheetText}`;
      }

      const { data: newAssign, error } = await supabase
        .from('assignments')
        .insert({
          classroom_id: classroomId,
          title: assignTitle,
          description: finalDescription,
          answer_key: assignAnswerKey,
          rubric: assignRubric,
          max_marks: Number(assignMaxMarks),
          deadline: new Date(assignDeadline).toISOString(),
          creator_id: user.id,
          file_path: uploadedFilePath
        })
        .select()
        .single();

      if (error) throw error;

      setAssignments([...assignments, newAssign]);
      setSubmissionsCounts(prev => ({ ...prev, [newAssign.id]: 0 }));
      setShowAssignModal(false);
      setAssignTitle('');
      setAssignDesc('');
      setAssignQuestionText('');
      setAssignDeadline('');
      setAssignRubric('');
      setAssignAnswerKey('');
      setAssignFile(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    setActionError(null);
    try {
      const { data: newMat, error } = await supabase
        .from('materials')
        .insert({
          classroom_id: classroomId,
          title: matTitle,
          description: matDesc,
          file_path: matLink,
          file_type: 'link',
          category: matCategory,
          uploader_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setMaterials([newMat, ...materials]);
      setShowMaterialModal(false);
      setMatTitle('');
      setMatDesc('');
      setMatLink('');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    setActionError(null);
    try {
      const { data: newThread, error } = await supabase
        .from('discussion_threads')
        .insert({
          classroom_id: classroomId,
          user_id: user.id,
          title: threadTitle,
          content: threadContent,
          is_anonymous: threadAnon
        })
        .select('*, users!user_id(name, username, avatar_path)')
        .single();

      if (error) throw error;

      setThreads([newThread, ...threads]);
      setShowThreadModal(false);
      setThreadTitle('');
      setThreadContent('');
      setThreadAnon(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  // --- QUIZ & COMBINED EXAMS WORKFLOWS ---
  const openQuizCreatorModal = () => {
    setQuizTitle('');
    setQuizDuration(30);
    setQuizNegative(false);
    setQuizShuffle(false);
    setQuizDesc('');
    setQuizScheduledStart('');
    setQuizScheduledEnd('');
    setQuizQuestions([{
      question_text: '',
      question_type: 'MCQ',
      points: 10,
      options: ['', '', '', ''],
      correct_answer: '0'
    }]);
    setShowQuizModal(true);
  };

  const openExamCreatorModal = () => {
    setQuizTitle('');
    setQuizDuration(90);
    setQuizNegative(false);
    setQuizShuffle(false);
    setQuizDesc('');
    setQuizScheduledStart('');
    setQuizScheduledEnd('');
    setQuizQuestions([{
      question_text: '',
      question_type: 'MCQ',
      points: 10,
      options: ['', '', '', ''],
      correct_answer: '0'
    }]);
    setShowExamModal(true);
  };

  const handleAddQuizQuestion = (qType = 'MCQ') => {
    setQuizQuestions([
      ...quizQuestions,
      {
        question_text: '',
        question_type: qType,
        points: 10,
        options: ['', '', '', ''],
        correct_answer: qType === 'MCQ' ? '0' : ''
      }
    ]);
  };

  const handleQuizQuestionChange = (index, field, value) => {
    const updated = [...quizQuestions];
    updated[index][field] = value;
    setQuizQuestions(updated);
  };

  const handleQuizOptionChange = (qIndex, optIndex, value) => {
    const updated = [...quizQuestions];
    updated[qIndex].options[optIndex] = value;
    setQuizQuestions(updated);
  };

  const handleRemoveQuizQuestion = (index) => {
    setQuizQuestions(quizQuestions.filter((_, idx) => idx !== index));
  };

  const handleDeployTest = async (testType) => {
    setActionError(null);
    try {
      if (quizQuestions.length === 0) {
        throw new Error('Please add at least one question to the quiz/exam.');
      }

      let finalMaxMarks = 0;
      quizQuestions.forEach(q => finalMaxMarks += Number(q.points));

      const { data: newQuiz, error: qError } = await supabase
        .from('quizzes')
        .insert({
          classroom_id: classroomId,
          title: quizTitle,
          description: quizDesc,
          duration_minutes: Number(quizDuration),
          shuffle_questions: quizShuffle,
          negative_marking: quizNegative,
          max_marks: finalMaxMarks,
          creator_id: user.id,
          is_public: false,
          type: testType,
          scheduled_start: quizScheduledStart ? new Date(quizScheduledStart + '+05:30').toISOString() : null,
          scheduled_end: quizScheduledEnd ? new Date(quizScheduledEnd + '+05:30').toISOString() : null
        })
        .select()
        .single();

      if (qError) throw qError;

      const questionsPayload = quizQuestions.map(q => {
        let optionsJson = '[]';
        let correctAnswerJson = q.correct_answer;

        if (q.question_type === 'MCQ') {
          optionsJson = JSON.stringify(q.options);
          correctAnswerJson = JSON.stringify([Number(q.correct_answer)]);
        }

        return {
          quiz_id: newQuiz.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options_json: optionsJson,
          correct_answer_json: correctAnswerJson,
          points: Number(q.points),
          negative_points: quizNegative ? Math.max(1, Math.floor(Number(q.points) / 4)) : 0
        };
      });

      const { error: qnsError } = await supabase
        .from('quiz_questions')
        .insert(questionsPayload);

      if (qnsError) throw qnsError;

      setQuizzes([newQuiz, ...quizzes]);
      if (testType === 'QUIZ') setShowQuizModal(false);
      else setShowExamModal(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeleteQuiz = (id, e) => {
    e.stopPropagation();
    setDeleteQuizTargetId(id);
  };

  const executeDeleteQuiz = async (id) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setQuizzes(quizzes.filter(q => q.id !== id));
      triggerToast('Success', 'Quiz deleted successfully.');
    } catch (err) {
      triggerToast('Delete failed', err.message);
    }
  };

  const handleDeleteThread = (threadId) => {
    setDeleteThreadTargetId(threadId);
  };

  const executeDeleteThread = async (threadId) => {
    try {
      const { error } = await supabase
        .from('discussion_threads')
        .delete()
        .eq('id', threadId);
      if (error) throw error;
      setThreads(prev => prev.filter(t => t.id !== threadId));
      triggerToast('Success', 'Discussion thread deleted.');
    } catch (err) {
      triggerToast('Delete failed', err.message);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!confirm("Are you sure you want to remove this student from the classroom?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/classroom/remove-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          classroomId: Number(classroomId),
          studentId: studentId
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to remove member');
      }

      setMembers(prev => prev.filter(m => m.user_id !== studentId));
      triggerToast('Success', 'Student removed from classroom.');
    } catch (err) {
      triggerToast('Error removing student', err.message);
    }
  };

  const handleLeaveClassroom = async () => {
    if (!confirm("Are you sure you want to leave this classroom? You will lose access to all assignments, grades, and materials.")) return;
    try {
      const { error } = await supabase
        .from('classroom_members')
        .delete()
        .eq('classroom_id', classroomId)
        .eq('user_id', user.id);

      if (error) throw error;
      router.replace('/');
    } catch (err) {
      triggerToast('Error leaving classroom', err.message);
    }
  };

  const handleEditQuizClick = async (quizItem, e) => {
    e.stopPropagation();
    setSelectedQuizToEdit(quizItem);
    try {
      const { data: qns, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizItem.id)
        .order('id', { ascending: true });
      if (error) throw error;

      const mappedQns = (qns || []).map(q => {
        let opts = [];
        try {
          opts = JSON.parse(q.options_json || '[]');
        } catch (e) {
          opts = [];
        }
        let correctIdx = 0;
        try {
          const arr = JSON.parse(q.correct_answer_json || '[]');
          correctIdx = arr[0] || 0;
        } catch (e) {
          correctIdx = q.correct_answer_json || 0;
        }
        return {
          ...q,
          options: opts,
          correct_answer: correctIdx
        };
      });

      setEditQuizQuestions(mappedQns);
      setEditQuizTitle(quizItem.title);
      setEditQuizDuration(quizItem.duration_minutes);
      setEditQuizMaxMarks(quizItem.max_marks || 0);
      setEditQuizStart(toIndianISOTime(quizItem.scheduled_start));
      setEditQuizEnd(toIndianISOTime(quizItem.scheduled_end));
      setEditQuizShuffle(quizItem.shuffle_questions || false);
      setEditQuizNegative(quizItem.negative_marking || false);
      setShowEditQuizModal(true);
    } catch (err) {
      triggerToast('Failed to load quiz details', err.message);
    }
  };

  const handleSaveEditQuiz = async () => {
    try {
      const { error: quizUpdateError } = await supabase
        .from('quizzes')
        .update({
          title: editQuizTitle,
          duration_minutes: parseInt(editQuizDuration, 10),
          max_marks: parseInt(editQuizMaxMarks, 10),
          scheduled_start: editQuizStart ? new Date(editQuizStart + '+05:30').toISOString() : null,
          scheduled_end: editQuizEnd ? new Date(editQuizEnd + '+05:30').toISOString() : null,
          shuffle_questions: editQuizShuffle,
          negative_marking: editQuizNegative
        })
        .eq('id', selectedQuizToEdit.id);

      if (quizUpdateError) throw quizUpdateError;

      // Update questions
      for (const q of editQuizQuestions) {
        const { error: qUpdateError } = await supabase
          .from('quiz_questions')
          .update({
            question_text: q.question_text,
            question_type: q.question_type,
            points: parseInt(q.points, 10),
            options_json: q.question_type === 'MCQ' ? JSON.stringify(q.options) : '[]',
            correct_answer_json: q.question_type === 'MCQ' ? JSON.stringify([parseInt(q.correct_answer, 10)]) : q.correct_answer_json
          })
          .eq('id', q.id);

        if (qUpdateError) throw qUpdateError;
      }

      // Update local state quizzes list
      setQuizzes(prev => prev.map(q => q.id === selectedQuizToEdit.id ? {
        ...q,
        title: editQuizTitle,
        duration_minutes: parseInt(editQuizDuration, 10),
        max_marks: parseInt(editQuizMaxMarks, 10),
        scheduled_start: editQuizStart ? new Date(editQuizStart + '+05:30').toISOString() : null,
        scheduled_end: editQuizEnd ? new Date(editQuizEnd + '+05:30').toISOString() : null,
        shuffle_questions: editQuizShuffle,
        negative_marking: editQuizNegative
      } : q));

      setShowEditQuizModal(false);
      triggerToast('Success', 'Exam updated successfully!');
    } catch (err) {
      triggerToast('Error updating exam', err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Classroom...</h2>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Classroom not found or you are not enrolled.</h2>
      </div>
    );
  }

  const isTeacher = user?.role === 'Faculty' || user?.role === 'Administrator' || classroom.creator_id === user?.id;
  const isClassCreator = user?.role === 'Administrator' || classroom.creator_id === user?.id;

  const facultyCount = members.filter(m => m.users?.role === 'Faculty' || m.users?.role === 'Administrator').length;
  const studentCount = members.filter(m => m.users?.role === 'Student' || m.users?.role === 'Teaching Assistant' || m.users?.role === 'Research Scholar' || m.users?.role === 'Mentor').length;

  return (
    <div>
      <Navbar />
      <div className="container">
        
        {/* Classroom Header Card */}
        <div className="glass card" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(6, 182, 212, 0.06) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{classroom.class_name}</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{classroom.description}</p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>JOIN CODE</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{classroom.join_code}</span>
              </div>
              {!isClassCreator && (
                <button
                  onClick={handleLeaveClassroom}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    borderColor: 'rgba(220, 38, 38, 0.2)',
                    background: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(220, 38, 38, 0.05)' }}
                  onMouseLeave={(e) => { e.target.style.background = 'none' }}
                >
                  🚪 Leave Class
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Classroom Tab Navigation */}
        <div className="tabs-container" style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '2.0rem', 
          gap: '2rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {['assignments', 'quizzes', 'materials', 'members'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
                paddingBottom: '1rem',
                borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                fontWeight: 650,
                fontSize: '1rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'var(--transition)',
                flexShrink: 0
              }}
            >
              {tab === 'quizzes' ? 'Quizzes & Exams' : tab}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="animate-fade-in">
          
          {/* 1. Assignments Tab */}
          {activeTab === 'assignments' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Assignments</h3>
                {isTeacher && (
                  <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
                    + Create Assignment
                  </button>
                )}
              </div>

              {assignments.length === 0 ? (
                <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No assignments posted yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {assignments.map((assign) => (
                    <div
                      key={assign.id}
                      className="glass card"
                      onClick={() => router.push(`/assignment/${assign.id}`)}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}
                    >
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{assign.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          Due: {new Date(assign.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </p>
                        {submissionsCounts[assign.id] !== undefined && (
                          <p style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--color-primary)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            📊 Submitted: {submissionsCounts[assign.id]} / {studentCount}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>MAX MARKS</span>
                        <span style={{ fontWeight: 800, color: 'var(--color-secondary)' }}>{assign.max_marks} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Quizzes & Combined Exams Tab */}
          {activeTab === 'quizzes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Quizzes & Exams</h3>
                {isTeacher && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={openQuizCreatorModal}>
                      + Create MCQ Quiz
                    </button>
                    <button className="btn btn-primary" onClick={openExamCreatorModal}>
                      + Create Combined Exam
                    </button>
                  </div>
                )}
              </div>

              {quizzes.length === 0 ? (
                <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No tests or exams deployed yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {quizzes.map((q) => (
                    <div
                      key={q.id}
                      className="glass card"
                      onClick={() => router.push(`/quiz/${q.id}`)}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}
                    >
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span className={`badge ${q.type === 'QUIZ' ? 'badge-student' : 'badge-faculty'}`}>
                            {q.type}
                          </span>
                          {q.is_public && (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>
                              Public Link
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{q.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {q.duration_minutes} Mins • {q.max_marks} Marks
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          onClick={() => {
                            if (isTeacher) {
                              router.push(`/quiz/${q.id}?phase=view`);
                            } else {
                              const hasTaken = myAttempts.some(att => att.quiz_id === q.id);
                              if (hasTaken) {
                                router.push(`/quiz/${q.id}?phase=result`);
                              } else {
                                router.push(`/quiz/${q.id}`);
                              }
                            }
                          }}
                          className="btn btn-primary" 
                          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                        >
                          {isTeacher 
                            ? 'View attempts' 
                            : myAttempts.some(att => att.quiz_id === q.id)
                              ? 'View Result'
                              : 'Begin Test'}
                        </button>
                        {isClassCreator && (
                          <button
                            onClick={(e) => handleEditQuizClick(q, e)}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(99, 102, 241, 0.15)' }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                        {isClassCreator && (
                          <button
                            onClick={(e) => handleDeleteQuiz(q.id, e)}
                            className="btn btn-danger"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Materials Tab */}
          {activeTab === 'materials' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Study Materials</h3>
                {isTeacher && (
                  <button className="btn btn-primary" onClick={() => setShowMaterialModal(true)}>
                    + Add Link
                  </button>
                )}
              </div>

              {materials.length === 0 ? (
                <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No study resources or reference links added yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {materials.map((mat) => (
                    <div key={mat.id} className="glass card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
                      <div>
                        <span className="badge badge-student" style={{ fontSize: '0.65rem', marginBottom: '0.3rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)' }}>
                          {mat.category}
                        </span>
                        <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{mat.title}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{mat.description}</p>
                      </div>
                      <a href={mat.file_path} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        🔗 Open Resource
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Forum Tab */}
          {activeTab === 'forum' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Discussion Forum</h3>
                <button className="btn btn-primary" onClick={() => setShowThreadModal(true)}>
                  Start Thread
                </button>
              </div>

              {threads.length === 0 ? (
                <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No discussion threads started yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="glass card"
                      style={{ padding: '1.5rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <img
                            src={thread.is_anonymous ? '/assets/images/default-avatar.png' : thread.users?.avatar_path || '/assets/images/default-avatar.png'}
                            alt="avatar"
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{thread.is_anonymous ? 'Anonymous' : thread.users?.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                              {new Date(thread.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {user && (thread.user_id === user.id || isTeacher) && (
                          <button
                            onClick={() => handleDeleteThread(thread.id)}
                            className="btn btn-danger"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <h4 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{thread.title}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{thread.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. Members Tab */}
          {activeTab === 'members' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Class Members</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>👨‍🏫 <strong>{facultyCount}</strong> Faculty</span>
                  <span>👨‍🎓 <strong>{studentCount}</strong> Students</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {members.map((member) => (
                  <div key={member.user_id} className="glass card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img
                        src={member.users?.avatar_path || '/assets/images/default-avatar.png'}
                        alt="avatar"
                        style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{member.users?.name}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{member.users?.username}</span>
                        <span className="badge badge-student" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                          {member.role_in_class}
                        </span>
                      </div>
                    </div>
                    {isTeacher && member.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveStudent(member.user_id)}
                        className="btn"
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          color: '#dc2626',
                          background: 'none',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => { e.target.style.background = 'rgba(220, 38, 38, 0.05)' }}
                        onMouseLeave={(e) => { e.target.style.background = 'none' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Create Assignment Modal */}
        {showAssignModal && (
          <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Create Assignment</h3>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <form onSubmit={handleCreateAssignment}>
                <div className="input-group">
                  <label className="label">Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="E.g. Final Project Report"
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Description / Instructions</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Provide details on the homework guidelines..."
                    value={assignDesc}
                    onChange={(e) => setAssignDesc(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Question Text (Optional if Question Sheet is uploaded)</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Type the actual exam/assignment questions directly here..."
                    value={assignQuestionText}
                    onChange={(e) => setAssignQuestionText(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="label">Deadline</label>
                    <input
                      type="datetime-local"
                      required
                      className="input"
                      value={assignDeadline}
                      onChange={(e) => setAssignDeadline(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Max Marks</label>
                    <input
                      type="number"
                      required
                      className="input"
                      value={assignMaxMarks}
                      onChange={(e) => setAssignMaxMarks(e.target.value)}
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="label">Grading Rubric (For AI Evaluator)</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    placeholder="E.g. 50 marks for accuracy, 30 marks for clarity, 20 marks for formatting."
                    value={assignRubric}
                    onChange={(e) => setAssignRubric(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Answer Key / Ideal Concepts (For AI Comparison)</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    placeholder="Provide key sentences or topics that should be present in a good answer..."
                    value={assignAnswerKey}
                    onChange={(e) => setAssignAnswerKey(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Upload Question Sheet (Optional PDF/DOCX/Image)</label>
                  <input
                    type="file"
                    className="input"
                    onChange={(e) => setAssignFile(e.target.files[0])}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Post Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Material Link Modal */}
        {showMaterialModal && (
          <div className="modal-overlay">
            <div className="glass modal-content">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Add Study Resource Link</h3>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <form onSubmit={handleAddMaterial}>
                <div className="input-group">
                  <label className="label">Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="E.g. Lecture 3 Notes on Process Schedulers"
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Link URL (Google Drive, OneDrive, etc.)</label>
                  <input
                    type="url"
                    required
                    className="input"
                    placeholder="https://drive.google.com/..."
                    value={matLink}
                    onChange={(e) => setMatLink(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Category</label>
                  <select
                    className="input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                  >
                    <option value="Notes">Notes</option>
                    <option value="Video">Video</option>
                    <option value="Syllabus">Syllabus</option>
                    <option value="Assignment Sheet">Assignment Sheet</option>
                    <option value="Project Docs">Project Docs</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="label">Description (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="A quick summary of the resource..."
                    value={matDesc}
                    onChange={(e) => setMatDesc(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMaterialModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Start Forum Thread Modal */}
        {showThreadModal && (
          <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '550px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Start Forum Discussion</h3>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              <form onSubmit={handleCreateThread}>
                <div className="input-group">
                  <label className="label">Thread Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="E.g. Issue installing MySQL on Windows 11"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Thread Content</label>
                  <textarea
                    required
                    className="input"
                    style={{ minHeight: '120px', resize: 'vertical' }}
                    placeholder="Ask your question or start a topic here..."
                    value={threadContent}
                    onChange={(e) => setThreadContent(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input
                    type="checkbox"
                    id="anon"
                    checked={threadAnon}
                    onChange={(e) => setThreadAnon(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="anon" className="label" style={{ margin: 0, cursor: 'pointer' }}>
                    Post Anonymously
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowThreadModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Post Thread
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- DYNAMIC CREATE MCQ QUIZ MODAL --- */}
        {showQuizModal && (
          <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                🚀 Create MCQ Quiz
              </h3>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              
              <div className="row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="label">Quiz Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Midterm Quiz on Process Management"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Duration (Mins)</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="label">Scheduled Start Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={quizScheduledStart}
                    onChange={(e) => setQuizScheduledStart(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Scheduled End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={quizScheduledEnd}
                    onChange={(e) => setQuizScheduledEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="negMarkQuiz"
                    checked={quizNegative}
                    onChange={(e) => setQuizNegative(e.target.checked)}
                  />
                  <label htmlFor="negMarkQuiz" className="label" style={{ margin: 0, cursor: 'pointer' }}>Negative Marking (1/4 marks penalty)</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="shuffleQuiz"
                    checked={quizShuffle}
                    onChange={(e) => setQuizShuffle(e.target.checked)}
                  />
                  <label htmlFor="shuffleQuiz" className="label" style={{ margin: 0, cursor: 'pointer' }}>Shuffle Questions</label>
                </div>
              </div>

              <div className="input-group">
                <label className="label">Description / Instructions</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Topic guidelines..."
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                />
              </div>

              {/* Dynamic Questions List */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>Questions (MCQ only)</h4>
                  <button onClick={() => handleAddQuizQuestion('MCQ')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    + Add MCQ Question
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="glass" style={{ padding: '1rem', position: 'relative' }}>
                      <button type="button" onClick={() => handleRemoveQuizQuestion(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                        ×
                      </button>
                      <h5 style={{ fontWeight: 750, color: 'var(--color-primary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>QUESTION {idx + 1}</h5>

                      <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Prompt</label>
                          <input
                            type="text"
                            required
                            className="input"
                            placeholder="Enter question text..."
                            value={q.question_text}
                            onChange={(e) => handleQuizQuestionChange(idx, 'question_text', e.target.value)}
                          />
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Marks</label>
                          <input
                            type="number"
                            required
                            className="input"
                            value={q.points}
                            onChange={(e) => handleQuizQuestionChange(idx, 'points', e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {q.options.map((opt, optIdx) => (
                          <input
                            key={optIdx}
                            type="text"
                            required
                            className="input"
                            style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                            value={opt}
                            onChange={(e) => handleQuizOptionChange(idx, optIdx, e.target.value)}
                          />
                        ))}
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="label">Select Correct Option</label>
                        <select
                          className="input"
                          value={q.correct_answer}
                          onChange={(e) => handleQuizQuestionChange(idx, 'correct_answer', e.target.value)}
                        >
                          <option value="0">Option A is Correct</option>
                          <option value="1">Option B is Correct</option>
                          <option value="2">Option C is Correct</option>
                          <option value="3">Option D is Correct</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowQuizModal(false)}>
                  Cancel
                </button>
                <button onClick={() => handleDeployTest('QUIZ')} className="btn btn-primary">
                  Deploy Quiz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- DYNAMIC CREATE COMBINED EXAM MODAL --- */}
        {showExamModal && (
          <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                📝 Create Combined Exam (MCQ + Theory)
              </h3>
              {actionError && <div className="alert alert-error">{actionError}</div>}
              
              <div className="row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="label">Exam Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Final Combined Evaluation"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Duration (Mins)</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="input-group">
                  <label className="label">Scheduled Start Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={quizScheduledStart}
                    onChange={(e) => setQuizScheduledStart(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="label">Scheduled End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={quizScheduledEnd}
                    onChange={(e) => setQuizScheduledEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="negMarkExam"
                    checked={quizNegative}
                    onChange={(e) => setQuizNegative(e.target.checked)}
                  />
                  <label htmlFor="negMarkExam" className="label" style={{ margin: 0, cursor: 'pointer' }}>Negative Marking (for MCQs)</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="shuffleExam"
                    checked={quizShuffle}
                    onChange={(e) => setQuizShuffle(e.target.checked)}
                  />
                  <label htmlFor="shuffleExam" className="label" style={{ margin: 0, cursor: 'pointer' }}>Shuffle Questions</label>
                </div>
              </div>

              <div className="input-group">
                <label className="label">Description / Instructions</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Exam instructions..."
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                />
              </div>

              {/* Dynamic Questions List */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>Exam Questions (All Formats)</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleAddQuizQuestion('MCQ')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                      + Add MCQ
                    </button>
                    <button onClick={() => handleAddQuizQuestion('THEORY')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                      + Add Theory
                    </button>
                    <button onClick={() => handleAddQuizQuestion('ANALYTICAL')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                      + Add Analytical
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="glass" style={{ padding: '1rem', position: 'relative' }}>
                      <button type="button" onClick={() => handleRemoveQuizQuestion(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                        ×
                      </button>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <h5 style={{ fontWeight: 750, color: 'var(--color-primary)', fontSize: '0.85rem' }}>QUESTION {idx + 1}</h5>
                        <span className="badge badge-student" style={{ fontSize: '0.6rem' }}>{q.question_type}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Prompt</label>
                          <input
                            type="text"
                            required
                            className="input"
                            placeholder="Enter question prompt..."
                            value={q.question_text}
                            onChange={(e) => handleQuizQuestionChange(idx, 'question_text', e.target.value)}
                          />
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Type</label>
                          <select
                            className="input"
                            value={q.question_type}
                            onChange={(e) => handleQuizQuestionChange(idx, 'question_type', e.target.value)}
                          >
                            <option value="MCQ">MCQ (Auto-graded)</option>
                            <option value="THEORY">Theory (AI-graded)</option>
                            <option value="ANALYTICAL">Analytical (AI-graded)</option>
                          </select>
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Marks</label>
                          <input
                            type="number"
                            required
                            className="input"
                            value={q.points}
                            onChange={(e) => handleQuizQuestionChange(idx, 'points', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Options Block if MCQ */}
                      {q.question_type === 'MCQ' ? (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {q.options.map((opt, optIdx) => (
                              <input
                                key={optIdx}
                                type="text"
                                required
                                className="input"
                                style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                value={opt}
                                onChange={(e) => handleQuizOptionChange(idx, optIdx, e.target.value)}
                              />
                            ))}
                          </div>

                          <div className="input-group" style={{ margin: 0 }}>
                            <label className="label">Select Correct Option</label>
                            <select
                              className="input"
                              value={q.correct_answer}
                              onChange={(e) => handleQuizQuestionChange(idx, 'correct_answer', e.target.value)}
                            >
                              <option value="0">Option A is Correct</option>
                              <option value="1">Option B is Correct</option>
                              <option value="2">Option C is Correct</option>
                              <option value="3">Option D is Correct</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="input-group" style={{ margin: 0 }}>
                          <label className="label">Grading Key / Model Answer (For comparative AI grading)</label>
                          <textarea
                            required
                            className="input"
                            style={{ minHeight: '60px', resize: 'vertical' }}
                            placeholder="Provide the criteria, key terms, or outline details that the AI evaluator will use to grade essay answers..."
                            value={q.correct_answer}
                            onChange={(e) => handleQuizQuestionChange(idx, 'correct_answer', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => setShowExamModal(false)}>
                  Cancel
                </button>
                <button onClick={() => handleDeployTest('EXAM')} className="btn btn-primary">
                  Deploy Exam
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ================= EDIT EXAM MODAL ================= */}
      {showEditQuizModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="glass modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', fontFamily: 'Fraunces, serif' }}>
              ✏️ Edit Exam Settings & Questions
            </h3>

            {/* Part 1: General Exam Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div>
                <label className="label">Exam Title</label>
                <input 
                  type="text" 
                  className="input" 
                  value={editQuizTitle} 
                  onChange={(e) => setEditQuizTitle(e.target.value)} 
                />
              </div>
              <div>
                <label className="label">Duration (Minutes)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={editQuizDuration} 
                  onChange={(e) => setEditQuizDuration(e.target.value)} 
                />
              </div>
              <div>
                <label className="label">Maximum Marks</label>
                <input 
                  type="number" 
                  className="input" 
                  value={editQuizMaxMarks} 
                  onChange={(e) => setEditQuizMaxMarks(e.target.value)} 
                />
              </div>
              <div>
                <label className="label">Shuffled Questions</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={editQuizShuffle} 
                    onChange={(e) => setEditQuizShuffle(e.target.checked)} 
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Enable Question Shuffling</span>
                </div>
              </div>
              <div>
                <label className="label">Scheduled Start (Optional)</label>
                <input 
                  type="datetime-local" 
                  className="input" 
                  value={editQuizStart ? editQuizStart.substring(0, 16) : ''} 
                  onChange={(e) => setEditQuizStart(e.target.value)} 
                />
              </div>
              <div>
                <label className="label">Scheduled End (Optional)</label>
                <input 
                  type="datetime-local" 
                  className="input" 
                  value={editQuizEnd ? editQuizEnd.substring(0, 16) : ''} 
                  onChange={(e) => setEditQuizEnd(e.target.value)} 
                />
              </div>
            </div>

            {/* Part 2: Questions Editor */}
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)', textAlign: 'left' }}>
              Questions List ({editQuizQuestions.length})
            </h4>
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
              {editQuizQuestions.map((q, qIndex) => (
                <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.8rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-primary)' }}>Question #{qIndex + 1}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Marks:</label>
                      <input 
                        type="number" 
                        style={{ width: '60px', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                        value={q.points} 
                        onChange={(e) => updateEditQuestion(qIndex, 'points', e.target.value)}
                      />
                    </div>
                  </div>

                  <label className="label" style={{ fontSize: '0.8rem' }}>Question Text</label>
                  <textarea 
                    className="input"
                    style={{ minHeight: '60px', resize: 'vertical', fontSize: '0.85rem', marginBottom: '0.8rem' }}
                    value={q.question_text} 
                    onChange={(e) => updateEditQuestion(qIndex, 'question_text', e.target.value)}
                  />

                  {q.question_type === 'MCQ' ? (
                    <div>
                      <label className="label" style={{ fontSize: '0.8rem' }}>Options</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
                        {[0, 1, 2, 3].map((optIndex) => (
                          <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{optIndex}:</span>
                            <input 
                              type="text" 
                              className="input"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                              value={q.options[optIndex] || ''} 
                              onChange={(e) => updateEditQuestionOption(qIndex, optIndex, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <label className="label" style={{ fontSize: '0.8rem' }}>Correct Option Index</label>
                      <select 
                        className="input"
                        style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                        value={q.correct_answer}
                        onChange={(e) => updateEditQuestion(qIndex, 'correct_answer', e.target.value)}
                      >
                        {[0, 1, 2, 3].map(i => (
                          <option key={i} value={i}>Option {i}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="label" style={{ fontSize: '0.8rem' }}>Reference Answer Key (Optional)</label>
                      <textarea 
                        className="input"
                        style={{ minHeight: '50px', resize: 'vertical', fontSize: '0.85rem' }}
                        value={q.correct_answer_json || ''} 
                        onChange={(e) => updateEditQuestion(qIndex, 'correct_answer_json', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button 
                onClick={() => setShowEditQuizModal(false)} 
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditQuiz} 
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DELETE QUIZ OVERLAY ================= */}
      {deleteQuizTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Delete Test</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to delete this test and all student attempt history? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteQuizTargetId(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const targetId = deleteQuizTargetId;
                  setDeleteQuizTargetId(null);
                  await executeDeleteQuiz(targetId);
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

      {/* ================= CUSTOM CONFIRM DELETE THREAD OVERLAY ================= */}
      {deleteThreadTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Delete Thread</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to delete this discussion thread? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteThreadTargetId(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const targetId = deleteThreadTargetId;
                  setDeleteThreadTargetId(null);
                  await executeDeleteThread(targetId);
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

      {/* ================= IN-SCREEN TOAST ALERTS ================= */}
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
    </div>
    </div>
  );
}
