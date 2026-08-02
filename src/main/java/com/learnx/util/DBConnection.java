package com.learnx.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
    private static final String URL = "jdbc:mysql://localhost:3306/learnx_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String USER = "root";
    private static final String PASSWORD = "";
    private static final String DRIVER_CLASS = "com.mysql.cj.jdbc.Driver";

    static {
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
