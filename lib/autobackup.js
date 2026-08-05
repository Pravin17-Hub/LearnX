import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const TIMESTAMP_FILE = path.join(BACKUP_DIR, 'last_backup_timestamp.txt');
const AUTO_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// List of all tables in dependency order
const TABLES = [
  'users',
  'follows',
  'classrooms',
  'classroom_members',
  'materials',
  'feed_posts',
  'post_likes',
  'post_comments',
  'subject_communities',
  'community_members',
  'community_posts',
  'discussion_threads',
  'discussion_replies',
  'assignments',
  'assignment_submissions',
  'quizzes',
  'quiz_questions',
  'quiz_attempts',
  'attendance_records',
  'private_messages',
  'notifications',
  'achievements',
  'bookmarks'
];

async function fetchAllRows(tableName) {
  let allRows = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    // Try ordering by id. If it fails, fallback without ordering
    let query = supabaseAdmin.from(tableName).select('*').range(start, end);
    
    // Add ordering for tables that have standard serial IDs
    if (!['follows', 'classroom_members', 'post_likes', 'community_members'].includes(tableName)) {
      query = query.order('id', { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      // Fallback if ordering failed or query failed
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .range(start, end);

      if (fallbackError) {
        console.error(`Error backing up table ${tableName}:`, fallbackError.message);
        throw fallbackError;
      }
      
      if (!fallbackData || fallbackData.length === 0) break;
      allRows.push(...fallbackData);
      if (fallbackData.length < pageSize) break;
    } else {
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
    }
    page++;
  }

  return allRows;
}

export async function performBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupData = {};
  
  // Backup each table in order
  for (const table of TABLES) {
    try {
      const rows = await fetchAllRows(table);
      backupData[table] = rows;
    } catch (err) {
      console.error(`Failed to back up table ${table}:`, err.message);
      // Keep going to back up as much as possible
      backupData[table] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_auto_${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

  // Maintain rolling backups (keep last 10 backups)
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time); // newest first

  if (files.length > 10) {
    const extraFiles = files.slice(10);
    for (const file of extraFiles) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
      } catch (e) {
        console.error(`Failed to delete old backup file ${file.name}:`, e.message);
      }
    }
  }

  return filename;
}

export async function autoBackupIfNeeded() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    let lastBackupTime = 0;
    if (fs.existsSync(TIMESTAMP_FILE)) {
      const content = fs.readFileSync(TIMESTAMP_FILE, 'utf-8').trim();
      lastBackupTime = Number(content) || 0;
    }

    const now = Date.now();
    if (now - lastBackupTime >= AUTO_BACKUP_INTERVAL_MS) {
      // Update timestamp before running to prevent concurrent requests from double running
      fs.writeFileSync(TIMESTAMP_FILE, String(now), 'utf-8');
      
      // Run backup asynchronously in the background so it doesn't block request
      performBackup().catch(err => {
        console.error('Background automatic database backup failed:', err.message);
      });
    }
  } catch (err) {
    console.error('Error during autoBackupIfNeeded check:', err.message);
  }
}
