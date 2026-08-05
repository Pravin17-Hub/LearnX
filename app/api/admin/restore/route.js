import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

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
    .select('id, role, email')
    .eq('email', user.email)
    .single();

  if (profileError || !profile || profile.role !== 'Administrator') {
    return { error: 'Forbidden: Administrator privileges required', status: 403 };
  }

  return { user: profile };
}

export async function POST(request) {
  try {
    const authCheck = await verifyAdmin(request);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const adminProfile = authCheck.user;
    const adminEmail = adminProfile.email;

    const backupData = await request.json();
    if (!backupData || typeof backupData !== 'object') {
      return NextResponse.json({ error: 'Invalid backup data format' }, { status: 400 });
    }

    // Step 1: Wipe all tables (except users) in reverse dependency order
    const REVERSE_TABLES = [
      'bookmarks', 'achievements', 'notifications', 'private_messages', 
      'attendance_records', 'quiz_attempts', 'quiz_questions', 'quizzes', 
      'assignment_submissions', 'assignments', 'discussion_replies', 
      'discussion_threads', 'community_posts', 'community_members', 
      'subject_communities', 'post_comments', 'post_likes', 'feed_posts', 
      'materials', 'classroom_members', 'classrooms', 'follows'
    ];

    for (const table of REVERSE_TABLES) {
      let deleteQuery = supabaseAdmin.from(table).delete();
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
        throw new Error(`Failed to clear table ${table}: ${error.message}`);
      }
    }

    // Wipe all users EXCEPT the current admin
    const { error: userWipeError } = await supabaseAdmin
      .from('users')
      .delete()
      .gt('id', 0)
      .neq('id', adminProfile.id);
    
    if (userWipeError) {
      throw new Error(`Failed to clear users table: ${userWipeError.message}`);
    }

    // Step 2: Restore data with relationship ID mapping
    const userMap = {};
    const classroomMap = {};
    const postMap = {};
    const commentMap = {};
    const communityMap = {};
    const threadMap = {};
    const replyMap = {};
    const assignmentMap = {};
    const quizMap = {};
    const quizQuestionMap = {};
    const privateMsgMap = {};

    // 1. Restore Users
    const backupUsers = backupData.users || [];
    for (const u of backupUsers) {
      if (u.email.toLowerCase() === adminEmail.toLowerCase()) {
        // Update current admin profile details
        const updateData = { ...u };
        delete updateData.id;
        delete updateData.email;
        delete updateData.created_at;
        delete updateData.updated_at;
        
        const { error } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', adminProfile.id);
        
        if (error) throw new Error(`Failed to update admin profile: ${error.message}`);
        userMap[u.id] = adminProfile.id;
      } else {
        // Insert new user profile
        const insertData = { ...u };
        delete insertData.id;
        delete insertData.created_at;
        delete insertData.updated_at;
        
        const { data, error } = await supabaseAdmin
          .from('users')
          .insert(insertData)
          .select('id')
          .single();
        
        if (error) throw new Error(`Failed to insert user ${u.username}: ${error.message}`);
        userMap[u.id] = data.id;
      }
    }

    // 2. Restore Follows
    const backupFollows = backupData.follows || [];
    for (const f of backupFollows) {
      const followerId = userMap[f.follower_id];
      const followedId = userMap[f.followed_id];
      if (followerId && followedId) {
        await supabaseAdmin.from('follows').insert({
          follower_id: followerId,
          followed_id: followedId
        });
      }
    }

    // 3. Restore Classrooms
    const backupClassrooms = backupData.classrooms || [];
    for (const c of backupClassrooms) {
      const insertData = { ...c };
      delete insertData.id;
      delete insertData.created_at;
      insertData.creator_id = userMap[c.creator_id] || adminProfile.id;
      
      const { data, error } = await supabaseAdmin
        .from('classrooms')
        .insert(insertData)
        .select('id')
        .single();
      
      if (error) throw new Error(`Failed to insert classroom ${c.class_name}: ${error.message}`);
      classroomMap[c.id] = data.id;
    }

    // 4. Restore Classroom Members
    const backupClassroomMembers = backupData.classroom_members || [];
    for (const cm of backupClassroomMembers) {
      const cid = classroomMap[cm.classroom_id];
      const uid = userMap[cm.user_id];
      if (cid && uid) {
        await supabaseAdmin.from('classroom_members').insert({
          classroom_id: cid,
          user_id: uid,
          role_in_class: cm.role_in_class
        });
      }
    }

    // 5. Restore Materials
    const backupMaterials = backupData.materials || [];
    for (const m of backupMaterials) {
      const insertData = { ...m };
      delete insertData.id;
      delete insertData.created_at;
      insertData.classroom_id = classroomMap[m.classroom_id] || null;
      insertData.uploader_id = userMap[m.uploader_id] || adminProfile.id;

      await supabaseAdmin.from('materials').insert(insertData);
    }

    // 6. Restore Feed Posts
    const backupFeedPosts = backupData.feed_posts || [];
    for (const p of backupFeedPosts) {
      const insertData = { ...p };
      delete insertData.id;
      delete insertData.created_at;
      insertData.user_id = userMap[p.user_id] || adminProfile.id;

      const { data, error } = await supabaseAdmin
        .from('feed_posts')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert feed post: ${error.message}`);
      postMap[p.id] = data.id;
    }

    // 7. Restore Post Likes
    const backupPostLikes = backupData.post_likes || [];
    for (const l of backupPostLikes) {
      const pid = postMap[l.post_id];
      const uid = userMap[l.user_id];
      if (pid && uid) {
        await supabaseAdmin.from('post_likes').insert({
          post_id: pid,
          user_id: uid
        });
      }
    }

    // 8. Restore Post Comments (Parent Comments ordered by ID so parents exist before children)
    const backupPostComments = backupData.post_comments || [];
    // Sort to ensure parents are inserted first
    const sortedComments = [...backupPostComments].sort((a, b) => a.id - b.id);
    for (const c of sortedComments) {
      const insertData = { ...c };
      delete insertData.id;
      delete insertData.created_at;
      insertData.post_id = postMap[c.post_id];
      insertData.user_id = userMap[c.user_id] || adminProfile.id;
      insertData.parent_comment_id = c.parent_comment_id ? (commentMap[c.parent_comment_id] || null) : null;

      const { data, error } = await supabaseAdmin
        .from('post_comments')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert comment: ${error.message}`);
      commentMap[c.id] = data.id;
    }

    // 9. Restore Subject Communities
    const backupCommunities = backupData.subject_communities || [];
    for (const sc of backupCommunities) {
      const insertData = { ...sc };
      delete insertData.id;
      delete insertData.created_at;
      insertData.moderator_id = userMap[sc.moderator_id] || adminProfile.id;

      const { data, error } = await supabaseAdmin
        .from('subject_communities')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert community: ${error.message}`);
      communityMap[sc.id] = data.id;
    }

    // 10. Restore Community Members
    const backupCommunityMembers = backupData.community_members || [];
    for (const cm of backupCommunityMembers) {
      const cid = communityMap[cm.community_id];
      const uid = userMap[cm.user_id];
      if (cid && uid) {
        await supabaseAdmin.from('community_members').insert({
          community_id: cid,
          user_id: uid
        });
      }
    }

    // 11. Restore Community Posts
    const backupCommunityPosts = backupData.community_posts || [];
    for (const cp of backupCommunityPosts) {
      const insertData = { ...cp };
      delete insertData.id;
      delete insertData.created_at;
      insertData.community_id = communityMap[cp.community_id];
      insertData.user_id = userMap[cp.user_id] || adminProfile.id;

      await supabaseAdmin.from('community_posts').insert(insertData);
    }

    // 12. Restore Classroom Discussion Threads
    const backupThreads = backupData.discussion_threads || [];
    for (const t of backupThreads) {
      const insertData = { ...t };
      delete insertData.id;
      delete insertData.created_at;
      insertData.classroom_id = classroomMap[t.classroom_id];
      insertData.user_id = userMap[t.user_id] || adminProfile.id;

      const { data, error } = await supabaseAdmin
        .from('discussion_threads')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert discussion thread: ${error.message}`);
      threadMap[t.id] = data.id;
    }

    // 13. Restore Discussion Replies (Sorted to insert parent replies first)
    const backupReplies = backupData.discussion_replies || [];
    const sortedReplies = [...backupReplies].sort((a, b) => a.id - b.id);
    for (const r of sortedReplies) {
      const insertData = { ...r };
      delete insertData.id;
      delete insertData.created_at;
      insertData.thread_id = threadMap[r.thread_id];
      insertData.user_id = userMap[r.user_id] || adminProfile.id;
      insertData.parent_reply_id = r.parent_reply_id ? (replyMap[r.parent_reply_id] || null) : null;

      const { data, error } = await supabaseAdmin
        .from('discussion_replies')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert reply: ${error.message}`);
      replyMap[r.id] = data.id;
    }

    // 14. Restore Assignments
    const backupAssignments = backupData.assignments || [];
    for (const a of backupAssignments) {
      const insertData = { ...a };
      delete insertData.id;
      delete insertData.created_at;
      insertData.classroom_id = classroomMap[a.classroom_id];
      insertData.creator_id = userMap[a.creator_id] || adminProfile.id;

      const { data, error } = await supabaseAdmin
        .from('assignments')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert assignment: ${error.message}`);
      assignmentMap[a.id] = data.id;
    }

    // 15. Restore Assignment Submissions
    const backupSubmissions = backupData.assignment_submissions || [];
    for (const s of backupSubmissions) {
      const insertData = { ...s };
      delete insertData.id;
      insertData.assignment_id = assignmentMap[s.assignment_id];
      insertData.student_id = userMap[s.student_id] || adminProfile.id;

      await supabaseAdmin.from('assignment_submissions').insert(insertData);
    }

    // 16. Restore Quizzes
    const backupQuizzes = backupData.quizzes || [];
    for (const q of backupQuizzes) {
      const insertData = { ...q };
      delete insertData.id;
      delete insertData.created_at;
      insertData.classroom_id = classroomMap[q.classroom_id] || null;
      insertData.creator_id = userMap[q.creator_id] || adminProfile.id;

      const { data, error } = await supabaseAdmin
        .from('quizzes')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert quiz: ${error.message}`);
      quizMap[q.id] = data.id;
    }

    // 17. Restore Quiz Questions
    const backupQuizQuestions = backupData.quiz_questions || [];
    for (const qq of backupQuizQuestions) {
      const insertData = { ...qq };
      delete insertData.id;
      insertData.quiz_id = quizMap[qq.quiz_id];

      const { data, error } = await supabaseAdmin
        .from('quiz_questions')
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to insert quiz question: ${error.message}`);
      quizQuestionMap[qq.id] = data.id;
    }

    // 18. Restore Quiz Attempts
    const backupQuizAttempts = backupData.quiz_attempts || [];
    for (const qa of backupQuizAttempts) {
      const insertData = { ...qa };
      delete insertData.id;
      insertData.quiz_id = quizMap[qa.quiz_id];
      insertData.student_id = qa.student_id ? (userMap[qa.student_id] || null) : null;

      await supabaseAdmin.from('quiz_attempts').insert(insertData);
    }

    // 19. Restore Attendance Records
    const backupAttendance = backupData.attendance_records || [];
    for (const ar of backupAttendance) {
      const insertData = { ...ar };
      delete insertData.id;
      insertData.classroom_id = classroomMap[ar.classroom_id];
      insertData.student_id = userMap[ar.student_id] || adminProfile.id;

      await supabaseAdmin.from('attendance_records').insert(insertData);
    }

    // 20. Restore Private Messages
    const backupMessages = backupData.private_messages || [];
    for (const pm of backupMessages) {
      const insertData = { ...pm };
      delete insertData.id;
      delete insertData.created_at;
      insertData.sender_id = userMap[pm.sender_id] || adminProfile.id;
      insertData.receiver_id = userMap[pm.receiver_id] || adminProfile.id;

      await supabaseAdmin.from('private_messages').insert(insertData);
    }

    // 21. Restore Notifications
    const backupNotifications = backupData.notifications || [];
    for (const n of backupNotifications) {
      const insertData = { ...n };
      delete insertData.id;
      delete insertData.created_at;
      insertData.user_id = userMap[n.user_id] || adminProfile.id;

      // Translate reference_id based on notification type
      if (n.reference_id) {
        if (['COMMENT', 'LIKE'].includes(n.type)) {
          insertData.reference_id = postMap[n.reference_id] || null;
        } else if (n.type === 'ASSIGNMENT') {
          insertData.reference_id = assignmentMap[n.reference_id] || null;
        } else if (n.type === 'QUIZ') {
          insertData.reference_id = quizMap[n.reference_id] || null;
        } else if (n.type === 'CHAT') {
          insertData.reference_id = userMap[n.reference_id] || null;
        }
      }

      await supabaseAdmin.from('notifications').insert(insertData);
    }

    // 22. Restore Achievements
    const backupAchievements = backupData.achievements || [];
    for (const ac of backupAchievements) {
      const insertData = { ...ac };
      delete insertData.id;
      insertData.user_id = userMap[ac.user_id] || adminProfile.id;

      await supabaseAdmin.from('achievements').insert(insertData);
    }

    // 23. Restore Bookmarks
    const backupBookmarks = backupData.bookmarks || [];
    for (const bm of backupBookmarks) {
      const insertData = { ...bm };
      delete insertData.id;
      delete insertData.created_at;
      insertData.user_id = userMap[bm.user_id] || adminProfile.id;

      // Translate item_id based on type
      if (bm.type === 'ASSIGNMENT') {
        insertData.item_id = assignmentMap[bm.item_id] || 0;
      }

      await supabaseAdmin.from('bookmarks').insert(insertData);
    }

    return NextResponse.json({ success: true, message: 'Database successfully restored from backup file' });
  } catch (error) {
    return NextResponse.json({ error: `Restore process failed: ${error.message}` }, { status: 500 });
  }
}
