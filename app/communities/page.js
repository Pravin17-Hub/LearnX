'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function CommunitiesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Community creation states
  const [isCreating, setIsCreating] = useState(false);
  const [commName, setCommName] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commCategory, setCommCategory] = useState('Computer Science');
  const [createProgress, setCreateProgress] = useState(false);

  const fetchCommunitiesData = async () => {
    setLoading(true);
    
    // 1. Get logged-in user details
    const { data: { session } } = await supabase.auth.getSession();
    let loggedInUser = null;
    if (session) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      setCurrentUser(profile);
      loggedInUser = profile;
    }

    // 2. Fetch communities
    const { data: comms } = await supabase
      .from('subject_communities')
      .select('*')
      .order('created_at', { ascending: false });
    setCommunities(comms || []);

    // 3. Fetch joined communities
    if (loggedInUser) {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', loggedInUser.id);
      
      const joinedIds = new Set(memberships?.map(m => m.community_id) || []);
      setJoinedCommunityIds(joinedIds);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCommunitiesData();
  }, []);

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!commName.trim() || !currentUser) return;

    setCreateProgress(true);
    try {
      // 1. Insert community
      const { data: newComm, error } = await supabase
        .from('subject_communities')
        .insert({
          name: commName.trim(),
          description: commDesc.trim(),
          category: commCategory,
          moderator_id: currentUser.id,
          member_count: 1
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Insert creator as community member
      await supabase
        .from('community_members')
        .insert({
          community_id: newComm.id,
          user_id: currentUser.id
        });

      setIsCreating(false);
      setCommName('');
      setCommDesc('');
      await fetchCommunitiesData();
    } catch (err) {
      alert(`Error creating community: ${err.message}`);
    }
    setCreateProgress(false);
  };

  const handleJoinToggle = async (community) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    const isJoined = joinedCommunityIds.has(community.id);
    try {
      if (isJoined) {
        // Leave
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', community.id)
          .eq('user_id', currentUser.id);

        await supabase
          .from('subject_communities')
          .update({ member_count: Math.max(0, community.member_count - 1) })
          .eq('id', community.id);

        setJoinedCommunityIds(prev => {
          const next = new Set(prev);
          next.delete(community.id);
          return next;
        });
      } else {
        // Join
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

        setJoinedCommunityIds(prev => {
          const next = new Set(prev);
          next.add(community.id);
          return next;
        });
      }
      
      // Refresh database records
      const { data: freshComms } = await supabase
        .from('subject_communities')
        .select('*')
        .order('created_at', { ascending: false });
      setCommunities(freshComms || []);
    } catch (err) {
      console.error(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Communities...</h2>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
        
        {/* Header card */}
        <div className="glass card" style={{ padding: '2rem 2.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>👥 Communities & Groups</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Join subject networks to share notes, projects, and chat in groups.</p>
          </div>
          {currentUser && (
            <button className="btn btn-primary" onClick={() => setIsCreating(true)} style={{ padding: '0.6rem 1.5rem' }}>
              ➕ Create Community
            </button>
          )}
        </div>

        {/* Communities List Grid */}
        {communities.length === 0 ? (
          <div className="glass card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No subject communities created yet. Be the first to start one!
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {communities.map((comm) => {
              const isMember = joinedCommunityIds.has(comm.id);
              return (
                <div key={comm.id} className="glass card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{comm.name}</h3>
                      <span className="badge badge-student" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)', fontSize: '0.65rem' }}>
                        {comm.category}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{comm.description}</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      👥 <strong>{comm.member_count}</strong> Members
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleJoinToggle(comm)}
                      className={`btn ${isMember ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                    >
                      {isMember ? '✓ Joined' : 'Join'}
                    </button>
                    {isMember && (
                      <button
                        onClick={() => router.push(`/community/${comm.id}`)}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'var(--color-secondary)' }}
                      >
                        💬 Chat & Share
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* CREATE COMMUNITY MODAL */}
      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass card" style={{ maxWidth: '500px', width: '100%', padding: '2rem', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>➕ Create New Community</h3>
            <form onSubmit={handleCreateCommunity} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <label className="label">Community Name</label>
                <input type="text" className="input" placeholder="e.g. Java Developers Group" required value={commName} onChange={(e) => setCommName(e.target.value)} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={commCategory} onChange={(e) => setCommCategory(e.target.value)}>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="General Science">General Science</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" placeholder="Give brief details about what members will share and discuss..." style={{ minHeight: '80px' }} value={commDesc} onChange={(e) => setCommDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" disabled={createProgress} onClick={() => setIsCreating(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createProgress}>
                  {createProgress ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
