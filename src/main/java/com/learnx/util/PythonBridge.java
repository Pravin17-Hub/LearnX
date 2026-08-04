package com.learnx.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;

public class PythonBridge {
    // Semaphore to limit concurrent Python executions to prevent CPU exhaustion
    private static final Semaphore executionSemaphore = new Semaphore(4);

    private static String resolvePythonCommand() {
        // 1. Try standard "python" command
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"python", "--version"});
            if (p.waitFor() == 0) {
                return "python";
            }
        } catch (Exception e) {}

        // 2. Try "python3" command
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"python3", "--version"});
            if (p.waitFor() == 0) {
                return "python3";
            }
        } catch (Exception e) {}

        // 3. Try standard developer user paths for Dell
        String[] fallbackPaths = {
            "C:\\Users\\Dell\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
            "C:\\Users\\Dell\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
            "C:\\Users\\Dell\\AppData\\Local\\Programs\\Python\\Python310\\python.exe",
            "C:\\Users\\Dell\\AppData\\Local\\Programs\\Python\\Python39\\python.exe",
            "C:\\Users\\Dell\\AppData\\Local\\Programs\\Python\\Python38\\python.exe"
        };
        for (String path : fallbackPaths) {
            if (new File(path).exists()) {
                return path;
            }
        }

        // 4. Inspect LOCALAPPDATA directory dynamically
        String localAppData = System.getenv("LOCALAPPDATA");
        if (localAppData != null) {
            File pyDir = new File(localAppData, "Programs\\Python");
            if (pyDir.exists() && pyDir.isDirectory()) {
                File[] subdirs = pyDir.listFiles();
                if (subdirs != null) {
                    for (File subdir : subdirs) {
                        File pyExe = new File(subdir, "python.exe");
                        if (pyExe.exists()) {
                            return pyExe.getAbsolutePath();
                        }
                    }
                }
            }
        }

        return "python"; // Fallback to system default
    }

    public static String resolveActualFilePath(String filePath) {
        File f = new File(filePath);
        if (f.exists()) {
            return f.getAbsolutePath();
        }

        // Try Kaspersky Sandbox path or Windows Virtual Store
        if (filePath.contains("learnx_uploads")) {
            int idx = filePath.indexOf("learnx_uploads");
            String relPath = filePath.substring(idx + "learnx_uploads".length());
            
            // Check C:\KVRT2020_Data\Temp\learnx_uploads
            File kaspFile = new File("C:\\KVRT2020_Data\\Temp\\learnx_uploads", relPath);
            if (kaspFile.exists()) {
                return kaspFile.getAbsolutePath();
            }

            // Check VirtualStore
            String localAppData = System.getenv("LOCALAPPDATA");
            if (localAppData != null) {
                File vsFile = new File(localAppData, "VirtualStore\\learnx_uploads" + relPath);
                if (vsFile.exists()) {
                    return vsFile.getAbsolutePath();
                }
            }
        }
        return filePath;
    }

    public static String extractText(String filePath, String webappRoot) {
        try {
            executionSemaphore.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "ERROR: Extraction interrupted while waiting in queue.";
        }

        try {
            String actualPath = resolveActualFilePath(filePath);
            
            // Locate the python script in the deployed context
            String scriptPath = new File(webappRoot, "python/document_extractor.py").getAbsolutePath();
            
            // Build process execution command
            List<String> command = new ArrayList<>();
            command.add(resolvePythonCommand());
            command.add(scriptPath);
            command.add(actualPath);
            
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true); // Merge error and output streams
            
            Process process = pb.start();
            
            // Read output
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                System.err.println("Python script exited with error code " + exitCode + ". Output: " + output);
                return "ERROR: Extraction process failed (exit code " + exitCode + ")";
            }
            
            return output.toString().trim();
        } catch (Exception e) {
            e.printStackTrace();
            return "ERROR: Failed to run Python subprocess: " + e.getMessage();
        } finally {
            executionSemaphore.release();
        }
    }
}
