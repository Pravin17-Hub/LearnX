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
  
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);

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

      // Request desktop notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        Notification.requestPermission();
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

        const mappedUsers = (users || []).map(u => ({
          ...u,
          unreadCount: counts[u.id] || 0
        }));
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
              // Trigger notification
              if (Notification.permission === 'granted') {
                new Notification('New Message', { body: newMsg.content || 'You received a message.' });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      setMessages((prev) => [...prev, data]);
      scrollToBottom();
    } catch (err) {
      alert(`Error sending message: ${err.message}`);
    }
  };

  const getAvatarUrl = (peer) => {
    return peer.avatar_path && peer.avatar_path !== '/assets/images/default-avatar.png'
      ? peer.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${peer.username}`;
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
      
      <div className="container" style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', height: 'calc(100vh - 120px)', minHeight: '500px', paddingBottom: '2rem' }}>
        
        {/* Left Sidebar: Peers List */}
        <div className="glass card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>💬 Peers</h3>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {usersList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No other registered users found.</p>
            ) : (
              usersList.map((peer) => (
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

        {/* Right Panel: Conversation history */}
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
              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#F8FAFC' }}>
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
                        }}
                      >
                        <p style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', textAlign: 'right', marginTop: '0.3rem' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input box */}
              <form onSubmit={handleSendMessage} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', background: '#FFFFFF' }}>
                <input
                  type="text"
                  required
                  placeholder="Type a message..."
                  className="input"
                  style={{ flex: 1, background: '#F1F5F9' }}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                  Send
                </button>
              </form>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
