'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      // Fetch user username to redirect to their public profile
      const { data: profile } = await supabase
        .from('users')
        .select('username')
        .eq('email', session.user.email)
        .single();

      if (profile) {
        router.replace(`/profile/${profile.username}`);
      } else {
        router.replace('/dashboard');
      }
    };

    handleRedirect();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Loading your profile...</h2>
    </div>
  );
}
