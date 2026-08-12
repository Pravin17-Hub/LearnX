'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function CommunityRoomPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params.id;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [community, setCommunity] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'library' | 'members'
  
  // Realtime Group Chat States
  const [chatPosts, setChatPosts] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  
  // File Upload states
  const [fileToShare, setFileToShare] = useState(null);
  const [sharingProgress, setSharingProgress] = useState(false);
  const [shareTitle, setShareTitle] = useState('');

  // Members list state
  const [communityMembersList, setCommunityMembersList] = useState([]);

  const messagesEndRef = useRef(null);

  const loadCommunityRoom = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    // 1. Fetch current profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
    setCurrentUser(profile);

    // 2. Fetch community details
    const { data: comm } = await supabase
      .from('subject_communities')
      .select('*')
      .eq('id', communityId)
      .single();
    
    if (!comm) {
      setCommunity(null);
      setLoading(false);
      return;
    }
    setCommunity(comm);

    // 3. Check membership
    const { data: membership } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', profile.id)
      .maybeSingle();

    const joined = !!membership;
    setIsMember(joined);

    if (joined) {
      // 4. Fetch community chat posts
      const { data: posts } = await supabase
        .from('community_posts')
        .select('*, users!user_id(name, username, role, avatar_path)')
        .eq('community_id', communityId)
        .order('created_at', { ascending: true });
      setChatPosts(posts || []);

      // 5. Fetch community members list
      const { data: members } = await supabase
        .from('community_members')
        .select('*, users!user_id(name, username, role, avatar_path, institution)')
        .eq('community_id', communityId);
      setCommunityMembersList(members || []);
      
      scrollToBottom();
    }

    setLoading(false);
  };

  useEffect(() => {
    if (communityId) {
      loadCommunityRoom();
    }
  }, [communityId]);

  // Subscribe to community real-time chat posts
  useEffect(() => {
    if (!isMember) return;

    const channel = supabase
      .channel(`community_chat_${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: `community_id=eq.${communityId}`
        },
        async (payload) => {
          const newPost = payload.new;
          // Fetch user metadata for this new post
          const { data: userData } = await supabase
            .from('users')
            .select('name, username, role, avatar_path')
            .eq('id', newPost.user_id)
            .single();

          const postWithUser = {
            ...newPost,
            users: userData
          };

          setChatPosts((prev) => prev.some(p => p.id === postWithUser.id) ? prev : [...prev, postWithUser]);
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'community_posts',
          filter: `community_id=eq.${communityId}`
        },
        (payload) => {
          const updatedPost = payload.new;
          setChatPosts((prev) => prev.map(p => p.id === updatedPost.id ? { ...p, content: updatedPost.content } : p));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMember, communityId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleJoin = async () => {
    if (!currentUser || !community) return;
    try {
      await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: currentUser.id
        });

      await supabase
        .from('subject_communities')
        .update({ member_count: community.member_count + 1 })
        .eq('id', community.id);

      await loadCommunityRoom();
    } catch (err) {
      alert(`Error joining community: ${err.message}`);
    }
  };

  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser || !community) return;

    const chatContent = newMessage.trim();
    setNewMessage('');

    try {
      const { data: newPost, error } = await supabase
        .from('community_posts')
        .insert({
          community_id: community.id,
          user_id: currentUser.id,
          title: 'Community Chat',
          content: chatContent,
          type: 'post'
        })
        .select('*, users!user_id(name, username, role, avatar_path)')
        .single();

      if (error) throw error;
      setChatPosts((prev) => prev.some(p => p.id === newPost.id) ? prev : [...prev, newPost]);
      scrollToBottom();
    } catch (err) {
      alert(`Error sending chat: ${err.message}`);
    }
  };

  const handleDeletePost = (postId) => {
    setDeleteTargetId(postId);
  };

  const executeDeletePost = async (postId) => {
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({
          content: 'This message was deleted'
        })
        .eq('id', postId);
        
      if (error) throw error;
      setChatPosts(prev => prev.map(p => p.id === postId ? { ...p, content: 'This message was deleted' } : p));
    } catch (err) {
      alert("Error deleting message: " + err.message);
    }
  };

  const handleShareFile = async (e) => {
    e.preventDefault();
    if (!fileToShare || !currentUser || !community) return;

    setSharingProgress(true);
    try {
      // 1. Upload File locally
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const formData = new FormData();
      formData.append('file', fileToShare);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });

      if (!res.ok) throw new Error('File upload failed');
      const uploadData = await res.json();

      // 2. Format content with file reference
      const titleText = shareTitle.trim() || fileToShare.name;
      const formattedContent = `Shared a resource: **${titleText}**\n[FILE:${uploadData.url}]`;

      // 3. Create community post
      const { error } = await supabase
        .from('community_posts')
        .insert({
          community_id: community.id,
          user_id: currentUser.id,
          title: 'Shared Resource',
          content: formattedContent,
          type: 'project'
        });

      if (error) throw error;

      setFileToShare(null);
      setShareTitle('');
      setActiveTab('chat');
    } catch (err) {
      alert(`Error sharing resource: ${err.message}`);
    }
    setSharingProgress(false);
  };

  const getAvatarUrl = (u) => {
    return u?.avatar_path && u.avatar_path !== '/assets/images/default-avatar.png'
      ? u.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${u?.username}`;
  };

  // Helper: parse content for file attachments
  const parseFileRef = (content) => {
    const match = content.match(/\[FILE:(.*?)\]/);
    return match ? match[1] : null;
  };

  const cleanFileText = (content) => {
    return content.replace(/\[FILE:(.*?)\]/, '').trim();
  };

  const renderMessageWithLinks = (content, linkColor = 'var(--color-primary)') => {
    if (!content) return '';
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
              color: linkColor, 
              textDecoration: 'underline', 
              fontWeight: '700',
              wordBreak: 'break-all',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 5
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Compile list of shared resources
  const sharedResources = chatPosts.filter(p => parseFileRef(p.content) !== null);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Community Room...</h2>
      </div>
    );
  }

  if (!community) {
    return (
      <div>
        <Navbar />
        <div className="container" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--text-primary)' }}>Community Not Found</h2>
          <button className="btn btn-primary" onClick={() => router.push('/communities')}>
            Back to Communities
          </button>
        </div>
      </div>
    );
  }

  // Not a member screen
  if (!isMember) {
    return (
      <div>
        <Navbar />
        <div className="container animate-fade-in" style={{ maxWidth: '650px', textAlign: 'center', padding: '4rem 2rem' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>🔒</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Join {community.name}</h2>
          <span className="badge badge-student" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)', fontSize: '0.8rem', padding: '0.3rem 1rem', marginBottom: '1.5rem' }}>
            {community.category}
          </span>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2rem' }}>
            {community.description || 'Join this study group to engage in chats and share learning resources.'}
          </p>
          <button onClick={handleJoin} className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', fontSize: '1.05rem' }}>
            Join Community Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      <Navbar />
      
      {/* Title Bar */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-color)', padding: '1rem 2rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>👥 {community.name}</h1>
              <span className="badge badge-student" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)', fontSize: '0.7rem' }}>
                {community.category}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>{community.description}</p>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => router.push('/communities')}>
            &larr; Back
          </button>
        </div>
      </div>

      <div className="container community-layout-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', height: 'calc(100vh - 160px)', minHeight: '500px', paddingBottom: '2rem', paddingTop: '1.5rem' }}>
        
        {/* Main Room Canvas */}
        <div className="glass card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
          
          {/* Tab Selector */}
          <div className="tabs-container" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#FFFFFF', padding: '0 1.5rem' }}>
            {['chat', 'library', 'share'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
                  padding: '1rem 0',
                  marginRight: '2rem',
                  borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                  fontWeight: 650,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'var(--transition)'
                }}
              >
                {tab === 'chat' ? '💬 Group Chat' : tab === 'library' ? '📚 Resource Library' : '➕ Share Resource'}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* 1. Chat Tab */}
            {activeTab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                
                {/* Chat Stream Viewport */}
                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#F8FAFC' }}>
                  {chatPosts.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'auto', marginBottom: 'auto' }}>
                      Welcome to the group chat! Share files or message peers to get started.
                    </p>
                  ) : (
                    chatPosts.map((post) => {
                      const isMe = currentUser && post.user_id === currentUser.id;
                      const isDeleted = post.content === 'This message was deleted';
                      const fileUrl = parseFileRef(post.content);
                      const displayContent = cleanFileText(post.content);
                      
                      return (
                        <div key={post.id} style={{ display: 'flex', gap: '0.75rem', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                          {!isMe && (
                            <img
                              src={getAvatarUrl(post.users)}
                              alt="avatar"
                              style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          )}
                          <div
                            style={{
                              padding: '0.75rem 1.1rem',
                              borderRadius: 'var(--radius)',
                              background: isMe ? 'var(--color-primary)' : '#FFFFFF',
                              color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                              border: isMe ? 'none' : '1px solid var(--border-color)',
                              boxShadow: 'var(--shadow-sm)',
                              position: 'relative',
                              paddingRight: (isMe && !isDeleted) ? '24px' : '1.1rem'
                            }}
                          >
                            {isMe && !isDeleted && (
                              <button
                                onClick={() => handleDeletePost(post.id)}
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
                            {!isMe && (
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.2rem' }}>
                                {post.users?.name} (@{post.users?.username})
                              </span>
                            )}
                            <p style={{ 
                              fontSize: '0.9rem', 
                              margin: 0, 
                              whiteSpace: 'pre-wrap',
                              fontStyle: isDeleted ? 'italic' : 'normal',
                              opacity: isDeleted ? 0.75 : 1
                            }}>
                              {isDeleted ? post.content : renderMessageWithLinks(displayContent, isMe ? '#FFFFFF' : 'var(--color-primary)')}
                            </p>
                            {fileUrl && (
                              <div style={{ marginTop: '0.6rem', borderTop: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.6rem',
                                    background: isMe ? '#FFFFFF' : 'var(--color-primary)',
                                    color: isMe ? 'var(--color-primary)' : '#FFFFFF',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    border: 'none',
                                    fontWeight: 700
                                  }}
                                >
                                  📄 Download File
                                </a>
                              </div>
                            )}
                            <span style={{ display: 'block', fontSize: '0.6rem', color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textAlign: 'right', marginTop: '0.3rem' }}>
                              {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input form */}
                <form onSubmit={handleSendChat} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', background: '#FFFFFF', alignItems: 'flex-end' }}>
                  <textarea
                    required
                    placeholder="Type a message to the group... (Shift+Enter for new line)"
                    className="input"
                    style={{ flex: 1, background: '#F1F5F9', minHeight: '44px', maxHeight: '120px', resize: 'vertical', paddingTop: '0.6rem', paddingBottom: '0.6rem', lineHeight: '1.4' }}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat(e);
                      }
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', height: '44px' }}>
                    Send
                  </button>
                </form>

              </div>
            )}

            {/* 2. Library Tab */}
            {activeTab === 'library' && (
              <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#F8FAFC' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>📚 Group Resources & Library</h3>
                {sharedResources.length === 0 ? (
                  <div className="glass card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No files or shared notes in this community library yet. Use the "Share Resource" tab to add some!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                    {sharedResources.map((res) => {
                      const fileUrl = parseFileRef(res.content);
                      const displayTitle = cleanFileText(res.content).replace('Shared a resource: ', '').replace(/\*\*/g, '');
                      return (
                        <div key={res.id} className="glass card" style={{ padding: '1.25rem', background: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--color-primary)' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shared by @{res.users?.username}</span>
                            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0.3rem 0' }}>{displayTitle}</h4>
                          </div>
                          <div style={{ marginTop: '1rem' }}>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem', textAlign: 'center' }}
                            >
                              📄 Download Resource
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. Share Resource Tab */}
            {activeTab === 'share' && (
              <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto', background: '#FFFFFF', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>➕ Share File / Note in Community</h3>
                <form onSubmit={handleShareFile} style={{ display: 'grid', gap: '1.2rem' }}>
                  <div>
                    <label className="label">Resource Title</label>
                    <input type="text" className="input" placeholder="e.g. Spring Boot Cheat Sheet" required value={shareTitle} onChange={(e) => setShareTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Select File</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                      onChange={(e) => setFileToShare(e.target.files[0])}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 2rem', marginTop: '0.5rem' }} disabled={sharingProgress}>
                    {sharingProgress ? 'Sharing to Community...' : 'Share Resource'}
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>

        {/* Right Sidebar: Active Members List */}
        <div className="glass card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>👥 Members ({communityMembersList.length})</h3>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {communityMembersList.map((member) => (
              <div
                key={member.user_id}
                onClick={() => router.push(`/profile/${member.users?.username}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', background: 'rgba(0,0,0,0.01)' }}
              >
                <img
                  src={getAvatarUrl(member.users)}
                  alt="avatar"
                  style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {member.users?.name}
                  </h4>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>@{member.users?.username}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ================= CUSTOM CONFIRM DELETE MESSAGE ================= */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass modal-content" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Delete Message</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              Are you sure you want to delete this message? This will mark it as deleted for all community members.
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
                  await executeDeletePost(targetId);
                }} 
                className="btn btn-danger" 
                style={{ padding: '0.6rem 1.5rem', cursor: 'pointer', background: '#dc2626', color: '#FFFFFF', border: 'none', borderRadius: '4px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
