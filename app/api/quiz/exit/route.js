import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { attemptId, answersJson, violationReason, token } = await req.json();
    
    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attempt ID' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase credentials missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data, error } = await supabase
      .from('quiz_attempts')
      .update({
        answers_json: answersJson,
        violation_reason: violationReason || 'EXAMINATION_TERMINATED_UNAPPROVED_EXIT',
        submit_time: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      console.error('Server exit update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Server exit handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
