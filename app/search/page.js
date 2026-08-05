'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function GlobalSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('people'); // 'people' | 'notes' | 'classrooms'
  const [loading, setLoading] = useState(false);

  // Search Results
  const [people, setPeople] = useState([]);
  const [notes, setNotes] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  useEffect(() => {
    if (!query.trim()) {
      setPeople([]);
      setNotes([]);
      setClassrooms([]);
      return;
    }

    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSearch = async () => {
    setLoading(true);
    const searchVal = `%${query.trim().toLowerCase()}%`;

    try {
      if (activeTab === 'people') {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, username, role, avatar_path, institution')
          .or(`name.ilike.${searchVal},username.ilike.${searchVal}`)
          .limit(20);
        setPeople(users || []);
      } else if (activeTab === 'notes') {
        const { data: mats } = await supabase
          .from('materials')
          .select('*, users(name, username)')
          .or(`title.ilike.${searchVal},description.ilike.${searchVal}`)
          .not('category', 'like', 'Private%')
          .limit(20);
        setNotes(mats || []);
      } else if (activeTab === 'classrooms') {
        const { data: comms } = await supabase
          .from('subject_communities')
          .select('*')
          .or(`name.ilike.${searchVal},description.ilike.${searchVal}`)
          .limit(20);
        setClassrooms(comms || []);
      }
    } catch (err) {
      console.error('Search error:', err.message);
    }
    setLoading(false);
  };

  // Re-trigger search when tab changes
  useEffect(() => {
    if (query.trim()) {
      handleSearch();
    }
  }, [activeTab]);

  const getAvatarUrl = (peer) => {
    return peer.avatar_path && peer.avatar_path !== '/assets/images/default-avatar.png'
      ? peer.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${peer.username}`;
  };

  return (
    <div>
      <Navbar />
      <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
        
        {/* Search Header */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            🔍 Search LearnX
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Find classmates, study notes, or active communities in your network.
          </p>
          <input
            type="text"
            className="input"
            style={{ maxWidth: '500px', margin: '0 auto', fontSize: '1.1rem', padding: '0.8rem 1.5rem', background: '#FFFFFF' }}
            placeholder="Type search terms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '2rem', justifyContent: 'center' }}>
          {['people', 'notes', 'classrooms'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--text-secondary)',
                paddingBottom: '1rem',
                borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : '3px solid transparent',
                fontWeight: 650,
                fontSize: '1rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'var(--transition)'
              }}
            >
              {tab === 'notes' ? 'Notes & Materials' : tab === 'classrooms' ? 'communities' : tab}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Searching...
          </div>
        )}

        {/* Search Results */}
        {!loading && query.trim() && (
          <div>
            
            {/* 1. People Tab */}
            {activeTab === 'people' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {people.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No people match your search query.</p>
                ) : (
                  people.map((peer) => (
                    <div
                      key={peer.id}
                      onClick={() => router.push(`/profile/${peer.username}`)}
                      className="glass card"
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer' }}
                    >
                      <img
                        src={getAvatarUrl(peer)}
                        alt="avatar"
                        style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {peer.name} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>@{peer.username}</span>
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {peer.role} {peer.institution && `• ${peer.institution}`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. Notes Tab */}
            {activeTab === 'notes' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {notes.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No study notes match your search query.</p>
                ) : (
                  notes.map((mat) => (
                    <div key={mat.id} className="glass card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-student" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)' }}>
                          {mat.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Uploaded by @{mat.users?.username}
                        </span>
                      </div>
                      <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0.2rem 0' }}>{mat.title}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{mat.description}</p>
                      {mat.file_path && (
                        <a
                          href={mat.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}
                        >
                          📄 Download Note
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3. Communities Tab */}
            {activeTab === 'classrooms' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {classrooms.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No communities match your search query.</p>
                ) : (
                  classrooms.map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => router.push(`/community/${cls.id}`)}
                      className="glass card"
                      style={{ cursor: 'pointer', padding: '1.2rem', borderLeft: '4px solid var(--color-primary)' }}
                    >
                      <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cls.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0' }}>{cls.description}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', fontWeight: 600 }}>Category: {cls.category} • {cls.member_count} Members</span>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

        {/* Empty Query Prompt */}
        {!query.trim() && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Please type in the input box above to search for people, notes, or communities.
          </div>
        )}

      </div>
    </div>
  );
}
