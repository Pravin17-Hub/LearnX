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
  const [dueSoon, setDueSoon] = useState([]);
  
  // Todo list states
  const [todos, setTodos] = useState([]);
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoCourse, setNewTodoCourse] = useState('');

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
        
        const fetchedClasses = classes || [];
        setClassrooms(fetchedClasses);

        // Fetch due assignments for user's classrooms
        if (classIds.length > 0) {
          const { data: assigns } = await supabase
            .from('assignments')
            .select('*, classrooms(class_name)')
            .in('classroom_id', classIds)
            .order('deadline', { ascending: true })
            .limit(5);
          
          setDueSoon(assigns || []);
        }
      }
      setLoading(false);
    };

    initDashboard();
  }, []);

  // Load and save todos using localStorage
  useEffect(() => {
    const saved = localStorage.getItem('learnx_todos');
    if (saved) {
      setTodos(JSON.parse(saved));
    } else {
      const defaultTodos = [
        { id: 1, text: 'Email TA about lab makeup slot', course: 'Cell Biology II', done: true },
        { id: 2, text: 'Print handout for peer review', course: 'Design Systems', done: false },
        { id: 3, text: 'Book library room for group study', course: 'Applied Statistics', done: false },
        { id: 4, text: 'Reread Bishop poem before Friday', course: 'Modern Poetry', done: false }
      ];
      setTodos(defaultTodos);
      localStorage.setItem('learnx_todos', JSON.stringify(defaultTodos));
    }
  }, []);

  const saveTodos = (newTodos) => {
    setTodos(newTodos);
    localStorage.setItem('learnx_todos', JSON.stringify(newTodos));
  };

  const toggleTodo = (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    saveTodos(updated);
  };

  const deleteTodo = (id) => {
    const updated = todos.filter(t => t.id !== id);
    saveTodos(updated);
  };

  const handleAddTodoSubmit = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const item = {
      id: Date.now(),
      text: newTodoText.trim(),
      course: newTodoCourse.trim() || 'General',
      done: false
    };
    const updated = [...todos, item];
    saveTodos(updated);
    setNewTodoText('');
    setNewTodoCourse('');
    setShowAddTodo(false);
  };

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

  // Calculate dynamic due tasks count
  const overdueCount = dueSoon.filter(a => new Date(a.deadline) < new Date()).length;
  const activeDueCount = dueSoon.length;

  // Build the list of displayable due soon rows
  const displayDueSoon = dueSoon.length > 0 ? dueSoon.map(assign => {
    const deadlineDate = new Date(assign.deadline);
    const isOverdue = deadlineDate < new Date();
    const diffTime = Math.abs(deadlineDate - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let stampText = '';
    let isSoon = true;
    if (isOverdue) {
      stampText = 'Overdue';
      isSoon = false;
    } else if (diffDays <= 1) {
      stampText = 'Due today';
    } else {
      stampText = `${diffDays} days`;
    }
    
    return {
      id: assign.id,
      title: assign.title,
      course: assign.classrooms?.class_name || 'Classroom',
      dateText: deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      stamp: stampText,
      isSoon: isSoon
    };
  }) : [
    { id: 'mock-1', title: 'Reading response — Ch. 4', course: 'Modern Poetry', dateText: 'Aug 4', stamp: 'Overdue', isSoon: false },
    { id: 'mock-2', title: 'Problem set 3 — regression models', course: 'Applied Statistics', dateText: '11:59 PM', stamp: 'Due today', isSoon: true },
    { id: 'mock-3', title: 'Component audit — case study draft', course: 'Design Systems', dateText: 'Aug 8', stamp: '2 days', isSoon: true },
    { id: 'mock-4', title: 'Lab report — mitosis observation', course: 'Cell Biology II', dateText: 'Aug 11', stamp: '5 days', isSoon: true }
  ];

  const classColors = ['#2F6F4E', '#4C6E91', '#E2963A', '#6B4C7A', '#C4573A'];
  const avatarUrl = user?.avatar_path && user.avatar_path !== '/assets/images/default-avatar.png'
    ? user.avatar_path
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'user'}`;

  return (
    <div>
      <Navbar /> {/* Renders null, keeping page layout correct */}
      
      {/* ================= TOPBAR ================= */}
      <div className="topbar">
        <div className="greeting">
          <div className="greeting-eyebrow">{formattedDate}</div>
          <h1>{getGreeting()}, {user?.name.split(' ')[0]}</h1>
          <div className="sub">
            {overdueCount > 0 ? `${overdueCount} items overdue · ` : ''}
            {activeDueCount > 0 ? `${activeDueCount} total assignments pending` : 'All caught up on assignments'}
          </div>
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

      {/* ================= CLASSES SECTION ================= */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div className="section-head">
          <h2>Your classes</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="join-btn" onClick={() => setShowJoinModal(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Join a class
            </button>
            {(user?.role === 'Faculty' || user?.role === 'Administrator') && (
              <button className="join-btn" style={{ background: 'var(--forest-dark)' }} onClick={() => setShowCreateModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Create a class
              </button>
            )}
          </div>
        </div>

        {classrooms.length === 0 ? (
          <div className="panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-soft)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎒</span>
            <p style={{ fontWeight: 500 }}>No classrooms found.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Click "Join a class" above to enroll in your courses using a code.</p>
          </div>
        ) : (
          <div className="course-grid">
            {classrooms.map((cls, index) => {
              const spineColor = classColors[index % classColors.length];
              
              // Calculate semi-random realistic values for progress metrics based on class ID
              const progressPercent = (cls.class_name.length * 7) % 50 + 40; 
              const doneCount = Math.round((progressPercent / 100) * 10);
              
              return (
                <div 
                  key={cls.id} 
                  className="course-card" 
                  style={{ '--spine': spineColor }}
                  onClick={() => router.push(`/classroom/${cls.id}`)}
                >
                  <div className="fold"></div>
                  <div className="course-code mono">{cls.subject || 'CLASS'} • Code: {cls.join_code}</div>
                  <h3 className="course-title">{cls.class_name}</h3>
                  <div className="course-teacher">{cls.description || 'No course overview provided.'}</div>
                  
                  <div className="course-meta">
                    <div className="progress-wrap">
                      <div className="progress-label">
                        <span>{doneCount} of 10 done</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progressPercent}%`, background: spineColor }}></div>
                      </div>
                    </div>
                    <div className="avatars-stack">
                      <span style={{ background: '#2F6F4E' }}></span>
                      <span style={{ background: '#E2963A' }}></span>
                      <span style={{ background: '#4C6E91' }}></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= LOWER GRID (DUE SOON + TO-DO) ================= */}
      <section className="lower-grid" id="todo">
        
        {/* Due Soon Panel */}
        <div className="panel">
          <div className="section-head">
            <h2 style={{ fontSize: '17px' }}>Due soon</h2>
            <a className="link-btn" href="#" onClick={(e) => { e.preventDefault(); router.push('/search'); }}>View all →</a>
          </div>
          
          <div style={{ paddingBottom: '14px' }}>
            {displayDueSoon.map((item) => (
              <div key={item.id} className="due-row">
                <div className={`stamp ${item.isSoon ? 'soon' : ''}`}>
                  {item.stamp}
                </div>
                <div className="due-info">
                  <div className="due-title">{item.title}</div>
                  <div className="due-sub">
                    {item.course}
                  </div>
                </div>
                <div className="due-date">{item.dateText}</div>
              </div>
            ))}
          </div>
        </div>

        {/* To-Do Panel */}
        <div className="panel">
          <div className="section-head">
            <h2 style={{ fontSize: '17px' }}>To-do</h2>
            <button className="link-btn" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => setShowAddTodo(true)}>
              Add task
            </button>
          </div>

          <div style={{ paddingBottom: '14px' }}>
            {todos.map((todo) => (
              <div key={todo.id} className="todo-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                  <div 
                    className={`checkbox ${todo.done ? 'done' : ''}`}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    {todo.done && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M5 12l5 5 9-9"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className={`todo-text ${todo.done ? 'done' : ''}`}>{todo.text}</div>
                    <div className="todo-course">{todo.course}</div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteTodo(todo.id)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', opacity: 0.5, fontSize: '1.1rem' }}
                  title="Delete task"
                >
                  ×
                </button>
              </div>
            ))}

            {todos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
                No tasks to do! Add a task above.
              </div>
            )}
          </div>
        </div>

      </section>

      {/* ================= JOIN CLASSROOM MODAL ================= */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Join Classroom</h3>
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Create New Classroom</h3>
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

      {/* ================= ADD TODO MODAL ================= */}
      {showAddTodo && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>Add To-Do Task</h3>
            <form onSubmit={handleAddTodoSubmit}>
              <div className="input-group">
                <label className="label">Task Description</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="E.g. Prepare presentation slides"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">Class / Context</label>
                <input
                  type="text"
                  className="input"
                  placeholder="E.g. Design Systems"
                  value={newTodoCourse}
                  onChange={(e) => setNewTodoCourse(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTodo(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
