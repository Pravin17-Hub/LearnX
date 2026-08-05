'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function PublicTestsPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicQuizzes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*, users(name, username)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching public quizzes:', error);
      } else {
        setQuizzes(data || []);
      }
      setLoading(false);
    };

    fetchPublicQuizzes();
  }, []);

  const copyPublicTestLink = (qId) => {
    const testUrl = `${window.location.origin}/quiz/${qId}`;
    navigator.clipboard.writeText(testUrl).then(() => {
      alert('Test share link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy test link: ', err);
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Public Tests...</h2>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container animate-fade-in">
        
        {/* Banner */}
        <div className="glass card" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)' }}>
          <span className="badge badge-student" style={{ marginBottom: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
            🎓 Global Test Center
          </span>
          <h2 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Public Academic Tests</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            Take combined evaluations, solve questions, and receive detailed AI grading and feedback reports instantly.
          </p>
        </div>

        {/* Tests Grid */}
        {quizzes.length === 0 ? (
          <div className="glass card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📋</span>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No Public Tests</h4>
            <p style={{ fontSize: '0.9rem' }}>No public evaluations have been shared yet. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {quizzes.map((q) => (
              <div key={q.id} className="glass card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className="badge badge-student" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                      ⏱️ {q.duration_minutes} Mins
                    </span>
                    <small style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{q.max_marks} Marks</small>
                  </div>

                  <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{q.title}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {q.description || 'Comprehensive test covering subject principles.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Created by <b>@{q.users?.username || 'Faculty'}</b>
                  </small>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => copyPublicTestLink(q.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} title="Copy Link">
                      Share
                    </button>
                    <button onClick={() => router.push(`/quiz/${q.id}`)} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                      Begin
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
