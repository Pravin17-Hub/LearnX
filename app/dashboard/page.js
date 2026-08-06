'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dashboard states
  const [classrooms, setClassrooms] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  
  // Join/Create Classroom Modals
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [className, setClassName] = useState('');
  const [classSubject, setClassSubject] = useState('');
  const [classDesc, setClassDesc] = useState('');
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      // Fetch user profile from DB
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      
      setUser(profile);

      if (profile) {
        // Fetch Classrooms where user is enrolled or created
        const { data: memberClassrooms } = await supabase
          .from('classroom_members')
          .select('classroom_id')
          .eq('user_id', profile.id);

        const classIds = memberClassrooms?.map(m => m.classroom_id) || [];
        
        let { data: classes } = await supabase
          .from('classrooms')
          .select('*')
          .or(`creator_id.eq.${profile.id},id.in.(${classIds.length ? classIds.join(',') : '-1'})`);
        
        setClassrooms(classes || []);

        // Fetch Global Feed Posts
        const { data: posts } = await supabase
          .from('feed_posts')
          .select('*, users!user_id(name, username, role, avatar_path)')
          .order('created_at', { ascending: false })
          .limit(10);
        
        setFeedPosts(posts || []);
      }
      setLoading(false);
    };

    initDashboard();
  }, []);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: newClass, error } = await supabase
        .from('classrooms')
        .insert({
          class_name: className,
          subject: classSubject,
          description: classDesc,
          join_code: code,
          creator_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Creator automatically joins classroom as faculty
      await supabase.from('classroom_members').insert({
        classroom_id: newClass.id,
        user_id: user.id,
        role_in_class: user.role
      });

      setClassrooms([...classrooms, newClass]);
      setActionSuccess(`Classroom created! Join Code: ${code}`);
      setClassName('');
      setClassSubject('');
      setClassDesc('');
      setTimeout(() => setShowCreateModal(false), 2000);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      // Find classroom by join code
      const { data: targetClass, error: findError } = await supabase
        .from('classrooms')
        .select('*')
        .eq('join_code', joinCode.trim().toUpperCase())
        .maybeSingle();

      if (findError || !targetClass) {
        throw new Error('Classroom not found. Verify the code and try again.');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('classroom_members')
        .select('*')
        .eq('classroom_id', targetClass.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error('You are already a member of this classroom.');
      }

      // Join classroom
      const { error: joinError } = await supabase
        .from('classroom_members')
        .insert({
          classroom_id: targetClass.id,
          user_id: user.id,
          role_in_class: user.role
        });

      if (joinError) throw joinError;

      setClassrooms([...classrooms, targetClass]);
      setActionSuccess(`Joined ${targetClass.class_name} successfully!`);
      setJoinCode('');
      setTimeout(() => setShowJoinModal(false), 2000);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    try {
      const { data: newPost, error } = await supabase
        .from('feed_posts')
        .insert({
          user_id: user.id,
          title: newPostTitle.trim() || 'Untitled Post',
          content: newPostContent.trim(),
          type: 'text'
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

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)', fontFamily: 'Fraunces, serif' }}>Loading Dashboard...</h2>
      </div>
    );
  }

  // Get current date string in custom format
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const classColors = ['#7A533E', '#8C7A6B', '#C2884E', '#8A6F62', '#A63A26'];
  const avatarUrl = user?.avatar_path && user.avatar_path !== '/assets/images/default-avatar.png'
    ? user.avatar_path
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}`;

  return (
    <div>
      <Navbar /> {/* Renders null to keep LayoutShell sidebar structure clean */}
      
      {/* ================= TOPBAR ================= */}
      <div className="topbar">
        <div className="greeting">
          <div className="greeting-eyebrow">{formattedDate}</div>
          <h1>{getGreeting()}, {user?.name.split(' ')[0]}</h1>
          <div className="sub">Track your progress, join discussions, or submit assignment files.</div>
        </div>
        <div className="top-actions">
          <div className="search-bar-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="text" placeholder="Search classes, people, files" onClick={() => router.push('/search')} readOnly style={{ cursor: 'pointer' }} />
          </div>
          <button className="icon-btn" aria-label="Inbox Messages" onClick={() => router.push('/chat')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="dot"></span>
          </button>
          <img 
            src={avatarUrl} 
            alt="avatar" 
            className="avatar-nav" 
            style={{ cursor: 'pointer' }} 
            onClick={() => router.push(`/profile/${user?.username}`)} 
          />
        </div>
      </div>

      {/* ================= USER STATS / STREAKS ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
          <span style={{ fontSize: '2.3rem' }}>🔥</span>
          <div>
            <h4 style={{ color: 'var(--ink-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>LEARNING STREAK</h4>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.learning_streak || 0} Days</p>
          </div>
        </div>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
          <span style={{ fontSize: '2.3rem' }}>🏆</span>
          <div>
            <h4 style={{ color: 'var(--ink-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>CONTRIBUTION SCORE</h4>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>{user?.contribution_score || 0} Pts</p>
          </div>
        </div>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
          <span style={{ fontSize: '2.3rem' }}>🏫</span>
          <div>
            <h4 style={{ color: 'var(--ink-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>ACTIVE CLASSROOMS</h4>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>{classrooms.length} Enrolled</p>
          </div>
        </div>
      </div>

      {/* ================= MAIN GRID ================= */}
      <div className="dashboard-grid">
        
        {/* Left Column - Classrooms List */}
        <div>
          <div className="section-head" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
              📚 My Classrooms
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowJoinModal(true)}>
                Join
              </button>
              {(user?.role === 'Faculty' || user?.role === 'Administrator') && (
                <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowCreateModal(true)}>
                  + Create
                </button>
              )}
            </div>
          </div>

          {classrooms.length === 0 ? (
            <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Not enrolled in any classrooms yet. Click 'Join' to enter a class join code.
            </div>
          ) : (
            classrooms.map((cls, index) => {
              const spineColor = classColors[index % classColors.length];
              return (
                <div
                  key={cls.id}
                  className="course-card"
                  onClick={() => router.push(`/classroom/${cls.id}`)}
                  style={{ 
                    '--spine': spineColor,
                    marginBottom: '1rem',
                    padding: '16px 16px 14px 20px'
                  }}
                >
                  <div className="fold"></div>
                  <div className="course-code mono">{cls.subject}</div>
                  <h4 className="course-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{cls.class_name}</h4>
                  <div className="course-teacher" style={{ fontSize: '12px', marginTop: '0.4rem', marginBottom: 0 }}>
                    Code: <span className="mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{cls.join_code}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Main Panel - Social Feed */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📣 Social Feed
          </h3>
          
          {/* Create Post Form */}
          <form onSubmit={handleCreatePost} className="panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.8rem', fontFamily: 'var(--font-serif)' }}>Share with the community</h4>
            <input
              type="text"
              placeholder="Post title (optional)..."
              className="input"
              style={{ marginBottom: '0.8rem', background: '#FFFFFF' }}
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
            />
            <textarea
              placeholder="Share resources, questions, or updates with the community..."
              className="input"
              style={{ minHeight: '80px', resize: 'vertical', marginBottom: '0.8rem', background: '#FFFFFF' }}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem' }}>
                Share Post
              </button>
            </div>
          </form>

          {/* Feed List */}
          {feedPosts.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No community announcements or feed posts yet.
            </div>
          ) : (
            feedPosts.map((post) => {
              const postAvatarUrl = post.users?.avatar_path && post.users.avatar_path !== '/assets/images/default-avatar.png'
                ? post.users.avatar_path
                : `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.users?.username || 'user'}`;
              return (
                <div key={post.id} className="panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <img
                      src={postAvatarUrl}
                      alt="avatar"
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{post.users?.name}</span>
                        <span className="badge badge-student" style={{ fontSize: '0.65rem' }}>
                          {post.users?.role}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{post.users?.username} • {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{post.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', margin: 0 }}>{post.content}</p>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ================= JOIN CLASSROOM MODAL ================= */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>Join Classroom</h3>
            {actionError && <div className="alert alert-error">{actionError}</div>}
            {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}
            <form onSubmit={handleJoinClass}>
              <div className="input-group">
                <label className="label">Classroom Join Code</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="E.g. A9XF7K"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CREATE CLASSROOM MODAL ================= */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '550px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>Create New Classroom</h3>
            {actionError && <div className="alert alert-error">{actionError}</div>}
            {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}
            <form onSubmit={handleCreateClass}>
              <div className="input-group">
                <label className="label">Class Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="E.g. Advanced Operating Systems"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Subject Area</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="E.g. Computer Science"
                  value={classSubject}
                  onChange={(e) => setClassSubject(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="Brief description of the course..."
                  value={classDesc}
                  onChange={(e) => setClassDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
