'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function AdvancedQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id;

  const [user, setUser] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Phases: 'view' | 'playing' | 'result'
  const [phase, setPhase] = useState('view');

  // Pre-Quiz View details
  const [pastAttempt, setPastAttempt] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [allAttemptsList, setAllAttemptsList] = useState([]);
  const [isTeacher, setIsTeacher] = useState(false);

  // Guest details for public quizzes
  const [guestName, setGuestName] = useState('');
  const [guestAttempted, setGuestAttempted] = useState(false);

  // Playing Phase states
  const [timeLeft, setTimeLeft] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(null); // 'grading_mcqs' | 'grading_theory' | 'saving'
  const timerRef = useRef(null);

  // Result Phase state
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [feedbackDetails, setFeedbackDetails] = useState({});

  // --- CHEATING PREVENTION / VIOLATION STATES ---
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationReason, setViolationReason] = useState(null);
  const [warningViolationType, setWarningViolationType] = useState('');

  const securityViolationCount = useRef(0);
  const isWindowFocused = useRef(true);
  const examStarted = useRef(false);
  const trustedRadioChecks = useRef({});
  const isGracePeriod = useRef(true);

  useEffect(() => {
    if (!quizId) return;
    loadInitialData();
  }, [quizId]);

  // Main countdown timer
  useEffect(() => {
    if (phase === 'playing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, timeLeft]);

  // --- SECURE EXAM CONTROLS LIFE-CYCLE ---
  useEffect(() => {
    if (phase !== 'playing') {
      examStarted.current = false;
      return;
    }

    examStarted.current = true;
    securityViolationCount.current = 0;
    isWindowFocused.current = true;
    trustedRadioChecks.current = {};
    isGracePeriod.current = true;

    const graceTimer = setTimeout(() => {
      isGracePeriod.current = false;
    }, 3000);

    // 1. Fullscreen request
    enterFullscreen();

    // 2. Fullscreen monitor
    const handleFullscreenChange = () => {
      if (!examStarted.current || isGracePeriod.current) return;
      const isFull = document.fullscreenElement || 
                     document.webkitIsFullScreen || 
                     document.mozFullScreen || 
                     document.msFullscreenElement;
      if (!isFull) {
        handleSecurityViolationEvent("exiting fullscreen mode");
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // 3. Tab switching & focus loss
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSecurityViolationEvent("tab switching / focus loss");
      } else if (document.visibilityState === 'visible') {
        isWindowFocused.current = true;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleWindowBlur = () => {
      setTimeout(() => {
        if (!document.hasFocus() && examStarted.current) {
          handleSecurityViolationEvent("tab switching / focus loss");
        }
      }, 250);
    };
    window.addEventListener('blur', handleWindowBlur);

    const handleWindowFocus = () => {
      isWindowFocused.current = true;
    };
    window.addEventListener('focus', handleWindowFocus);

    // 4. Timer Throttling Poll (200ms)
    let lastIntervalTime = Date.now();
    const throttlingTimer = setInterval(() => {
      if (!examStarted.current) return;
      const now = Date.now();
      const diff = now - lastIntervalTime;
      lastIntervalTime = now;
      if (diff > 1500) {
        handleSecurityViolationEvent("tab switching (detected via background timer throttling)");
      }
    }, 200);

    // 5. requestAnimationFrame suspension check
    let lastFrameTime = Date.now();
    let frameId;
    const checkFrame = () => {
      if (examStarted.current) {
        const now = Date.now();
        const diff = now - lastFrameTime;
        if (diff > 2000) {
          handleSecurityViolationEvent("tab switching (detected via frame suspension)");
        }
      }
      lastFrameTime = Date.now();
      frameId = requestAnimationFrame(checkFrame);
    };
    frameId = requestAnimationFrame(checkFrame);

    // 6. Visibility API Tampering & Hooking Detection
    const detectVisibilityTampering = () => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        if (descriptor && descriptor.get) {
          const getterStr = descriptor.get.toString();
          if (!getterStr.includes('[native code]')) {
            handleSecurityViolationEvent("unauthorized modification of visibility API (cheating extension)");
          }
        }
        const hiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
        if (hiddenDescriptor && hiddenDescriptor.get) {
          const getterStr = hiddenDescriptor.get.toString();
          if (!getterStr.includes('[native code]')) {
            handleSecurityViolationEvent("unauthorized modification of visibility API (cheating extension)");
          }
        }
      } catch (e) {
        console.log("Anti-tamper check error: ", e);
      }
    };
    const tamperTimer = setInterval(detectVisibilityTampering, 1000);

    // 7. Clipboard and drag/drop blocks
    const blockClipboardOrDrag = (e) => {
      if (!examStarted.current) return;
      e.preventDefault();
      e.stopPropagation();

      let type = e.type;
      let msg = "clipboard action (" + type + ")";
      if (type === 'drop') {
        msg = "drag-and-drop text insertion";
      }
      handleSecurityViolationEvent(msg);
    };

    window.addEventListener('copy', blockClipboardOrDrag, true);
    window.addEventListener('cut', blockClipboardOrDrag, true);
    window.addEventListener('paste', blockClipboardOrDrag, true);
    window.addEventListener('drop', blockClipboardOrDrag, true);

    const blockDragOver = (e) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', blockDragOver, true);

    // 8. Right-click Context Menu disable
    const blockContextMenu = (e) => {
      if (!examStarted.current) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('contextmenu', blockContextMenu, true);

    // 9. Text selection block (highlights > 10 chars)
    const handleSelectionChange = () => {
      if (!examStarted.current) return;
      const selection = window.getSelection().toString().trim();
      if (selection.length > 10) {
        handleSecurityViolationEvent("selecting/highlighting text");
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);

    // 10. Key shortcuts block (F12, DevTools, Ctrl+C/V/X/U, Alt/Meta)
    const blockKeys = (e) => {
      if (!examStarted.current) return;

      if (e.altKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSecurityViolationEvent("forbidden modifier key (Alt/Meta) shortcut invocation");
        return;
      }

      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 'v') ||
        (e.ctrlKey && e.key === 'x')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleSecurityViolationEvent("forbidden keyboard shortcut");
      }
    };
    document.addEventListener('keydown', blockKeys, true);

    // 11. Textarea input size jump and background value polling check
    const textareas = document.querySelectorAll('textarea');
    const textareaHistory = new Map();

    textareas.forEach((t) => {
      textareaHistory.set(t, { lastLength: t.value.length, lastValue: t.value });
    });

    const handleInputCheck = (e) => {
      if (!examStarted.current) return;
      const t = e.target;
      const hist = textareaHistory.get(t) || { lastLength: 0, lastValue: '' };
      const currentLength = t.value.length;
      const delta = currentLength - hist.lastLength;

      if (e.inputType === 'insertFromPaste' || delta > 15) {
        handleSecurityViolationEvent("copy-pasting or auto-filling text");
      }
      textareaHistory.set(t, { ...hist, lastLength: currentLength });
    };

    textareas.forEach((t) => {
      t.addEventListener('input', handleInputCheck);
    });

    // 12. Textarea 200ms polling delta checker
    const textareaPoll = setInterval(() => {
      if (!examStarted.current) return;
      document.querySelectorAll('textarea').forEach((t) => {
        const hist = textareaHistory.get(t) || { lastLength: 0, lastValue: '' };
        const currentValue = t.value;
        if (currentValue !== hist.lastValue) {
          const delta = currentValue.length - hist.lastValue.length;
          if (delta > 8) {
            handleSecurityViolationEvent("sudden text insertion (copy-paste/autofill)");
          }
          textareaHistory.set(t, { ...hist, lastValue: currentValue });
        }
      });
    }, 200);

    // 13. MCQ Background verification polling (200ms)
    const mcqVerifyPoll = setInterval(() => {
      if (!examStarted.current) return;
      document.querySelectorAll('input[type="radio"]').forEach((radio) => {
        if (radio.checked) {
          if (
            trustedRadioChecks.current[radio.name] !== undefined &&
            trustedRadioChecks.current[radio.name] !== radio.value
          ) {
            handleSecurityViolationEvent("programmatic answer selection (copy-paste/autofill extension)");
          }
        }
      });
    }, 200);

    // 14. DOM Mutation Observer to check overlays
    const domObserver = new MutationObserver((mutations) => {
      if (!examStarted.current) return;
      for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.id === 'warningModal' ||
                node.id === 'violationModal' ||
                node.className.includes('tooltip') ||
                node.className.includes('modal') ||
                node.tagName.toLowerCase() === 'style' ||
                node.tagName.toLowerCase() === 'script'
              ) {
                continue;
              }
              handleSecurityViolationEvent("unauthorized extension overlay injection");
            }
          }
        }
      }
    });

    domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Cleanup all event handlers and intervals
    return () => {
      examStarted.current = false;
      clearTimeout(graceTimer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(throttlingTimer);
      cancelAnimationFrame(frameId);
      clearInterval(tamperTimer);
      window.removeEventListener('copy', blockClipboardOrDrag, true);
      window.removeEventListener('cut', blockClipboardOrDrag, true);
      window.removeEventListener('paste', blockClipboardOrDrag, true);
      window.removeEventListener('drop', blockClipboardOrDrag, true);
      window.removeEventListener('dragover', blockDragOver, true);
      window.removeEventListener('contextmenu', blockContextMenu, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', blockKeys, true);
      textareas.forEach((t) => {
        t.removeEventListener('input', handleInputCheck);
      });
      clearInterval(textareaPoll);
      clearInterval(mcqVerifyPoll);
      domObserver.disconnect();
    };
  }, [phase]);

  // Monitors radio trusted clicks
  const handleMCQTrustedSelect = (questionId, optionIndex, e) => {
    if (e.isTrusted) {
      trustedRadioChecks.current[`answer_${questionId}`] = String(optionIndex);
      handleAnswerSelect(questionId, optionIndex);
    } else {
      handleSecurityViolationEvent("untrusted programmatic option change");
    }
  };

  const handleSecurityViolationEvent = (reason) => {
    if (!examStarted.current) return;

    // Avoid multiple trigger alerts in the same blur cycle
    if (!isWindowFocused.current) return;

    isWindowFocused.current = false;
    securityViolationCount.current += 1;
    setWarningViolationType(reason);

    if (securityViolationCount.current === 1) {
      setShowWarningModal(true);
    } else {
      triggerSecurityViolation(reason);
    }
  };

  const triggerSecurityViolation = (reason) => {
    examStarted.current = false;
    submitQuiz(false, reason);
  };

  const dismissWarning = () => {
    setShowWarningModal(false);
    isWindowFocused.current = true;
    enterFullscreen();
  };

  const dismissViolation = () => {
    setShowViolationModal(false);
    isWindowFocused.current = true;
    enterFullscreen();
  };

  const enterFullscreen = () => {
    const docEl = document.documentElement;
    const requestFS = docEl.requestFullscreen || 
                      docEl.mozRequestFullScreen || 
                      docEl.webkitRequestFullscreen || 
                      docEl.msRequestFullscreen;
    if (requestFS) {
      requestFS.call(docEl).catch((err) => {
        console.log("Fullscreen request failed: " + err.message);
      });
    }
  };

  const handleDownloadQuizExcel = () => {
    if (!allAttemptsList || allAttemptsList.length === 0) {
      alert('No student attempts to download.');
      return;
    }

    const headers = ['Register Number', 'Student Name', 'Marks Obtained', 'Max Marks', 'Violation Reason', 'Submit Time'];
    const rows = allAttemptsList.map(att => [
      `"\t${att.users?.reg_no || 'Guest/N/A'}"`,
      `"${att.users?.name || att.guest_name || 'Guest User'}"`,
      att.score,
      att.max_score || quiz?.max_marks || 0,
      `"${att.violation_reason || 'None'}"`,
      new Date(att.submit_time).toLocaleString()
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${quiz?.title?.replace(/\s+/g, '_') || 'test'}_grades.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DATABASE DATA LOADING ---
  const loadInitialData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    let profile = null;
    if (session) {
      const { data: prof } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      profile = prof;
      setUser(prof);
    }

    // Fetch Quiz
    const { data: qz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    setQuiz(qz);

    if (qz) {
      const teacherRole = profile && (profile.role === 'Faculty' || profile.role === 'Administrator' || qz.creator_id === profile.id);
      setIsTeacher(teacherRole);

      // Fetch Questions
      const { data: qns } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId);
      setQuestions(qns || []);

      // Fetch Leaderboard
      const { data: lb } = await supabase
        .from('quiz_attempts')
        .select('*, users(name, username)')
        .eq('quiz_id', quizId)
        .order('score', { ascending: false })
        .limit(10);
      setLeaderboard(lb || []);

      // Fetch user's own past attempt
      if (profile) {
        const { data: past } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', quizId)
          .eq('student_id', profile.id)
          .order('score', { ascending: false })
          .limit(1)
          .maybeSingle();
        setPastAttempt(past);
        if (past && !teacherRole) {
          setCurrentAttempt(past);
          try {
            setFeedbackDetails(JSON.parse(past.ai_feedback || '{}'));
          } catch (e) {
            setFeedbackDetails({});
          }
          setPhase('result');
        }
      }

      // Fetch all attempts if teacher
      if (teacherRole) {
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*, users(name, username, reg_no)')
          .eq('quiz_id', quizId)
          .order('submit_time', { ascending: false });
        setAllAttemptsList(attempts || []);
      }
    }

    setLoading(false);
  };

  const handleStartQuiz = () => {
    if (quiz?.is_public && !user && !guestName.trim()) {
      alert('Please enter your name to begin the public test.');
      return;
    }
    enterFullscreen();
    setPhase('playing');
    setTimeLeft((quiz?.duration_minutes || 30) * 60);
  };

  const handleAnswerSelect = (questionId, optionIndex) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: String(optionIndex)
    }));
  };

  const handleTextAnswerChange = (questionId, text) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: text
    }));
  };

  const handleAutoSubmit = () => {
    submitQuiz(true, "exam time limit expired");
  };

  const submitQuiz = async (isAutoSaved = false, violationReasonVal = null) => {
    if (submitting) return;
    examStarted.current = false; // Disable cheating prevention checks immediately on submission
    setSubmitting(true);
    setSubmissionProgress('grading_mcqs');
    if (timerRef.current) clearInterval(timerRef.current);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      // De-authenticate active fullscreen state
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      let finalScore = 0;
      let totalMaxMarks = 0;
      const feedbackMap = {};

      // 1. Grade MCQs locally
      for (const q of questions) {
        totalMaxMarks += q.points;
        const studentAns = studentAnswers[q.id] || '';

        const itemFeedback = {
          questionText: q.question_text,
          questionType: q.question_type,
          studentAnswer: studentAns,
          maxMarks: q.points,
          score: 0,
          feedback: '',
          correct: false
        };

        if (q.question_type === 'MCQ') {
          let corrects = [];
          try {
            corrects = JSON.parse(q.correct_answer_json || '[]');
          } catch (e) {
            corrects = [q.correct_answer_json];
          }

          if (studentAns.trim() !== '') {
            const correctIdx = corrects[0];
            if (studentAns === String(correctIdx)) {
              finalScore += q.points;
              itemFeedback.score = q.points;
              itemFeedback.feedback = 'Correct answer! Maximum marks awarded.';
              itemFeedback.correct = true;
            } else {
              const penalty = quiz.negative_marking ? (q.negative_points || 0) : 0;
              finalScore -= penalty;
              itemFeedback.score = -penalty;
              itemFeedback.feedback = `Incorrect answer. The correct option was option index ${correctIdx}.`;
              itemFeedback.correct = false;
            }
          } else {
            itemFeedback.feedback = 'No option selected.';
          }
          feedbackMap[q.id] = itemFeedback;
        }
      }

      // 2. Grade Theory questions via serverless AI
      const theoryQuestions = questions.filter(q => q.question_type !== 'MCQ');
      
      if (theoryQuestions.length > 0 && !violationReasonVal) {
        setSubmissionProgress('grading_theory');
        
        for (const q of theoryQuestions) {
          const studentAns = studentAnswers[q.id] || '';
          const itemFeedback = {
            questionText: q.question_text,
            questionType: q.question_type,
            studentAnswer: studentAns,
            maxMarks: q.points,
            score: 0,
            feedback: '',
            correct: false
          };

          if (studentAns.trim() !== '') {
            try {
              let refAnswer = q.correct_answer_json;
              if (!refAnswer || refAnswer.trim() === '' || refAnswer === '[]') {
                refAnswer = 'A logical and concise academic explanation.';
              }

              const res = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  ...authHeaders
                },
                body: JSON.stringify({
                  question: q.question_text,
                  answerKey: refAnswer,
                  rubric: 'Assess grammar, reasoning, terminology accuracy, and completion.',
                  maxMarks: q.points,
                  studentAnswer: studentAns
                })
              });

              if (res.ok) {
                const aiResult = await res.json();
                const score = Number(aiResult.score) || 0;
                finalScore += score;
                itemFeedback.score = score;
                itemFeedback.feedback = aiResult.feedback || 'AI evaluated successfully.';
                itemFeedback.ai_response = aiResult;
                if (score >= q.points * 0.75) {
                  itemFeedback.correct = true;
                }
              } else {
                throw new Error('AI service error');
              }
            } catch (err) {
              const fallback = Math.max(1, Math.floor(q.points / 2));
              finalScore += fallback;
              itemFeedback.score = fallback;
              itemFeedback.feedback = 'AI grader was busy. Awarded half-marks for completion.';
            }
          } else {
            itemFeedback.feedback = 'No answer submitted.';
          }
          feedbackMap[q.id] = itemFeedback;
        }
      } else if (violationReasonVal) {
        // If auto-submitted due to violation, grade remaining theory questions as 0 marks
        for (const q of theoryQuestions) {
          feedbackMap[q.id] = {
            questionText: q.question_text,
            questionType: q.question_type,
            studentAnswer: studentAnswers[q.id] || '',
            maxMarks: q.points,
            score: 0,
            feedback: 'Evaluation suspended: Quiz auto-submitted due to a security violation.',
            correct: false
          };
        }
      }

      if (finalScore < 0) finalScore = 0;

      // 3. Save Attempt to Supabase
      setSubmissionProgress('saving');
      
      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: quizId,
          student_id: user?.id || null,
          guest_name: user ? null : guestName.trim(),
          score: finalScore,
          max_score: totalMaxMarks,
          answers_json: JSON.stringify(studentAnswers),
          ai_feedback: JSON.stringify(feedbackMap),
          auto_saved: isAutoSaved,
          violation_reason: violationReasonVal
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // 4. Update student points
      if (user && !violationReasonVal) {
        await supabase.rpc('increment_score', {
          user_id: user.id,
          points: finalScore * 5 + 5
        });
      }

      setCurrentAttempt(attempt);
      setPastAttempt(attempt);
      setFeedbackDetails(feedbackMap);
      setPhase('result');
      
      if (!user) {
        setGuestAttempted(true);
      }
    } catch (err) {
      alert(`Error submitting evaluation: ${err.message}`);
    } finally {
      setSubmitting(false);
      setSubmissionProgress(null);
    }
  };

  const handleDeleteAttempt = async (attemptId) => {
    if (!confirm('Are you sure you want to delete this student attempt record?')) return;
    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .delete()
        .eq('id', attemptId);

      if (error) throw error;

      setAllAttemptsList(allAttemptsList.filter(a => a.id !== attemptId));
      alert('Attempt deleted successfully.');
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const showPastAttemptDetails = (attempt) => {
    setCurrentAttempt(attempt);
    let parsedFeedback = {};
    try {
      parsedFeedback = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      parsedFeedback = {};
    }
    setFeedbackDetails(parsedFeedback);
    setPhase('result');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Evaluation details...</h2>
      </div>
    );
  }

  return (
    <div>
      {phase !== 'playing' && <Navbar />}
      <div className="container">
        
        {/* PHASE 1: PRE-QUIZ VIEW */}
        {phase === 'view' && (
          <div className="animate-fade-in">
            
            {/* Banner card */}
            <div className="glass card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <span className="badge badge-student" style={{ marginBottom: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                {quiz.type || 'Academic Test'}
              </span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{quiz.title}</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>{quiz.description || 'Practice test covering class materials.'}</p>
              
              <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>DURATION</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{quiz.duration_minutes} Minutes</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL SCORE</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{quiz.max_marks} Marks</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>SHUFFLE QUESTIONS</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{quiz.shuffle_questions ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>NEGATIVE MARKING</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{quiz.negative_marking ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>

            {/* Main view grid split: Start Quiz Panel & Leaderboard */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: isTeacher ? '1fr' : '1fr 340px' }}>
              
              {/* Left Panel */}
              <div>
                
                {/* Guest access form */}
                {!user && quiz.is_public && !guestAttempted && (
                  <div className="glass card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.8rem' }}>Begin as Guest</h3>
                    <div className="input-group">
                      <label className="label">Enter Your Full Name</label>
                      <input
                        type="text"
                        required
                        className="input"
                        placeholder="E.g. David Miller"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Begin button / past attempt status */}
                {(!guestAttempted && (!pastAttempt || isTeacher)) ? (
                  <div className="glass card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                      Ready to start? Once you click the button, the exam enters full-screen. Navigating away, switching tabs, right-clicking, or copying text will trigger warnings and automatic exit.
                    </p>
                    <button onClick={handleStartQuiz} className="btn btn-primary" style={{ padding: '0.8rem 3rem', fontSize: '1rem' }}>
                      Start Test Now
                    </button>
                  </div>
                ) : (
                  !isTeacher && (
                    <div className="glass card" style={{ padding: '2rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '3rem' }}>✅</span>
                      <h4 style={{ fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>Test Already Taken</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        You have submitted your answers for this evaluation.
                      </p>
                      {pastAttempt && (
                        <button onClick={() => showPastAttemptDetails(pastAttempt)} className="btn btn-secondary">
                          View Grade & AI Feedback ({pastAttempt.score}/{pastAttempt.max_score})
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* TEACHER ONLY OVERSIGHT PANEL */}
                {isTeacher && (
                  <div style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>📥 Student Test Submissions</h3>
                      <button
                        onClick={handleDownloadQuizExcel}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      >
                        📊 Export Test Grades
                      </button>
                    </div>
                    {allAttemptsList.length === 0 ? (
                      <div className="glass card" style={{ color: 'var(--text-secondary)' }}>No student submissions recorded for this test yet.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.8rem' }}>
                        {allAttemptsList.map((att) => (
                          <div key={att.id} className="glass card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                            <div>
                              <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>
                                {att.users?.name || att.guest_name || 'Guest User'}
                              </h4>
                              {att.violation_reason ? (
                                <span className="badge badge-student" style={{ background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontSize: '0.65rem' }}>
                                  Violated: {att.violation_reason}
                                </span>
                              ) : (
                                <span className="badge badge-student" style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', fontSize: '0.65rem' }}>
                                  Completed
                                </span>
                              )}
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Submitted: {new Date(att.submit_time).toLocaleString()}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                {att.score}/{att.max_score}
                              </span>
                              <button onClick={() => showPastAttemptDetails(att)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                Details
                              </button>
                              <button onClick={() => handleDeleteAttempt(att.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Right Panel: Leaderboard */}
              {!isTeacher && (
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>🏆 Leaderboard</h3>
                  <div className="glass" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}>
                    {leaderboard.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No rankings available yet.</p>
                    ) : (
                      leaderboard.map((lbItem, idx) => (
                        <div key={lbItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--warning)' : 'var(--text-muted)' }}>#{idx + 1}</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 550 }}>
                              {lbItem.users?.name || lbItem.guest_name || 'Guest'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>{lbItem.score} pts</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* PHASE 2: PLAYING QUIZ */}
        {phase === 'playing' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Stick Timer header bar */}
            <div className="glass card" style={{ position: 'sticky', top: '1rem', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', marginBottom: '2rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{quiz.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.05)', border: timeLeft < 60 ? '1px solid var(--danger)' : '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ color: timeLeft < 60 ? 'var(--danger)' : 'var(--color-primary)', fontWeight: 800 }}>⏱️ {formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* AI Grading Loader */}
            {submitting && (
              <div className="glass card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '3px solid rgba(0,0,0,0.05)', borderLeftColor: 'var(--color-primary)', borderRadius: '50%', width: '35px', height: '35px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                <p style={{ fontWeight: 700 }}>
                  {submissionProgress === 'grading_mcqs' && 'Grading Multiple Choice Questions...'}
                  {submissionProgress === 'grading_theory' && 'Running serverless AI evaluator for Theory answers...'}
                  {submissionProgress === 'saving' && 'Saving scores to database...'}
                </p>
              </div>
            )}

            {/* Questions list */}
            {!submitting && (
              <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2.5rem' }}>
                {questions.map((q, idx) => {
                  let options = [];
                  try {
                    options = JSON.parse(q.options_json || '[]');
                  } catch (e) {
                    options = [];
                  }

                  return (
                    <div key={q.id} className="glass card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Q{idx + 1}.</span>
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{q.question_text}</p>
                          <span className="badge badge-student" style={{ fontSize: '0.6rem', marginTop: '0.25rem', background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>
                            {q.question_type} • {q.points} Marks
                          </span>
                        </div>
                      </div>

                      {/* Render question based on type */}
                      {q.question_type === 'MCQ' ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          {options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              onClick={(e) => handleMCQTrustedSelect(q.id, optIdx, e)}
                              style={{
                                padding: '0.8rem 1.2rem',
                                background: studentAnswers[q.id] === String(optIdx) ? 'rgba(99, 102, 241, 0.08)' : '#FFFFFF',
                                border: studentAnswers[q.id] === String(optIdx) ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                transition: 'var(--transition)',
                              }}
                            >
                              <span style={{ fontWeight: 600, marginRight: '0.5rem', color: studentAnswers[q.id] === String(optIdx) ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              {opt}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="input-group">
                          <label className="label">Write your essay / explanation below:</label>
                          <textarea
                            className="input"
                            style={{ minHeight: '120px', resize: 'vertical' }}
                            placeholder="Type your answer in detail here..."
                            value={studentAnswers[q.id] || ''}
                            onChange={(e) => handleTextAnswerChange(q.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!submitting && (
              <button
                onClick={() => submitQuiz(false, null)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.8rem', fontSize: '1.1rem' }}
              >
                Submit Answers for AI Evaluation
              </button>
            )}

          </div>
        )}

        {/* PHASE 3: DETAILED RESULT VIEW */}
        {phase === 'result' && currentAttempt && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            
            {/* Score circle header card */}
            <div className="glass card" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '2rem' }}>
              <span style={{ fontSize: '3rem' }}>🎉</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>Test Evaluation Summary</h2>
              
              <div style={{ margin: '1.5rem 0' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>FINAL SCORE</span>
                <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--success)' }}>
                  {currentAttempt.score}/{currentAttempt.max_score}
                </span>
                {currentAttempt.violation_reason && (
                  <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--danger)', fontWeight: 700, background: 'rgba(239,68,68,0.08)', padding: '0.5rem', borderRadius: '8px', width: 'fit-content', margin: '0.5rem auto' }}>
                    ⚠️ Exam Auto-Submitted Due To Security Violation: "{currentAttempt.violation_reason}"
                  </span>
                )}
                {currentAttempt.auto_saved && !currentAttempt.violation_reason && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Auto-submitted due to timer expiry</span>
                )}
              </div>
              <button 
                onClick={() => {
                  if (quiz?.classroom_id) {
                    router.push(`/classroom/${quiz.classroom_id}`);
                  } else {
                    router.push('/');
                  }
                }} 
                className="btn btn-secondary"
              >
                Back to Classroom
              </button>
            </div>

            {/* Question by question feedback list */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>📝 Question-by-Question Grading</h3>
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '3rem' }}>
              {Object.keys(feedbackDetails).map((qId, index) => {
                const f = feedbackDetails[qId];
                return (
                  <div key={qId} className="glass card" style={{ padding: '1.5rem', borderLeft: f.correct ? '4px solid var(--success)' : '4px solid var(--danger)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Q{index + 1}. {f.questionText}</h4>
                      <span style={{ fontWeight: 800, color: f.correct ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                        {f.score} / {f.maxMarks} Marks
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ display: 'block', fontWeight: 650, color: 'var(--text-muted)' }}>YOUR SUBMISSION:</span>
                        <p style={{ color: 'var(--text-primary)', background: '#F8FAFC', padding: '0.6rem 1rem', borderRadius: '8px', marginTop: '0.2rem' }}>
                          {f.studentAnswer || '[Empty Response]'}
                        </p>
                      </div>

                      {/* AI evaluation or MCQs grading notes */}
                      <div>
                        <span style={{ display: 'block', fontWeight: 650, color: 'var(--text-muted)' }}>AI EVALUATION FEEDBACK:</span>
                        <p style={{ color: 'var(--text-secondary)', background: 'rgba(99, 102, 241, 0.03)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.08)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                          {f.feedback}
                        </p>
                      </div>

                      {/* If AI evaluation detailed responses are attached */}
                      {f.ai_response && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>✔️ Strengths</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.ai_response.strengths}</p>
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>❌ Weaknesses</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.ai_response.weaknesses}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

      {/* --- EXAM SECURITY MODAL OVERLAYS --- */}

      {/* 1. First Warning Modal */}
      {showWarningModal && (
        <div id="warningModal" className="modal-overlay">
          <div className="glass modal-content" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--warning)', marginTop: '1rem', marginBottom: '0.5rem' }}>
              Secure Exam Warning!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Violation detected: <strong style={{ color: '#dc2626' }}>{warningViolationType}</strong>. This is your **first warning**. Any further violation will result in immediate automatic submission.
            </p>
            <button onClick={dismissWarning} className="btn btn-primary" style={{ width: '100%' }}>
              Okay, return to Exam
            </button>
          </div>
        </div>
      )}

      {/* 2. Second Warning (Violation) Modal */}
      {showViolationModal && (
        <div id="violationModal" className="modal-overlay">
          <div className="glass modal-content" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🚨</span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--danger)', marginTop: '1rem', marginBottom: '0.5rem' }}>
              Security Violation Registered!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              You navigated away from the secure exam environment again. This is a **registered violation**.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              One more violation will result in **immediate automatic submission** and exit.
            </p>
            <button onClick={dismissViolation} className="btn btn-primary" style={{ width: '100%', background: 'var(--danger)' }}>
              Okay, I understand
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
