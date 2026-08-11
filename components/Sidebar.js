'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Sidebar({ isCollapsed, onToggle }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [classrooms, setClassrooms] = useState([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchSidebarData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      
      if (profile) {
        setUser(profile);

        // 2. Fetch user's classrooms
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
      }
    };

    fetchSidebarData();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const classColors = ['#7A533E', '#8C7A6B', '#C2884E', '#8A6F62', '#A63A26'];

  if (!user) {
    return (
      <aside className="sidebar">
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-mark">L</div>
            <div className="brand-name">LearnX</div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="sidebar-collapse-btn"
            title="Hide Sidebar"
            aria-label="Hide Sidebar"
            style={{ background: 'none', border: 'none', color: '#8FA089', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#EFF6F0'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#8FA089'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="12" x2="6" y2="12"/><polyline points="12 18 6 12 12 6"/></svg>
          </button>
        </div>
        <nav className="tabs">
          <div className="tab-group-label">Overview</div>
          <a className="tab active" href="/login">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Sign In
          </a>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => router.push('/')}>
          <div className="brand-mark">L</div>
          <div className="brand-name">LearnX</div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="sidebar-collapse-btn"
          title="Hide Sidebar"
          aria-label="Hide Sidebar"
          style={{ background: 'none', border: 'none', color: '#8FA089', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#EFF6F0'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8FA089'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="12" x2="6" y2="12"/><polyline points="12 18 6 12 12 6"/></svg>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setMobileMenuOpen(!mobileMenuOpen); }}
          className="mobile-hamburger-btn"
          title="Toggle Menu"
          aria-label="Toggle Menu"
          style={{ background: 'none', border: 'none', color: '#8FA089', cursor: 'pointer', padding: '6px', display: 'none', alignItems: 'center', transition: 'color 0.15s ease' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12"/>
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18"/>
            )}
          </svg>
        </button>
      </div>

      <nav className="tabs">
        <div className="tab-group-label">Overview</div>
        <a 
          className={`tab ${pathname === '/' ? 'active' : ''}`} 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/'); }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          My Classrooms
        </a>
        <a 
          className={`tab ${pathname === '/dashboard' ? 'active' : ''}`} 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
          Dashboard
        </a>
        <a 
          className={`tab ${pathname === '/search' ? 'active' : ''}`} 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/search'); }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Search
        </a>
        <a 
          className={`tab ${pathname === '/communities' ? 'active' : ''}`} 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/communities'); }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Communities
        </a>
        <a 
          className={`tab ${pathname === '/chat' ? 'active' : ''}`} 
          href="#"
          onClick={(e) => { e.preventDefault(); router.push('/chat'); }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chat
        </a>
        


        {user.role === 'Administrator' && (
          <a 
            className={`tab ${pathname === '/admin/backups' ? 'active' : ''}`} 
            href="#"
            onClick={(e) => { e.preventDefault(); router.push('/admin/backups'); }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Admin Panel
          </a>
        )}



        {classrooms.length > 0 && (
          <>
            <div className="tab-group-label">Classes</div>
            {classrooms.map((cls, index) => {
              const isActiveClass = pathname === `/classroom/${cls.id}`;
              const spineColor = classColors[index % classColors.length];
              return (
                <a
                  key={cls.id}
                  className={`tab ${isActiveClass ? 'active' : ''}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/classroom/${cls.id}`);
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: spineColor, flexShrink: 0 }}></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cls.class_name}
                  </span>
                </a>
              );
            })}
          </>
        )}


      </nav>

      <div className="sidebar-foot" style={{ marginTop: 'auto' }}>
        <img
          src={user.avatar_path && user.avatar_path !== '/assets/images/default-avatar.png' ? user.avatar_path : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username || 'user'}`}
          alt="avatar"
          className="avatar-sm"
          style={{ cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.15)' }}
          onClick={() => router.push(`/profile/${user.username}`)}
        />
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/profile/${user.username}`)}>
          <div className="who" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          <div className="role" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user.role}
          </div>
        </div>
        <button 
          onClick={handleLogout}
          aria-label="Sign Out"
          style={{ background: 'none', border: 'none', color: '#8FA089', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#EFF6F0'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8FA089'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>

      {/* Mobile navigation overlay drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-menu" style={{
          position: 'fixed',
          top: '60px',
          left: 0,
          width: '100%',
          height: 'calc(100vh - 60px)',
          background: 'var(--sidebar)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          <nav className="mobile-tabs" style={{ display: 'grid', gap: '0.5rem', flex: 1 }}>
            <div className="tab-group-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Overview</div>
            <a 
              className={`tab ${pathname === '/' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push('/'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              My Classrooms
            </a>
            <a 
              className={`tab ${pathname === '/dashboard' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push('/dashboard'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
              Dashboard
            </a>
            <a 
              className={`tab ${pathname === '/search' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push('/search'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Search
            </a>
            <a 
              className={`tab ${pathname === '/communities' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push('/communities'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Communities
            </a>
            <a 
              className={`tab ${pathname === '/chat' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push('/chat'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Chat
            </a>

            {classrooms.length > 0 && (
              <>
                <div className="tab-group-label" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1rem', marginBottom: '0.5rem' }}>Classes</div>
                {classrooms.map((cls, idx) => (
                  <a
                    key={cls.id}
                    className={`tab ${pathname === `/classroom/${cls.id}` ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); router.push(`/classroom/${cls.id}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--sidebar-text)', textDecoration: 'none', padding: '0.75rem', borderRadius: '6px' }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: classColors[idx % classColors.length] }}></span>
                    {cls.class_name}
                  </a>
                ))}
              </>
            )}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem' }}>
            <img
              src={user.avatar_path && user.avatar_path !== '/assets/images/default-avatar.png' ? user.avatar_path : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username || 'user'}`}
              alt="avatar"
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', color: 'white' }}>{user.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.role}</div>
            </div>
            <button 
              onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
