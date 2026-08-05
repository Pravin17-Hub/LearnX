<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="com.learnx.model.Assignment" %>
<%@ page import="com.learnx.model.Submission" %>
<%@ page import="com.learnx.model.Classroom" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Assignment assignment = (Assignment) request.getAttribute("assignment");
    Classroom classroom = (Classroom) request.getAttribute("classroom");
    Submission submission = (Submission) request.getAttribute("submission");
%>

<!-- Assignment Detail Panel -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <!-- Back Button -->
    <a href="<%= request.getContextPath() %>/classroom?id=<%= classroom.getId() %>" class="btn btn-sm btn-light bg-transparent text-muted mb-3 border-divider">
        <i class="fa-solid fa-arrow-left me-1"></i>Back to Classroom
    </a>

    <div class="row">
        <!-- Assignment Info -->
        <div class="col-md-7 mb-3">
            <div class="glass-container p-4 h-100">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h4 class="fw-bold mb-0 text-main"><%= assignment.getTitle() %></h4>
                    <span class="badge bg-primary p-2">Max Marks: <%= assignment.getMaxMarks() %></span>
                </div>
                
                <p class="text-muted small mb-4">
                    Posted by <%= assignment.getCreatorName() %> • Deadline: <span class="text-danger"><%= assignment.getDeadline() %></span>
                </p>
                
                <h6 class="fw-bold text-main mb-2">Instructions</h6>
                <p class="text-muted small mb-4"><%= assignment.getDescription() %></p>

                <% if (assignment.getFilePath() != null && !assignment.getFilePath().isEmpty()) { %>
                    <h6 class="fw-bold text-main mb-2">Attachments</h6>
                    <div class="p-3 neumorphic-inset rounded-3 d-flex justify-content-between align-items-center mb-4">
                        <span class="small text-muted"><i class="fa-regular fa-file me-2 text-danger"></i>Assignment Sheet</span>
                        <a href="<%= request.getContextPath() %><%= assignment.getFilePath() %>" class="btn btn-sm btn-primary-glass px-3" download><i class="fa-solid fa-download"></i></a>
                    </div>
                <% } %>

                <!-- Rubric Info -->
                <div class="border-top pt-3">
                    <h6 class="fw-bold text-main mb-2">Grading Rubric Reference</h6>
                    <pre class="bg-light p-3 text-muted rounded-3 font-size-xs" style="font-family: inherit; font-size: 0.8rem; white-space: pre-wrap;"><%= assignment.getRubric() %></pre>
                </div>
            </div>
        </div>

        <!-- Student Submission & Results Panel -->
        <div class="col-md-5 mb-3">
            <div class="glass-card mb-3">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-arrow-up text-primary me-2"></i>Your Work</h5>
                
                <% if (submission == null) { %>
                    <!-- Not Submitted -->
                    <div class="text-center py-4 border border-dashed border-divider rounded-4 mb-3">
                        <i class="fa-regular fa-folder-open fs-2 text-muted mb-2"></i>
                        <p class="text-muted small mb-0">No submission files uploaded yet.</p>
                    </div>

                    <form action="<%= request.getContextPath() %>/assignment" method="post" enctype="multipart/form-data">
                        <input type="hidden" name="action" value="submit">
                        <input type="hidden" name="assignmentId" value="<%= assignment.getId() %>">
                        
                        <div class="mb-3">
                            <label class="form-label text-muted small fw-semibold">Upload Answer Sheet (PDF, Image, DOCX)</label>
                            <input type="file" name="submissionFile" class="form-control form-control-glass" required>
                            <small class="text-muted d-block mt-2">Supports handwritten paper uploads (take a photo and upload JPEG/PNG).</small>
                        </div>
                        <button type="submit" class="btn btn-primary-glass w-100 py-2.5">
                            <i class="fa-solid fa-cloud-arrow-up me-2"></i>Submit Sheet
                        </button>
                    </form>
                <% } else { %>
                    <!-- Submitted Status Card -->
                    <div class="p-3 neumorphic-inset rounded-4 mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="small text-muted">Submission Status</span>
                            <% if (submission.getTeacherMarks() != null) { %>
                                <span class="badge bg-success">Graded</span>
                            <% } else if (submission.getAiMarks() != null) { %>
                                <span class="badge bg-warning text-dark">AI Drafted (Reviewing)</span>
                            <% } else { %>
                                <span class="badge bg-info text-white">AI Extracting...</span>
                            <% } %>
                        </div>
                        <p class="mb-0 text-main small text-truncate">Uploaded: <%= submission.getFilePath().substring(submission.getFilePath().lastIndexOf("/") + 1) %></p>
                        <small class="text-muted">On: <%= submission.getSubmittedAt() %></small>
                    </div>

                    <% if (submission.getTeacherMarks() == null && submission.getAiMarks() == null) { %>
                        <div class="text-center py-3">
                            <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                            <small class="text-muted">AI is processing OCR text extraction and rubric comparison...</small>
                            <!-- Auto Refresh Button -->
                            <button class="btn btn-sm btn-light bg-transparent text-primary border-divider mt-2 d-block mx-auto" onclick="location.reload()">
                                <i class="fa-solid fa-arrows-rotate me-1"></i>Refresh Grades
                            </button>
                        </div>
                        <script>
                            // Auto-reload every 5 seconds to check grading progress
                            setTimeout(() => {
                                location.reload();
                            }, 5000);
                        </script>
                    <% } %>

                    <% if (submission.getTeacherMarks() != null) { %>
                        <!-- Final Published Grade -->
                        <div class="p-3 rounded-4 bg-primary text-white text-center mb-3">
                            <small class="text-white-50 text-uppercase fw-bold">Published Marks</small>
                            <h2 class="fw-bold mb-0 mt-1"><%= submission.getTeacherMarks() %> / <%= assignment.getMaxMarks() %></h2>
                        </div>
                    <% } else if (submission.getAiMarks() != null) { %>
                        <!-- AI Suggested Grade Draft -->
                        <div class="p-3 rounded-4 bg-warning text-dark text-center mb-3">
                            <small class="text-muted-50 text-uppercase fw-bold d-block" style="font-size: 0.75rem; letter-spacing: 0.5px;">AI Suggested Marks (Draft)</small>
                            <h2 class="fw-bold mb-0 mt-1"><%= submission.getAiMarks() %> / <%= assignment.getMaxMarks() %></h2>
                            <small class="text-muted d-block mt-1 font-size-xs" style="font-size: 0.75rem;"><i class="fa-solid fa-hourglass-half me-1"></i>Awaiting Faculty Review & Approval</small>
                        </div>
                    <% } %>
                <% } %>
            </div>

            <!-- AI Feedback Panel (Visible after draft / publish) -->
            <% if (submission != null && (submission.getAiMarks() != null || submission.getTeacherMarks() != null)) { %>
                <div class="glass-container p-4">
                    <h5 class="fw-bold mb-3"><i class="fa-solid fa-robot text-primary me-2"></i>AI Feedback Analysis</h5>
                    
                    <div class="mb-3">
                        <h6 class="fw-bold text-main mb-1" style="font-size: 0.85rem;">Strengths</h6>
                        <p class="text-muted small mb-0"><%= submission.getStrengths() %></p>
                    </div>

                    <div class="mb-3">
                        <h6 class="fw-bold text-main mb-1" style="font-size: 0.85rem;">Weaknesses & Gaps</h6>
                        <p class="text-muted small mb-0"><%= submission.getWeaknesses() %></p>
                    </div>

                    <div class="mb-3">
                        <h6 class="fw-bold text-main mb-1" style="font-size: 0.85rem;">Missing Concepts</h6>
                        <span class="badge bg-danger-subtle text-danger p-2 border-0 rounded-3 small text-wrap text-start"><%= submission.getMissingConcepts() %></span>
                    </div>

                    <div class="border-top pt-3 mt-3">
                        <h6 class="fw-bold text-main mb-1" style="font-size: 0.85rem;">Grading Summary</h6>
                        <p class="text-muted small mb-0"><%= submission.getAiFeedback() %></p>
                    </div>
                </div>
            <% } %>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
