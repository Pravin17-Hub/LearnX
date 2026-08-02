<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Classroom" %>
<%@ page import="com.learnx.model.Assignment" %>
<%@ page import="com.learnx.model.Material" %>
<%@ page import="com.learnx.model.User" %>
<%@ page import="com.learnx.model.Quiz" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    Classroom currentClass = (Classroom) request.getAttribute("classroom");
    List<Assignment> assignments = (List<Assignment>) request.getAttribute("assignments");
    List<Material> materials = (List<Material>) request.getAttribute("materials");
    List<User> members = (List<User>) request.getAttribute("members");

    boolean isInstructor = (currentUser != null && 
        ("Faculty".equals(currentUser.getRole()) || "Administrator".equals(currentUser.getRole()) || "Teaching Assistant".equals(currentUser.getRole())));
%>

<!-- Classroom Workspace -->
<div class="<%= (currentUser != null) ? "col-md-9 col-sm-12" : "col-12" %> fade-in-up">
    <!-- Class Cover Card -->
    <div class="glass-container p-4 mb-4 text-white d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.85), rgba(79, 70, 229, 0.85)), url('/assets/images/default-cover.jpg'); min-height: 180px; border-radius: 20px;">
        <div>
            <span class="badge bg-white text-primary mb-2"><%= currentClass.getSubject() %></span>
            <h3 class="fw-bold mb-1" style="font-family: 'Poppins', sans-serif;"><%= currentClass.getClassName() %></h3>
            <p class="mb-0 text-white-50"><%= currentClass.getDescription() %></p>
        </div>
        <div class="text-end d-none d-md-block bg-white text-dark p-3 rounded-4 shadow-sm" style="max-width: 180px;">
            <small class="text-muted d-block font-size-sm">Classroom Code</small>
            <h5 class="fw-bold mb-1 text-primary"><%= currentClass.getJoinCode() %></h5>
            <img src="<%= currentClass.getQrCodePath() %>" alt="QR Join" style="width: 100px; height: 100px;">
        </div>
    </div>

    <!-- Classroom Sub Navigation Tabs -->
    <ul class="nav nav-pills glass-container p-2 mb-4 d-flex gap-2" id="classTab" role="tablist" style="border-radius: 14px;">
        <li class="nav-item" role="presentation">
            <button class="nav-link active rounded-3 px-4 py-2" id="stream-tab" data-bs-toggle="tab" data-bs-target="#stream" type="button" role="tab">Stream</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link rounded-3 px-4 py-2" id="classwork-tab" data-bs-toggle="tab" data-bs-target="#classwork" type="button" role="tab">Classwork</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link rounded-3 px-4 py-2" id="people-tab" data-bs-toggle="tab" data-bs-target="#people" type="button" role="tab">People</button>
        </li>
    </ul>

    <!-- Tab Contents -->
    <div class="tab-content" id="classTabContent">
        
        <!-- 1. Stream Tab -->
        <div class="tab-pane fade show active" id="stream" role="tabpanel">
            <div class="row">
                <!-- Sidebar widgets -->
                <div class="col-md-4 mb-3">
                    <div class="glass-card mb-3">
                        <h6 class="fw-bold mb-2">Classroom Details</h6>
                        <small class="text-muted d-block mb-1">Instructor: <b><%= currentClass.getCreatorName() %></b></small>
                        <small class="text-muted d-block mb-3">Enrolled Scholars: <b><%= members != null ? members.size() : 0 %></b></small>
                        
                        <div class="d-grid gap-2">
                            <button class="btn btn-sm btn-outline-secondary rounded-pill mb-1" onclick="copyClassroomLink()">
                                <i class="fa-solid fa-share-nodes me-1"></i>Copy Invite Link
                            </button>
                            <% if (isInstructor) { %>
                                <button class="btn btn-primary-glass btn-sm" data-bs-toggle="modal" data-bs-target="#createAssignmentModal">
                                    <i class="fa-solid fa-plus me-1"></i>New Assignment
                                </button>
                                <button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createQuizModal">
                                    <i class="fa-solid fa-plus me-1"></i>New MCQ Quiz
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="modal" data-bs-target="#createExamModal">
                                    <i class="fa-solid fa-plus me-1"></i>New Exam
                                </button>
                            <% } %>
                        </div>
                    </div>
                </div>

                <!-- Stream feed -->
                <div class="col-md-8 mb-3">
                    <!-- Post announcement box -->
                    <div class="glass-card mb-3">
                        <form action="<%= request.getContextPath() %>/resources" method="post" enctype="multipart/form-data">
                            <input type="hidden" name="action" value="upload">
                            <input type="hidden" name="classroomId" value="<%= currentClass.getId() %>">
                            <input type="hidden" name="category" value="Notes">
                            <input type="hidden" name="difficulty" value="Intermediate">
                            
                            <div class="mb-2">
                                <input type="text" name="title" class="form-control form-control-glass mb-2" placeholder="Announcement Title" required>
                                <textarea name="description" class="form-control form-control-glass" rows="2" placeholder="Share updates or attach learning materials..." required></textarea>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <label class="btn btn-sm btn-light bg-transparent text-primary p-2 border-divider" title="Attach file">
                                    <i class="fa-solid fa-paperclip me-1"></i>Attach File
                                    <input type="file" name="resourceFile" class="d-none">
                                </label>
                                <button type="submit" class="btn btn-primary-glass btn-sm px-4">Post</button>
                            </div>
                        </form>
                    </div>

                    <!-- Stream Announcements & Materials -->
                    <div class="stream-posts">
                        <%
                            if (materials != null && !materials.isEmpty()) {
                                for (Material m : materials) {
                        %>
                            <div class="glass-card">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <div class="d-flex align-items-center">
                                        <div class="p-2 rounded-circle bg-primary-subtle text-primary me-3"><i class="fa-solid fa-bullhorn"></i></div>
                                        <div>
                                            <h6 class="fw-bold mb-0 text-main" style="font-size: 0.95rem;"><%= m.getTitle() %></h6>
                                            <small class="text-muted"><%= m.getCreatedAt() %> • Posted by <%= m.getUploaderName() %></small>
                                        </div>
                                    </div>
                                    <span class="badge bg-secondary p-1 px-2.5 small"><%= m.getFileType().toUpperCase() %></span>
                                </div>
                                <p class="text-main small mb-3"><%= m.getDescription() %></p>
                                <div class="p-2.5 neumorphic-inset rounded-3 d-flex justify-content-between align-items-center">
                                    <span class="small text-muted"><i class="fa-regular fa-file me-1"></i>Resource File</span>
                                    <a href="<%= request.getContextPath() %>/resources?action=download&id=<%= m.getId() %>" class="btn btn-sm btn-primary-glass py-1 px-3"><i class="fa-solid fa-download"></i></a>
                                </div>
                            </div>
                        <%
                                }
                            } else {
                        %>
                            <div class="glass-card text-center py-4">
                                <p class="text-muted mb-0">No announcements in classroom stream yet.</p>
                            </div>
                        <% } %>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. Classwork Tab -->
        <div class="tab-pane fade" id="classwork" role="tabpanel">
            <!-- Assignments List -->
            <div class="glass-container p-4 mb-4">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-contract text-primary me-2"></i>Assignments</h5>
                <div class="row">
                    <%
                        if (assignments != null && !assignments.isEmpty()) {
                            for (Assignment a : assignments) {
                    %>
                        <div class="col-12 mb-3">
                            <div class="p-3 neumorphic-inset rounded-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold text-main mb-1"><%= a.getTitle() %></h6>
                                    <small class="text-muted d-block mb-1"><%= a.getDescription() %></small>
                                    <small class="text-danger fw-semibold"><i class="fa-regular fa-clock me-1"></i>Deadline: <%= a.getDeadline() %></small>
                                </div>
                                <a href="<%= request.getContextPath() %>/assignment?id=<%= a.getId() %>" class="btn btn-primary-glass py-1 px-3">View</a>
                            </div>
                        </div>
                    <%
                            }
                        } else {
                    %>
                        <p class="text-muted p-2">No assignments scheduled.</p>
                    <% } %>
                </div>
            </div>            <!-- Quizzes List -->
            <div class="glass-container p-4 mb-4">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-circle-question text-primary me-2"></i>Class Quizzes (MCQ Only)</h5>
                <div class="row">
                    <%
                        List<Quiz> classroomQuizzes = (List<Quiz>) request.getAttribute("quizzes");
                        boolean hasQuizzes = false;
                        if (classroomQuizzes != null && !classroomQuizzes.isEmpty()) {
                            for (Quiz q : classroomQuizzes) {
                                if ("EXAM".equalsIgnoreCase(q.getType())) continue;
                                hasQuizzes = true;
                    %>
                        <div class="col-12 mb-3">
                            <div class="p-3 neumorphic-inset rounded-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold text-main mb-1"><%= q.getTitle() %></h6>
                                    <small class="text-muted d-block mb-1"><%= q.getDescription() %></small>
                                    <small class="text-muted small"><i class="fa-solid fa-clock me-1"></i><%= q.getDurationMinutes() %> Mins | Max Marks: <%= q.getMaxMarks() %> m</small>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <a href="<%= request.getContextPath() %>/quiz?action=view&id=<%= q.getId() %>" class="btn btn-primary-glass btn-sm py-1.5 px-3 rounded-3">Attempt / Play</a>
                                    <% if (isInstructor) { %>
                                        <a href="<%= request.getContextPath() %>/quiz_export?quizId=<%= q.getId() %>" class="btn btn-outline-success btn-sm py-1 px-2.5 rounded-3" title="Export Results (CSV/Excel)">
                                            <i class="fa-solid fa-file-excel"></i> Export
                                        </a>
                                        <button class="btn btn-outline-danger btn-sm py-1 px-2.5 rounded-3" onclick="deleteQuiz(<%= q.getId() %>)" title="Delete Quiz">
                                            <i class="fa-solid fa-trash-can"></i> Delete
                                        </button>
                                    <% } %>
                                </div>
                            </div>
                        </div>
                    <%
                            }
                        }
                        if (!hasQuizzes) {
                    %>
                        <p class="text-muted p-2">No MCQ quizzes scheduled.</p>
                    <% } %>
                </div>
            </div>

            <!-- Exams List -->
            <div class="glass-container p-4 mb-4">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-signature text-secondary me-2"></i>Class Exams (Theory & Analytical)</h5>
                <div class="row">
                    <%
                        boolean hasExams = false;
                        if (classroomQuizzes != null && !classroomQuizzes.isEmpty()) {
                            for (Quiz q : classroomQuizzes) {
                                if (!"EXAM".equalsIgnoreCase(q.getType())) continue;
                                hasExams = true;
                    %>
                        <div class="col-12 mb-3">
                            <div class="p-3 neumorphic-inset rounded-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold text-main mb-1"><%= q.getTitle() %></h6>
                                    <small class="text-muted d-block mb-1"><%= q.getDescription() %></small>
                                    <small class="text-muted small"><i class="fa-solid fa-clock me-1"></i><%= q.getDurationMinutes() %> Mins | Max Marks: <%= q.getMaxMarks() %> m</small>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <a href="<%= request.getContextPath() %>/quiz?action=view&id=<%= q.getId() %>" class="btn btn-primary-glass btn-sm py-1.5 px-3 rounded-3">Attempt / Play</a>
                                    <% if (isInstructor) { %>
                                        <a href="<%= request.getContextPath() %>/quiz_export?quizId=<%= q.getId() %>" class="btn btn-outline-success btn-sm py-1 px-2.5 rounded-3" title="Export Results (CSV/Excel)">
                                            <i class="fa-solid fa-file-excel"></i> Export
                                        </a>
                                        <button class="btn btn-outline-danger btn-sm py-1 px-2.5 rounded-3" onclick="deleteQuiz(<%= q.getId() %>)" title="Delete Exam">
                                            <i class="fa-solid fa-trash-can"></i> Delete
                                        </button>
                                    <% } %>
                                </div>
                            </div>
                        </div>
                    <%
                            }
                        }
                        if (!hasExams) {
                    %>
                        <p class="text-muted p-2">No exams scheduled.</p>
                    <% } %>
                </div>
            </div>v>
        </div>

        <!-- 3. People Tab -->
        <div class="tab-pane fade" id="people" role="tabpanel">
            <div class="glass-container p-4">
                <h5 class="fw-bold mb-3"><i class="fa-solid fa-user-group text-primary me-2"></i>Classroom Members</h5>
                <div class="list-group list-group-flush border-0">
                    <%
                        if (members != null && !members.isEmpty()) {
                            for (User u : members) {
                    %>
                        <div class="d-flex align-items-center justify-content-between py-2.5 border-bottom border-divider last-border-0">
                            <div class="d-flex align-items-center">
                                <img src="<%= u.getAvatarPath() %>" alt="avatar" class="rounded-circle border border-divider me-3" style="width: 38px; height: 38px; object-fit: cover;">
                                <div>
                                    <a href="<%= request.getContextPath() %>/@<%= u.getUsername() %>" class="fw-bold text-main text-decoration-none small"><%= u.getUsername() %></a>
                                    <small class="text-muted d-block font-size-xs" style="font-size: 0.75rem;"><%= u.getEmail() %></small>
                                </div>
                            </div>
                            <span class="role-badge"><%= u.getRole() %></span>
                        </div>
                    <%
                            }
                        }
                    %>
                </div>
            </div>
        </div>


    </div>
</div>

<!-- ==========================================
      MODALS
========================================== -->

<% if (isInstructor) { %>
<!-- Create Assignment Modal -->
<div class="modal fade" id="createAssignmentModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-invoice me-2 text-primary"></i>Schedule Assignment</h5>
            <form action="<%= request.getContextPath() %>/assignment" method="post" enctype="multipart/form-data">
                <input type="hidden" name="action" value="create">
                <input type="hidden" name="classroomId" value="<%= currentClass.getId() %>">

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Assignment Title</label>
                        <input type="text" name="title" class="form-control form-control-glass" placeholder="e.g. Heuristics Exploration" required>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-muted small fw-semibold">Max Marks</label>
                        <input type="number" name="maxMarks" class="form-control form-control-glass text-center" value="100" required>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-muted small fw-semibold">Deadline</label>
                        <input type="datetime-local" name="deadline" class="form-control form-control-glass" required>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Instructions</label>
                    <textarea name="description" class="form-control form-control-glass" rows="2" placeholder="Instructions for submissions..."></textarea>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Grading Rubric (AI grading baseline)</label>
                        <textarea name="rubric" class="form-control form-control-glass" rows="3" placeholder="- Admissibility proof: 40%&#10;- Graph representation: 40%&#10;- Explanations: 20%" required></textarea>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted small fw-semibold">Ideal Answer Key (AI marking comparative sheet)</label>
                        <textarea name="answerKey" class="form-control form-control-glass" rows="3" placeholder="Key concepts: h(n) <= h*(n), consistent heuristic, triangle inequality proof..." required></textarea>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="form-label text-muted small fw-semibold">Upload Question Sheet (Optional PDF/DOCX)</label>
                    <input type="file" name="assignmentFile" class="form-control form-control-glass">
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass">Schedule</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Create Quiz Modal -->
<div class="modal fade" id="createQuizModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-question me-2 text-primary"></i>Create MCQ Quiz</h5>
            <form action="<%= request.getContextPath() %>/quiz" method="post" id="createQuizForm">
                <input type="hidden" name="action" value="create">
                <input type="hidden" name="type" value="QUIZ">
                <input type="hidden" name="classroomId" value="<%= currentClass.getId() %>">

                <div class="row">
                    <div class="col-md-5 mb-3">
                        <label class="form-label text-muted small fw-semibold">Quiz Title</label>
                        <input type="text" name="title" class="form-control form-control-glass" placeholder="e.g. Midterm MCQ Quiz" required>
                    </div>
                    <div class="col-md-2 mb-3">
                        <label class="form-label text-muted small fw-semibold">Duration (Mins)</label>
                        <input type="number" name="duration" class="form-control form-control-glass text-center" value="30" required>
                    </div>
                    <div class="col-md-5 mb-3">
                        <label class="form-label text-muted small fw-semibold">Options & Publicity</label>
                        <div class="d-flex gap-3 pt-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="negativeMarking" value="true" id="negMarkQuiz">
                                <label class="form-check-label text-muted small" for="negMarkQuiz">Neg. Marking</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="isPublic" value="true" id="isPublicCheckQuiz">
                                <label class="form-check-label text-muted small" for="isPublicCheckQuiz">Public (Shareable link)</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Quiz Description</label>
                    <textarea name="description" class="form-control form-control-glass" rows="2" placeholder="Briefly describe the topics covered in this MCQ evaluation..."></textarea>
                </div>

                <div class="border-top border-divider pt-3 mt-3">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h6 class="fw-bold mb-0 text-main"><i class="fa-solid fa-list-check me-2"></i>Quiz Questions (MCQ Only)</h6>
                        <button type="button" class="btn btn-sm btn-primary-glass px-3 rounded-pill" onclick="addQuestion('quizQuestionsContainer', true)">
                            <i class="fa-solid fa-plus me-1"></i>Add Question
                        </button>
                    </div>

                    <div id="quizQuestionsContainer" class="pe-1" style="max-height: 380px; overflow-y: auto;">
                        <!-- Questions will be added here dynamically -->
                    </div>
                </div>

                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass px-4">Deploy Quiz</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Create Exam Modal -->
<div class="modal fade" id="createExamModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content glass-container border-0 p-4">
            <h5 class="fw-bold mb-3"><i class="fa-solid fa-file-signature me-2 text-primary"></i>Create Combined Exam</h5>
            <form action="<%= request.getContextPath() %>/quiz" method="post" id="createExamForm">
                <input type="hidden" name="action" value="create">
                <input type="hidden" name="type" value="EXAM">
                <input type="hidden" name="classroomId" value="<%= currentClass.getId() %>">

                <div class="row">
                    <div class="col-md-5 mb-3">
                        <label class="form-label text-muted small fw-semibold">Exam Title</label>
                        <input type="text" name="title" class="form-control form-control-glass" placeholder="e.g. Final Combined Exam" required>
                    </div>
                    <div class="col-md-2 mb-3">
                        <label class="form-label text-muted small fw-semibold">Duration (Mins)</label>
                        <input type="number" name="duration" class="form-control form-control-glass text-center" value="90" required>
                    </div>
                    <div class="col-md-5 mb-3">
                        <label class="form-label text-muted small fw-semibold">Options & Publicity</label>
                        <div class="d-flex gap-3 pt-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="negativeMarking" value="true" id="negMarkExam">
                                <label class="form-check-label text-muted small" for="negMarkExam">Neg. Marking</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="isPublic" value="true" id="isPublicCheckExam">
                                <label class="form-check-label text-muted small" for="isPublicCheckExam">Public (Shareable link)</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label text-muted small fw-semibold">Exam Description</label>
                    <textarea name="description" class="form-control form-control-glass" rows="2" placeholder="Briefly describe the topics covered in this exam..."></textarea>
                </div>

                <div class="border-top border-divider pt-3 mt-3">
                    <div class="d-flex align-items-center justify-content-between mb-3">
                        <h6 class="fw-bold mb-0 text-main"><i class="fa-solid fa-list-check me-2"></i>Exam Questions (All Formats)</h6>
                        <button type="button" class="btn btn-sm btn-primary-glass px-3 rounded-pill" onclick="addQuestion('examQuestionsContainer', false)">
                            <i class="fa-solid fa-plus me-1"></i>Add Question
                        </button>
                    </div>

                    <div id="examQuestionsContainer" class="pe-1" style="max-height: 380px; overflow-y: auto;">
                        <!-- Questions will be added here dynamically -->
                    </div>
                </div>

                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn btn-light bg-transparent border-0 text-muted" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary-glass px-4">Deploy Exam</button>
                </div>
            </form>
        </div>
    </div>
</div>
<% } %>

<!-- Script Utilities -->
<script>
    // Delete Test
    function deleteQuiz(quizId) {
        if (confirm("Are you sure you want to delete this test and all its submissions? This cannot be undone.")) {
            window.location.href = '<%= request.getContextPath() %>/quiz?action=delete&id=' + quizId + '&classroomId=<%= currentClass.getId() %>';
        }
    }

    // Copy Classroom Link
    function copyClassroomLink() {
        const inviteUrl = window.location.origin + '<%= request.getContextPath() %>/classroom?id=' + <%= currentClass.getId() %>;
        navigator.clipboard.writeText(inviteUrl).then(() => {
            alert('Classroom invite link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }

    // Dynamic Test Question Builder
    let questionCount = 0;
    function addQuestion(containerId, isMcqOnly) {
        const container = document.getElementById(containerId);
        const qDiv = document.createElement('div');
        qDiv.className = 'glass-card p-3 mb-3 question-block position-relative border border-glass';
        qDiv.id = `question_block_${questionCount}`;
        
        let typeSelectHtml = '';
        if (isMcqOnly) {
            typeSelectHtml = `
                <input type="hidden" name="types[]" value="MCQ">
                <input type="text" class="form-control form-control-glass p-2 font-size-sm" value="MCQ (Auto-graded)" disabled>
            `;
        } else {
            typeSelectHtml = `
                <select name="types[]" class="form-select form-control-glass p-2 font-size-sm" onchange="toggleTypeFields(this, this.value)" required>
                    <option value="MCQ">MCQ (Auto-graded)</option>
                    <option value="THEORY">Theory (AI-graded)</option>
                    <option value="ANALYTICAL">Analytical (AI-graded)</option>
                </select>
            `;
        }

        qDiv.innerHTML = `
            <button type="button" class="btn-close position-absolute end-0 top-0 m-3 shadow-none border-0" onclick="removeQuestion(this, '${containerId}')" style="font-size: 0.8rem;"></button>
            <h6 class="fw-bold mb-3 text-primary text-uppercase font-size-xs"><i class="fa-solid fa-circle-question me-1.5"></i>Question <span class="q-number"></span></h6>
            
            <div class="row mb-2.5">
                <div class="col-md-7 mb-2">
                    <label class="form-label text-muted small fw-semibold">Question Prompt</label>
                    <input type="text" name="questions[]" class="form-control form-control-glass p-2 font-size-sm" placeholder="Enter question text..." required>
                </div>
                <div class="col-md-3 mb-2">
                    <label class="form-label text-muted small fw-semibold">Question Type</label>
                    \${typeSelectHtml}
                </div>
                <div class="col-md-2 mb-2">
                    <label class="form-label text-muted small fw-semibold">Marks</label>
                    <input type="number" name="points[]" class="form-control form-control-glass p-2 font-size-sm text-center" value="10" min="1" required>
                </div>
            </div>
            
            <!-- MCQ Options Block -->
            <div class="mt-2" data-options-wrapper="true">
                <label class="form-label text-muted small fw-semibold">Options & Correct Answer Selection</label>
                <div class="row g-2 mb-2.5">
                    <div class="col-6 col-md-3"><input type="text" name="options_q\${questionCount}[]" class="form-control form-control-glass p-2 font-size-xs mcq-option-input" placeholder="Option A" required></div>
                    <div class="col-6 col-md-3"><input type="text" name="options_q\${questionCount}[]" class="form-control form-control-glass p-2 font-size-xs mcq-option-input" placeholder="Option B" required></div>
                    <div class="col-6 col-md-3"><input type="text" name="options_q\${questionCount}[]" class="form-control form-control-glass p-2 font-size-xs mcq-option-input" placeholder="Option C" required></div>
                    <div class="col-6 col-md-3"><input type="text" name="options_q\${questionCount}[]" class="form-control form-control-glass p-2 font-size-xs mcq-option-input" placeholder="Option D" required></div>
                </div>
                <div class="row">
                    <div class="col-md-5">
                        <select name="answers_q\${questionCount}[]" class="form-select form-control-glass p-2 font-size-sm mcq-answer-input" required>
                            <option value="0">Option A is Correct</option>
                            <option value="1">Option B is Correct</option>
                            <option value="2">Option C is Correct</option>
                            <option value="3">Option D is Correct</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Theory Reference Answer Block -->
            <div class="mt-2" data-theory-wrapper="true" style="display:none;">
                <label class="form-label text-muted small fw-semibold">Expected Reference Answer / Grading Key (For AI Evaluator)</label>
                <textarea name="theory_answer_q\${questionCount}" class="form-control form-control-glass p-2 font-size-xs theory-answer-input" rows="3" placeholder="Provide the key concepts, points, or the model answer the AI should grade against..."></textarea>
            </div>
        `;
        container.appendChild(qDiv);
        questionCount++;
        reindexQuestions(containerId);
    }

    function removeQuestion(btn, containerId) {
        const qDiv = btn.closest('.question-block');
        if (qDiv) {
            qDiv.remove();
            reindexQuestions(containerId);
        }
    }

    function toggleTypeFields(selectElement, type) {
        const block = selectElement.closest('.question-block');
        if (block) {
            const mcqDiv = block.querySelector('[data-options-wrapper="true"]');
            const theoryDiv = block.querySelector('[data-theory-wrapper="true"]');
            
            if (type === 'MCQ') {
                if (mcqDiv) {
                    mcqDiv.style.display = 'block';
                    mcqDiv.querySelectorAll('input, select').forEach(inp => inp.setAttribute('required', 'true'));
                }
                if (theoryDiv) {
                    theoryDiv.style.display = 'none';
                    theoryDiv.querySelectorAll('textarea').forEach(tx => tx.removeAttribute('required'));
                }
            } else {
                if (mcqDiv) {
                    mcqDiv.style.display = 'none';
                    mcqDiv.querySelectorAll('input, select').forEach(inp => inp.removeAttribute('required'));
                }
                if (theoryDiv) {
                    theoryDiv.style.display = 'block';
                    theoryDiv.querySelectorAll('textarea').forEach(tx => tx.setAttribute('required', 'true'));
                }
            }
        }
    }

    function reindexQuestions(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const blocks = container.querySelectorAll('.question-block');
        blocks.forEach((block, idx) => {
            block.querySelector('.q-number').innerText = idx + 1;
            
            // Find the MCQ options wrapper
            const mcqOptions = block.querySelector('[data-options-wrapper="true"]');
            if (mcqOptions) {
                const options = mcqOptions.querySelectorAll('.mcq-option-input');
                options.forEach(opt => opt.name = `options_q\${idx}[]`);
                
                const answers = mcqOptions.querySelectorAll('.mcq-answer-input');
                answers.forEach(ans => ans.name = `answers_q\${idx}[]`);
            }

            // Find the Theory wrapper
            const theoryAns = block.querySelector('.theory-answer-input');
            if (theoryAns) {
                theoryAns.name = `theory_answer_q\${idx}`;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function() {
        const quizModal = document.getElementById('createQuizModal');
        if (quizModal) {
            quizModal.addEventListener('show.bs.modal', function () {
                const container = document.getElementById('quizQuestionsContainer');
                if (container.children.length === 0) {
                    addQuestion('quizQuestionsContainer', true);
                }
            });
        }
        const examModal = document.getElementById('createExamModal');
        if (examModal) {
            examModal.addEventListener('show.bs.modal', function () {
                const container = document.getElementById('examQuestionsContainer');
                if (container.children.length === 0) {
                    addQuestion('examQuestionsContainer', false);
                }
            });
        }
    });
</script>

<%@ include file="/common/footer.jsp" %>
