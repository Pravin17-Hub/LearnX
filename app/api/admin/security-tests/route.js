import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { POST as evaluatePOST } from '@/app/api/evaluate/route';
import { POST as ocrPOST } from '@/app/api/ocr/route';
import { POST as uploadPOST } from '@/app/api/upload/route';

async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single();

  if (profileError || !profile || profile.role !== 'Administrator') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user: profile, token };
}

export async function GET(request) {
  try {
    const authCheck = await verifyAdmin(request);
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const adminToken = authCheck.token;
    const results = [];

    // Test 1: API Route Protection - /api/evaluate
    try {
      const mockReq = new Request('http://localhost/api/evaluate', { method: 'POST', body: '{}' });
      const res = await evaluatePOST(mockReq);
      results.push({
        test: 'API Authentication: /api/evaluate rejects anonymous requests',
        passed: res.status === 401,
        details: `Returned status code: ${res.status} (Expected: 401)`
      });
    } catch (e) {
      results.push({ test: 'API Authentication: /api/evaluate rejects anonymous requests', passed: false, details: e.message });
    }

    // Test 2: API Route Protection - /api/ocr
    try {
      const mockReq = new Request('http://localhost/api/ocr', { method: 'POST', body: new FormData() });
      const res = await ocrPOST(mockReq);
      results.push({
        test: 'API Authentication: /api/ocr rejects anonymous requests',
        passed: res.status === 401,
        details: `Returned status code: ${res.status} (Expected: 401)`
      });
    } catch (e) {
      results.push({ test: 'API Authentication: /api/ocr rejects anonymous requests', passed: false, details: e.message });
    }

    // Test 3: API Route Protection - /api/upload
    try {
      const mockReq = new Request('http://localhost/api/upload', { method: 'POST', body: new FormData() });
      const res = await uploadPOST(mockReq);
      results.push({
        test: 'API Authentication: /api/upload rejects anonymous requests',
        passed: res.status === 401,
        details: `Returned status code: ${res.status} (Expected: 401)`
      });
    } catch (e) {
      results.push({ test: 'API Authentication: /api/upload rejects anonymous requests', passed: false, details: e.message });
    }

    // Test 4: File Upload Extension Restrictions
    try {
      const formData = new FormData();
      const mockFile = new Blob(['console.log("malicious")'], { type: 'text/javascript' });
      formData.append('file', mockFile, 'exploit.js');
      formData.append('folder', 'general');

      const mockReq = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData
      });

      const res = await uploadPOST(mockReq);
      const json = await res.json();

      results.push({
        test: 'File Security: Block unsupported file extensions (.js)',
        passed: res.status === 400 && json.error.includes('Forbidden: Unsupported file type'),
        details: `Returned status code: ${res.status}, response: ${JSON.stringify(json)}`
      });
    } catch (e) {
      results.push({ test: 'File Security: Block unsupported file extensions (.js)', passed: false, details: e.message });
    }

    // Test 5: File Upload Path Traversal Prevention
    try {
      const formData = new FormData();
      const mockFile = new Blob(['hello world'], { type: 'text/plain' });
      formData.append('file', mockFile, 'test.txt');
      formData.append('folder', '../../traversal_test');

      const mockReq = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData
      });

      const res = await uploadPOST(mockReq);
      const json = await res.json();

      // If it returns a URL, check if folder path traversal was sanitized out to just 'traversal_test' or general
      const hasTraversalInUrl = json.url && json.url.includes('..');
      
      results.push({
        test: 'Directory Security: Sanitize path traversal sequences (../../)',
        passed: res.status === 200 && !hasTraversalInUrl,
        details: `Sanitized Upload Path URL: ${json.url || 'Blocked / Error'}`
      });
    } catch (e) {
      results.push({ test: 'Directory Security: Sanitize path traversal sequences (../../)', passed: false, details: e.message });
    }

    // Test 6: Environment Secret Protection
    const serviceKeyExposed = Object.keys(process.env).some(k => k.startsWith('NEXT_PUBLIC_') && k.includes('SERVICE_ROLE'));
    results.push({
      test: 'Configuration Security: Supabase Admin Service Key is not exposed to the client (NEXT_PUBLIC_ prefix check)',
      passed: !serviceKeyExposed,
      details: serviceKeyExposed ? 'CRITICAL: Service role key is prefixed with NEXT_PUBLIC_!' : 'Passed: Service role key is kept server-side.'
    });

    const allPassed = results.every(r => r.passed);
    return NextResponse.json({ success: allPassed, tests: results });
  } catch (error) {
    return NextResponse.json({ error: `Security checks failed: ${error.message}` }, { status: 500 });
  }
}
