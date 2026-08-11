'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Chat states
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const triggerToast = (title, body) => {
    setToast({ title, body });
    setTimeout(() => {
      setToast(prev => {
        if (prev && prev.title === title && prev.body === body) {
          return null;
        }
        return prev;
      });
    }, 4000);
  };

  const filteredUsers = usersList.filter(peer => 
    peer.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    peer.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const displayedUsers = filteredUsers;
  
  const messagesContainerRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 760);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync ref with state for the realtime handler
  useEffect(() => {
    selectedUserRef.current = selectedUser;
    
    // Mark as read when selecting a peer
    if (user && selectedUser) {
      const markAsRead = async () => {
        await supabase
          .from('private_messages')
          .update({ read_receipt: true })
          .eq('sender_id', selectedUser.id)
          .eq('receiver_id', user.id)
          .eq('read_receipt', false);

        setUsersList(prev => prev.map(u => u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u));
      };
      markAsRead();
    }
  }, [selectedUser, user]);

  useEffect(() => {
    const initChat = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Desktop notification permission removed as requested to avoid browser popups
      if (typeof window !== 'undefined' && 'Notification' in window) {
        // Disabled browser permission prompt
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      setUser(profile);

      if (profile) {
        // Fetch list of other users (peers)
        const { data: users } = await supabase
          .from('users')
          .select('id, name, username, role, avatar_path')
          .neq('id', profile.id);

        // Fetch unread count from private_messages
        const { data: unreadMsgs } = await supabase
          .from('private_messages')
          .select('sender_id')
          .eq('receiver_id', profile.id)
          .eq('read_receipt', false);

        const counts = {};
        unreadMsgs?.forEach(m => {
          counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
        });

        // Fetch last message timestamps to sort peers
        const { data: allUserMsgs } = await supabase
          .from('private_messages')
          .select('sender_id, receiver_id, created_at')
          .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
          .order('created_at', { ascending: false });

        const lastMsgTimeMap = {};
        allUserMsgs?.forEach(m => {
          const peerId = m.sender_id === profile.id ? m.receiver_id : m.sender_id;
          if (!lastMsgTimeMap[peerId]) {
            lastMsgTimeMap[peerId] = new Date(m.created_at).getTime();
          }
        });

        const mappedUsers = (users || []).map(u => ({
          ...u,
          unreadCount: counts[u.id] || 0,
          lastMessageTime: lastMsgTimeMap[u.id] || 0
        }));

        mappedUsers.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        setUsersList(mappedUsers);

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const urlUname = urlParams.get('username');
          if (urlUname) {
            const matchedPeer = mappedUsers.find(u => u.username.toLowerCase() === urlUname.toLowerCase());
            if (matchedPeer) {
              setSelectedUser(matchedPeer);
            }
          }
        }
      }
      setLoading(false);
    };

    initChat();
  }, []);

  // Fetch conversation history when selectedUser changes
  useEffect(() => {
    if (!user || !selectedUser) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
        scrollToBottom();
      }
    };

    fetchMessages();
  }, [selectedUser, user]);

  // Subscribe to global messages realtime channel
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat_global_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.receiver_id === user.id) {
            // Update usersList sorting on new message
            setUsersList(prev => {
              const updated = prev.map(u => {
                if (u.id === newMsg.sender_id) {
                  return {
                    ...u,
                    lastMessageTime: new Date(newMsg.created_at).getTime(),
                    unreadCount: (!selectedUserRef.current || selectedUserRef.current.id !== newMsg.sender_id) 
                      ? (u.unreadCount || 0) + 1 
                      : u.unreadCount
                  };
                }
                return u;
              });
              return [...updated].sort((a, b) => b.lastMessageTime - a.lastMessageTime);
            });

            const activePeer = selectedUserRef.current;
            if (activePeer && newMsg.sender_id === activePeer.id) {
              // Add directly to chat if active conversation
              setMessages((prev) => [...prev, newMsg]);
              scrollToBottom();
              // Mark as read in db
              supabase
                .from('private_messages')
                .update({ read_receipt: true })
                .eq('id', newMsg.id)
                .then();
            } else {
              // Increment unread count in sidebar for inactive conversation
              setUsersList(prev => prev.map(u => u.id === newMsg.sender_id ? { ...u, unreadCount: (u.unreadCount || 0) + 1 } : u));
              // Trigger in-screen toast notification instead of browser popup
              const senderPeer = usersList.find(u => u.id === newMsg.sender_id);
              triggerToast(`New Message from ${senderPeer?.name || 'Peer'}`, newMsg.content);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_messages',
        },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'private_messages',
        },
        (payload) => {
          const deletedId = payload.old.id;
          setMessages((prev) => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, usersList]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const msgContent = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.id,
          content: msgContent,
          read_receipt: false,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update selected peer's last message time locally and sort
      setUsersList(prev => {
        const updated = prev.map(u => {
          if (u.id === selectedUser.id) {
            return {
              ...u,
              lastMessageTime: new Date(data.created_at).getTime()
            };
          }
          return u;
        });
        return [...updated].sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      });

      setMessages((prev) => [...prev, data]);
      scrollToBottom();
    } catch (err) {
      triggerToast('Error sending message', err.message);
    }
  };

  const handleDeleteMessage = (msgId) => {
    setDeleteTargetId(msgId);
  };

  const executeDeleteMessage = async (msgId) => {
    try {
      const { error } = await supabase
        .from('private_messages')
        .update({
          content: 'This message was deleted'
        })
        .eq('id', msgId);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: 'This message was deleted' } : m));
    } catch (err) {
      triggerToast('Error deleting message', err.message);
    }
  };

  const getAvatarUrl = (peer) => {
    return peer.avatar_path && peer.avatar_path !== '/assets/images/default-avatar.png'
      ? peer.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${peer.username}`;
  };

  const renderMessageContent = (content, isMe) => {
    if (!content) return '';
    // Regex to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: isMe ? '#FFFFFF' : 'var(--color-primary)', 
              textDecoration: 'underline', 
              fontWeight: '700',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Chat...</h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      <Navbar />
      
      <div className="chat-container-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: isMobile ? '0' : '2rem', height: 'calc(100vh - 140px)', width: '95%', maxWidth: '1350px', margin: '0 auto', paddingBottom: '2rem' }}>
        
        {/* Left Sidebar: Peers List */}
        {(!isMobile || !selectedUser) && (
          <div className="glass card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '100%', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>💬 Peers</h3>
            
            {/* Search Input Box */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search peers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: 'var(--text-primary)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: '0.8rem', paddingRight: '4px' }}>
              {displayedUsers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No matching peers found.</p>
              ) : (
                displayedUsers.map((peer) => (
                  <div
                    key={peer.id}
                    onClick={() => setSelectedUser(peer)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      background: selectedUser?.id === peer.id 
                        ? 'rgba(99, 102, 241, 0.12)' 
                        : peer.unreadCount > 0 
                          ? 'rgba(239, 68, 68, 0.08)' 
                          : 'rgba(255, 255, 255, 0.6)',
                      border: selectedUser?.id === peer.id 
                        ? '1px solid var(--color-primary)' 
                        : peer.unreadCount > 0 
                          ? '1px solid #ef4444' 
                          : '1px solid var(--border-color)',
                      transition: 'var(--transition)',
                    }}
                  >
                    <img
                      src={getAvatarUrl(peer)}
                      alt="avatar"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {peer.name}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{peer.username}</span>
                    </div>
                    {peer.unreadCount > 0 && (
                      <span 
                        style={{ 
                          background: '#ef4444', 
                          color: 'white', 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          padding: '0.15rem 0.4rem', 
                          borderRadius: '10px',
                          marginLeft: 'auto'
                        }}
                      >
                        {peer.unreadCount}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Right Panel: Conversation history */}
        {(!isMobile || selectedUser) && (
          <div className="glass card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
            {!selectedUser ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</span>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Your Inbox</h4>
                <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>Select a peer from the left sidebar to start messaging in real time.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* Active User Header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isMobile && (
                    <button 
                      onClick={() => setSelectedUser(null)} 
                      style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', paddingRight: '0.5rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}
                    >
                      &larr; Back
                    </button>
                  )}
                  <img
                    src={getAvatarUrl(selectedUser)}
                    alt="avatar"
                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }} onClick={() => router.push(`/profile/${selectedUser.username}`)}>
                      {selectedUser.name} <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', cursor: 'pointer' }}>(View Profile &rarr;)</span>
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{selectedUser.username} • {selectedUser.role}</span>
                  </div>
                </div>

                {/* Chat messages viewport */}
                <div ref={messagesContainerRef} style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#F8FAFC' }}>
                  {messages.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'auto', marginBottom: 'auto' }}>
                      Say hello to start the conversation!
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          style={{
                            maxWidth: '70%',
                            padding: '0.8rem 1.2rem',
                            borderRadius: 'var(--radius)',
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            background: isMe ? 'var(--color-primary)' : '#FFFFFF',
                            color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                            border: isMe ? 'none' : '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            position: 'relative'
                          }}
                        >
                          {isMe && msg.content !== 'This message was deleted' && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '6px',
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255, 255, 255, 0.5)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px',
                                zIndex: 10
                              }}
                              title="Delete message"
                              onMouseEnter={(e) => e.target.style.color = '#FFFFFF'}
                              onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}
                            >
                              ✕
                            </button>
                          )}
                          <p style={{ 
                            fontSize: '0.95rem', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word', 
                            paddingRight: (isMe && msg.content !== 'This message was deleted') ? '12px' : '0',
                            fontStyle: msg.content === 'This message was deleted' ? 'italic' : 'normal',
                            opacity: msg.content === 'This message was deleted' ? 0.75 : 1
                          }}>
                            {renderMessageContent(msg.content, isMe)}
                          </p>
                          <span style={{ display: 'block', fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', textAlign: 'right', marginTop: '0.3rem' }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input box */}
                <form onSubmit={handleSendMessage} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', background: '#FFFFFF', alignItems: 'flex-end' }}>
                  <textarea
                    required
                    placeholder="Type a message... (Shift+Enter for new line)"
                    className="input"
                    style={{ flex: 1, background: '#F1F5F9', minHeight: '44px', maxHeight: '120px', resize: 'vertical', paddingTop: '0.6rem', paddingBottom: '0.6rem', lineHeight: '1.4' }}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', height: '44px' }}>
                    Send
                  </button>
                </form>

              </div>
            )}
          </div>
        )}

      </div>

      {/* ================= CUSTOM CONFIRMATION MODAL ================= */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Delete Message</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to delete this message? This will mark it as deleted for both you and the receiver.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setDeleteTargetId(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const targetId = deleteTargetId;
                  setDeleteTargetId(null);
                  await executeDeleteMessage(targetId);
                }} 
                className="btn btn-danger" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= IN-SCREEN CUSTOM TOAST NOTIFICATION ================= */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--color-primary)' }}>{toast.title}</span>
            <button 
              onClick={() => setToast(null)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0 0 10px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{toast.body}</p>
        </div>
      )}
    </div>
  );
}
