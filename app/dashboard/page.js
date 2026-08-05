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

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container">
        
        {/* Welcome Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Welcome back, {user?.name}!
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Track your progress, join discussions, or submit assignment files.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>
              Join Class
            </button>
            {(user?.role === 'Faculty' || user?.role === 'Administrator') && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                + Create Class
              </button>
            )}
          </div>
        </div>

        {/* User Stats / Streaks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="glass card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🔥</span>
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>LEARNING STREAK</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.learning_streak || 0} Days</p>
            </div>
          </div>
          <div className="glass card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🏆</span>
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>CONTRIBUTION SCORE</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.contribution_score || 0} Pts</p>
            </div>
          </div>
          <div className="glass card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🏫</span>
            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ACTIVE CLASSROOMS</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{classrooms.length} Enrolled</p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">
          
          {/* Left Sidebar - Classrooms */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              📚 My Classrooms
            </h3>
            {classrooms.length === 0 ? (
              <div className="glass card" style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Not enrolled in any classrooms yet. Click 'Join Class' to enter a class join code.
              </div>
            ) : (
              classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="glass card"
                  onClick={() => router.push(`/classroom/${cls.id}`)}
                  style={{ cursor: 'pointer', padding: '1.2rem', borderLeft: '4px solid var(--color-primary)' }}
                >
                  <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cls.class_name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cls.subject}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', fontWeight: 600 }}>Code: {cls.join_code}</span>
                </div>
              ))
            )}
          </div>

          {/* Right Main Panel - Social Feed */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>📣 Social Feed</h3>
            
            {/* Create Post Card */}
            <form onSubmit={handleCreatePost} className="glass card" style={{ marginBottom: '1.5rem' }}>
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
              <div className="glass card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No community announcements or feed posts yet.
              </div>
            ) : (
              feedPosts.map((post) => (
                <div key={post.id} className="glass card animate-fade-in" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <img
                      src={post.users?.avatar_path || '/assets/images/default-avatar.png'}
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

                  <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{post.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Join Classroom Modal */}
        {showJoinModal && (
          <div className="modal-overlay">
            <div className="glass modal-content">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Join Classroom</h3>
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
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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

        {/* Create Classroom Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '550px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Create New Classroom</h3>
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
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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
    </div>
  );
}
