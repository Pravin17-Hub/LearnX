package com.learnx.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class PythonBridge {
    public static String extractText(String filePath, String webappRoot) {
        try {
            // Locate the python script in the deployed context
            String scriptPath = new File(webappRoot, "python/document_extractor.py").getAbsolutePath();
            
            // Build process execution command
            List<String> command = new ArrayList<>();
            command.add("python");
            command.add(scriptPath);
            command.add(filePath);
            
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
        }
    }
}
