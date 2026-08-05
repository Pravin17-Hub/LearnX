'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Get current user session
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch custom user profile info
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();
        setUser(profile || user);
      }
    };
    fetchUser();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getRoleBadge = (role) => {
    if (!role) return '';
    const name = role.toLowerCase();
    if (name === 'administrator') return <span className="badge badge-admin">Admin</span>;
    if (name === 'faculty') return <span className="badge badge-faculty">Faculty</span>;
    return <span className="badge badge-student">{role}</span>;
  };

  return (
    <nav className="navbar">
      <a href="/dashboard" className="logo">
        🚀 LearnX
      </a>
      
      {user ? (
        <ul className="nav-links">
          <li>
            <a href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </a>
          </li>
          {user?.role === 'Administrator' && (
            <li>
              <a href="/admin/backups" className={`nav-link ${pathname === '/admin/backups' ? 'active' : ''}`}>
                🛡️ Admin Panel
              </a>
            </li>
          )}
          <li>
            <a href="/communities" className={`nav-link ${pathname === '/communities' ? 'active' : ''}`}>
              Communities
            </a>
          </li>
          <li>
            <a href="/search" className={`nav-link ${pathname === '/search' ? 'active' : ''}`}>
              Search
            </a>
          </li>
          <li>
            <a href="/chat" className={`nav-link ${pathname === '/chat' ? 'active' : ''}`}>
              Chat
            </a>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginLeft: '1rem', cursor: 'pointer' }} onClick={() => router.push('/profile')}>
            <img
              src={user.avatar_path && user.avatar_path !== '/assets/images/default-avatar.png' ? user.avatar_path : `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username || 'user'}`}
              alt="avatar"
              style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--color-primary)', objectFit: 'cover' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name || user.email.split('@')[0]}</span>
              <span style={{ fontSize: '0.7rem' }}>{getRoleBadge(user.role)}</span>
            </div>
          </li>
          <li>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              Log Out
            </button>
          </li>
        </ul>
      ) : (
        <ul className="nav-links">
          <li>
            <a href="/login" className="btn btn-primary" style={{ padding: '0.4rem 1rem' }}>
              Sign In
            </a>
          </li>
        </ul>
      )}
    </nav>
  );
}
