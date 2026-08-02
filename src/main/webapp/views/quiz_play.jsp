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

<div class="col-12 fade-in-up">
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
                            <!-- Theory / Analytical Textarea with OCR Option -->
                            <div class="mb-2">
                                <textarea name="answer_<%= q.getId() %>" class="form-control form-control-glass" rows="6" placeholder="Type your detailed answer or explanation here..."></textarea>
                                
                                <!-- File input & Trigger for Handwriting OCR Scanning -->
                                <input type="file" id="ocr_file_<%= q.getId() %>" style="display:none;" accept="image/*" onchange="runOCR(<%= q.getId() %>)">
                                <div class="d-flex align-items-center justify-content-between mt-2.5">
                                    <button type="button" class="btn btn-xs btn-outline-primary rounded-pill px-3 font-size-xs" onclick="document.getElementById('ocr_file_<%= q.getId() %>').click()">
                                        <i class="fa-solid fa-camera me-1"></i>Scan Handwritten Notes (OCR)
                                    </button>
                                    <span class="text-muted font-size-xs italic" id="ocr_status_<%= q.getId() %>" style="display:none; font-style: italic;">Processing OCR transcription...</span>
                                </div>
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

    function updateTimer() {
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

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    // OCR Handwriting Scan Execution
    function runOCR(qId) {
        const fileInput = document.getElementById(`ocr_file_${qId}`);
        const textarea = document.querySelector(`textarea[name="answer_${qId}"]`);
        const statusSpan = document.getElementById(`ocr_status_${qId}`);
        
        if (!fileInput.files || fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);
        
        textarea.disabled = true;
        statusSpan.style.display = "inline";
        
        fetch('<%= request.getContextPath() %>/ocr', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(text => {
            textarea.disabled = false;
            statusSpan.style.display = "none";
            if (text.startsWith("Error")) {
                alert(text);
            } else {
                textarea.value = text;
            }
        })
        .catch(err => {
            textarea.disabled = false;
            statusSpan.style.display = "none";
            console.error(err);
            alert("Error connecting to OCR server.");
        });
    }

    // Anti-cheating Security System
    let isFilePickerOpen = false;
    let tabSwitchCount = 0;

    // Track file picker interactions to prevent false positives
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('click', () => {
            isFilePickerOpen = true;
        });
        input.addEventListener('change', () => {
            setTimeout(() => {
                isFilePickerOpen = false;
            }, 1000);
        });
    });

    window.addEventListener('focus', () => {
        isFilePickerOpen = false;
    });

    function handleTabSwitch() {
        if (isFilePickerOpen) return;
        
        tabSwitchCount++;
        if (tabSwitchCount === 1) {
            // Show warning modal
            const modal = document.getElementById('warningModal');
            modal.classList.remove('d-none');
            modal.style.display = 'flex';
        } else if (tabSwitchCount >= 2) {
            // Auto submit
            alert("Security violation! Your test is being automatically submitted.");
            form.submit();
        }
    }

    function dismissWarning() {
        const modal = document.getElementById('warningModal');
        modal.classList.add('d-none');
        modal.style.display = 'none';
    }

    // Monitor Visibility State
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            handleTabSwitch();
        }
    });

    // Monitor Window Focus
    window.addEventListener('blur', () => {
        setTimeout(() => {
            if (!document.hasFocus() && !isFilePickerOpen) {
                handleTabSwitch();
            }
        }, 250);
    });

    // Prevent copy, paste, cut, and right-click
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('cut', e => e.preventDefault());
    document.addEventListener('paste', e => e.preventDefault());

    // Prevent key shortcuts (F12, DevTools, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U)
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'u') ||
            (e.ctrlKey && e.key === 'c') ||
            (e.ctrlKey && e.key === 'v') ||
            (e.ctrlKey && e.key === 'x')
        ) {
            e.preventDefault();
        }
    });
</script>

<%@ include file="/common/footer.jsp" %>
