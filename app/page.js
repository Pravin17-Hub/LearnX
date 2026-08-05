'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [feedPosts, setFeedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Post states
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');

  // Comments states
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [newCommentContent, setNewCommentContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    const initHome = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();
        setUser(profile);
      }

      // Fetch global live feed posts
      const { data: posts } = await supabase
        .from('feed_posts')
        .select('*, users!user_id(name, username, role, avatar_path)')
        .order('created_at', { ascending: false })
        .limit(20);
      setFeedPosts(posts || []);

      setLoading(false);
    };

    initHome();
  }, []);

  const handleToggleComments = async (postId) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    setLoadingComments(true);

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, users!user_id(name, username, avatar_path)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCommentsMap((prev) => ({ ...prev, [postId]: data || [] }));
    } catch (err) {
      console.error('Error loading comments:', err.message);
    }
    setLoadingComments(false);
  };

  const handleAddComment = async (e, postId) => {
    e.preventDefault();
    if (!newCommentContent.trim() || !user) return;

    const contentText = newCommentContent.trim();
    setNewCommentContent('');

    try {
      const { data: newComment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: contentText
        })
        .select('*, users!user_id(name, username, avatar_path)')
        .single();

      if (error) throw error;

      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
    } catch (err) {
      alert(`Error posting comment: ${err.message}`);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || !user) return;

    try {
      const { data: newPost, error } = await supabase
        .from('feed_posts')
        .insert({
          user_id: user.id,
          title: newPostTitle.trim() || 'Untitled Announcement',
          content: newPostContent.trim(),
          type: 'announcement'
        })
        .select('*, users!user_id(name, username, role, avatar_path)')
        .single();

      if (error) throw error;

      setFeedPosts([newPost, ...feedPosts]);
      setNewPostTitle('');
      setNewPostContent('');
    } catch (err) {
      console.error(err.message);
    }
  };

  const getAvatarUrl = (u) => {
    return u?.avatar_path && u.avatar_path !== '/assets/images/default-avatar.png'
      ? u.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${u?.username}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading LearnX...</h2>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container" style={{ maxWidth: '1000px' }}>
        
        {/* Banner Section */}
        <div className="glass card" style={{ padding: '2.5rem', marginBottom: '2.5rem', textAlign: 'center', borderBottom: '4px solid var(--color-primary)' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            🚀 LearnX Community
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            A collaborative learning network for peers and faculty. Share notes, discuss concepts, and publish announcements in real-time.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => router.push('/search')}>
              🔍 Search Library & Peers
            </button>
            {!user && (
              <button className="btn btn-secondary" onClick={() => router.push('/login')}>
                Sign In to Share
              </button>
            )}
          </div>
        </div>

        {/* Feed & Sidebar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', flexWrap: 'wrap' }}>
          
          {/* Main Feed Column */}
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
              📣 Live Feed & Announcements
            </h3>

            {/* Post Creator Form */}
            {user && (
              <form onSubmit={handleCreatePost} className="glass card" style={{ marginBottom: '2rem' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.8rem' }}>Write an announcement...</h4>
                <input
                  type="text"
                  placeholder="Post title (optional)..."
                  className="input"
                  style={{ marginBottom: '0.8rem', background: '#FFFFFF' }}
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
                <textarea
                  placeholder="What would you like to share with the community today?"
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical', marginBottom: '0.8rem', background: '#FFFFFF' }}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                    Publish Announcement
                  </button>
                </div>
              </form>
            )}

            {/* Posts List */}
            {feedPosts.length === 0 ? (
              <div className="glass card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No active announcements yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {feedPosts.map((post) => (
                  <div key={post.id} className="glass card animate-fade-in" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <img
                        src={getAvatarUrl(post.users)}
                        alt="avatar"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                        onClick={() => router.push(`/profile/${post.users?.username}`)}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span 
                            style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
                            onClick={() => router.push(`/profile/${post.users?.username}`)}
                          >
                            {post.users?.name}
                          </span>
                          <span className="badge badge-student" style={{ fontSize: '0.65rem' }}>
                            {post.users?.role}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          @{post.users?.username} • {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{post.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', margin: 0 }}>{post.content}</p>

                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                      <button
                        onClick={() => handleToggleComments(post.id)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        💬 Comments
                      </button>
                    </div>

                    {activeCommentsPostId === post.id && (
                      <div className="animate-fade-in" style={{ marginTop: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h5 style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Comments</h5>
                        
                        {loadingComments && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading comments...</p>}
                        
                        {!loadingComments && (!commentsMap[post.id] || commentsMap[post.id].length === 0) && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No comments yet. Write one below!</p>
                        )}

                        {!loadingComments && commentsMap[post.id] && (
                          <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1rem' }}>
                            {commentsMap[post.id].map((comm) => (
                              <div key={comm.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                <img
                                  src={getAvatarUrl(comm.users)}
                                  alt="avatar"
                                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div style={{ background: '#FFFFFF', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{comm.users?.name}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(comm.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{comm.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {user && (
                          <form onSubmit={(e) => handleAddComment(e, post.id)} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input
                              type="text"
                              required
                              placeholder="Write a comment..."
                              className="input"
                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', flex: 1, background: '#FFFFFF' }}
                              value={newCommentContent}
                              onChange={(e) => setNewCommentContent(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
                              Post
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar Column */}
          <div>
            {user ? (
              <div className="glass card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>My Details</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <img
                    src={getAvatarUrl(user)}
                    alt="avatar"
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <h5 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{user.name}</h5>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Reg No:</span> {user.reg_no || 'N/A'}
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Institution:</span> {user.institution || 'N/A'}
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1.25rem', padding: '0.5rem' }}
                  onClick={() => router.push(`/profile/${user.username}`)}
                >
                  View My Public Profile
                </button>
              </div>
            ) : (
              <div className="glass card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Welcome to LearnX</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Register today to create study classrooms, share materials, and follow your classmates.
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => router.push('/login')}>
                  Sign In / Register
                </button>
              </div>
            )}

            <div className="glass card" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Quick Actions</h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ textAlign: 'left', width: '100%', fontSize: '0.85rem' }} onClick={() => router.push('/dashboard')}>
                  🏫 Enter Classrooms
                </button>
                <button className="btn btn-secondary" style={{ textAlign: 'left', width: '100%', fontSize: '0.85rem' }} onClick={() => router.push('/communities')}>
                  👥 Explore Communities
                </button>
                <button className="btn btn-secondary" style={{ textAlign: 'left', width: '100%', fontSize: '0.85rem' }} onClick={() => router.push('/chat')}>
                  💬 Direct Messages
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
