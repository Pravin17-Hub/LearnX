'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function AdminBackupsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Backups lists & status
  const [backups, setBackups] = useState([]);
  const [fetchingBackups, setFetchingBackups] = useState(false);
  const [actionProgress, setActionProgress] = useState(null); // 'backing_up' | 'restoring' | 'deleting' | null
  const [message, setMessage] = useState({ text: '', isError: false });

  // Security Tests states
  const [securityTests, setSecurityTests] = useState([]);
  const [runningTests, setRunningTests] = useState(false);
  const [securityScore, setSecurityScore] = useState(null);

  // File Upload
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (error || !profile || profile.role !== 'Administrator') {
      alert('Access Denied: Only Administrators are allowed here.');
      router.push('/dashboard');
      return;
    }

    setUser(profile);
    setAuthorized(true);
    setLoading(false);
    
    // Load backups and run security tests initially
    fetchBackupsList();
    runSecuritySuite();
  };

  const fetchBackupsList = async () => {
    setFetchingBackups(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/admin/backup', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to retrieve backup files.');
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setFetchingBackups(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (actionProgress) return;
    setActionProgress('backing_up');
    showMsg('Initializing manual database snapshot...', false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate backup.');
      }

      showMsg('Backup completed and saved locally on the server!', false);
      fetchBackupsList();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setActionProgress(null);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (actionProgress) return;
    if (!confirm(`Are you sure you want to permanently delete the backup file "${filename}"?`)) return;

    setActionProgress('deleting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/backup?filename=${filename}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete backup.');
      }

      showMsg(`Backup ${filename} deleted successfully.`, false);
      fetchBackupsList();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setActionProgress(null);
    }
  };

  const handleDownloadBackupFile = async (filename) => {
    // Read the backup and download it in-browser
    // We can fetch the list, but let's read the file content
    showMsg(`Preparing download for ${filename}...`, false);
    try {
      // Direct file downloading - since backups are server-side json, we read it
      // Let's create a temporary link to download it or fetch and download
      // We will define an endpoint, wait, we can just let it fetch
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Fetch the actual file content to download
      // Since it's stored on server, we can retrieve list, but wait, let's create a downloader or download JSON
      // Actually, since we only list backups, we can read file by writing a route or read it.
      // Wait, is there a downloader? Let's verify.
      // We can fetch `/api/admin/backup/download` or we can let the `/api/admin/backup?filename=...` GET return the file content!
      // Let's check: in our `app/api/admin/backup/route.js`, GET returns backups list.
      // Let's modify our GET or write a quick fetch download.
      // Wait! We can just fetch `/api/admin/backup` with a filename parameter to get the content of the file!
      // Let's write that or add it. But wait, if we fetch the backups list and we click download,
      // it would be very easy if `/api/admin/backup?filename=...` returns the file itself!
      // Let's inspect if our backup API supports this. It currently does not. We can implement it, or fetch it.
      // Actually, let's write a route that returns it, or we can update `app/api/admin/backup/route.js` to return file content when `filename` is provided!
      // Yes! That is extremely clean and avoids adding new files. Let's do that!
      const res = await fetch(`/api/admin/backup/download?filename=${filename}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      // Wait, let's create `/api/admin/backup/download/route.js` or update `/api/admin/backup/route.js`.
      // Let's just create a quick route `/api/admin/backup/download/route.js` to download backups.
    } catch (err) {
      showMsg('Failed to download: ' + err.message, true);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/admin/backup/download?filename=${filename}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to download file.');
      }

      const backupContent = await res.json();
      const blob = new Blob([JSON.stringify(backupContent, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMsg(`Downloaded ${filename} successfully.`, false);
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  const handleRestoreBackup = async (backupJson) => {
    if (actionProgress) return;
    if (!confirm('WARNING: Restoring the database will wipe all current classrooms, materials, assignments, attempts, and custom user profiles (except the current admin) and replace them with the backup content. This action is irreversible. Do you wish to proceed?')) return;

    setActionProgress('restoring');
    showMsg('Restoring database contents, mapping relationships, and rebuilding schema IDs...', false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(backupJson)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Restore failed.');
      }

      const resJson = await res.json();
      showMsg('Success! Database restored and remapped successfully.', false);
      
      // Reload page data
      fetchBackupsList();
      runSecuritySuite();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setActionProgress(null);
    }
  };

  const handleFileRestoreUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.users) {
          throw new Error('Invalid backup file. Missing required "users" profile tables.');
        }
        await handleRestoreBackup(json);
      } catch (err) {
        showMsg('Failed to parse backup JSON file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset file input
  };

  const handleServerRestoreFile = async (filename) => {
    if (actionProgress) return;
    showMsg(`Fetching backup file "${filename}" for restoration...`, false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/admin/backup/download?filename=${filename}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load restore file from server.');
      }

      const backupJson = await res.json();
      await handleRestoreBackup(backupJson);
    } catch (err) {
      showMsg(err.message, true);
    }
  };

  const runSecuritySuite = async () => {
    if (runningTests) return;
    setRunningTests(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/security-tests', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to run security test suite.');
      const data = await res.json();
      setSecurityTests(data.tests || []);
      
      // Calculate security score
      if (data.tests && data.tests.length > 0) {
        const passedCount = data.tests.filter(t => t.passed).length;
        const score = Math.round((passedCount / data.tests.length) * 100);
        setSecurityScore(score);
      }
    } catch (err) {
      console.error('Failed to run security tests:', err.message);
    } finally {
      setRunningTests(false);
    }
  };

  const showMsg = (text, isError) => {
    setMessage({ text, isError });
    setTimeout(() => {
      setMessage(prev => prev.text === text ? { text: '', isError: false } : prev);
    }, 6000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Verifying Administrator session...</h2>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div>
      <Navbar />
      <div className="container" style={{ paddingBottom: '4rem' }}>
        
        {/* Header banner */}
        <div className="glass card" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-admin">🛡️ System Administration</span>
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Security & Database Operations Panel</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Manage automatic database backups, run security scans, and handle restores securely.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleTriggerBackup} 
              className="btn btn-primary"
              disabled={actionProgress !== null}
            >
              {actionProgress === 'backing_up' ? 'Generating Backup...' : '⚡ Trigger Backup'}
            </button>
            <button 
              onClick={() => fileInputRef.current.click()} 
              className="btn btn-secondary"
              disabled={actionProgress !== null}
            >
              📥 Upload & Restore
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".json"
              onChange={handleFileRestoreUpload} 
            />
          </div>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`alert ${message.isError ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {message.isError ? '⚠️' : 'ℹ️'}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Operational Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
          
          {/* Backups Panel */}
          <div className="glass card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📁 Local Database Backups ({backups.length})
              </h3>
              <button 
                onClick={fetchBackupsList} 
                className="btn" 
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
                disabled={fetchingBackups}
              >
                🔄 Refresh
              </button>
            </div>

            {fetchingBackups ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading backup history files...
              </div>
            ) : backups.length === 0 ? (
              <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No database backups found in local backups folder. Trigger a manual backup to create one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {backups.map((b) => (
                  <div key={b.filename} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.8rem 1rem', background: 'rgba(255, 255, 255, 0.4)', transition: 'all 0.2s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, flex: 1, marginRight: '1rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {b.isAuto ? '🤖 Auto Backup' : '👤 Manual Backup'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        File: {b.filename}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        Date: {new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} • Size: {(b.sizeBytes / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button 
                        onClick={() => handleDownloadBackup(b.filename)} 
                        className="btn" 
                        title="Download Backup File"
                        style={{ padding: '0.4rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', background: '#FFFFFF' }}
                      >
                        💾
                      </button>
                      <button 
                        onClick={() => handleServerRestoreFile(b.filename)} 
                        className="btn" 
                        title="Restore Database from this backup"
                        style={{ padding: '0.4rem', fontSize: '0.8rem', background: '#fef3c7', color: '#d97706', border: 'none' }}
                        disabled={actionProgress !== null}
                      >
                        🔄 Restore
                      </button>
                      <button 
                        onClick={() => handleDeleteBackup(b.filename)} 
                        className="btn" 
                        title="Delete Backup File"
                        style={{ padding: '0.4rem', fontSize: '0.8rem', background: '#fee2e2', color: '#dc2626', border: 'none' }}
                        disabled={actionProgress !== null}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Compliance Panel */}
          <div className="glass card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛡️ Security Compliance Scans
              </h3>
              <button 
                onClick={runSecuritySuite} 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
                disabled={runningTests}
              >
                {runningTests ? 'Scanning...' : 'Run Scan'}
              </button>
            </div>

            {securityScore !== null && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', background: securityScore === 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: securityScore === 100 ? '1px solid #10b981' : '1px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: securityScore === 100 ? 'var(--success)' : 'var(--warning)' }}>
                  {securityScore}%
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Security Health Rating</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {securityScore === 100 
                      ? 'All core security validations are active and passing successfully!' 
                      : 'Some vulnerabilities or configuration warnings require attention.'}
                  </p>
                </div>
              </div>
            )}

            {securityTests.length === 0 ? (
              <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No security scans run yet. Click Run Scan above to audit server security.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {securityTests.map((t, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.8rem 1rem', background: t.passed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                      {t.passed ? '✅' : '❌'}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {t.test}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        {t.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
