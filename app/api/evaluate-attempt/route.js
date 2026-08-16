import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateAttempt } from '@/lib/evaluateQueue';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token format' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    
    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or session expired' }, { status: 401 });
    }

    const { attemptId } = await request.json();
    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attemptId parameter' }, { status: 400 });
    }

    // Fetch attempt details
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    // Check if evaluation is indeed needed
    const fbStr = attempt.ai_feedback || '';
    const isQueued = fbStr.includes('"status":"queued"') || fbStr.includes('"status":"grading"');

    if (!isQueued) {
      return NextResponse.json({ success: true, message: 'Attempt is already graded.' });
    }

    console.log(`[Serverless Queue] Starting on-demand evaluation for attempt ID: ${attemptId} requested by user ${user.id}`);
    await evaluateAttempt(attempt);

    return NextResponse.json({ success: true, message: 'Attempt evaluated successfully.' });
  } catch (error) {
    console.error('[Serverless Queue] On-demand evaluation error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
