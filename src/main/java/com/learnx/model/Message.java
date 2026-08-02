package com.learnx.model;

import java.sql.Timestamp;

public class Message {
    private int id;
    private int senderId;
    private String senderName; // helper field
    private int receiverId;
    private String receiverName; // helper field
    private String content;
    private String filePath;
    private boolean readReceipt;
    private Timestamp createdAt;

    public Message() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getSenderId() { return senderId; }
    public void setSenderId(int senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public int getReceiverId() { return receiverId; }
    public void setReceiverId(int receiverId) { this.receiverId = receiverId; }

    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public boolean isReadReceipt() { return readReceipt; }
    public void setReadReceipt(boolean readReceipt) { this.readReceipt = readReceipt; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
