// scripts/clear-db.js - Clears all database tables (wipes admin user, users, classrooms, posts, etc.)
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually load and parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const val = valueParts.join('=').trim();
      process.env[key.trim()] = val.replace(/^["']|["']$/g, ''); // strip quotes
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TABLES = [
  'bookmarks',
  'achievements',
  'notifications',
  'private_messages',
  'attendance_records',
  'quiz_attempts',
  'quiz_questions',
  'quizzes',
  'assignment_submissions',
  'assignments',
  'discussion_replies',
  'discussion_threads',
  'community_posts',
  'community_members',
  'subject_communities',
  'post_comments',
  'post_likes',
  'feed_posts',
  'materials',
  'classroom_members',
  'classrooms',
  'follows',
  'users'
];

async function clearDatabase() {
  console.log('Starting complete database wipe...');

  for (const table of TABLES) {
    try {
      console.log(`Clearing table ${table}...`);
      let deleteQuery = supabaseAdmin.from(table).delete();
      
      // Construct filter to match all rows
      if (['follows', 'classroom_members', 'post_likes', 'community_members'].includes(table)) {
        if (table === 'follows') deleteQuery = deleteQuery.gt('follower_id', 0);
        if (table === 'classroom_members') deleteQuery = deleteQuery.gt('classroom_id', 0);
        if (table === 'post_likes') deleteQuery = deleteQuery.gt('post_id', 0);
        if (table === 'community_members') deleteQuery = deleteQuery.gt('community_id', 0);
      } else {
        deleteQuery = deleteQuery.gt('id', 0);
      }

      const { error } = await deleteQuery;
      if (error) {
        console.error(`Warning: Failed to clear ${table}:`, error.message);
      } else {
        console.log(`Successfully cleared ${table}.`);
      }
    } catch (err) {
      console.error(`Error clearing ${table}:`, err.message);
    }
  }

  console.log('Database wipe complete! All records, classrooms, posts, and user accounts have been removed.');
}

clearDatabase();
