import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from '@/lib/supabase';

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

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename || !filename.startsWith('backup_') || !filename.endsWith('.json') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid backup filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const backupJson = JSON.parse(content);

    return NextResponse.json(backupJson);
  } catch (error) {
    return NextResponse.json({ error: `Download failed: ${error.message}` }, { status: 500 });
  }
}
