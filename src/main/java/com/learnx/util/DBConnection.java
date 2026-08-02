package com.learnx.util;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import org.apache.tomcat.dbcp.dbcp2.BasicDataSource;

public class DBConnection {
    private static final BasicDataSource dataSource = new BasicDataSource();

    static {
        String envUrl = System.getenv("DB_URL");
        String envUser = System.getenv("DB_USER");
        String envPass = System.getenv("DB_PASSWORD");

        String url = (envUrl != null) ? envUrl : "jdbc:mysql://localhost:3306/learnx_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        String user = (envUser != null) ? envUser : "root";
        String password = (envPass != null) ? envPass : "";

        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(url);
        dataSource.setUsername(user);
        dataSource.setPassword(password);

        // Configure connection pooling properties for production load and performance
        dataSource.setInitialSize(5);      // Start with 5 pre-opened connections
        dataSource.setMaxTotal(25);        // Allow up to 25 connections under heavy loads
        dataSource.setMaxIdle(10);         // Max 10 idle connections kept in pool
        dataSource.setMinIdle(5);          // Keep at least 5 idle connections active
        dataSource.setMaxWaitMillis(10000); // Wait up to 10 seconds for a connection if busy

        // Connection health checks
        dataSource.setTestOnBorrow(true);
        dataSource.setValidationQuery("SELECT 1");

        // Run dynamic database migration to ensure violation_reason column exists
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            try {
                stmt.execute("ALTER TABLE quiz_attempts ADD COLUMN violation_reason VARCHAR(255) NULL");
                System.out.println("LearnX DB Migration: Added violation_reason column to quiz_attempts.");
            } catch (SQLException e) {
                // Column probably already exists or table does not exist yet (during schema init)
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    public static String resolveAvatarPath(String path) {
        if (path == null || path.trim().isEmpty() || path.equalsIgnoreCase("null")) {
            return "/LearnX/assets/images/default-avatar.png";
        }
        if (path.startsWith("/assets/")) {
            return "/LearnX" + path;
        }
        return path;
    }
}
