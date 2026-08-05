<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.Map" %>
<%@ page import="com.google.gson.Gson" %>
<%@ page import="com.google.gson.JsonObject" %>
<%@ page import="com.google.gson.JsonElement" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Map<String, Object> attempt = (Map<String, Object>) request.getAttribute("attempt");
    if (attempt == null) {
        response.sendRedirect(request.getContextPath() + "/dashboard");
        return;
    }

    String quizTitle = (String) attempt.get("quizTitle");
    int score = (int) attempt.get("score");
    int quizMaxMarks = (int) attempt.get("quizMaxMarks");
    String studentName = (String) attempt.get("studentName");
    String guestName = (String) attempt.get("guestName");
    String submitName = (studentName != null && !studentName.isEmpty()) ? "@" + studentName : guestName;
    if (submitName == null || submitName.isEmpty()) {
        submitName = "Guest Scholar";
    }

    String aiFeedbackJson = (String) attempt.get("aiFeedback");
    Gson gson = new Gson();
    JsonObject feedbackObj = null;
    try {
        if (aiFeedbackJson != null && !aiFeedbackJson.isEmpty()) {
            feedbackObj = gson.fromJson(aiFeedbackJson, JsonObject.class);
        }
    } catch(Exception e) {
        e.printStackTrace();
    }
%>

<!-- Scorecard Result View -->
<div class="<%= (currentUser != null) ? "col-md-9 col-sm-12" : "col-12" %> fade-in-up">
    <%
        String violationReason = (String) attempt.get("violationReason");
        boolean isViolated = (violationReason != null && !violationReason.trim().isEmpty());
    %>
    <!-- Scorecard Header Banner -->
    <div class="glass-container p-4 mb-4 text-center overflow-hidden" 
         style="<%= isViolated ? "background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%); border-color: rgba(239, 68, 68, 0.2);" : "background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%); border-color: rgba(16, 185, 129, 0.2);" %>">
        
        <% if (isViolated) { %>
            <span class="badge bg-danger-glass text-danger px-3 py-1.5 mb-2 font-size-xs text-uppercase fw-bold"><i class="fa-solid fa-triangle-exclamation me-2"></i>Security Violation Detected</span>
        <% } else { %>
            <span class="badge bg-success-glass text-success px-3 py-1.5 mb-2 font-size-xs text-uppercase fw-bold"><i class="fa-solid fa-circle-check me-2"></i>Test Completed</span>
        <% } %>
        
        <h3 class="fw-bold mb-1 text-main"><%= quizTitle %></h3>
        <p class="text-muted mb-3">Attempt score for <span class="text-white fw-bold"><%= submitName %></span></p>

        <!-- Dynamic Circular/Radial Score representation -->
        <div class="d-inline-block p-4 rounded-circle neumorphic-inset mb-3 border border-glass" style="min-width: 140px;">
            <small class="text-muted d-block font-size-xs text-uppercase fw-bold">Score</small>
            <span class="fs-1 fw-bold <%= isViolated ? "text-danger" : "text-success" %>"><%= score %></span>
            <span class="text-muted font-size-sm">/ <%= quizMaxMarks %></span>
        </div>

        <% if (isViolated) { %>
            <div class="alert alert-danger bg-danger-glass border-0 text-start mt-1 mb-3 mx-auto" style="max-width: 500px;">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="fa-solid fa-ban fs-5 text-danger"></i>
                    <strong class="text-white">Exam Integrity Violation</strong>
                </div>
                <p class="font-size-sm mb-0 text-muted" style="line-height: 1.4;">
                    This test attempt was immediately auto-submitted because the system detected the following violation:
                    <strong class="text-white d-block mt-1 font-size-xs text-uppercase"><%= violationReason %></strong>
                </p>
            </div>
        <% } %>

        <div class="d-flex justify-content-center gap-3">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="copyResultShareLink()">
                <i class="fa-solid fa-share-nodes me-1.5"></i>Share Scorecard
            </button>
        </div>
    </div>

    <!-- Question Details AI Evaluator Review -->
    <h5 class="fw-bold mb-3 text-main"><i class="fa-solid fa-graduation-cap text-primary me-2"></i>AI-Grading Detailed Report</h5>
    
    <div class="d-flex flex-column gap-3 mb-5">
        <%
            if (feedbackObj != null && feedbackObj.size() > 0) {
                int qNum = 1;
                for (Map.Entry<String, JsonElement> entry : feedbackObj.entrySet()) {
                    JsonObject qFeed = entry.getValue().getAsJsonObject();
                    String qText = qFeed.has("questionText") ? qFeed.get("questionText").getAsString() : "";
                    String qType = qFeed.has("questionType") ? qFeed.get("questionType").getAsString() : "";
                    String stAns = qFeed.has("studentAnswer") ? qFeed.get("studentAnswer").getAsString() : "";
                    int qPoints = qFeed.has("maxMarks") ? qFeed.get("maxMarks").getAsInt() : 0;
                    int qScore = qFeed.has("score") ? qFeed.get("score").getAsInt() : 0;
                    String basicFeedback = qFeed.has("feedback") ? qFeed.get("feedback").getAsString() : "";

                    // Check for details from AI response
                    JsonObject aiDetails = null;
                    if (qFeed.has("ai_response")) {
                        try {
                            aiDetails = qFeed.get("ai_response").getAsJsonObject();
                        } catch (Exception ex) {}
                    }
        %>
            <div class="glass-card p-4 border border-glass">
                <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2 border-divider">
                    <h6 class="fw-bold text-accent mb-0">Question <%= qNum++ %> <span class="badge bg-secondary-glass text-muted font-size-xs rounded-pill ms-2"><%= qType %></span></h6>
                    <span class="fw-bold text-main"><%= qScore %> / <%= qPoints %> marks</span>
                </div>
                
                <p class="text-main fw-semibold mb-3" style="font-size: 0.95rem;"><%= qText %></p>
                
                <div class="p-3 neumorphic-inset rounded-3 mb-3">
                    <small class="text-muted d-block mb-1.5 font-size-xs fw-bold text-uppercase"><i class="fa-solid fa-reply me-1"></i>Submitted Answer</small>
                    <p class="text-main mb-0 font-size-sm text-pre-line" style="white-space: pre-line;"><%= stAns.isEmpty() ? "<i>No answer submitted.</i>" : stAns %></p>
                </div>

                <!-- Grading Comments -->
                <div class="p-3 rounded-3" style="background: rgba(var(--primary-rgb), 0.05); border-left: 4px solid var(--primary);">
                    <small class="text-primary d-block mb-1.5 font-size-xs fw-bold text-uppercase"><i class="fa-solid fa-robot me-1"></i>AI Evaluator Feedback</small>
                    <p class="text-main font-size-sm mb-0"><%= basicFeedback %></p>
                    
                    <% if (aiDetails != null) { %>
                        <div class="row g-2 mt-3 pt-3 border-top border-divider">
                            <% if (aiDetails.has("strengths") && !aiDetails.get("strengths").getAsString().isEmpty()) { %>
                                <div class="col-md-6 mb-2">
                                    <span class="text-success fw-bold font-size-xs d-block text-uppercase mb-1"><i class="fa-solid fa-thumbs-up me-1"></i>Key Strengths</span>
                                    <small class="text-muted font-size-sm"><%= aiDetails.get("strengths").getAsString() %></small>
                                </div>
                            <% } %>
                            <% if (aiDetails.has("weaknesses") && !aiDetails.get("weaknesses").getAsString().isEmpty()) { %>
                                <div class="col-md-6 mb-2">
                                    <span class="text-danger fw-bold font-size-xs d-block text-uppercase mb-1"><i class="fa-solid fa-circle-exclamation me-1"></i>Gaps / Weaknesses</span>
                                    <small class="text-muted font-size-sm"><%= aiDetails.get("weaknesses").getAsString() %></small>
                                </div>
                            <% } %>
                            <% if (aiDetails.has("missing_concepts") && !aiDetails.get("missing_concepts").getAsString().isEmpty()) { %>
                                <div class="col-12 mt-2">
                                    <span class="text-warning fw-bold font-size-xs d-block text-uppercase mb-1"><i class="fa-solid fa-lightbulb me-1"></i>Missing Key Concepts</span>
                                    <small class="text-muted font-size-sm"><%= aiDetails.get("missing_concepts").getAsString() %></small>
                                </div>
                            <% } %>
                        </div>
                    <% } %>
                </div>
            </div>
        <%
                }
            } else {
        %>
            <div class="glass-card text-center py-5">
                <i class="fa-solid fa-clipboard-question text-muted fs-1 mb-3"></i>
                <h5 class="fw-bold text-main mb-1">No Grading Detail Available</h5>
                <p class="text-muted small mb-0">The scorecard is finalized but detailed report parsing failed.</p>
            </div>
        <% } %>
    </div>
</div>

<!-- Copy Results Share link Javascript -->
<script>
    function copyResultShareLink() {
        const shareUrl = window.location.origin + '<%= request.getContextPath() %>/quiz?action=attempt_result&attemptId=' + <%= attempt.get("id") %>;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Scorecard share link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy scorecard link: ', err);
        });
    }
</script>

<%@ include file="/common/footer.jsp" %>
