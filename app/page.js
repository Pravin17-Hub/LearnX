'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function MyClassroomsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState([]);

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
    const initClassrooms = async () => {
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
        .maybeSingle();
      
      if (!profile) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }
      
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
          .select('*, creator:users!creator_id(name)')
          .or(`creator_id.eq.${profile.id},id.in.(${classIds.length ? classIds.join(',') : '-1'})`);
        
        setClassrooms(classes || []);
      }
      setLoading(false);
    };

    initClassrooms();
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
          subject: user?.department || 'General',
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
      setTimeout(() => setShowCreateModal(false), 1500);
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
      setTimeout(() => setShowJoinModal(false), 1500);
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Classrooms...</h2>
      </div>
    );
  }

  const classColors = ['#7A533E', '#8C7A6B', '#C2884E', '#8A6F62', '#A63A26'];

  return (
    <div>
      <Navbar />
      <div className="container" style={{ maxWidth: '1200px' }}>
        
        {/* Banner Section */}
        <div className="glass card" style={{ padding: '2.5rem', marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '4px solid var(--color-primary)' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              🏫 My Classrooms
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
              Access your enrolled classrooms, view evaluations, and participate in discussion forums.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.8rem 1.8rem', fontSize: '0.95rem', fontWeight: 'bold' }} onClick={() => setShowJoinModal(true)}>
              🔗 Join Classroom
            </button>
            {(user?.role === 'Faculty' || user?.role === 'Administrator') && (
              <button className="btn btn-primary" style={{ padding: '0.8rem 1.8rem', fontSize: '0.95rem', fontWeight: 'bold' }} onClick={() => setShowCreateModal(true)}>
                ➕ Create Classroom
              </button>
            )}
          </div>
        </div>

        {/* Classrooms Grid */}
        {classrooms.length === 0 ? (
          <div className="glass card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1.5rem' }}>📚</span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Enrolled Classrooms</h3>
            <p style={{ fontSize: '0.95rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
              You are not enrolled in any classes yet. Get a join code from your instructor to get started.
            </p>
            <button className="btn btn-primary" onClick={() => setShowJoinModal(true)}>
              Join a Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {classrooms.map((cls, index) => {
              const spineColor = classColors[index % classColors.length];
              return (
                <div
                  key={cls.id}
                  className="course-card"
                  onClick={() => router.push(`/classroom/${cls.id}`)}
                  style={{ 
                    '--spine': spineColor,
                    padding: '24px 24px 20px 28px',
                    cursor: 'pointer',
                    minHeight: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div className="fold"></div>
                  <div>
                    <div className="course-code mono" style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, marginBottom: '0.4rem' }}>
                      {cls.subject}
                    </div>
                    <h4 className="course-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: '1.2', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
                      {cls.class_name}
                    </h4>
                    {cls.creator?.name && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Faculty: {cls.creator.name}
                      </div>
                    )}
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {cls.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Join Code: <strong className="mono" style={{ color: 'var(--color-primary)' }}>{cls.join_code}</strong>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      Enter Class →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ================= JOIN CLASSROOM MODAL ================= */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="glass modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Join Classroom</h3>
            {actionError && <div className="alert alert-error">{actionError}</div>}
            {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}
            <form onSubmit={handleJoinClass}>
              <div className="input-group">
                <label className="label">Classroom Code</label>
                <input
                  type="text"
                  required
                  className="input mono"
                  placeholder="Enter 6-char code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Create New Classroom</h3>
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
