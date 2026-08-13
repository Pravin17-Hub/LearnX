import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    
    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { classroomId, studentId } = await request.json();
    if (!classroomId || !studentId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify caller is either the class creator or a Faculty member of the class
    const { data: callerMember, error: callerError } = await supabaseAdmin
      .from('classroom_members')
      .select('*, classrooms(*)')
      .eq('classroom_id', classroomId)
      .eq('user_id', user.id)
      .single();

    const isCreator = callerMember?.classrooms?.creator_id === user.id;
    const isFaculty = callerMember?.role_in_class === 'Faculty';

    if (!isCreator && !isFaculty) {
      // Check if the user's overall role in the database is Administrator/Faculty
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (profile?.role !== 'Faculty' && profile?.role !== 'Administrator') {
        return NextResponse.json({ error: 'Forbidden: Only faculty can remove members' }, { status: 403 });
      }
    }

    // Delete the member using admin client (bypasses RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('classroom_members')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('user_id', studentId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Student removed successfully.' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
