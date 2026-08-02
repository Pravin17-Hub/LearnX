<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Quiz" %>
<%@ page import="com.learnx.model.QuizQuestion" %>
<%@ page import="com.google.gson.Gson" %>

<%@ include file="/common/header.jsp" %>

<%
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);

    Quiz activeQuiz = (Quiz) session.getAttribute("activeQuiz");
    List<QuizQuestion> questions = (List<QuizQuestion>) session.getAttribute("quizQuestions");
    Long startTime = (Long) session.getAttribute("quizStartTime");
    
    if (activeQuiz == null || questions == null || startTime == null) {
        response.sendRedirect(request.getContextPath() + "/dashboard");
        return;
    }

    long timeElapsedSec = (new java.util.Date().getTime() - startTime) / 1000;
    long totalDurationSec = activeQuiz.getDurationMinutes() * 60;
    long timeRemainingSec = totalDurationSec - timeElapsedSec;
    
    if (timeRemainingSec <= 0) {
        response.sendRedirect(request.getContextPath() + "/dashboard");
        return;
    }

    Gson gson = new Gson();
    String guestName = request.getParameter("guestName");
%>

<style>
    body {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
</style>

<div class="col-12 fade-in-up">
    <!-- Start Exam Modal (Fullscreen Enforcer) -->
    <div id="startExamModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10,10,10,0.95); backdrop-filter: blur(15px); z-index: 10000; display: flex; align-items: center; justify-content: center; color: white;">
        <div class="glass-card text-center p-5 border border-primary shadow-lg" style="max-width: 550px; background: rgba(20, 20, 20, 0.85); border-radius: 20px;">
            <i class="fa-solid fa-shield-halved text-primary fs-1 mb-4"></i>
            <h3 class="fw-bold mb-3 text-primary">Secure Exam Environment</h3>
            <p class="mb-4 text-light">This exam must be taken in <strong>Fullscreen Mode</strong>. Switching tabs, exiting fullscreen, or minimizing the window will result in automatic submission.</p>
            <button type="button" class="btn btn-primary px-5 py-3 rounded-pill fw-bold fs-5 shadow" onclick="startSecureExam()">
                <i class="fa-solid fa-expand me-2"></i>Start Exam in Fullscreen
            </button>
        </div>
    </div>

    <!-- Warning Modal Overlay -->
    <div id="warningModal" class="d-none" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 9999; display: none; align-items: center; justify-content: center; color: white;">
        <div class="glass-card text-center p-5 border border-danger shadow-lg animate-pulse" style="max-width: 500px; background: rgba(20, 20, 20, 0.7); border-radius: 20px;">
            <i class="fa-solid fa-triangle-exclamation text-danger fs-1 mb-4"></i>
            <h3 class="fw-bold mb-3 text-danger">Cheating Warning!</h3>
            <p class="mb-4 text-light">You navigated away or switched tabs/windows. This is your <strong>first and final warning</strong>.</p>
            <p class="mb-4 text-muted small">Any further tab switching, window minimization, or focus loss will cause your quiz to be <strong>submitted automatically</strong>.</p>
            <button type="button" class="btn btn-danger px-4 py-2.5 rounded-pill fw-bold" onclick="dismissWarning()">I Understand</button>
        </div>
    </div>

    <!-- Floating Header with Countdown Timer -->
    <div class="glass-card d-flex justify-content-between align-items-center mb-4 sticky-top" style="top: 80px; z-index: 100;">
        <div>
            <h5 class="fw-bold mb-0 text-main"><%= activeQuiz.getTitle() %></h5>
            <small class="text-muted"><%= questions.size() %> Questions • Combined Test</small>
        </div>
        <div class="d-flex align-items-center gap-3" style="display: none !important;">
            <span class="small text-muted"><i class="fa-regular fa-clock me-1"></i>Time Remaining:</span>
            <span class="badge bg-danger fs-5 px-3 py-2 fw-bold" id="timer">--:--</span>
        </div>
    </div>

    <div class="row justify-content-center">
        <div class="col-lg-8">
            <form action="<%= request.getContextPath() %>/quiz" method="post" id="quizForm">
                <input type="hidden" name="action" value="submit">
                <input type="hidden" name="guestName" value="<%= (guestName != null) ? guestName : "" %>">
                
                <%
                    int index = 1;
                    for (QuizQuestion q : questions) {
                        String[] options = null;
                        try {
                            options = gson.fromJson(q.getOptionsJson(), String[].class);
                        } catch(Exception e) {}
                %>
                    <div class="glass-card mb-4 p-4">
                        <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2 border-divider">
                            <span class="badge bg-primary-glass text-primary px-2.5 py-1 text-uppercase fw-bold font-size-xs">Question <%= index++ %></span>
                            <span class="small text-muted"><%= q.getPoints() %> points | <%= q.getQuestionType() %></span>
                        </div>
                        <h6 class="fw-bold text-main mb-3" style="font-size: 1.05rem;"><%= q.getQuestionText() %></h6>

                        <% if ("MCQ".equalsIgnoreCase(q.getQuestionType())) { %>
                            <!-- Radio Buttons Option Layout -->
                            <div class="d-flex flex-column gap-2">
                                <% 
                                    if (options != null) {
                                        for (int i = 0; i < options.length; i++) { 
                                %>
                                    <label class="p-3 neumorphic-inset rounded-3 d-flex align-items-center gap-3 option-label cursor-pointer">
                                        <input type="radio" name="answer_<%= q.getId() %>" value="<%= i %>" class="form-check-input border-primary">
                                        <span class="text-main"><%= options[i] %></span>
                                    </label>
                                <% 
                                        } 
                                    } 
                                %>
                            </div>

                        <% } else { %>
                            <!-- Theory / Analytical Textarea -->
                            <div class="mb-2">
                                <textarea name="answer_<%= q.getId() %>" class="form-control form-control-glass" rows="6" placeholder="Type your detailed answer or explanation here..."></textarea>
                            </div>
                        <% } %>
                    </div>
                <% } %>

                <div class="text-center mb-5">
                    <button type="submit" class="btn btn-primary-glass px-5 py-3 fs-5 rounded-4"><i class="fa-solid fa-cloud-arrow-up me-2"></i>Submit Test Answers</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Scripts for Timer and OCR -->
<script>
    let timeRemaining = <%= timeRemainingSec %>;
    const timerSpan = document.getElementById('timer');
    const form = document.getElementById('quizForm');
    let examStarted = false;
    let timerInterval = null;

    function updateTimer() {
        if (!examStarted) return;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        timerSpan.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeRemaining <= 30) {
            timerSpan.className = 'badge bg-danger fs-5 px-3 py-2 fw-bold animate-pulse';
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("Time's up! Your attempt is being saved and submitted automatically.");
            form.submit();
        }
        timeRemaining--;
    }

    // Entering secure fullscreen mode
    function startSecureExam() {
        const docEl = document.documentElement;
        const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        
        const enterExamMode = () => {
            document.getElementById('startExamModal').style.display = 'none';
            examStarted = true;
            updateTimer();
            timerInterval = setInterval(updateTimer, 1000);
        };

        if (requestFS) {
            requestFS.call(docEl)
                .then(enterExamMode)
                .catch(err => {
                    alert("Error entering fullscreen mode: " + err.message + "\nPlease grant fullscreen permission to begin the exam.");
                });
        } else {
            enterExamMode();
        }
    }

    // Monitor Fullscreen Mode Exit
    const handleFullscreenChange = () => {
        if (!document.fullscreenElement && 
            !document.webkitIsFullScreen && 
            !document.mozFullScreen && 
            !document.msFullscreenElement &&
            examStarted) {
            triggerSecurityViolation("exiting fullscreen mode");
        }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Anti-cheating Security System
    let isWindowFocused = true;
    let tabSwitchCount = 0;

    function handleTabSwitch() {
        if (!examStarted) return;
        if (!isWindowFocused) return; // Prevent double-triggering in the same blur cycle
        
        isWindowFocused = false;
        tabSwitchCount++;
        if (tabSwitchCount === 1) {
            // Show warning modal
            const modal = document.getElementById('warningModal');
            modal.classList.remove('d-none');
            modal.style.display = 'flex';
        } else if (tabSwitchCount >= 2) {
            triggerSecurityViolation("tab switching / focus loss");
        }
    }

    function dismissWarning() {
        const modal = document.getElementById('warningModal');
        modal.classList.add('d-none');
        modal.style.display = 'none';
        isWindowFocused = true; // reset focus flag
    }

    // Monitor Visibility State
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            handleTabSwitch();
        } else if (document.visibilityState === 'visible') {
            isWindowFocused = true;
        }
    });

    // Monitor Window Focus
    window.addEventListener('blur', () => {
        setTimeout(() => {
            if (!document.hasFocus()) {
                handleTabSwitch();
            }
        }, 250);
    });

    window.addEventListener('focus', () => {
        isWindowFocused = true;
    });

    // Helper to log and auto-submit on clipboard/drag-drop cheating attempt
    function triggerSecurityViolation(reason) {
        // Append a hidden parameter so the server knows it was auto-submitted due to a violation
        const violationInput = document.createElement('input');
        violationInput.type = 'hidden';
        violationInput.name = 'securityViolation';
        violationInput.value = reason;
        form.appendChild(violationInput);

        // Turn off exam started state to prevent any subsequent event triggers during postback
        examStarted = false;

        form.submit();
    }

    // Prevent and detect copy, paste, cut, and drop operations using capturing phase listeners
    // to block attempts to bypass via extensions or other standard bypass scripts.
    const blockClipboardOrDrag = e => {
        if (!examStarted) return;
        e.preventDefault();
        e.stopPropagation();
        
        let type = e.type;
        let msg = "clipboard action (" + type + ")";
        if (type === 'drop') {
            msg = "drag-and-drop text insertion";
        }
        triggerSecurityViolation(msg);
    };

    window.addEventListener('copy', blockClipboardOrDrag, true);
    window.addEventListener('cut', blockClipboardOrDrag, true);
    window.addEventListener('paste', blockClipboardOrDrag, true);
    window.addEventListener('drop', blockClipboardOrDrag, true);
    
    // Always call preventDefault on dragover window-wide to prevent drop operations from being permitted
    window.addEventListener('dragover', e => {
        e.preventDefault();
    }, true);

    // Prevent right-click context menu window-wide
    window.addEventListener('contextmenu', e => {
        if (!examStarted) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // Monitor input events on all textareas to catch copy-paste or autofill extension bypasses.
    // If a text length jump > 15 characters occurs in a single event, or if insertFromPaste is fired, we trigger auto-submit.
    document.querySelectorAll('textarea').forEach(textarea => {
        let lastLength = textarea.value.length;
        
        textarea.addEventListener('input', e => {
            if (!examStarted) return;
            const currentLength = textarea.value.length;
            const delta = currentLength - lastLength;
            
            if (e.inputType === 'insertFromPaste' || delta > 15) {
                triggerSecurityViolation("copy-pasting or auto-filling text");
            }
            lastLength = currentLength;
        });
    });

    // Background polling running every 200ms to detect bypasses that direct-set .value bypassing input events
    document.querySelectorAll('textarea').forEach(textarea => {
        let lastValue = textarea.value;
        setInterval(() => {
            if (!examStarted) return;
            const currentValue = textarea.value;
            if (currentValue !== lastValue) {
                const delta = currentValue.length - lastValue.length;
                // If text length increases by more than 8 characters in 200ms, it is a copy-paste/autofill
                if (delta > 8) {
                    triggerSecurityViolation("sudden text insertion (copy-paste/autofill)");
                }
                lastValue = currentValue;
            }
        }, 200);
    });

    // Monitor Selection Changes (prevent highlighting/scraping questions/answers)
    document.addEventListener('selectionchange', () => {
        if (!examStarted) return;
        const selection = window.getSelection().toString().trim();
        if (selection.length > 10) {
            triggerSecurityViolation("selecting/highlighting text");
        }
    });

    // MCQ Anti-Autofill / Automated Solver Protection
    const trustedRadioChecks = {};

    // Record trusted radio inputs
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', e => {
            if (!examStarted) return;
            if (e.isTrusted) {
                trustedRadioChecks[radio.name] = radio.value;
            } else {
                triggerSecurityViolation("untrusted programmatic option change");
            }
        });
    });

    // Background polling running every 200ms for MCQs to verify no options were programmatically checked
    setInterval(() => {
        if (!examStarted) return;
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            if (radio.checked) {
                // If a radio is checked, it MUST match the recorded trusted checked value
                if (trustedRadioChecks[radio.name] !== radio.value) {
                    triggerSecurityViolation("programmatic answer selection (copy-paste/autofill extension)");
                }
            }
        });
    }, 200);

    // Prevent key shortcuts (F12, DevTools, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U)
    document.addEventListener('keydown', e => {
        if (!examStarted) return;
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'u') ||
            (e.ctrlKey && e.key === 'c') ||
            (e.ctrlKey && e.key === 'v') ||
            (e.ctrlKey && e.key === 'x')
        ) {
            e.preventDefault();
            e.stopPropagation();
            triggerSecurityViolation("forbidden keyboard shortcut");
        }
    }, true);
</script>

<%@ include file="/common/footer.jsp" %>
