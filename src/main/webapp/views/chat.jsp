<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.List" %>
<%@ page import="com.learnx.model.Message" %>
<%@ page import="com.learnx.model.User" %>

<%@ include file="/common/header.jsp" %>
<%@ include file="/common/sidebar.jsp" %>

<%
    List<Message> recentChats = (List<Message>) request.getAttribute("recentChats");
    List<User> contactList = (List<User>) request.getAttribute("contactList");
    if (contactList == null) {
        contactList = (List<User>) request.getAttribute("leaderboard");
    }
%>

<!-- Messaging Workspace -->
<div class="col-md-9 col-sm-12 fade-in-up">
    <div class="glass-container p-0 overflow-hidden" style="border-radius: 20px;">
        <div class="row g-0" style="min-height: 520px;">
            
            <!-- Contact list sidebar (Left Column) -->
            <div class="col-md-4 border-end border-divider bg-light-subtle">
                <div class="p-3 border-bottom border-divider">
                    <h6 class="fw-bold mb-0">Direct Messages</h6>
                </div>
                
                <!-- Chats Roster -->
                <div class="list-group list-group-flush overflow-y-auto" style="max-height: 460px;">
                    <%
                        if (contactList != null && !contactList.isEmpty()) {
                            for (User u : contactList) {
                                if (u.getId() == currentUser.getId()) continue; // skip self
                                String displayName = u.getName() != null && !u.getName().isEmpty() ? u.getName() : u.getUsername();
                                String avatarPath = u.getAvatarPath();
                                if (avatarPath == null || avatarPath.isEmpty()) {
                                    avatarPath = request.getContextPath() + "/assets/images/default-avatar.png";
                                } else if (avatarPath.startsWith("/") && !avatarPath.startsWith(request.getContextPath())) {
                                    avatarPath = request.getContextPath() + avatarPath;
                                }
                    %>
                        <button onclick="loadChatPartner(<%= u.getId() %>, '<%= displayName.replace("'", "\\'") %>', '<%= avatarPath %>')" class="list-group-item list-group-item-action bg-transparent border-0 border-bottom border-divider p-3 d-flex align-items-center gap-3 text-main">
                            <img src="<%= avatarPath %>" alt="avatar" class="rounded-circle border border-divider" style="width: 38px; height: 38px; object-fit: cover;">
                            <div class="w-100">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="fw-bold small"><%= displayName %></span>
                                    <div>
                                        <span class="role-badge" style="font-size: 0.65rem;"><%= u.getRole() %></span>
                                        <span class="badge bg-danger ms-2 d-none" id="unread-badge-<%= u.getId() %>">New</span>
                                    </div>
                                </div>
                                <small class="text-muted text-truncate d-block small" style="max-width: 150px;">Click to open message log...</small>
                            </div>
                        </button>
                    <%
                            }
                        }
                    %>
                </div>
            </div>

            <!-- Chat Message Window (Right Column) -->
            <div class="col-md-8 d-flex flex-column justify-content-between">
                <!-- Chat Window Header -->
                <div class="p-3 border-bottom border-divider bg-light-subtle d-flex align-items-center gap-3">
                    <img src="<%= request.getContextPath() %>/assets/images/default-avatar.png" id="chatPartnerAvatar" class="rounded-circle border border-divider" style="width: 36px; height: 36px; object-fit: cover;">
                    <div>
                        <h6 class="fw-bold mb-0" id="chatPartnerName">Select a Partner</h6>
                        <small class="text-success font-size-xs d-none" id="typingIndicator" style="font-size: 0.75rem;"><i class="fa-solid fa-pen-nib me-1 animate-bounce"></i>typing...</small>
                    </div>
                </div>

                <!-- Messages Log Box -->
                <div class="chat-window flex-grow-1" id="chatWindow">
                    <div class="text-center text-muted p-5 mt-5">
                        <i class="fa-regular fa-comments fs-1 mb-2 text-primary"></i>
                        <p class="mb-0">Open a dialogue from the roster panel to start talking.</p>
                    </div>
                </div>

                <!-- Input Footer Box -->
                <div class="p-3 bg-light-subtle border-top border-divider">
                    <form action="#" id="chatForm" onsubmit="sendChatMessage(event)" class="d-none">
                        <div class="input-group align-items-center gap-2">
                            <!-- File Attach Real -->
                            <button type="button" class="btn btn-sm btn-light bg-transparent text-secondary border-divider" title="Share Document" onclick="triggerFileSelect()">
                                <i class="fa-solid fa-paperclip"></i>
                            </button>
                            <input type="file" id="chatFileInput" class="d-none" onchange="uploadFileAttachment(event)">
                            
                            <input type="text" id="messageText" class="form-control form-control-glass p-2.5 rounded-3" placeholder="Type a message..." required oninput="triggerTyping()">
                            <button type="submit" class="btn btn-primary-glass px-4 py-2.5"><i class="fa-solid fa-paper-plane"></i></button>
                        </div>
                    </form>
                </div>

            </div>

        </div>
    </div>
</div>

<!-- Chat Engine Script -->
<script>
    let activePartnerId = null;
    let pollInterval = null;

    function loadChatPartner(userId, username, avatarUrl) {
        activePartnerId = userId;
        document.getElementById('chatPartnerName').innerText = username;
        document.getElementById('chatPartnerAvatar').src = avatarUrl;
        
        // Show input form
        document.getElementById('chatForm').classList.remove('d-none');
        
        // Load messages history
        fetchHistory();
        
        // Setup polling every 3 seconds to fetch new messages
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(fetchHistory, 3000);
    }

    function fetchHistory() {
        if (!activePartnerId) return;
        
        fetch(`<%= request.getContextPath() %>/chat?action=history&partnerId=\${activePartnerId}`)
        .then(response => response.json())
        .then(messages => {
            const chatWindow = document.getElementById('chatWindow');
            chatWindow.innerHTML = '';
            
            if (messages.length === 0) {
                chatWindow.innerHTML = `
                    <div class="text-center text-muted p-5">
                        <p class="mb-0">No chat history. Send the first message!</p>
                    </div>
                `;
                return;
            }

            messages.forEach(msg => {
                const isSent = (msg.senderId === <%= currentUser.getId() %>);
                const bubble = document.createElement('div');
                bubble.className = `d-flex \${isSent ? 'justify-content-end' : 'justify-content-start'} mb-2`;
                
                let fileSnippet = '';
                if (msg.filePath) {
                    const isAudio = msg.filePath.toLowerCase().endsWith('.webm') || 
                                    msg.filePath.toLowerCase().endsWith('.wav') || 
                                    msg.filePath.toLowerCase().endsWith('.mp3') || 
                                    msg.filePath.toLowerCase().endsWith('.ogg') ||
                                    msg.filePath.toLowerCase().endsWith('.m4a') ||
                                    (msg.content && msg.content.includes("Voice Message"));

                    if (isAudio) {
                        fileSnippet = `
                            <div class="mt-2">
                                <audio src="\${msg.filePath}" controls style="max-width: 240px; height: 35px;" onloadedmetadata="fixAudioDuration(this)"></audio>
                                <a href="\${msg.filePath}" download class="btn btn-sm btn-link text-white-50 p-0 d-block mt-1 small" style="font-size: 0.75rem; text-decoration: none;"><i class="fa-solid fa-download me-1"></i>Download Voice Memo</a>
                            </div>
                        `;
                    } else {
                        const fileName = msg.filePath.substring(msg.filePath.lastIndexOf('/') + 1);
                        const cleanName = fileName.includes('_') ? fileName.substring(fileName.indexOf('_') + 1) : fileName;
                        
                        fileSnippet = `
                            <div class="p-2 rounded-3 bg-white-10 border mt-2 small text-main d-flex justify-content-between align-items-center gap-2" style="background: rgba(255,255,255,0.1);">
                                <div class="text-truncate" style="max-width: 180px;" title="\${cleanName}">
                                    <i class="fa-solid fa-paperclip me-1.5"></i>\${cleanName}
                                </div>
                                <a href="\${msg.filePath}" download class="text-primary"><i class="fa-solid fa-download"></i></a>
                            </div>
                        `;
                    }
                }

                let readSnippet = isSent ? `
                    <small class="d-block text-end text-muted font-size-xs" style="font-size: 0.65rem;">
                        \${msg.readReceipt ? '<i class="fa-solid fa-check-double text-primary"></i> Read' : '<i class="fa-solid fa-check"></i> Sent'}
                    </small>
                ` : '';

                bubble.innerHTML = `
                    <div class="d-flex flex-column" style="max-width: 70%;">
                        <div class="msg-bubble \${isSent ? 'msg-sent' : 'msg-received'} mb-1" \${msg.filePath ? 'style="min-width: 280px;"' : ''}>
                            \${msg.content || ''}
                            \${fileSnippet}
                        </div>
                        \${readSnippet}
                    </div>
                `;
                chatWindow.appendChild(bubble);
            });
            
            // Scroll to bottom
            chatWindow.scrollTop = chatWindow.scrollHeight;
        })
        .catch(err => console.error("Could not load chat history:", err));
    }

    function sendChatMessage(e) {
        e.preventDefault();
        const input = document.getElementById('messageText');
        const content = input.value.trim();
        if (!content || !activePartnerId) return;

        fetch('<%= request.getContextPath() %>/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `receiverId=\${activePartnerId}&content=\${encodeURIComponent(content)}`
        })
        .then(response => response.json())
        .then(data => {
            input.value = '';
            fetchHistory(); // reload logs
        })
        .catch(err => console.error("Failed to deliver message:", err));
    }

    function triggerTyping() {
        // Send a temporary simulation state for visual impact
        // We can simulate an active typing sequence on the partner side!
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.remove('d-none');
        
        setTimeout(() => {
            indicator.classList.add('d-none');
        }, 1500);
    }

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    function triggerFileSelect() {
        document.getElementById('chatFileInput').click();
    }

    function uploadFileAttachment(event) {
        const file = event.target.files[0];
        if (!file || !activePartnerId) return;

        const formData = new FormData();
        formData.append('receiverId', activePartnerId);
        formData.append('file', file);
        formData.append('content', '📄 Shared Attachment: ' + file.name);

        // Clear file input
        event.target.value = '';

        const input = document.getElementById('messageText');
        const originalPlaceholder = input.placeholder;
        input.disabled = true;
        input.placeholder = "Uploading attachment...";

        fetch('<%= request.getContextPath() %>/chat', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            input.disabled = false;
            input.placeholder = originalPlaceholder;
            fetchHistory();
        })
        .catch(err => {
            input.disabled = false;
            input.placeholder = originalPlaceholder;
            console.error("Failed to upload attachment:", err);
            alert("Failed to upload attachment.");
        });
    }

    function fixAudioDuration(audio) {
        if (audio.dataset.durationFixed) return;
        
        const checkAndFix = () => {
            if (audio.duration === Infinity || isNaN(audio.duration)) {
                // Seek to a high value to force Chromium to parse the index clusters
                audio.currentTime = 9999;
                audio.ontimeupdate = () => {
                    audio.ontimeupdate = null;
                    audio.currentTime = 0;
                    audio.dataset.durationFixed = "true";
                };
            } else {
                audio.dataset.durationFixed = "true";
            }
        };

        if (audio.duration === Infinity || isNaN(audio.duration)) {
            // Listen to durationchange and loadeddata to handle latency
            audio.addEventListener('durationchange', checkAndFix, { once: true });
            audio.addEventListener('loadeddata', checkAndFix, { once: true });
            checkAndFix();
        } else {
            audio.dataset.durationFixed = "true";
        }
    }

    function toggleVoiceRecording() {
        const btn = document.getElementById('voiceRecordBtn');
        const icon = document.getElementById('voiceMicIcon');

        if (!isRecording) {
            navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                let options = {};
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus' };
                } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                    options = { mimeType: 'audio/webm' };
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    options = { mimeType: 'audio/ogg;codecs=opus' };
                }

                mediaRecorder = new MediaRecorder(stream, options);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = e => {
                    if (e.data && e.data.size > 0) {
                        audioChunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                    const file = new File([audioBlob], "voice_message.webm", { type: audioBlob.type });

                    const formData = new FormData();
                    formData.append('receiverId', activePartnerId);
                    formData.append('file', file);
                    formData.append('content', '🎤 Voice Message');

                    fetch('<%= request.getContextPath() %>/chat', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        fetchHistory();
                    })
                    .catch(err => console.error("Failed to upload voice message:", err));
                    
                    // Stop stream tracks with 500ms delay to allow final encoder flush safely
                    setTimeout(() => {
                        stream.getTracks().forEach(track => track.stop());
                    }, 500);
                };

                // Request chunks every 250ms to ensure full continuous recording buffer flushes
                mediaRecorder.start(250);
                isRecording = true;
                btn.className = "btn btn-sm btn-danger text-white border-divider";
                icon.className = "fa-solid fa-stop blink-animation";
                btn.title = "Stop Recording";
            })
            .catch(err => {
                console.error("Microphone access denied:", err);
                alert("Microphone access is required to record voice notes.");
            });
        } else {
            if (mediaRecorder) {
                // Request a final data flush explicitly before triggering stop
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.requestData();
                }
                setTimeout(() => {
                    mediaRecorder.stop();
                }, 100);
            }
            isRecording = false;
            btn.className = "btn btn-sm btn-light bg-transparent text-primary border-divider";
            icon.className = "fa-solid fa-microphone";
            btn.title = "Record Voice Memo";
        }
    }

    function pollUnreadCounts() {
        fetch('<%= request.getContextPath() %>/chat?action=unread')
        .then(response => response.json())
        .then(unreadCounts => {
            // Reset all badges
            const badges = document.querySelectorAll('[id^="unread-badge-"]');
            badges.forEach(b => b.classList.add('d-none'));

            // Show active badges
            for (const senderId in unreadCounts) {
                const badge = document.getElementById('unread-badge-' + senderId);
                if (badge && parseInt(senderId) !== activePartnerId) {
                    badge.innerText = unreadCounts[senderId] + ' New';
                    badge.classList.remove('d-none');
                }
            }
        })
        .catch(err => console.error("Error loading unread counts:", err));
    }

    document.addEventListener("DOMContentLoaded", function() {
        pollUnreadCounts();
        setInterval(pollUnreadCounts, 3000);
    });
</script>

<%@ include file="/common/footer.jsp" %>
