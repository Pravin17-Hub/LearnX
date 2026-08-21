'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function AdvancedQuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [queuePosition, setQueuePosition] = useState(null);

  // Active attempt and instruction state
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [visibleWarningCount, setVisibleWarningCount] = useState(0);
  const [completedStudentsCount, setCompletedStudentsCount] = useState(0);

  // In-Screen Custom Popups / Alerts & Modals
  const [toast, setToast] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [grantAccessTarget, setGrantAccessTarget] = useState(null);
  const [pdfConfirmTarget, setPdfConfirmTarget] = useState(null);
  const [editMarksTarget, setEditMarksTarget] = useState(null);
  const [editQuestionsData, setEditQuestionsData] = useState([]);
  const [editQuestionsMarks, setEditQuestionsMarks] = useState({});

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
  const [totalClassroomStudents, setTotalClassroomStudents] = useState(0);
  const [classroomStudents, setClassroomStudents] = useState([]);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [isClassCreator, setIsClassCreator] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const violationProofsRef = useRef([]);
  const initialWidth = useRef(0);
  const initialHeight = useRef(0);

  const answersRef = useRef({});
  const questionsRef = useRef([]);

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
  const lastViolationTime = useRef(0);
  const isWarningModalOpen = useRef(false);
  const topTouchStart = useRef(null);
  const activeAttemptRef = useRef(activeAttempt);
  const textSaveDebounce = useRef(null);
  const authTokenRef = useRef(null);

  useEffect(() => {
    activeAttemptRef.current = activeAttempt;
  }, [activeAttempt]);

  useEffect(() => {
    activeAttemptRef.current = activeAttempt;
  }, [activeAttempt]);

  useEffect(() => {
    if (!quizId) return;
    loadInitialData();
  }, [quizId]);

  // URL Phase synchronization to act as separate pages
  useEffect(() => {
    if (phase === 'playing') {
      document.documentElement.style.overscrollBehaviorX = 'contain';
      document.body.style.overscrollBehaviorX = 'contain';
    } else {
      document.documentElement.style.overscrollBehaviorX = 'auto';
      document.body.style.overscrollBehaviorX = 'auto';
    }
    return () => {
      document.documentElement.style.overscrollBehaviorX = 'auto';
      document.body.style.overscrollBehaviorX = 'auto';
    };
  }, [phase]);

  // Intercept Next.js query navigation POP events dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlPhase = searchParams?.get('phase') || 'view';

    if (examStarted.current && urlPhase !== 'playing') {
      window.history.pushState(null, '', '?phase=playing');
      handleSecurityViolationEvent("browser back button click / navigation swipe");
    }
  }, [searchParams]);

  useEffect(() => {
    const handlePhasePop = (e) => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlPhase = params.get('phase') || 'view';

        if (examStarted.current) {
          // Block popstate transition away from active exam without confirmation
          e.stopImmediatePropagation();
          e.stopPropagation();
          e.preventDefault();
          window.history.pushState(null, '', '?phase=playing');
          handleSecurityViolationEvent("browser back button click / navigation swipe");
          return;
        }

        if (urlPhase === 'result') {
          const attemptId = params.get('attemptId');
          const matchedAtt = allAttemptsList.find(a => String(a.id) === attemptId);
          if (matchedAtt) {
            setCurrentAttempt(matchedAtt);
            setFeedbackDetails(JSON.parse(matchedAtt.ai_feedback || '{}'));
            setPhase('result');
          } else {
            setPhase('view');
          }
        } else {
          setPhase('view');
        }
      }
    };

    window.addEventListener('popstate', handlePhasePop, true);
    return () => window.removeEventListener('popstate', handlePhasePop, true);
  }, [allAttemptsList]);

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

  // Sync studentAnswers to ref
  useEffect(() => {
    answersRef.current = studentAnswers;
  }, [studentAnswers]);

  // Autosave answers every 3 seconds
  useEffect(() => {
    if (phase !== 'playing' || !activeAttempt) return;

    const interval = setInterval(async () => {
      try {
        await supabase
          .from('quiz_attempts')
          .update({
            answers_json: JSON.stringify(answersRef.current),
            submit_time: new Date().toISOString()
          })
          .eq('id', activeAttempt.id);
      } catch (e) {
        console.error('Autosave failed:', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [phase, activeAttempt]);

  // Real-time listener and fast polling for instant result display without refresh
  useEffect(() => {
    const currentFeedbackStr = currentAttempt?.ai_feedback || '';
    const isCurrentPending = currentFeedbackStr.includes('"status":"queued"') || currentFeedbackStr.includes('"status":"grading"');
    
    if (phase !== 'result' || !currentAttempt || !isCurrentPending) return;

    let isMounted = true;

    // 1. Setup Supabase Realtime WebSocket for instant 0ms result updates
    const channel = supabase
      .channel(`quiz-attempt-live-${currentAttempt.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quiz_attempts',
          filter: `id=eq.${currentAttempt.id}`
        },
        (payload) => {
          if (!isMounted) return;
          const updated = payload.new;
          const fb = updated?.ai_feedback || '';
          if (!fb.includes('"status":"queued"') && !fb.includes('"status":"grading"')) {
            console.log('[Realtime] Attempt graded event received! Displaying result...');
            setCurrentAttempt(updated);
            setPastAttempt(updated);
            try {
              setFeedbackDetails(JSON.parse(fb));
            } catch (e) {
              setFeedbackDetails({});
            }
          }
        }
      )
      .subscribe();

    let interval;
    const checkStatus = async () => {
      if (!isMounted) return;
      try {
        const { data: latestAttempt, error } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('id', currentAttempt.id)
          .single();

        if (error) throw error;
        
        const fbStr = latestAttempt.ai_feedback || '';
        const isLatestPending = fbStr.includes('"status":"queued"') || fbStr.includes('"status":"grading"');
        
        if (!isLatestPending) {
          setCurrentAttempt(latestAttempt);
          setPastAttempt(latestAttempt);
          try {
            setFeedbackDetails(JSON.parse(latestAttempt.ai_feedback || '{}'));
          } catch (e) {
            setFeedbackDetails({});
          }
          if (interval) clearInterval(interval);
          return;
        }

        const { data: rawAttempts, error: fetchErr } = await supabase
          .from('quiz_attempts')
          .select('id, ai_feedback, submit_time')
          .eq('quiz_id', quizId)
          .order('id', { ascending: true });

        if (fetchErr) throw fetchErr;

        const nowTime = Date.now();
        const attempts = (rawAttempts || []).filter(att => {
          const fb = att.ai_feedback || '';
          const isPending = fb.includes('"status":"queued"') || fb.includes('"status":"grading"');
          if (!isPending) return false;
          // Ignore stale attempts older than 3 minutes from queue position counting
          const submitTime = new Date(att.submit_time || nowTime).getTime();
          const ageInSeconds = (nowTime - submitTime) / 1000;
          return ageInSeconds < 180 || att.id === currentAttempt.id;
        });

        const ourIndex = attempts.findIndex(att => att.id === currentAttempt.id);
        
        if (ourIndex !== -1) {
          setQueuePosition(ourIndex);
          
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

          if (ourIndex === 0) {
            // We are first. Trigger our own evaluation on the server!
            fetch('/api/evaluate-attempt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ attemptId: currentAttempt.id })
            })
            .then(res => res.json())
            .then(async (resData) => {
              if (resData?.success && isMounted) {
                const { data: freshAtt } = await supabase
                  .from('quiz_attempts')
                  .select('*')
                  .eq('id', currentAttempt.id)
                  .single();
                if (freshAtt && !freshAtt.ai_feedback?.includes('"status":"queued"') && !freshAtt.ai_feedback?.includes('"status":"grading"')) {
                  setCurrentAttempt(freshAtt);
                  setPastAttempt(freshAtt);
                  try {
                    setFeedbackDetails(JSON.parse(freshAtt.ai_feedback || '{}'));
                  } catch (e) {}
                }
              }
            })
            .catch(() => {});
          } else {
            // We are waiting. Check if the attempt at index 0 has timed out (offline student)
            const firstAttempt = attempts[0];
            const queuedAt = new Date(firstAttempt.submit_time || new Date()).getTime();
            const elapsedSeconds = (Date.now() - queuedAt) / 1000;
            
            // If first attempt has been queued for over 15 seconds, help grade it so the queue moves forward!
            if (elapsedSeconds > 15) {
              fetch('/api/evaluate-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ attemptId: firstAttempt.id })
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Error polling attempt queue status:', err.message);
      }
    };

    checkStatus();
    
    // Ping to wake up background queue worker on server
    fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true })
    }).catch(() => {});

    // Fast polling every 1.5s for instant UI transition
    interval = setInterval(checkStatus, 1500);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [phase, currentAttempt?.id, currentAttempt?.ai_feedback, quizId]);

  // --- SECURE EXAM CONTROLS LIFE-CYCLE ---
  useEffect(() => {
    if (phase !== 'playing') {
      examStarted.current = false;
      return;
    }

    examStarted.current = true;
    securityViolationCount.current = 0;
    setVisibleWarningCount(0);
    isWindowFocused.current = true;
    trustedRadioChecks.current = {};
    isGracePeriod.current = true;

    const graceTimer = setTimeout(() => {
      isGracePeriod.current = false;
    }, 3000);

    const handleBeforeUnload = (e) => {
      if (activeAttemptRef.current) {
        const payload = {
          answers_json: JSON.stringify(answersRef.current),
          violation_reason: 'EXAMINATION_TERMINATED_UNAPPROVED_EXIT',
          submit_time: new Date().toISOString()
        };
        
        const headers = {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal'
        };
        if (authTokenRef.current) {
          headers['Authorization'] = `Bearer ${authTokenRef.current}`;
        }

        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quiz_attempts?id=eq.${activeAttemptRef.current.id}`, {
          method: 'PATCH',
          headers: headers,
          body: JSON.stringify(payload),
          keepalive: true
        });
      }
      
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave the exam?";
      return "Are you sure you want to leave the exam?";
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);

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
      if (examStarted.current) {
        handleSecurityViolationEvent("tab switching / focus loss");
      }
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

      // Periodic Focus Loss Check to catch sidebar tools/extensions
      if (!document.hasFocus() && !isGracePeriod.current && !isWarningModalOpen.current) {
        handleSecurityViolationEvent("focus loss (detected via periodic focus check)");
      }

      // Periodic Fullscreen Check to prevent escaping fullscreen mode
      const isFS = document.fullscreenElement || 
                   document.webkitFullscreenElement || 
                   document.mozFullScreenElement || 
                   document.msFullscreenElement;
      if (!isFS && !isGracePeriod.current && !isWarningModalOpen.current) {
        handleSecurityViolationEvent("exiting full-screen mode (detected via periodic check)");
      }
    }, 200);

    // Viewport Resizing / Chrome Side Panel opening detection
    initialWidth.current = typeof window !== 'undefined' ? window.innerWidth : 0;
    initialHeight.current = typeof window !== 'undefined' ? window.innerHeight : 0;

    const handleResize = () => {
      if (!examStarted.current || isGracePeriod.current) return;
      const diffW = Math.abs(window.innerWidth - initialWidth.current);
      const diffH = Math.abs(window.innerHeight - initialHeight.current);
      
      if (diffW > 15 || diffH > 15) {
        handleSecurityViolationEvent("resizing browser window / opening side panels");
        initialWidth.current = window.innerWidth;
        initialHeight.current = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Swipe down from top edge (to view notifications drawer) detection
    const startTouchY = { current: null };

    const handleTouchMove = (ev) => {
      if (!examStarted.current) return;
      const touch = ev.touches[0];
      const currentY = touch.clientY;

      if (startTouchY.current === null) {
        startTouchY.current = currentY;
        return;
      }

      const diffY = currentY - startTouchY.current;

      // Detect if user touches near the top notch, and drags down by more than 20px
      const isScrollAtTop = typeof window !== 'undefined' ? (window.scrollY || document.documentElement.scrollTop) < 15 : true;
      if (isScrollAtTop && startTouchY.current < 100 && diffY > 20) {
        startTouchY.current = null;
        handleSecurityViolationEvent("swiping status bar / notification drawer");
      }
    };

    const handleTouchEnd = () => {
      startTouchY.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
    window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });

    // Multi-finger swipe & gesture blocker (cancels 2, 3, 4 finger swipe actions)
    const handleTouchStartMulti = (ev) => {
      if (!examStarted.current) return;
      if (ev.touches.length >= 2) {
        ev.preventDefault();
        ev.stopPropagation();
        handleSecurityViolationEvent("multi-finger swipe gesture");
      }
    };

    const handleTouchMoveMulti = (ev) => {
      if (!examStarted.current) return;
      if (ev.touches.length >= 2) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    window.addEventListener('touchstart', handleTouchStartMulti, { capture: true, passive: false });
    window.addEventListener('touchmove', handleTouchMoveMulti, { capture: true, passive: false });

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

    // Fullscreen integrity interval check (every 1 sec)
    const secureInterval = setInterval(() => {
      if (!examStarted.current || isGracePeriod.current || isWarningModalOpen.current) return;
      
      const isFull = document.fullscreenElement || 
                     document.webkitIsFullScreen || 
                     document.mozFullScreen || 
                     document.msFullscreenElement;
      if (!isFull) {
        handleSecurityViolationEvent("exiting fullscreen mode");
      }
    }, 1000);

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

    // 14. Periodic Overlay & Resize Checker (3s)
    const checkUnauthorizedOverlays = () => {
      if (!examStarted.current) return;

      // 1. Verify window remains maximized (no side panels or split-screens)
      const isMaximized = window.innerWidth >= window.screen.width - 80;
      if (!isMaximized) {
        handleSecurityViolationEvent("resizing browser window / opening side panels");
        return; // Prioritize resize warning over element overlays
      }

      // 2. Scan for injected elements
      const bodyChildren = Array.from(document.body.children);
      let foundOverlay = false;
      
      for (const node of bodyChildren) {
        if (
          node.tagName.toLowerCase() === 'script' ||
          node.tagName.toLowerCase() === 'style' ||
          node.id === '__next' ||
          node.id === 'warningModal' ||
          node.id === 'violationModal' ||
          node.className?.includes('toast') ||
          node.className?.includes('modal')
        ) {
          continue;
        }
        
        try {
          const style = window.getComputedStyle(node);
          const isFloating = style.position === 'fixed' || style.position === 'absolute';
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
          
          // Check if it is a large overlay or cheating widget (width & height > 180px)
          // Allows small floating helper widgets/icons (Grammarly bubble, translation buttons)
          const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
          const isLargeOverlay = rect.width > 180 && rect.height > 180;
          
          if (isFloating && isVisible && isLargeOverlay) {
            foundOverlay = true;
            break;
          }
        } catch (e) {}
      }
      
      if (foundOverlay) {
        handleSecurityViolationEvent("unauthorized screen overlay or extension widget detected");
      }
    };

    const overlayPoll = setInterval(checkUnauthorizedOverlays, 3000);

    // Cleanup all event handlers and intervals
    return () => {
      examStarted.current = false;
      clearTimeout(graceTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      clearInterval(secureInterval);
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
      clearInterval(overlayPoll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      window.removeEventListener('touchend', handleTouchEnd, { capture: true });
      window.removeEventListener('touchstart', handleTouchStartMulti, { capture: true });
      window.removeEventListener('touchmove', handleTouchMoveMulti, { capture: true });
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
    if (!examStarted.current || isGracePeriod.current || isWarningModalOpen.current) return;

    securityViolationCount.current += 1;
    setVisibleWarningCount(securityViolationCount.current);
    setWarningViolationType(reason);

    if (securityViolationCount.current <= 4) {
      isWarningModalOpen.current = true;
      setShowWarningModal(true);
    } else {
      triggerSecurityViolation(reason);
    }
  };

  const triggerSecurityViolation = (reason) => {
    examStarted.current = false;
    isWarningModalOpen.current = false;
    submitQuiz(false, reason);
  };

  const dismissWarning = () => {
    setShowWarningModal(false);
    isWarningModalOpen.current = false;
    isGracePeriod.current = true;
    enterFullscreen();
    setTimeout(() => {
      isGracePeriod.current = false;
    }, 1500);
  };

  const dismissViolation = () => {
    setShowViolationModal(false);
    isWarningModalOpen.current = false;
    isGracePeriod.current = true;
    enterFullscreen();
    setTimeout(() => {
      isGracePeriod.current = false;
    }, 1500);
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
    // Gather all rows
    const rows = [];

    // Map classroom students
    classroomStudents.forEach(student => {
      const u = student.users;
      if (!u) return;

      // Find completed attempt
      const att = allAttemptsList.find(a => a.student_id === u.id && a.violation_reason !== 'IN_PROGRESS');
      const ipAtt = allAttemptsList.find(a => a.student_id === u.id && a.violation_reason === 'IN_PROGRESS');

      const reg = u.reg_no || 'N/A';
      const name = u.name || 'Unknown';
      const maxScore = quiz?.max_marks || 40;

      if (att) {
        rows.push({
          reg,
          name,
          score: att.score,
          maxScore: att.max_score || maxScore,
          status: att.violation_reason || 'Attempted',
          isAbsent: false
        });
      } else if (ipAtt) {
        rows.push({
          reg,
          name,
          score: 'ABSENT',
          maxScore,
          status: 'Absent',
          isAbsent: true
        });
      } else {
        rows.push({
          reg,
          name,
          score: 'ABSENT',
          maxScore,
          status: 'Not Attempted',
          isAbsent: true
        });
      }
    });

    // Map completed guest attempts (who are not classroom students)
    const guestAttempts = allAttemptsList.filter(att => !att.student_id && att.violation_reason !== 'IN_PROGRESS');
    guestAttempts.forEach(att => {
      rows.push({
        reg: 'Guest/N/A',
        name: att.guest_name || 'Guest User',
        score: att.score,
        maxScore: att.max_score || quiz?.max_marks || 40,
        status: att.violation_reason || 'Attempted',
        isAbsent: false
      });
    });

    // Sort rows strictly by Register Number, keeping absentees in-between
    rows.sort((a, b) => {
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
                <x:Name>Quiz Grades</x:Name>
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
              <th>Status / Violation Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.isAbsent ? 'absent' : ''}">
                <td>${r.reg}</td>
                <td>${r.name}</td>
                <td>${r.score}</td>
                <td>${r.maxScore}</td>
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
    link.setAttribute('download', `${quiz?.title?.replace(/\s+/g, '_') || 'test'}_grades.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DATABASE DATA LOADING ---
  const loadInitialData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      authTokenRef.current = session.access_token;
    }
    
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
      .select('*, users!creator_id(name), classrooms(*, users!creator_id(name))')
      .eq('id', quizId)
      .single();
    setQuiz(qz);

    if (qz) {
      const isStudent = profile && (profile.role === 'Student' || profile.role === 'Teaching Assistant' || profile.role === 'Research Scholar' || profile.role === 'Mentor');
      const teacherRole = profile && !isStudent && (profile.role === 'Faculty' || profile.role === 'Administrator' || qz.creator_id === profile.id);
      setIsTeacher(teacherRole);

      const classroomCreatorId = qz.classrooms?.creator_id || qz.creator_id;
      const classCreatorRole = profile && !isStudent && (profile.role === 'Administrator' || classroomCreatorId === profile.id);
      setIsClassCreator(classCreatorRole);

      // Fetch classroom members count (where role is student)
      if (qz.classroom_id) {
        const { data: membersData } = await supabase
          .from('classroom_members')
          .select('*, users!user_id(id, name, username, reg_no, role)')
          .eq('classroom_id', qz.classroom_id);
          
        if (membersData) {
          const students = membersData.filter(m => m.users?.role === 'Student' || m.users?.role === 'Teaching Assistant' || m.users?.role === 'Research Scholar' || m.users?.role === 'Mentor');
          setTotalClassroomStudents(students.length);
          setClassroomStudents(students);
        }
      }

      // Fetch Questions
      const { data: qns } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId);
      setQuestions(qns || []);
      questionsRef.current = qns || [];

      // Fetch Leaderboard
      const { data: lb } = await supabase
        .from('quiz_attempts')
        .select('*, users(name, username)')
        .eq('quiz_id', quizId)
        .order('score', { ascending: false })
        .limit(10);
      setLeaderboard(lb || []);

      // Fetch count of completed students
      const { data: countData } = await supabase
        .from('quiz_attempts')
        .select('violation_reason, users(role)')
        .eq('quiz_id', quizId);
      
      const compCount = countData 
        ? countData.filter(att => {
            const isCompleted = att.violation_reason !== 'IN_PROGRESS';
            const userRole = att.users?.role;
            const isFacultyOrAdmin = userRole === 'Faculty' || userRole === 'Administrator';
            return isCompleted && !isFacultyOrAdmin;
          }).length 
        : 0;
      setCompletedStudentsCount(compCount);

      // Fetch user's own past attempt
      if (profile) {
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', quizId)
          .eq('student_id', profile.id)
          .order('id', { ascending: false });
        
        const past = attempts && attempts.length > 0 ? attempts[0] : null;
        setPastAttempt(past);
        
        if (past && past.violation_reason !== 'IN_PROGRESS' && !teacherRole) {
          setCurrentAttempt(past);
          try {
            setFeedbackDetails(JSON.parse(past.ai_feedback || '{}'));
          } catch (e) {
            setFeedbackDetails({});
          }

          // Check if this was an unapproved exit that needs evaluation
          const needsEval = past.violation_reason === 'EXAMINATION_TERMINATED_UNAPPROVED_EXIT' && (!past.ai_feedback || past.ai_feedback === '{}');
          if (needsEval) {
            setActiveAttempt(past);
            activeAttemptRef.current = past;
            let loadedAnswers = {};
            try {
              loadedAnswers = JSON.parse(past.answers_json || '{}');
            } catch (e) {
              loadedAnswers = {};
            }
            setStudentAnswers(loadedAnswers);
            answersRef.current = loadedAnswers;
            
            // Trigger submit and evaluation on the active attempt
            setLoading(false);
            submitQuiz(false, 'EXAMINATION_TERMINATED_UNAPPROVED_EXIT');
            return;
          }

          setPhase('result');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `?phase=result&attemptId=${past.id}`);
          }
        } else if (past && past.violation_reason === 'IN_PROGRESS' && !teacherRole) {
          setActiveAttempt(past);
          let loadedAnswers = {};
          try {
            loadedAnswers = JSON.parse(past.answers_json || '{}');
          } catch (e) {
            loadedAnswers = {};
          }
          setStudentAnswers(loadedAnswers);
        }
      }

      // Fetch all attempts if teacher
      if (teacherRole) {
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*, users(name, username, reg_no, role)')
          .eq('quiz_id', quizId)
          .order('submit_time', { ascending: false });
        
        const filteredAttempts = (attempts || []).filter(att => {
          const role = att.users?.role;
          return role !== 'Faculty' && role !== 'Administrator';
        });
        setAllAttemptsList(filteredAttempts);

        // Scan for ungraded terminated attempts and auto-evaluate them in background
        filteredAttempts.forEach(async (att) => {
          const isTerminated = att.violation_reason !== 'IN_PROGRESS';
          const isUngraded = !att.ai_feedback || att.ai_feedback === '{}';
          if (isTerminated && isUngraded) {
            console.log(`Auto-evaluating ungraded terminated attempt ${att.id} for student ${att.users?.name}...`);
            await evaluateAttemptBackground(att);
          }
        });
      }
    }

    setLoading(false);
  };

  const getScheduleStatus = () => {
    if (!quiz) return { isAccessible: true };
    if (!quiz.scheduled_start && !quiz.scheduled_end) return { isAccessible: true };

    const now = new Date();
    const start = quiz.scheduled_start ? new Date(quiz.scheduled_start) : null;
    const end = quiz.scheduled_end ? new Date(quiz.scheduled_end) : null;

    if (start && now < start) {
      return { 
        isAccessible: false, 
        message: `This exam has not started yet. It is scheduled to start at ${start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.` 
      };
    }

    if (end && now > end) {
      return { 
        isAccessible: false, 
        message: `This exam is closed. The scheduled end time was ${end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.` 
      };
    }

    return { isAccessible: true };
  };

  const handleStartQuizClick = async () => {
    const schedule = getScheduleStatus();
    if (!isClassCreator && !isTeacher && !schedule.isAccessible) {
      alert(schedule.message);
      return;
    }

    const trimmedGuest = guestName.trim();
    if (quiz?.is_public && !user && !trimmedGuest) {
      alert('Please enter your name to begin the public test.');
      return;
    }
    
    if (!user && trimmedGuest) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('guest_name', trimmedGuest)
        .order('id', { ascending: false });
        
      const past = attempts && attempts.length > 0 ? attempts[0] : null;
      if (past) {
        if (past.violation_reason !== 'IN_PROGRESS') {
          setPastAttempt(past);
          setCurrentAttempt(past);
          try {
            setFeedbackDetails(JSON.parse(past.ai_feedback || '{}'));
          } catch (e) {
            setFeedbackDetails({});
          }
          setPhase('result');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `?phase=result&attemptId=${past.id}`);
          }
          setGuestAttempted(true);
          return;
        } else {
          setPastAttempt(past);
          setActiveAttempt(past);
          let loadedAnswers = {};
          try {
            loadedAnswers = JSON.parse(past.answers_json || '{}');
          } catch (e) {
            loadedAnswers = {};
          }
          setStudentAnswers(loadedAnswers);
        }
      }
    }
    
    setShowInstructions(true);
  };

  const handleStartQuiz = async () => {
    const schedule = getScheduleStatus();
    if (!isClassCreator && !isTeacher && !schedule.isAccessible) {
      alert(schedule.message);
      return;
    }
    
    // Verify window is maximized/no side panels are active
    const isMaximized = typeof window !== 'undefined' && (window.innerWidth >= window.screen.width - 80);
    if (!isMaximized) {
      alert("Exam Security Alert: Please maximize your browser window and close any side panels before starting the exam.");
      return;
    }

    try {
      let attempt = activeAttempt;
      
      if (!attempt) {
        if (user) {
          const { data: existing } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('quiz_id', quizId)
            .eq('student_id', user.id)
            .eq('violation_reason', 'IN_PROGRESS')
            .maybeSingle();
          attempt = existing;
        } else if (guestName.trim()) {
          const { data: existing } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('quiz_id', quizId)
            .eq('guest_name', guestName.trim())
            .eq('violation_reason', 'IN_PROGRESS')
            .maybeSingle();
          attempt = existing;
        }
      }

      if (!attempt) {
        const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
        const { data: newAttempt, error: insertError } = await supabase
          .from('quiz_attempts')
          .insert({
            quiz_id: quizId,
            student_id: user?.id || null,
            guest_name: user ? null : guestName.trim(),
            score: 0,
            max_score: totalPoints,
            answers_json: '{}',
            ai_feedback: '{}',
            violation_reason: 'IN_PROGRESS',
            auto_saved: true
          })
          .select()
          .single();
        if (insertError) throw insertError;
        attempt = newAttempt;
      } else {
        let loadedAnswers = {};
        try {
          loadedAnswers = JSON.parse(attempt.answers_json || '{}');
        } catch (e) {
          loadedAnswers = {};
        }
        setStudentAnswers(loadedAnswers);
      }

      setActiveAttempt(attempt);
      securityViolationCount.current = 0;
      setVisibleWarningCount(0);
      enterFullscreen();
      setPhase('playing');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '?phase=playing');
      }
      
      let duration = (quiz?.duration_minutes || 30) * 60;
      if (quiz?.scheduled_start && quiz?.scheduled_end) {
        const endTime = new Date(quiz.scheduled_end).getTime();
        duration = Math.floor((endTime - Date.now()) / 1000);
        duration = Math.max(0, duration);
      } else if (attempt && attempt.start_time) {
        const elapsed = Math.floor((Date.now() - new Date(attempt.start_time).getTime()) / 1000);
        duration = Math.max(10, duration - elapsed);
      }
      setTimeLeft(duration);
    } catch (err) {
      alert(`Failed to initialize quiz session: ${err.message}`);
    }
  };

  const handleAnswerSelect = (questionId, optionIndex) => {
    const nextAnswers = {
      ...studentAnswers,
      [questionId]: String(optionIndex)
    };
    setStudentAnswers(nextAnswers);
    answersRef.current = nextAnswers;

    if (activeAttemptRef.current) {
      supabase
        .from('quiz_attempts')
        .update({
          answers_json: JSON.stringify(nextAnswers),
          submit_time: new Date().toISOString()
        })
        .eq('id', activeAttemptRef.current.id)
        .then(({ error }) => {
          if (error) console.error('Database write error:', error);
        });
    }
  };

  const handleTextAnswerChange = (questionId, text) => {
    const nextAnswers = {
      ...studentAnswers,
      [questionId]: text
    };
    setStudentAnswers(nextAnswers);
    answersRef.current = nextAnswers;

    if (textSaveDebounce.current) clearTimeout(textSaveDebounce.current);
    textSaveDebounce.current = setTimeout(() => {
      if (activeAttemptRef.current) {
        supabase
          .from('quiz_attempts')
          .update({
            answers_json: JSON.stringify(nextAnswers),
            submit_time: new Date().toISOString()
          })
          .eq('id', activeAttemptRef.current.id)
          .then(({ error }) => {
            if (error) console.error('Database write error:', error);
          });
      }
    }, 500);
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
      for (const q of questionsRef.current) {
        totalMaxMarks += q.points;
        const studentAns = answersRef.current[q.id] || '';

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

      // 2. Grade Theory questions via serverless AI (Decoupled to backend Queue)
      const theoryQuestions = questionsRef.current.filter(q => q.question_type !== 'MCQ');
      const hasTheory = theoryQuestions.length > 0;
      
      if (hasTheory) {
        for (const q of theoryQuestions) {
          const studentAns = answersRef.current[q.id] || '';
          const itemFeedback = {
            questionText: q.question_text,
            questionType: q.question_type,
            studentAnswer: studentAns,
            maxMarks: q.points,
            score: null,
            feedback: studentAns.trim() !== '' ? 'Queued for AI evaluation...' : (violationReasonVal ? 'No answer submitted before secure environment termination.' : 'No answer submitted.'),
            correct: false
          };
          feedbackMap[q.id] = itemFeedback;
        }
      }

      const scoreToSave = hasTheory ? 0 : (finalScore < 0 ? 0 : finalScore);
      const aiFeedbackToSave = hasTheory 
        ? JSON.stringify({ status: 'queued', queued_at: new Date().toISOString(), feedbackMap })
        : JSON.stringify(feedbackMap);

      // 3. Save Attempt to Supabase
      setSubmissionProgress('saving');
      
      let attempt = null;
      if (activeAttemptRef.current?.id) {
        const { data: updatedAttempt, error: attemptError } = await supabase
          .from('quiz_attempts')
          .update({
            score: scoreToSave,
            max_score: totalMaxMarks,
            answers_json: JSON.stringify(answersRef.current),
            ai_feedback: aiFeedbackToSave,
            auto_saved: isAutoSaved,
            violation_reason: violationReasonVal,
            submit_time: new Date().toISOString()
          })
          .eq('id', activeAttemptRef.current.id)
          .select()
          .single();
          
        if (attemptError) throw attemptError;
        attempt = updatedAttempt;
      } else {
        const { data: insertedAttempt, error: attemptError } = await supabase
          .from('quiz_attempts')
          .insert({
            quiz_id: quizId,
            student_id: user?.id || null,
            guest_name: user ? null : guestName.trim(),
            score: scoreToSave,
            max_score: totalMaxMarks,
            answers_json: JSON.stringify(answersRef.current),
            ai_feedback: aiFeedbackToSave,
            auto_saved: isAutoSaved,
            violation_reason: violationReasonVal,
            submit_time: new Date().toISOString()
          })
          .select()
          .single();
          
        if (attemptError) throw attemptError;
        attempt = insertedAttempt;
      }

      // 4. Update student points (only if graded instantly)
      if (user && !violationReasonVal && !hasTheory) {
        await supabase.rpc('increment_score', {
          user_id: user.id,
          points: scoreToSave * 5 + 5
        });
      }

      // Trigger immediate on-demand evaluation on server for zero delay
      if (hasTheory && attempt?.id) {
        fetch('/api/evaluate-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ attemptId: attempt.id })
        }).catch(() => {});
      } else {
        fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ ping: true })
        }).catch(() => {});
      }

      setCurrentAttempt(attempt);
      setPastAttempt(attempt);
      setFeedbackDetails(feedbackMap);
      setPhase('result');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `?phase=result&attemptId=${attempt.id}`);
      }
      
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

  const evaluateAttemptBackground = async (targetAttempt) => {
    try {
      let finalScore = 0;
      let totalMaxMarks = 0;
      const feedbackMap = {};
      
      let answers = {};
      try {
        answers = JSON.parse(targetAttempt.answers_json || '{}');
      } catch (e) {
        answers = {};
      }

      // 1. Grade MCQs locally
      for (const q of questionsRef.current) {
        totalMaxMarks += q.points;
        const studentAns = answers[q.id] || '';

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
              const penalty = quiz?.negative_marking ? (q.negative_points || 0) : 0;
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
      const theoryQuestions = questionsRef.current.filter(q => q.question_type !== 'MCQ');
      
      if (theoryQuestions.length > 0) {
        for (const q of theoryQuestions) {
          const studentAns = answers[q.id] || '';
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

              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

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
            itemFeedback.feedback = 'No answer submitted before secure environment termination.';
          }
          feedbackMap[q.id] = itemFeedback;
        }
      }

      if (finalScore < 0) finalScore = 0;

      // 3. Save Attempt to Supabase
      const { data: updatedAttempt, error } = await supabase
        .from('quiz_attempts')
        .update({
          score: finalScore,
          max_score: totalMaxMarks,
          ai_feedback: JSON.stringify(feedbackMap),
          submit_time: new Date().toISOString()
        })
        .eq('id', targetAttempt.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state list so the teacher sees the updated score immediately!
      setAllAttemptsList(prev => prev.map(a => a.id === targetAttempt.id ? { 
        ...a, 
        score: finalScore, 
        max_score: totalMaxMarks,
        ai_feedback: JSON.stringify(feedbackMap) 
      } : a));

      console.log(`Successfully auto-evaluated attempt ${targetAttempt.id}!`);
    } catch (err) {
      console.error(`Failed to auto-evaluate attempt ${targetAttempt.id}:`, err);
    }
  };

  const handleDeleteAttempt = (attemptId) => {
    if (!isClassCreator) {
      triggerToast("Permission denied", "Only the classroom creator can delete attempt records.");
      return;
    }
    setDeleteTargetId(attemptId);
  };

  const executeDeleteAttempt = async (attemptId) => {
    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .delete()
        .eq('id', attemptId);

      if (error) throw error;

      setAllAttemptsList(allAttemptsList.filter(a => a.id !== attemptId));
      triggerToast('Success', 'Attempt deleted successfully.');
    } catch (err) {
      triggerToast('Delete failed', err.message);
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
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `?phase=result&attemptId=${attempt.id}`);
    }
  };

  const handleEditMarks = (attempt) => {
    if (!isClassCreator && !isTeacher) {
      triggerToast("Permission denied", "Only the classroom creator or faculty can edit marks.");
      return;
    }

    let parsedFeedback = {};
    try {
      parsedFeedback = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      parsedFeedback = {};
    }

    const qList = [];
    const initialMarks = {};

    if (questions && questions.length > 0) {
      questions.forEach((q, idx) => {
        const qId = String(q.id);
        const fb = parsedFeedback[qId] || {};
        const score = fb.score !== undefined ? Number(fb.score) : 0;
        const maxM = q.points || fb.maxMarks || 10;
        qList.push({
          qId,
          questionNumber: idx + 1,
          questionText: q.question_text || fb.questionText || `Question ${idx + 1}`,
          questionType: q.question_type || fb.questionType || 'THEORY',
          maxMarks: maxM,
          studentAnswer: fb.studentAnswer || ''
        });
        initialMarks[qId] = score;
      });
    } else {
      const keys = Object.keys(parsedFeedback).filter(k => k !== 'status' && k !== 'feedbackMap');
      keys.forEach((qId, idx) => {
        const fb = parsedFeedback[qId];
        if (fb && typeof fb === 'object') {
          const score = fb.score !== undefined ? Number(fb.score) : 0;
          const maxM = fb.maxMarks || 10;
          qList.push({
            qId,
            questionNumber: idx + 1,
            questionText: fb.questionText || `Question ${idx + 1}`,
            questionType: fb.questionType || 'THEORY',
            maxMarks: maxM,
            studentAnswer: fb.studentAnswer || ''
          });
          initialMarks[qId] = score;
        }
      });
    }

    setEditQuestionsData(qList);
    setEditQuestionsMarks(initialMarks);
    setEditMarksTarget(attempt);
  };

  const handleQuestionMarkChange = (qId, val) => {
    setEditQuestionsMarks(prev => ({
      ...prev,
      [qId]: val
    }));
  };

  const getCalculatedTotal = () => {
    let sum = 0;
    Object.values(editQuestionsMarks).forEach(v => {
      const num = parseFloat(v);
      if (!isNaN(num)) sum += num;
    });
    return Math.round(sum * 10) / 10;
  };

  const executeEditQuestionMarks = async () => {
    if (!editMarksTarget) return;

    let sum = 0;
    for (const q of editQuestionsData) {
      const val = editQuestionsMarks[q.qId];
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > q.maxMarks) {
        triggerToast('Invalid score', `Question ${q.questionNumber} score must be between 0 and ${q.maxMarks}.`);
        return;
      }
      sum += num;
    }

    const finalRoundedTotal = Math.round(sum);

    let updatedFeedback = {};
    try {
      updatedFeedback = JSON.parse(editMarksTarget.ai_feedback || '{}');
    } catch (e) {
      updatedFeedback = {};
    }

    editQuestionsData.forEach(q => {
      const newScore = parseFloat(editQuestionsMarks[q.qId]) || 0;
      if (!updatedFeedback[q.qId]) {
        updatedFeedback[q.qId] = {
          questionText: q.questionText,
          questionType: q.questionType,
          maxMarks: q.maxMarks,
          score: newScore,
          feedback: 'Mark updated manually by teacher.',
          correct: newScore >= q.maxMarks * 0.75
        };
      } else {
        updatedFeedback[q.qId] = {
          ...updatedFeedback[q.qId],
          score: newScore,
          correct: newScore >= q.maxMarks * 0.75
        };
      }
    });

    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .update({
          score: finalRoundedTotal,
          ai_feedback: JSON.stringify(updatedFeedback)
        })
        .eq('id', editMarksTarget.id);

      if (error) throw error;

      // Update state lists
      setAllAttemptsList(prev => prev.map(a => a.id === editMarksTarget.id ? {
        ...a,
        score: finalRoundedTotal,
        ai_feedback: JSON.stringify(updatedFeedback)
      } : a));

      if (currentAttempt && currentAttempt.id === editMarksTarget.id) {
        setCurrentAttempt(prev => ({
          ...prev,
          score: finalRoundedTotal,
          ai_feedback: JSON.stringify(updatedFeedback)
        }));
        setFeedbackDetails(updatedFeedback);
      }

      setEditMarksTarget(null);
      triggerToast('Success', `Marks updated successfully! New Total: ${finalRoundedTotal}/${editMarksTarget.max_score || quiz?.max_marks || 40}`);
    } catch (err) {
      triggerToast('Failed to update marks', err.message);
    }
  };

  const handleGrantAccess = (attempt) => {
    if (!isClassCreator) {
      triggerToast("Permission denied", "Only the classroom creator can grant continue access.");
      return;
    }
    setGrantAccessTarget(attempt);
  };

  const executeGrantAccess = async (attempt) => {
    try {
      const { error } = await supabase
        .from('quiz_attempts')
        .update({
          violation_reason: 'IN_PROGRESS',
          score: 0,
          ai_feedback: '{}',
          start_time: new Date().toISOString(),
          submit_time: new Date().toISOString()
        })
        .eq('id', attempt.id);

      if (error) throw error;

      setAllAttemptsList(prev => prev.map(a => a.id === attempt.id ? { 
        ...a, 
        violation_reason: 'IN_PROGRESS',
        score: 0,
        ai_feedback: '{}'
      } : a));
      
      triggerToast('Access granted', 'The student can now refresh and resume their test.');
    } catch (err) {
      triggerToast('Failed to grant access', err.message);
    }
  };

  const handleDownloadPDF = (attempt) => {
    setPdfConfirmTarget(attempt);
  };

  const executeDownloadPDF = (attempt, includeFeedback) => {
    const studentName = attempt.users?.name || attempt.guest_name || 'Guest Student';
    const regNo = attempt.users?.reg_no || 'N/A';
    const testName = quiz?.title || 'Academic Evaluation';
    const courseName = quiz?.classrooms?.class_name || 'N/A';
    const facultyName = quiz?.classrooms?.users?.name || quiz?.users?.name || 'N/A';
    const testDate = new Date(attempt.submit_time || attempt.start_time).toLocaleDateString();
    
    let parsedFeedback = {};
    try {
      parsedFeedback = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      parsedFeedback = {};
    }
    
    let answers = {};
    try {
      answers = JSON.parse(attempt.answers_json || '{}');
    } catch (e) {
      answers = {};
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerToast('Popup Blocker', 'Please allow popups to download the PDF.');
      return;
    }

    let questionsHtml = '';
    questions.forEach((q, idx) => {
      const studentAns = answers[q.id] || '[No Answer Provided]';
      const feedback = parsedFeedback[q.id] || {};
      const score = feedback.score !== undefined ? feedback.score : 0;
      
      let optionsHtml = '';
      if (q.question_type === 'MCQ') {
        let options = [];
        try {
          options = JSON.parse(q.options_json || '[]');
        } catch (e) {
          options = [];
        }
        optionsHtml = `<div class="options">
          ${options.map((opt, optIdx) => {
            const isSelected = studentAns === String(optIdx);
            return `<div class="option ${isSelected ? 'selected' : ''}">
              <span class="option-marker">${String.fromCharCode(65 + optIdx)}.</span> ${opt} ${isSelected ? '<strong>(Selected)</strong>' : ''}
            </div>`;
          }).join('')}
        </div>`;
      }

      questionsHtml += `
        <div class="question-block">
          <div class="question-header">
            <strong>Q${idx + 1}. ${q.question_text}</strong>
            <span class="marks">(${score} / ${q.points} Marks)</span>
          </div>
          ${optionsHtml}
          <div class="answer-section">
            <div class="section-title">Submitted Answer:</div>
            <div class="answer-text">${q.question_type === 'MCQ' ? '' : studentAns.replace(/\n/g, '<br/>')}</div>
          </div>
          ${(includeFeedback && feedback.feedback) ? `
            <div class="feedback-section">
              <div class="section-title">AI Evaluation & Feedback:</div>
              <div class="feedback-text">${feedback.feedback}</div>
            </div>
          ` : ''}
        </div>
      `;
    });

    const docContent = `
      <html>
        <head>
          <title>${testName} - ${studentName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1f2937;
              padding: 2rem;
              line-height: 1.5;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 1.5rem;
              margin-bottom: 2rem;
            }
            .title-section {
              text-align: center;
              flex-grow: 1;
            }
            .title-section h1 {
              font-size: 1.5rem;
              font-weight: 800;
              margin: 0;
              color: #111827;
            }
            .title-section p {
              margin: 0.25rem 0 0;
              color: #6b7280;
              font-size: 0.875rem;
            }
            .student-info {
              text-align: right;
              font-size: 0.875rem;
              color: #374151;
              min-width: 250px;
            }
            .student-info div {
              margin-bottom: 0.25rem;
            }
            .student-info strong {
              color: #111827;
            }
            .score-badge {
              display: inline-block;
              background: #ecfdf5;
              color: #065f46;
              padding: 0.5rem 1rem;
              border-radius: 9999px;
              font-weight: 700;
              font-size: 1.1rem;
              margin-top: 1rem;
              border: 1px solid #a7f3d0;
            }
            .question-block {
              margin-bottom: 2.5rem;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 1.5rem;
              background: #f9fafb;
            }
            .question-header {
              display: flex;
              justify-content: space-between;
              font-size: 1.1rem;
              color: #111827;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 0.75rem;
              margin-bottom: 1rem;
            }
            .marks {
              font-weight: 600;
              color: #4f46e5;
            }
            .options {
              display: grid;
              gap: 0.5rem;
              margin-bottom: 1rem;
            }
            .option {
              padding: 0.5rem 0.75rem;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              background: white;
            }
            .option.selected {
              border-color: #4f46e5;
              background: #f5f3ff;
            }
            .answer-section, .feedback-section {
              margin-top: 1rem;
            }
            .section-title {
              font-weight: 600;
              font-size: 0.875rem;
              color: #4b5563;
              margin-bottom: 0.25rem;
            }
            .answer-text {
              background: white;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              padding: 0.75rem 1rem;
              font-size: 0.95rem;
              min-height: 50px;
              white-space: pre-wrap;
            }
            .feedback-text {
              background: #f3f4f6;
              border-left: 4px solid #9ca3af;
              padding: 0.75rem 1rem;
              font-size: 0.9rem;
              color: #4b5563;
              font-style: italic;
            }
            @media print {
              body {
                padding: 0;
              }
              .question-block {
                border: none;
                background: none;
                padding: 0;
                margin-bottom: 2rem;
              }
              .answer-text {
                border: 1px solid #e5e7eb;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div style="width: 250px; text-align: left; font-size: 0.875rem; color: #374151;">
              <div>Course: <strong>${courseName}</strong></div>
              <div>Faculty: <strong>${facultyName}</strong></div>
              <div>Date: <strong>${testDate}</strong></div>
            </div>
            <div class="title-section">
              <h1>${testName}</h1>
              <p>Answer Sheet & Evaluation Report</p>
              <div class="score-badge">Total Score: ${attempt.score} / ${attempt.max_score}</div>
            </div>
            <div class="student-info">
              <div>Student Name: <strong>${studentName}</strong></div>
              <div>Register Number: <strong>${regNo}</strong></div>
            </div>
          </div>
          <div class="questions-container">
            ${questionsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(docContent);
    printWindow.document.close();
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
            
            {/* Back button */}
            <div style={{ marginBottom: '1.25rem' }}>
              <button 
                onClick={() => router.back()} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-primary)', 
                  cursor: 'pointer', 
                  fontWeight: 'bold', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  fontSize: '0.95rem',
                  padding: 0
                }}
              >
                ← Go Back to Classroom
              </button>
            </div>
            
            {/* Banner card */}
            <div className="glass card" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 650 }}>
                👥 {totalClassroomStudents > 0 
                  ? `${completedStudentsCount} / ${totalClassroomStudents} students completed this test`
                  : `${completedStudentsCount} ${completedStudentsCount === 1 ? 'student' : 'students'} completed this test`}
              </div>
              <span className="badge badge-student" style={{ marginBottom: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                {quiz.type || 'Academic Test'}
              </span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{quiz.title}</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>{quiz.description || 'Practice test covering class materials.'}</p>
              
              <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
                {!quiz.scheduled_start ? (
                  <div>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>DURATION</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{quiz.duration_minutes} Minutes</span>
                  </div>
                ) : (
                  <div>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>DURATION</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Scheduled Session</span>
                  </div>
                )}
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
                {(!guestAttempted && (!pastAttempt || pastAttempt.violation_reason === 'IN_PROGRESS' || isTeacher)) ? (
                  <div className="glass card" style={{ padding: '2rem', textAlign: 'center' }}>
                    {(() => {
                      const schedule = getScheduleStatus();
                      const restricted = !isClassCreator && !isTeacher && !schedule.isAccessible;
                      return (
                        <>
                          <p style={{ color: restricted ? '#b91c1c' : 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: restricted ? 'bold' : 'normal' }}>
                            {restricted 
                              ? `⚠️ ${schedule.message}`
                              : pastAttempt?.violation_reason === 'IN_PROGRESS'
                                ? "You have an ongoing attempt for this test. You can resume and continue from where you left off."
                                : "Ready to start? Once you click the button, the exam enters full-screen. Navigating away, switching tabs, right-clicking, or copying text will trigger warnings and automatic exit."}
                          </p>
                          {quiz?.scheduled_start && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                              🗓️ Scheduled: {new Date(quiz.scheduled_start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to {quiz.scheduled_end ? new Date(quiz.scheduled_end).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Open-Ended'}
                            </p>
                          )}
                          <button 
                            onClick={handleStartQuizClick} 
                            className="btn btn-primary" 
                            disabled={restricted}
                            style={{ 
                              padding: '1.1rem 3.5rem', 
                              fontSize: '1.2rem', 
                              fontWeight: 'bold',
                              opacity: restricted ? 0.5 : 1,
                              cursor: restricted ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {pastAttempt?.violation_reason === 'IN_PROGRESS' ? "Resume Test Now" : "Start Test Now"}
                          </button>
                        </>
                      );
                    })()}
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
                        <button 
                          onClick={() => showPastAttemptDetails(pastAttempt)} 
                          className="btn btn-secondary"
                          style={{ padding: '0.9rem 2.5rem', fontSize: '1.05rem', fontWeight: 'bold' }}
                        >
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
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Attended: {(() => {
                            const completedAttempts = allAttemptsList.filter(att => att.violation_reason !== 'IN_PROGRESS');
                            const uniqueStudentIds = new Set();
                            completedAttempts.forEach(att => {
                              if (att.student_id) {
                                uniqueStudentIds.add(att.student_id);
                              } else if (att.guest_name) {
                                uniqueStudentIds.add(att.guest_name);
                              }
                            });
                            return uniqueStudentIds.size;
                          })()} {totalClassroomStudents > 0 ? `of ${totalClassroomStudents} students` : 'students'}
                        </span>
                        <button
                          onClick={handleDownloadQuizExcel}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                        >
                          📊 Export Test Grades
                        </button>
                        <button
                          onClick={() => setShowAbsentModal(true)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                        >
                          ⚠️ Absent Students
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const completedAttempts = allAttemptsList.filter(att => att.violation_reason !== 'IN_PROGRESS');
                      if (completedAttempts.length === 0) {
                        return <div className="glass card" style={{ color: 'var(--text-secondary)' }}>No student submissions recorded for this test yet.</div>;
                      }
                      return (
                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                          {completedAttempts.map((att) => (
                            <div key={att.id} className="glass card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                              <div>
                                <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>
                                  {att.users?.name || att.guest_name || 'Guest User'}
                                </h4>
                                {att.violation_reason ? (
                                  <span className="badge badge-student" style={{ background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontSize: '0.65rem' }}>
                                    Terminated: {att.violation_reason}
                                  </span>
                                ) : (
                                  <span className="badge badge-student" style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', fontSize: '0.65rem' }}>
                                    Completed
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-primary)', marginRight: '0.5rem' }}>
                                  {att.score}/{att.max_score}
                                </span>
                                <button onClick={() => showPastAttemptDetails(att)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                  Details
                                </button>
                                <button onClick={() => handleDownloadPDF(att)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                  📄 PDF
                                </button>
                                {(isClassCreator || isTeacher) && (
                                  <button onClick={() => handleEditMarks(att)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                    ✏️ Edit Marks
                                  </button>
                                )}
                                {isClassCreator && (
                                  <button onClick={() => handleGrantAccess(att)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                                    🔓 Grant Continue
                                  </button>
                                )}
                                {isClassCreator && (
                                  <button onClick={() => handleDeleteAttempt(att.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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
                  {submissionProgress === 'grading_theory' && 'Evaluating Theory answers with safe queue rotation. Please wait, this may take a moment if multiple students submit at the same time...'}
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
                            style={{ minHeight: '260px', resize: 'vertical', fontSize: '1rem', lineHeight: '1.5' }}
                            placeholder="Type your answer in detail here..."
                            value={studentAnswers[q.id] || ''}
                            onChange={(e) => handleTextAnswerChange(q.id, e.target.value)}
                            spellCheck={false}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
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
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.25rem', fontWeight: 'bold' }}
              >
                Submit Answers for AI Evaluation
              </button>
            )}

          </div>
        )}

        {/* PHASE 3A: QUEUE WAIT SCREEN */}
        {phase === 'result' && currentAttempt && (currentAttempt.ai_feedback?.includes('"status":"queued"') || currentAttempt.ai_feedback?.includes('"status":"grading"')) && (
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <div className="glass card" style={{ padding: '3rem 2rem' }}>
              <span style={{ fontSize: '3.5rem' }}>⏳</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                Answers Submitted Successfully!
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
                Your exam has been recorded. We are currently performing the AI evaluation.
              </p>

              <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                  Queue Status
                </h4>
                <p style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.2rem 0' }}>
                  {queuePosition !== null ? `Position in Queue: #${queuePosition + 1}` : 'Calculating position...'}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Estimated Wait Time: {queuePosition !== null ? (
                    queuePosition === 0 ? 'Evaluating your answers now (~5-10s)...' : `~${(queuePosition + 1) * 8} seconds`
                  ) : 'Estimating...'}
                </p>
              </div>

              <div className="alert alert-info" style={{ textAlign: 'left', marginBottom: '2rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                ℹ️ <strong>You can safely close this screen now.</strong> The AI is processing the queue sequentially on the server. Your answers are safe and will be evaluated. If you return to this page later, your marks will be displayed here.
              </div>

              <button 
                onClick={() => {
                  if (quiz?.classroom_id) {
                    router.push(`/classroom/${quiz.classroom_id}?tab=quizzes`);
                  } else {
                    router.push('/');
                  }
                }}
                className="btn btn-secondary"
                style={{ padding: '0.8rem 2rem', fontWeight: 'bold' }}
              >
                Go to Classroom
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3B: DETAILED RESULT VIEW */}
        {phase === 'result' && currentAttempt && !(currentAttempt.ai_feedback?.includes('"status":"queued"') || currentAttempt.ai_feedback?.includes('"status":"grading"')) && (
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
                {(isClassCreator || isTeacher) && (
                  <button 
                    onClick={() => handleEditMarks(currentAttempt)} 
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: '0.75rem auto', fontWeight: 700 }}
                  >
                    ✏️ Edit Question Marks
                  </button>
                )}
                {currentAttempt.violation_reason && (
                  <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--danger)', fontWeight: 700, background: 'rgba(239,68,68,0.08)', padding: '0.5rem', borderRadius: '8px', width: 'fit-content', margin: '0.5rem auto' }}>
                    ⚠️ Exam Auto-Submitted Due To Security Violation: "{currentAttempt.violation_reason}"
                  </span>
                )}
                {currentAttempt.auto_saved && !currentAttempt.violation_reason && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Auto-submitted due to timer expiry</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  onClick={() => {
                    if (isTeacher) {
                      if (typeof window !== 'undefined' && window.history.length > 1) {
                        window.history.back();
                      } else {
                        setPhase('view');
                        if (typeof window !== 'undefined') {
                          window.history.replaceState(null, '', '?phase=view');
                        }
                      }
                    } else {
                      if (quiz?.classroom_id) {
                        router.push(`/classroom/${quiz.classroom_id}?tab=quizzes`);
                      } else {
                        router.push('/');
                      }
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.9rem 2rem', fontSize: '1.05rem', fontWeight: 'bold' }}
                >
                  Back
                </button>
                <button 
                  onClick={() => handleDownloadPDF(currentAttempt)} 
                  className="btn btn-primary"
                  style={{ padding: '0.9rem 2rem', fontSize: '1.05rem', fontWeight: 'bold', background: 'var(--color-primary)' }}
                >
                  📄 Download Answer Sheet PDF
                </button>
              </div>
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
                        <p style={{ color: 'var(--text-primary)', background: '#F8FAFC', padding: '0.6rem 1rem', borderRadius: '8px', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
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

      {/* 0. Instructions Modal before starting exam */}
      {showInstructions && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 10000,
          overflowY: 'auto',
          padding: '2.5rem 1rem',
        }}>
          <div className="glass card animate-fade-in" style={{
            maxWidth: '600px',
            width: '90%',
            padding: '2.5rem',
            textAlign: 'left',
            boxShadow: 'var(--shadow-lg)',
            border: '2px solid var(--border-color)',
            background: '#FFFFFF',
            margin: 'auto',
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem', textAlign: 'center' }}>📝</span>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Exam Instructions & Integrity Rules
            </h3>
            
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              <p style={{ marginBottom: '1rem' }}>
                Please read the following instructions carefully. To ensure a fair evaluation, this exam is monitored. The following actions are considered <strong>Security Violations</strong>:
              </p>
              
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', display: 'grid', gap: '0.5rem', listStyleType: 'none' }}>
                <li>❌ Exiting full-screen mode</li>
                <li>❌ Switching browser tabs or applications</li>
                <li>❌ Losing window focus or clicking outside the exam</li>
                <li>❌ Selecting or highlighting exam text (more than 10 characters)</li>
                <li>❌ Copy-pasting, dragging, dropping, or auto-filling answers</li>
                <li>❌ Keyboard shortcuts (Alt, Meta/Win, Ctrl+C, Ctrl+V, Ctrl+X, F12, Inspect Element)</li>
                <li>❌ Right-clicking to open context menus</li>
              </ul>

              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#b91c1c', fontWeight: 600 }}>
                ⚠️ Violation Policy: You are allowed exactly 4 warnings. On the 5th security violation, your exam will be automatically terminated, and your answers up to that point will be submitted and evaluated.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setShowInstructions(false)} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowInstructions(false);
                  handleStartQuiz();
                }} 
                className="btn btn-primary" 
                style={{ flex: 2, padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                I Understand, Start Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Warning Modal */}
      {showWarningModal && (
        <div id="warningModal" className="modal-overlay">
          <div className="glass modal-content" style={{ textAlign: 'center', maxWidth: '480px', padding: '2.5rem' }}>
            <span style={{ fontSize: '3.5rem' }}>⚠️</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', marginTop: '1rem', marginBottom: '0.5rem' }}>
              Secure Exam Warning!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1rem' }}>
              Violation detected: <strong style={{ color: '#dc2626' }}>{warningViolationType}</strong>.
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>
              This is warning {visibleWarningCount} of 4.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
              Reaching 5 violations will trigger immediate automatic submission and termination.
            </p>
            <button 
              onClick={dismissWarning} 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1.1rem', fontSize: '1.25rem', fontWeight: 'bold' }}
            >
              Okay, return to Exam
            </button>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DELETE ATTEMPT ================= */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Delete Record</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to delete this student attempt record? This action cannot be undone.
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
                  await executeDeleteAttempt(targetId);
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

      {/* ================= CUSTOM CONFIRM GRANT CONTINUE ACCESS ================= */}
      {grantAccessTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Grant Continue</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to allow <strong>{grantAccessTarget.users?.name || grantAccessTarget.guest_name || 'this student'}</strong> to resume and continue their test?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setGrantAccessTarget(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const target = grantAccessTarget;
                  setGrantAccessTarget(null);
                  await executeGrantAccess(target);
                }} 
                className="btn btn-primary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CUSTOM PER-QUESTION EDIT MARKS DIALOG ================= */}
      {editMarksTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass modal-content" style={{ 
            maxWidth: '680px', 
            width: '100%', 
            maxHeight: '90vh', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '2rem', 
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Fraunces, serif', margin: 0 }}>
                  ✏️ Edit Question Marks
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.3rem', margin: 0 }}>
                  Student: <strong>{editMarksTarget.users?.name || editMarksTarget.guest_name || 'Student'}</strong> {editMarksTarget.users?.reg_no && `(${editMarksTarget.users.reg_no})`}
                </p>
              </div>
              <button 
                onClick={() => setEditMarksTarget(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Live Automatically Calculated Total Score Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.3)',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚡ LIVE CALCULATED TOTAL
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                  Updates automatically as you edit each question's marks
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-primary)' }}>
                  {getCalculatedTotal()}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  /{editMarksTarget.max_score || quiz?.max_marks || 40}
                </span>
              </div>
            </div>

            {/* Scrollable Questions Breakdown List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              {editQuestionsData.map((q) => {
                const currentVal = editQuestionsMarks[q.qId] !== undefined ? editQuestionsMarks[q.qId] : '';
                const numVal = parseFloat(currentVal);
                const isOver = !isNaN(numVal) && (numVal < 0 || numVal > q.maxMarks);

                return (
                  <div key={q.qId} style={{
                    background: '#F8FAFC',
                    border: isOver ? '1.5px solid var(--danger)' : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1rem',
                    transition: 'border-color 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.4rem' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ 
                          display: 'inline-block', 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          color: 'var(--color-primary)', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '6px',
                          marginBottom: '0.3rem'
                        }}>
                          Question {q.questionNumber} ({q.maxMarks} Marks Max)
                        </span>
                        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                          {q.questionText}
                        </p>
                      </div>

                      {/* Marks Input for this question */}
                      <div style={{ minWidth: '120px', textAlign: 'right' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          MARKS (MAX {q.maxMarks})
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={q.maxMarks}
                          value={currentVal}
                          onChange={(e) => handleQuestionMarkChange(q.qId, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.6rem',
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            borderRadius: '8px',
                            border: isOver ? '1.5px solid var(--danger)' : '1px solid var(--border-color)',
                            background: '#FFFFFF',
                            color: isOver ? 'var(--danger)' : 'var(--text-primary)',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Student Answer Snippet */}
                    {q.studentAnswer && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        background: '#FFFFFF', 
                        padding: '0.5rem 0.75rem', 
                        borderRadius: '6px', 
                        border: '1px solid rgba(0,0,0,0.06)', 
                        fontSize: '0.78rem', 
                        color: 'var(--text-secondary)', 
                        maxHeight: '70px', 
                        overflowY: 'auto', 
                        whiteSpace: 'pre-wrap' 
                      }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Student Submission:</strong> {q.studentAnswer}
                      </div>
                    )}

                    {isOver && (
                      <p style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, margin: '0.3rem 0 0 0' }}>
                        ⚠️ Score must be between 0 and {q.maxMarks}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button 
                onClick={() => setEditMarksTarget(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.7rem 1.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button 
                onClick={executeEditQuestionMarks} 
                className="btn btn-primary" 
                style={{ 
                  padding: '0.7rem 1.75rem', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  background: 'var(--color-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                💾 Save & Update Total ({getCalculatedTotal()}/{editMarksTarget.max_score || quiz?.max_marks || 40})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CUSTOM CONFIRM DOWNLOAD PDF OPTIONS ================= */}
      {pdfConfirmTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '450px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Download PDF</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Do you want to include the detailed AI evaluation feedback and marks breakdown in the downloaded PDF sheet?
            </p>
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexDirection: 'column' }}>
              <button 
                onClick={() => {
                  const target = pdfConfirmTarget;
                  setPdfConfirmTarget(null);
                  executeDownloadPDF(target, true);
                }} 
                className="btn btn-primary" 
                style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}
              >
                📄 Yes, include AI feedback
              </button>
              <button 
                onClick={() => {
                  const target = pdfConfirmTarget;
                  setPdfConfirmTarget(null);
                  executeDownloadPDF(target, false);
                }} 
                className="btn btn-secondary" 
                style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}
              >
                📄 No, questions & answers only
              </button>
              <button 
                onClick={() => setPdfConfirmTarget(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', border: 'none', background: 'none', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absent Students Modal */}
      {showAbsentModal && (() => {
        const absentStudents = classroomStudents.filter(student => {
          const completedAttempt = allAttemptsList.find(att => att.student_id === student.user_id && att.violation_reason !== 'IN_PROGRESS');
          return !completedAttempt;
        });
        return (
          <div className="modal-overlay" onClick={() => setShowAbsentModal(false)}>
            <div className="glass modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  ⚠️ Absent Students ({absentStudents.length})
                </h3>
                <button onClick={() => setShowAbsentModal(false)} className="btn-close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>&times;</button>
              </div>
              {absentStudents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '2rem 0' }}>All enrolled students have attended the exam! 🎉</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '0.75rem', paddingRight: '0.5rem' }}>
                  {absentStudents.map(student => {
                    const hasInProgress = allAttemptsList.some(att => att.student_id === student.user_id && att.violation_reason === 'IN_PROGRESS');
                    return (
                      <div key={student.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.users?.name || 'Unknown Student'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            @{student.users?.username} • {hasInProgress ? (
                              <span style={{ color: '#d97706', fontWeight: 600 }}>Started but Incomplete</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>Not Attempted</span>
                            )}
                          </div>
                        </div>
                        {student.users?.reg_no && (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                            Reg No: {student.users.reg_no}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
 
      {/* ================= IN-SCREEN CUSTOM TOAST NOTIFICATIONS ================= */}
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
  );
}
