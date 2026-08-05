<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.sql.*" %>
<%@ page import="com.learnx.util.DBConnection" %>
<!DOCTYPE html>
<html>
<head>
    <title>LearnX Deployment Diagnostics</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
</head>
<body class="bg-light py-5">
<div class="container" style="max-width: 800px;">
    <div class="card shadow-sm">
        <div class="card-header bg-dark text-white">
            <h4 class="mb-0">LearnX Database Diagnostics</h4>
        </div>
        <div class="card-body">
            <h5>Environment Variables Check:</h5>
            <table class="table table-bordered">
                <tr>
                    <th>DB_URL</th>
                    <td><%= (System.getenv("DB_URL") != null) ? "SET (Length: " + System.getenv("DB_URL").length() + ")" : "<span class='text-danger'>NOT SET (NULL)</span>" %></td>
                </tr>
                <tr>
                    <th>DB_USER</th>
                    <td><%= (System.getenv("DB_USER") != null) ? "SET" : "<span class='text-danger'>NOT SET (NULL)</span>" %></td>
                </tr>
                <tr>
                    <th>DB_PASSWORD</th>
                    <td><%= (System.getenv("DB_PASSWORD") != null) ? "SET" : "<span class='text-danger'>NOT SET (NULL)</span>" %></td>
                </tr>
            </table>

            <h5 class="mt-4">Database Connection Test:</h5>
            <%
                try {
                    Connection conn = DBConnection.getConnection();
                    if (conn != null) {
                        out.println("<div class='alert alert-success'><strong>Success!</strong> Connected to the database.</div>");
                        Statement stmt = conn.createStatement();
                        ResultSet rs = stmt.executeQuery("SELECT count(*) FROM users");
                        if (rs.next()) {
                            out.println("<p>Users count in database: <strong>" + rs.getInt(1) + "</strong></p>");
                        }
                        conn.close();
                    } else {
                        out.println("<div class='alert alert-danger'><strong>Error:</strong> Connection object is null.</div>");
                    }
                } catch (Exception e) {
                    out.println("<div class='alert alert-danger'><strong>Connection Failed!</strong><br><pre>" + e.toString() + "</pre></div>");
                    java.io.StringWriter sw = new java.io.StringWriter();
                    java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                    e.printStackTrace(pw);
                    out.println("<pre class='bg-dark text-light p-3 rounded'>" + sw.toString() + "</pre>");
                }
            %>
        </div>
    </div>
</div>
</body>
</html>
