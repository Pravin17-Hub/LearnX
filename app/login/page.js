'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Student');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [regNo, setRegNo] = useState('');

  useEffect(() => {
    // Check if user is already authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      }
    };
    checkUser();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      if (isLogin) {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Fetch user from profile table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (profileError || !profile) {
          // Fallback if record doesn't exist in profile table: create a minimal record
          const defaultUsername = email.split('@')[0] + Math.floor(Math.random() * 1000);
          await supabase.from('users').insert({
            name: email.split('@')[0],
            username: defaultUsername,
            email: email,
            password_hash: 'auth_managed',
            role: 'Student',
            reg_no: 'N/A',
          });
        }

        setMessage('Logged in successfully! Redirecting...');
        setTimeout(() => router.push('/'), 1000);
      } else {
        // Sign Up
        if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/)) {
          throw new Error('Please enter a valid email address.');
        }
        if (username.length < 3) {
          throw new Error('Username must be at least 3 characters.');
        }

        // Check if username is taken in users table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (existingUser) {
          throw new Error('Username is already taken.');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        // Insert custom user profile metadata into database
        const { error: insertError } = await supabase.from('users').insert({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password_hash: 'auth_managed', // Password is managed securely by Supabase Auth
          role: role,
          institution: institution.trim(),
          department: department.trim(),
          reg_no: regNo.trim(),
        });

        if (insertError) throw insertError;

        setMessage('Registration successful! You can now log in.');
        setIsLogin(true);
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.15), transparent), radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.15), transparent)', padding: '1rem' }}>
      <div className="glass animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginContent: '0.5rem' }}>
            🚀 LearnX
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isLogin ? 'Welcome back! Log in to access your classes.' : 'Create an account and start learning.'}
          </p>
        </div>

        {message && (
          <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`} style={{ fontSize: '0.85rem' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {!isLogin && (
            <>
              <div className="input-group">
                <label className="label">Full Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="label">Register Number</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. 21100125"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="label">Username</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="label">Role</label>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                </select>
              </div>

              <div className="input-group">
                <label className="label">Institution</label>
                <input
                  type="text"
                  className="input"
                  placeholder="University Name"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Computer Science"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label className="label">Email Address</label>
            <input
              type="email"
              required
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '2rem' }}>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginBottom: '1.25rem' }}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage(null);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>

      </div>
    </div>
  );
}
