<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Assignment" %>
<%@ page import="com.learnx.model.Submission" %>
<%@ page import="com.learnx.model.Classroom" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Assignment assignment = (Assignment) request.getAttribute("assignment");
    Classroom classroom = (Classroom) request.getAttribute("classroom");
    List<Submission> submissions = (List<Submission>) request.getAttribute("submissions");
    
    // Check if a specific submission is selected for evaluation detail view
    Submission activeSub = null;
    String activeSubIdStr = request.getParameter("submissionId");
    if (activeSubIdStr != null && submissions != null) {
        try {
            int activeId = Integer.parseInt(activeSubIdStr);
            for (Submission s : submissions) {
                if (s.getId() == activeId) {
                    activeSub = s;
                    break;
                }
            }
        } catch (NumberFormatException e) {}
    }
%>

<!-- Faculty AI Evaluator Dashboard -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Back Button -->
    <a href="<%= request.getContextPath() %>/classroom?id=<%= classroom.getId() %>" class="btn btn-sm btn-light bg-transparent text-muted mb-3 border-divider">
        <i class="fa-solid fa-arrow-left me-1"></i>Back to Classroom
    </a>

    <div class="glass-card mb-4">
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <span class="badge role-badge mb-2">Classroom Evaluator Dashboard</span>
                <h4 class="fw-bold mb-1 text-main"><%= assignment.getTitle() %></h4>
                <small class="text-muted">Total Submissions: <%= submissions != null ? submissions.size() : 0 %></small>
            </div>
            <div class="text-end">
                <span class="badge bg-primary p-2">Max marks: <%= assignment.getMaxMarks() %></span>
            </div>
        </div>
    </div>

    <div class="row">
        <!-- Submissions Roster List (Left Column) -->
        <div class="col-md-4 mb-3">
            <div class="glass-container p-3 h-100">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-list me-2 text-primary"></i>Submissions Roster</h6>
                <div class="list-group list-group-flush border-0">
                    <%
                        if (submissions != null && !submissions.isEmpty()) {
                            for (Submission s : submissions) {
                                boolean isActive = (activeSub != null && s.getId() == activeSub.getId());
                    %>
                        <a href="?id=<%= assignment.getId() %>&submissionId=<%= s.getId() %>" class="list-group-item list-group-item-action bg-transparent border-0 rounded-3 mb-2 p-2.5 d-flex justify-content-between align-items-center <%= isActive ? "neumorphic-inset" : "border border-divider" %> text-main">
                            <div>
                                <span class="fw-bold d-block small"><%= s.getStudentName() %></span>
                                <small class="text-muted" style="font-size: 0.75rem;"><%= s.getSubmittedAt() %></small>
                            </div>
                            <div>
                                <% if (s.getTeacherMarks() != null) { %>
                                    <span class="badge bg-success"><%= s.getTeacherMarks() %> m</span>
                                <% } else if (s.getAiMarks() != null) { %>
                                    <span class="badge bg-warning text-dark"><%= s.getAiMarks() %> m (AI)</span>
                                <% } else { %>
                                    <span class="badge bg-info">OCR...</span>
                                <% } %>
                            </div>
                        </a>
                    <%
                            }
                        } else {
                    %>
                        <p class="text-muted small p-2">No submissions uploaded yet.</p>
                    <% } %>
                </div>
            </div>
        </div>

        <!-- Submission Grading Sandbox (Right Column) -->
        <div class="col-md-8 mb-3">
            <% if (activeSub == null) { %>
                <div class="glass-container p-5 text-center h-100 d-flex flex-column justify-content-center align-items-center">
                    <i class="fa-solid fa-robot fs-1 text-primary mb-3"></i>
                    <h5 class="fw-bold mb-2">AI Copilot Grading Panel</h5>
                    <p class="text-muted small col-lg-8">Select a student from the roster list to preview their scanned sheet, verify OCR transcription outputs, edit feedback details, and publish grades.</p>
                </div>
            <% } else { %>
                <!-- Detailed grading board -->
                <div class="glass-container p-4">
                    <!-- Student details header -->
                    <div class="d-flex justify-content-between align-items-start border-bottom border-divider pb-3 mb-3">
                        <div>
                            <h5 class="fw-bold mb-1"><%= activeSub.getStudentName() %></h5>
                            <small class="text-muted">Uploaded sheet: <a href="<%= request.getContextPath() %><%= activeSub.getFilePath() %>" target="_blank" class="text-primary text-decoration-none fw-semibold"><i class="fa-solid fa-file-arrow-down me-1"></i>Download Sheet</a></small>
                        </div>
                        <div class="text-end d-flex align-items-center gap-3">
                            <div>
                                <small class="text-muted d-block small">AI Confidence</small>
                                <span class="badge bg-info-subtle text-info fw-bold font-size-sm" style="font-size: 0.85rem;"><%= activeSub.getConfidenceScore() %>%</span>
                            </div>
                            <div>
                                <small class="text-muted d-block small">Suggested Marks</small>
                                <span class="badge bg-warning-subtle text-warning fw-bold font-size-sm" style="font-size: 0.85rem;"><%= activeSub.getAiMarks() != null ? activeSub.getAiMarks() : 0 %> / <%= assignment.getMaxMarks() %></span>
                            </div>
                        </div>
                    </div>

                    <!-- Grading Form -->
                    <form action="<%= request.getContextPath() %>/evaluator" method="post">
                        <input type="hidden" name="submissionId" value="<%= activeSub.getId() %>">

                        <!-- OCR Text Drawer (Editable so instructor has final control) -->
                        <div class="mb-4">
                            <h6 class="fw-bold text-main mb-2"><i class="fa-solid fa-file-signature text-primary me-2"></i>Extracted Answer Text (OCR Transcription)</h6>
                            <textarea name="ocrText" class="form-control form-control-glass font-size-sm" rows="5" style="font-family: inherit; font-size: 0.85rem;"><%= activeSub.getOcrText() != null ? activeSub.getOcrText() : "" %></textarea>
                            <small class="text-muted mt-1 d-block">You can edit the OCR text if transcription errors occur prior to scoring revision.</small>
                        </div>

                        <!-- AI Metrics Panels -->
                        <div class="row mb-4">
                            <div class="col-md-6 mb-3">
                                <div class="p-3 neumorphic-inset rounded-4 h-100">
                                    <h6 class="fw-bold mb-2 small text-primary"><i class="fa-solid fa-circle-check me-2"></i>Strengths Found</h6>
                                    <p class="text-muted small mb-0"><%= activeSub.getStrengths() != null ? activeSub.getStrengths() : "N/A" %></p>
                                </div>
                            </div>
                            <div class="col-md-6 mb-3">
                                <div class="p-3 neumorphic-inset rounded-4 h-100">
                                    <h6 class="fw-bold mb-2 small text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i>Weaknesses & Gaps</h6>
                                    <p class="text-muted small mb-0"><%= activeSub.getWeaknesses() != null ? activeSub.getWeaknesses() : "N/A" %></p>
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <div class="p-3 neumorphic-inset rounded-4">
                                <h6 class="fw-bold mb-2 small text-warning"><i class="fa-solid fa-magnifying-glass-chart me-2"></i>Missing Concepts (Gaps in Rubric)</h6>
                                <span class="badge bg-danger-subtle text-danger text-wrap text-start p-2 font-size-xs w-100 border-0"><%= activeSub.getMissingConcepts() != null ? activeSub.getMissingConcepts() : "None" %></span>
                            </div>
                        </div>

                        <div class="mb-4">
                            <h6 class="fw-bold text-main mb-2"><i class="fa-regular fa-message text-primary me-2"></i>AI Feedback Rationale</h6>
                            <textarea name="aiFeedback" class="form-control form-control-glass font-size-sm" rows="3" readonly><%= activeSub.getAiFeedback() != null ? activeSub.getAiFeedback() : "" %></textarea>
                        </div>

                        <!-- Input final grades -->
                        <div class="row align-items-center mb-4 border-top border-divider pt-3">
                            <div class="col-md-6 mb-2">
                                <div class="d-flex align-items-center">
                                    <label class="form-label text-main fw-bold mb-0 me-3">Assign Score:</label>
                                    <input type="number" name="teacherMarks" class="form-control form-control-glass text-center fw-bold fs-5" style="width: 100px;" value="<%= activeSub.getTeacherMarks() != null ? activeSub.getTeacherMarks() : (activeSub.getAiMarks() != null ? activeSub.getAiMarks() : 0) %>" min="0" max="<%= assignment.getMaxMarks() %>" required>
                                    <span class="ms-2 fs-5 text-muted">/ <%= assignment.getMaxMarks() %></span>
                                </div>
                            </div>
                            <div class="col-md-6 mb-2 text-end d-flex justify-content-end gap-2">
                                <button type="submit" name="action" value="reevaluate" class="btn btn-outline-primary border-divider rounded-pill px-3">
                                    <i class="fa-solid fa-arrows-rotate me-1"></i>Re-evaluate
                                </button>
                                <button type="submit" name="action" value="approve" class="btn btn-primary-glass rounded-pill px-4">
                                    <i class="fa-solid fa-check-double me-1"></i>Publish Marks
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            <% } %>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
