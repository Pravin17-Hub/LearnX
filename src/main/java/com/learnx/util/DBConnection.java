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

        // Configure connection pooling properties with env-var overrides and higher production defaults
        String envInitSize = System.getenv("DB_INITIAL_SIZE");
        String envMaxTotal = System.getenv("DB_MAX_TOTAL");
        String envMaxIdle = System.getenv("DB_MAX_IDLE");
        String envMinIdle = System.getenv("DB_MIN_IDLE");
        String envMaxWait = System.getenv("DB_MAX_WAIT_MILLIS");

        dataSource.setInitialSize(envInitSize != null ? Integer.parseInt(envInitSize) : 10);
        dataSource.setMaxTotal(envMaxTotal != null ? Integer.parseInt(envMaxTotal) : 100);
        dataSource.setMaxIdle(envMaxIdle != null ? Integer.parseInt(envMaxIdle) : 50);
        dataSource.setMinIdle(envMinIdle != null ? Integer.parseInt(envMinIdle) : 10);
        dataSource.setMaxWaitMillis(envMaxWait != null ? Long.parseLong(envMaxWait) : 10000);

        // Connection health checks
        dataSource.setTestOnBorrow(true);
        dataSource.setValidationQuery("SELECT 1");
    }

    public static Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    public static String getUploadDir() {
        String envUploadDir = System.getenv("UPLOAD_DIR");
        String path;
        if (envUploadDir != null && !envUploadDir.trim().isEmpty()) {
            path = envUploadDir;
        } else {
            // Safe cross-platform fallback that doesn't get cleared by Tomcat deployment wipes
            String os = System.getProperty("os.name").toLowerCase();
            if (os.contains("win")) {
                path = "C:\\learnx_uploads";
            } else {
                path = "/var/learnx_uploads";
            }
        }
        java.io.File dir = new java.io.File(path);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return path;
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
