'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const targetUsername = decodeURIComponent(params.username || '');

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userMaterials, setUserMaterials] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRegNo, setEditRegNo] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Upload Note States
  const [isUploading, setIsUploading] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteCategory, setNoteCategory] = useState('Notes');
  const [isPublicShare, setIsPublicShare] = useState(true);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const fetchProfileData = async () => {
    setLoading(true);

    // 1. Get current logged-in user
    const { data: { session } } = await supabase.auth.getSession();
    let loggedInUser = null;
    if (session) {
      const { data: curProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      setCurrentUser(curProfile);
      loggedInUser = curProfile;
    }

    // 2. Get public profile user details
    const { data: profUser } = await supabase
      .from('users')
      .select('*')
      .eq('username', targetUsername.toLowerCase())
      .maybeSingle();

    if (!profUser) {
      setProfileUser(null);
      setLoading(false);
      return;
    }

    setProfileUser(profUser);
    setFollowersCount(profUser.follower_count || 0);

    // Prepopulate edit forms
    setEditName(profUser.name || '');
    setEditBio(profUser.bio || '');
    setEditInstitution(profUser.institution || '');
    setEditDepartment(profUser.department || '');
    setEditRegNo(profUser.reg_no || '');

    // 3. Check if current user is following this profile
    if (loggedInUser && loggedInUser.id !== profUser.id) {
      const { data: followRecord } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', loggedInUser.id)
        .eq('followed_id', profUser.id)
        .maybeSingle();
      setIsFollowing(!!followRecord);
    }

    // 4. Fetch study notes / materials created by this user
    const { data: mats } = await supabase
      .from('materials')
      .select('*')
      .eq('uploader_id', profUser.id)
      .order('created_at', { ascending: false });

    // Filter private files if not the owner
    const isOwner = loggedInUser && loggedInUser.id === profUser.id;
    const finalMats = mats || [];
    setUserMaterials(isOwner ? finalMats : finalMats.filter(m => !m.category.startsWith('Private')));

    setLoading(false);
  };

  useEffect(() => {
    if (targetUsername) {
      fetchProfileData();
    }
  }, [targetUsername]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    setSavingProfile(true);
    try {
      let uploadedAvatarPath = currentUser.avatar_path;
      if (avatarFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

        const formData = new FormData();
        formData.append('file', avatarFile);
        formData.append('folder', 'profiles');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: authHeaders,
          body: formData
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to upload profile image');
        }
        const uploadData = await res.json();
        uploadedAvatarPath = uploadData.url;
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: editName.trim(),
          bio: editBio.trim(),
          institution: editInstitution.trim(),
          department: editDepartment.trim(),
          reg_no: editRegNo.trim(),
          avatar_path: uploadedAvatarPath
        })
        .eq('id', currentUser.id);

      if (error) throw error;
      setAvatarFile(null);
      setIsEditing(false);
      await fetchProfileData();
    } catch (err) {
      alert(`Error updating profile: ${err.message}`);
    }
    setSavingProfile(false);
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('followed_id', profileUser.id);

        // Decrement follower_count on profile user
        await supabase
          .from('users')
          .update({ follower_count: Math.max(0, followersCount - 1) })
          .eq('id', profileUser.id);

        setFollowersCount(Math.max(0, followersCount - 1));
        setIsFollowing(false);
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            followed_id: profileUser.id
          });

        // Increment follower_count on profile user
        await supabase
          .from('users')
          .update({ follower_count: followersCount + 1 })
          .eq('id', profileUser.id);

        setFollowersCount(followersCount + 1);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Error toggling follow status:', err.message);
    }
  };

  const handleUploadNote = async (e) => {
    e.preventDefault();
    if (!fileToUpload || !currentUser) return;

    setUploadProgress(true);

    try {
      // 1. Upload File locally
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const uploadData = await res.json();

      // 2. Determine private vs public category prefix
      const dbCategory = isPublicShare ? noteCategory : `Private - ${noteCategory}`;

      // 3. Save note metadata
      const { error } = await supabase.from('materials').insert({
        title: noteTitle.trim(),
        description: noteDesc.trim(),
        file_path: uploadData.url,
        file_type: fileToUpload.name.split('.').pop() || 'pdf',
        category: dbCategory,
        uploader_id: currentUser.id,
        difficulty: 'Intermediate'
      });

      if (error) throw error;

      // Reset Form
      setNoteTitle('');
      setNoteDesc('');
      setFileToUpload(null);
      setIsUploading(false);
      await fetchProfileData();
    } catch (err) {
      alert(`Error sharing note: ${err.message}`);
    }
    setUploadProgress(false);
  };

  const getAvatarUrl = (u) => {
    return u?.avatar_path && u.avatar_path !== '/assets/images/default-avatar.png'
      ? u.avatar_path
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${u?.username}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Loading Profile...</h2>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div>
        <Navbar />
        <div className="container" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--text-primary)' }}>Profile Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>The user @{targetUsername} does not exist.</p>
        </div>
      </div>
    );
  }

  const isMyProfile = currentUser && currentUser.id === profileUser.id;

  return (
    <div>
      <Navbar />
      <div className="container animate-fade-in" style={{ maxWidth: '900px' }}>
        
        {/* Header Profile Cover & Card */}
        <div className="glass card profile-header-card" style={{ padding: '2.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <img
            src={getAvatarUrl(profileUser)}
            alt="avatar"
            style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid var(--color-primary)', objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{profileUser.name}</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>@{profileUser.username}</p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                {isMyProfile ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                  >
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/chat?username=${profileUser.username}`)}
                      className="btn btn-secondary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      💬 DM Message
                    </button>
                    <button
                      onClick={handleFollowToggle}
                      className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      {isFollowing ? '✓ Following' : '+ Follow'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span className="badge badge-student" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)' }}>
                {profileUser.role}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>{followersCount}</strong> Followers
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>{profileUser.following_count || 0}</strong> Following
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>🔥 {profileUser.learning_streak || 0}</strong> Streak
              </span>
            </div>

            {profileUser.bio && (
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontStyle: 'italic', margin: 0 }}>
                "{profileUser.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* User Details */}
          <div className="glass card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>🏫 Academic Info</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>REGISTER NUMBER</span>
                <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{profileUser.reg_no || 'N/A'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>INSTITUTION</span>
                <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{profileUser.institution || 'Not specified'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>DEPARTMENT</span>
                <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{profileUser.department || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* User Shared Notes & Materials */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📝 Study Notes</h3>
              {isMyProfile && (
                <button
                  onClick={() => setIsUploading(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                >
                  ➕ Share Note
                </button>
              )}
            </div>

            {userMaterials.length === 0 ? (
              <div className="glass card" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>
                No study notes shared yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {userMaterials.map((mat) => {
                  const isPrivate = mat.category.startsWith('Private');
                  const displayCat = isPrivate ? mat.category.replace('Private - ', '') : mat.category;
                  return (
                    <div key={mat.id} className="glass card" style={{ padding: '1.25rem', borderLeft: isPrivate ? '4px solid #ef4444' : '4px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', background: isPrivate ? '#fee2e2' : '#e0f2fe', color: isPrivate ? '#ef4444' : 'var(--color-primary)' }}>
                          {displayCat} {isPrivate && '(Private)'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(mat.created_at).toLocaleDateString()}</span>
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
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditing && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div className="glass card modal-content" style={{ maxWidth: '500px', width: '100%', padding: '2rem', background: '#FFFFFF', margin: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>✏️ Edit Profile Info</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" required value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">Profile Picture (Avatar)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="label">Register Number</label>
                <input type="text" className="input" required value={editRegNo} onChange={(e) => setEditRegNo(e.target.value)} />
              </div>
              <div>
                <label className="label">Institution</label>
                <input type="text" className="input" value={editInstitution} onChange={(e) => setEditInstitution(e.target.value)} />
              </div>
              <div>
                <label className="label">Department</label>
                <input type="text" className="input" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea className="input" style={{ minHeight: '60px' }} value={editBio} onChange={(e) => setEditBio(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" disabled={savingProfile} onClick={() => setIsEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE STUDY NOTE MODAL */}
      {isUploading && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div className="glass card modal-content" style={{ maxWidth: '500px', width: '100%', padding: '2rem', background: '#FFFFFF', margin: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>📝 Share Note / Material</h3>
            <form onSubmit={handleUploadNote} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <label className="label">Note Title</label>
                <input type="text" className="input" placeholder="e.g. Operating Systems Lecture 2" required value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)}>
                  <option value="Notes">Notes</option>
                  <option value="Syllabus">Syllabus</option>
                  <option value="Project">Project</option>
                  <option value="Video">Video</option>
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" placeholder="Give details about what topics are covered..." style={{ minHeight: '65px' }} value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="public_share"
                  checked={isPublicShare}
                  onChange={(e) => setIsPublicShare(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="public_share" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  🌐 Share Publicly (Add to Library)
                </label>
              </div>

              <div>
                <label className="label">Document File</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => setFileToUpload(e.target.files[0])}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" disabled={uploadProgress} onClick={() => setIsUploading(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploadProgress}>
                  {uploadProgress ? 'Uploading...' : 'Share Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
