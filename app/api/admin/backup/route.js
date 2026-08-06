import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from '@/lib/supabase';
import { performBackup } from '@/lib/autobackup';

const BACKUP_DIR = process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'backups')
  : path.join(process.cwd(), 'backups');

async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token format', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid credentials or session expired', status: 401 };
  }

  // Check user role in public users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single();

  if (profileError || !profile || profile.role !== 'Administrator') {
    return { error: 'Forbidden: Administrator privileges required', status: 403 };
  }

  return { user: profile };
}

export async function GET(request) {
  try {
    const authCheck = await verifyAdmin(request);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
          isAuto: f.includes('_auto_')
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ backups: files });
  } catch (error) {
    return NextResponse.json({ error: `Failed to fetch backups: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authCheck = await verifyAdmin(request);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const filename = await performBackup();
    return NextResponse.json({ success: true, filename });
  } catch (error) {
    return NextResponse.json({ error: `Backup failed: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authCheck = await verifyAdmin(request);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename || !filename.startsWith('backup_') || !filename.endsWith('.json') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid backup filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, message: `Backup ${filename} deleted successfully` });
  } catch (error) {
    return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
  }
}
