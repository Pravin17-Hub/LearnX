<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.User" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<!-- Admin Dashboard Panel -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <div class="glass-card mb-4">
        <h4 class="fw-bold mb-1"><i class="fa-solid fa-user-shield text-primary me-2"></i>Administration Dashboard</h4>
        <p class="text-muted small mb-0">System configuration, logs, user management, and AI evaluator performance monitoring.</p>
    </div>

    <!-- Quick Stats Grid -->
    <div class="row mb-4 g-3">
        <div class="col-md-3">
            <div class="p-3 neumorphic-inset text-center rounded-4">
                <small class="text-muted d-block small">Total Active Users</small>
                <span class="fw-bold fs-4 text-primary">1,480</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="p-3 neumorphic-inset text-center rounded-4">
                <small class="text-muted d-block small">Subject Communities</small>
                <span class="fw-bold fs-4 text-accent">14</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="p-3 neumorphic-inset text-center rounded-4">
                <small class="text-muted d-block small">AI Evaluations Run</small>
                <span class="fw-bold fs-4 text-warning">842</span>
            </div>
        </div>
        <div class="col-md-3">
            <div class="p-3 neumorphic-inset text-center rounded-4">
                <small class="text-muted d-block small">System Status</small>
                <span class="fw-bold fs-5 text-success"><i class="fa-solid fa-circle-check me-1"></i>Healthy</span>
            </div>
        </div>
    </div>

    <div class="row">
        <!-- User Management Table -->
        <div class="col-md-8 mb-3">
            <div class="glass-container p-4">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-users-cog text-primary me-2"></i>Manage Users</h6>
                <div class="table-responsive">
                    <table class="table table-hover align-middle small text-muted">
                        <thead>
                            <tr class="text-main">
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Contribution</th>
                                <th>Status</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="fw-bold text-main">prof_albert</td>
                                <td>albert.einstein@learnx.edu</td>
                                <td>Faculty</td>
                                <td>850</td>
                                <td><span class="badge bg-success-subtle text-success border-0">Active</span></td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-light bg-transparent border-divider"><i class="fa-solid fa-pen"></i></button>
                                </td>
                            </tr>
                            <tr>
                                <td class="fw-bold text-main">student_john</td>
                                <td>john.doe@learnx.edu</td>
                                <td>Student</td>
                                <td>230</td>
                                <td><span class="badge bg-success-subtle text-success border-0">Active</span></td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-light bg-transparent border-divider"><i class="fa-solid fa-pen"></i></button>
                                </td>
                            </tr>
                            <tr>
                                <td class="fw-bold text-main">ta_richard</td>
                                <td>richard.feynman@learnx.edu</td>
                                <td>Teaching Assistant</td>
                                <td>410</td>
                                <td><span class="badge bg-danger-subtle text-danger border-0">Suspended</span></td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-light bg-transparent border-divider"><i class="fa-solid fa-pen"></i></button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- System Logs / AI metrics -->
        <div class="col-md-4 mb-3">
            <div class="glass-card mb-3">
                <h6 class="fw-bold mb-3"><i class="fa-solid fa-server text-primary me-2"></i>AI Pipeline Health</h6>
                <div class="mb-3">
                    <small class="text-muted d-block mb-1">OCR Accuracy Average</small>
                    <div class="progress neumorphic-inset" style="height: 10px;">
                        <div class="progress-bar bg-success rounded-pill" role="progressbar" style="width: 94.2%;" aria-valuenow="94.2" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <small class="text-muted d-block text-end mt-1 fw-semibold">94.2%</small>
                </div>
                <div>
                    <small class="text-muted d-block mb-1">Evaluation Consistency (GPT-4o)</small>
                    <div class="progress neumorphic-inset" style="height: 10px;">
                        <div class="progress-bar bg-primary rounded-pill" role="progressbar" style="width: 88.5%;" aria-valuenow="88.5" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <small class="text-muted d-block text-end mt-1 fw-semibold">88.5%</small>
                </div>
            </div>

            <!-- Server Environment info -->
            <div class="glass-card">
                <h6 class="fw-bold mb-2">Environment Configuration</h6>
                <small class="text-muted d-block mb-1">Tomcat Context: <b>/LearnX</b></small>
                <small class="text-muted d-block mb-1">JDK Version: <b>26.0.2</b></small>
                <small class="text-muted d-block">MySQL DB Host: <b>localhost:3306</b></small>
            </div>
        </div>
    </div>
</div>

<%@ include file="/common/footer.jsp" %>
