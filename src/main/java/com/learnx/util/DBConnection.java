package com.learnx.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
    private static final String URL;
    private static final String USER;
    private static final String PASSWORD;
    private static final String DRIVER_CLASS = "com.mysql.cj.jdbc.Driver";

    static {
        String envUrl = System.getenv("DB_URL");
        String envUser = System.getenv("DB_USER");
        String envPass = System.getenv("DB_PASSWORD");

        URL = (envUrl != null) ? envUrl : "jdbc:mysql://localhost:3306/learnx_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        USER = (envUser != null) ? envUser : "root";
        PASSWORD = (envPass != null) ? envPass : "";

        try {
            Class.forName(DRIVER_CLASS);
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL Driver not found in classpath!");
            e.printStackTrace();
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
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
