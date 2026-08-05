package com.learnx.websocket;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import com.google.gson.Gson;
import com.learnx.model.Message;

@ServerEndpoint("/chatSocket/{userId}")
public class ChatWebSocket {
    // Map of active WebSocket connections keyed by userId
    private static final Map<Integer, Session> activeSessions = new ConcurrentHashMap<>();
    private static final Gson gson = new Gson();

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") String userIdStr) {
        try {
            int userId = Integer.parseInt(userIdStr);
            activeSessions.put(userId, session);
            System.out.println("WebSocket connection opened for user: " + userId);
        } catch (NumberFormatException e) {
            System.err.println("Invalid userId format during WebSocket onOpen: " + userIdStr);
            try {
                session.close();
            } catch (IOException ioException) {
                ioException.printStackTrace();
            }
        }
    }

    @OnMessage
    public void onMessage(String messageJson, Session session) {
        // We handle outgoing chat messages primarily via HTTP POST in ChatServlet,
        // which gives us full multipart file upload support.
        // However, we can log any incoming websocket messages here if needed.
    }

    @OnClose
    public void onClose(Session session, @PathParam("userId") String userIdStr) {
        try {
            int userId = Integer.parseInt(userIdStr);
            activeSessions.remove(userId);
            System.out.println("WebSocket connection closed for user: " + userId);
        } catch (NumberFormatException e) {
            // ignore
        }
    }

    @OnError
    public void onError(Session session, Throwable throwable, @PathParam("userId") String userIdStr) {
        System.err.println("WebSocket error for user " + userIdStr + ": " + throwable.getMessage());
        try {
            int userId = Integer.parseInt(userIdStr);
            activeSessions.remove(userId);
        } catch (NumberFormatException e) {
            // ignore
        }
    }

    /**
     * Broadcasts a new message in real-time to the recipient (and the sender for multi-device sync).
     */
    public static void notifyNewMessage(Message msg) {
        String msgJson = gson.toJson(msg);
        
        // Deliver to receiver
        Session receiverSession = activeSessions.get(msg.getReceiverId());
        if (receiverSession != null && receiverSession.isOpen()) {
            sendMessageAsync(receiverSession, msgJson);
        }

        // Deliver back to sender (to synchronize multi-tab displays in real-time)
        Session senderSession = activeSessions.get(msg.getSenderId());
        if (senderSession != null && senderSession.isOpen()) {
            sendMessageAsync(senderSession, msgJson);
        }
    }

    private static void sendMessageAsync(Session session, String text) {
        session.getAsyncRemote().sendText(text);
    }
}
