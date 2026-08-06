import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token format' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or session expired' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    
    // Sanitize folder name to prevent path traversal
    let folder = formData.get('folder') || 'general';
    folder = folder.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file extension against a whitelist
    const fileExt = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg'];
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ 
        error: 'Forbidden: Unsupported file type. Only PDF, DOCX, DOC, TXT, and images (PNG, JPG, JPEG) are allowed.' 
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const bucketName = 'uploads';

    // Best-effort check & create bucket using service role client
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === bucketName);
      if (!bucketExists) {
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true
        });
      }
    } catch (bucketErr) {
      console.error('Failed to list/create Supabase storage bucket:', bucketErr.message);
    }

    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${folder}/${fileName}`;

    // Upload buffer to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload to Supabase Storage failed: ${uploadError.message}` }, { status: 500 });
    }

    // Publicly accessible URL path served by Supabase
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }
}
