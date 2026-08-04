package com.learnx.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.ArrayList;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class OpenAIClient {
    private static String apiKey = null;

    static {
        apiKey = loadApiKey();
    }

    private static String loadApiKey() {
        // 1. Try System Environment for Groq and OpenAI keys
        String key = System.getenv("GROQ_API_KEY");
        if (key != null && !key.trim().isEmpty()) {
            return key.trim();
        }
        key = System.getenv("OPENAI_API_KEY");
        if (key != null && !key.trim().isEmpty()) {
            return key.trim();
        }

        // 2. Try list of candidate .env files
        List<File> envFiles = new ArrayList<>();
        
        // 2a. Try $HOME/.env
        String homeDir = System.getProperty("user.home");
        if (homeDir != null) {
            envFiles.add(new File(homeDir, ".env"));
        }
        
        // 2b. Try USERPROFILE environment variable
        String userProfile = System.getenv("USERPROFILE");
        if (userProfile != null) {
            envFiles.add(new File(userProfile, ".env"));
        }
        
        // 2c. Hardcoded fallback for local developer path
        envFiles.add(new File("C:\\Users\\Dell\\.env"));
        
        // 2d. Fallback to current folder .env
        envFiles.add(new File(".env"));

        for (File envFile : envFiles) {
            if (envFile.exists()) {
                try (BufferedReader br = new BufferedReader(new FileReader(envFile))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        line = line.trim();
                        if (line.startsWith("GROQ_API_KEY=")) {
                            return cleanValue(line.substring("GROQ_API_KEY=".length()).trim());
                        }
                        if (line.startsWith("OPENAI_API_KEY=")) {
                            return cleanValue(line.substring("OPENAI_API_KEY=".length()).trim());
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Error reading .env file at " + envFile.getAbsolutePath() + ": " + e.getMessage());
                }
            }
        }

        return null;
    }

    private static String cleanValue(String val) {
        if (val.startsWith("\"") && val.endsWith("\"")) {
            return val.substring(1, val.length() - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
            return val.substring(1, val.length() - 1);
        }
        return val;
    }

    public static String getApiKey() {
        if (apiKey == null) {
            apiKey = loadApiKey();
        }
        return apiKey;
    }

    private static String getApiUrl(String key) {
        if (key != null && key.startsWith("gsk_")) {
            return "https://api.groq.com/openai/v1/chat/completions";
        }
        return "https://api.openai.com/v1/chat/completions";
    }

    private static String getEvalModel(String key) {
        if (key != null && key.startsWith("gsk_")) {
            return "llama-3.3-70b-versatile";
        }
        return "gpt-4o-mini";
    }

    private static String getOcrModel(String key) {
        if (key != null && key.startsWith("gsk_")) {
            return "llama-3.2-11b-vision-preview";
        }
        return "gpt-4o-mini";
    }

    public static JsonObject evaluateSubmission(String question, String answerKey, String rubric, int maxMarks, String studentAnswer) throws Exception {
        String key = getApiKey();
        if (key == null || key.isEmpty()) {
            throw new IllegalStateException("API Key is missing. Please set GROQ_API_KEY or OPENAI_API_KEY in your environment or ~/.env file.");
        }

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();

        String systemPrompt = "You are an expert academic evaluator. You are given a Question, an Answer Key, a Grading Rubric, and the Maximum Marks. " +
                "Evaluate the student's answer based strictly on the rubric and comparison with the answer key. " +
                "Respond ONLY with a JSON object in the following format:\n" +
                "{\n" +
                "  \"score\": 85,\n" +
                "  \"confidence\": 95.0,\n" +
                "  \"feedback\": \"Detailed feedback about the grading, explaining why marks were deducted or awarded.\",\n" +
                "  \"strengths\": \"Key positive elements of the student's answer.\",\n" +
                "  \"weaknesses\": \"Areas where the answer falls short.\",\n" +
                "  \"missing_concepts\": \"Important definitions or concepts from the answer key that are absent in the student's response.\"\n" +
                "}\n" +
                "Ensure the score is an integer between 0 and " + maxMarks + " (scale the score directly proportionate to the Maximum Marks; do NOT evaluate out of 100 unless the Maximum Marks is 100). The response must be valid JSON and contain no other text.";

        String userContent = String.format("Question: %s\n\nAnswer Key: %s\n\nRubric: %s\n\nMaximum Marks: %d\n\nStudent Answer: %s", 
                question, answerKey, rubric, maxMarks, studentAnswer);

        // Build request body
        JsonObject requestJson = new JsonObject();
        requestJson.addProperty("model", getEvalModel(key));
        
        JsonObject responseFormat = new JsonObject();
        responseFormat.addProperty("type", "json_object");
        requestJson.add("response_format", responseFormat);

        com.google.gson.JsonArray messages = new com.google.gson.JsonArray();
        
        JsonObject sysMsg = new JsonObject();
        sysMsg.addProperty("role", "system");
        sysMsg.addProperty("content", systemPrompt);
        messages.add(sysMsg);

        JsonObject userMsg = new JsonObject();
        userMsg.addProperty("role", "user");
        userMsg.addProperty("content", userContent);
        messages.add(userMsg);

        requestJson.add("messages", messages);
        requestJson.addProperty("temperature", 0.0);
        requestJson.addProperty("seed", 42);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(getApiUrl(key)))
                .timeout(java.time.Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + key)
                .POST(HttpRequest.BodyPublishers.ofString(requestJson.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("API call failed with status: " + response.statusCode() + " - " + response.body());
        }

        JsonObject responseJson = JsonParser.parseString(response.body()).getAsJsonObject();
        String jsonText = responseJson.get("choices").getAsJsonArray().get(0).getAsJsonObject()
                .get("message").getAsJsonObject().get("content").getAsString();

        return JsonParser.parseString(jsonText).getAsJsonObject();
    }

    public static String performImageOCR(byte[] imageBytes, String fileType) throws Exception {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        String mimeType = fileType.equalsIgnoreCase("png") ? "image/png" : "image/jpeg";
        String dataUrl = "data:" + mimeType + ";base64," + base64Image;

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();

        // Build form-urlencoded request body for OCR.space
        String requestBody = "apikey=helloworld" +
                "&language=eng" +
                "&isOverlayRequired=false" +
                "&base64Image=" + java.net.URLEncoder.encode(dataUrl, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.ocr.space/parse/image"))
                .timeout(java.time.Duration.ofSeconds(20))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("OCR API call failed with status: " + response.statusCode() + " - " + response.body());
        }

        JsonObject responseJson = JsonParser.parseString(response.body()).getAsJsonObject();
        
        if (responseJson.has("OCRExitCode") && responseJson.get("OCRExitCode").getAsInt() == 1) {
            com.google.gson.JsonArray parsedResults = responseJson.getAsJsonArray("ParsedResults");
            if (parsedResults != null && parsedResults.size() > 0) {
                return parsedResults.get(0).getAsJsonObject().get("ParsedText").getAsString().trim();
            }
            return "No text detected in the image.";
        } else {
            String errorMsg = responseJson.has("ErrorMessage") ? responseJson.get("ErrorMessage").getAsString() : "Unknown OCR error";
            throw new Exception("OCR service returned error: " + errorMsg);
        }
    }
}
