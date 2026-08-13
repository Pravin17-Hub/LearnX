'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function AIEvaluatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingSubs, setPendingSubs] = useState([]);

  useEffect(() => {
    const fetchPendingSubmissions = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      setUser(profile);

      if (profile) {
        if (profile.role !== 'Faculty' && profile.role !== 'Administrator') {
          router.push('/dashboard');
          return;
        }

        // Fetch submissions that are pending review for assignments created by this user
        const { data: teacherAssignments } = await supabase
          .from('assignments')
          .select('id')
          .eq('creator_id', profile.id);

        const assignmentIds = teacherAssignments?.map(a => a.id) || [];

        if (assignmentIds.length > 0) {
          const { data: subs, error } = await supabase
            .from('assignment_submissions')
            .select('*, users(name, username), assignments(title, max_marks)')
            .eq('review_status', 'PENDING')
            .in('assignment_id', assignmentIds)
            .order('submitted_at', { ascending: true });

          setPendingSubs(subs || []);
        } else {
          setPendingSubs([]);
        }
      }
      setLoading(false);
    };

    fetchPendingSubmissions();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Evaluator Inbox...</h2>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container animate-fade-in">
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            🤖 AI Grading Inbox
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Review pending assignment submissions that have been auto-evaluated by the AI system.
          </p>
        </div>

        {pendingSubs.length === 0 ? (
          <div className="glass card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>All Caught Up!</h4>
            <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>No student submissions are currently pending review.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {pendingSubs.map((sub) => (
              <div
                key={sub.id}
                onClick={() => router.push(`/assignment/${sub.assignment_id}`)}
                className="glass card"
                style={{
                  cursor: 'pointer',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'var(--transition)',
                }}
              >
                <div>
                  <span className="badge badge-student" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)' }}>
                    {sub.assignments?.title}
                  </span>
                  <h4 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {sub.users?.name || 'Unknown Student'}
                  </h4>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI MARKS</span>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-secondary)' }}>
                      {sub.ai_marks}/{sub.assignments?.max_marks}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CONFIDENCE</span>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)' }}>
                      {sub.confidence_score}%
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.2rem' }}>&rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
