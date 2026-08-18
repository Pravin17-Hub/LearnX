import https from 'https';
import { createClient } from '@supabase/supabase-js';

// Load primary API key from environment
const groqApiKey = process.env.GROQ_API_KEY || '';

let supabaseAdminClient = null;
function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
    supabaseAdminClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseAdminClient;
}

console.log(`[Queue System] Initialized with primary Groq API key.`);

// Queue state
const queue = [];
let activeCount = 0;
const MAX_CONCURRENCY = 1; // Strict sequential processing to prevent rate limit on 1 key

// Safe delay between requests to prevent rate limit (5.5 seconds)
const SAFE_DELAY_MS = 5500;
let lastCallTime = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Low level call to Groq using the key
function fetchFromGroq(apiKey, systemPrompt, userContent) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'openai/gpt-oss-20b',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.0
    });

    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 429) {
          reject({ status: 429, message: 'Groq Rate Limit' });
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini status ${res.statusCode}: ${body}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const text = parsed.choices?.[0]?.message?.content || '{}';
          let cleanJson = text.trim();
          if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          resolve(JSON.parse(cleanJson));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Process the next task in queue
async function processQueue() {
  if (queue.length === 0 || activeCount >= MAX_CONCURRENCY) {
    return;
  }

  activeCount++;
  const task = queue.shift();

  // Enforce delay per request
  const now = Date.now();
  const timePassed = now - lastCallTime;
  if (timePassed < SAFE_DELAY_MS) {
    const waitTime = SAFE_DELAY_MS - timePassed;
    await sleep(waitTime);
  }

  // Update last call time
  lastCallTime = Date.now();

  let success = false;
  let retries = 5;
  let retryDelay = 15000;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Queue System] Processing descriptive answer evaluation...`);
      const result = await fetchFromGroq(groqApiKey, task.systemPrompt, task.userContent);
      task.resolve(result);
      success = true;
      break;
    } catch (err) {
      if (err.status === 429 || err.message.includes('Limit')) {
        console.warn(`[Queue System] Rate limited. Waiting ${retryDelay / 1000}s to retry...`);
        await sleep(retryDelay);
        retryDelay += 5000;
      } else {
        console.error(`[Queue System] Request failed: ${err.message}. Retrying...`);
        await sleep(2000);
      }
    }
  }

  if (!success) {
    task.reject(new Error('AI evaluation failed after multiple retries due to rate limits. Please try again in a few moments.'));
  }

  activeCount--;
  // Check if there are more tasks
  processQueue();
}

export function addToQueue(systemPrompt, userContent) {
  return new Promise((resolve, reject) => {
    queue.push({
      systemPrompt,
      userContent,
      resolve,
      reject
    });
    // Trigger processing
    processQueue();
  });
}

// Generate the standard evaluation system prompt
function getSystemPrompt(maxMarks) {
  return `You are an expert academic evaluator. You are given the Question details, an Answer Key, a Grading Rubric, and the Maximum Marks (${maxMarks}).
Evaluate the student's response methodically and mathematically by following these strict rules:

1. GRADING CRITERIA & MARKS ALLOCATION:
   - **MAXIMUM MARKS**: The question carries a total of ${maxMarks} marks.
   - **LENIENCY ON SYNTAX ERRORS & TYPOS (NO PENALTY)**: DO NOT deduct marks for simple syntax errors, casing mistakes, or minor typos in code and examples. Students write under exam conditions without IDE autocomplete. If the logic, concept, or intent is clear, award FULL credit for that part.
   - **PENALTIES FOR MISSING, INCOMPLETE, OR WRONG CONTENT**:
     - Deduct marks ONLY when required concepts, definitions, explanations, or requested examples are missing, incomplete, or factually wrong.
     - **ALL CORRECT & COMPLETE (80% to 100%)**: Award between 80% and 100% of ${maxMarks} if all key concepts and examples are covered, even if there are minor syntax errors.
     - **PARTIAL / INCOMPLETE ANSWER (50% to 70%)**: Award between 50% and 70% of ${maxMarks} if the student attempted all parts but provided incomplete definitions or omitted some sub-topics.
     - **SHORT BUT CORRECT (30% to 40%)**: Award between 30% and 40% of ${maxMarks} if the answer is very short (e.g. only 1-2 lines) but correct.
     - **MISSED TOPIC PENALTY**: Deduct 1 to 2 marks for each required major rubric topic or example that was completely omitted.
     - **MINIMUM MARKS FOR RELATED ATTEMPTS**: If the student wrote something genuinely related to the topic (even if flawed or minimal), award at least 1.0 mark. Award exactly 0 marks ONLY if the answer is completely blank or totally unrelated.

2. DETAILED FEEDBACK REQUIREMENTS:
   - Provide a thorough, constructive, and comprehensive academic review.
   - You MUST explicitly include:
     - **Detailed Overview**: What the student answered and why they received this score.
     - **Key Strengths**: Specific concepts, definitions, or examples they got right.
     - **Areas for Improvement & Missing Elements**: Explicitly list what was missing, incomplete, or could be improved.

3. OUTPUT FORMAT:
   - Respond ONLY with a valid JSON object matching this schema:
{
  "question_breakdown": [
    {
      "question_number": 1,
      "max_marks": ${maxMarks}.0,
      "score": 8.5,
      "reason": "Clear explanation of concepts with examples."
    }
  ],
  "confidence": 98.0,
  "feedback": "Comprehensive overview of the answer and rationale for the score...",
  "strengths": "Detailed breakdown of the strengths demonstrated in the response...",
  "weaknesses": "Detailed list of missing concepts, omitted examples, or incomplete explanations..."
}`;
}

// Background Worker Loop
let isWorkerRunning = false;

export async function evaluateAttempt(attempt) {
  try {
    // 1. Lock this attempt by setting status to 'grading'
    let initialFB = {};
    try {
      initialFB = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      initialFB = {};
    }
    initialFB.status = 'grading';
    await getSupabaseAdmin()
      .from('quiz_attempts')
      .update({ ai_feedback: JSON.stringify(initialFB) })
      .eq('id', attempt.id);

    // 2. Fetch the questions for this quiz
    const { data: questions, error: qError } = await getSupabaseAdmin()
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', attempt.quiz_id);

    if (qError) throw qError;

    // 3. Fetch the quiz details (for negative marking etc.)
    const { data: quiz, error: quizError } = await getSupabaseAdmin()
      .from('quizzes')
      .select('*')
      .eq('id', attempt.quiz_id)
      .single();

    if (quizError) throw quizError;

    let answers = {};
    try {
      answers = JSON.parse(attempt.answers_json || '{}');
    } catch (e) {
      answers = {};
    }

    const feedbackMap = initialFB.feedbackMap || {};
    let finalScore = 0;

    // Grade MCQs first
    for (const q of questions) {
      if (q.question_type === 'MCQ') {
        const studentAns = answers[q.id] || '';
        let corrects = [];
        try {
          corrects = JSON.parse(q.correct_answer_json || '[]');
        } catch (e) {
          corrects = [q.correct_answer_json];
        }

        if (studentAns.trim() !== '') {
          const correctIdx = corrects[0];
          if (studentAns === String(correctIdx)) {
            finalScore += q.points;
          } else {
            const penalty = quiz.negative_marking ? (q.negative_points || 0) : 0;
            finalScore -= penalty;
          }
        }
      }
    }

    // Grade theory questions sequentially via safe queue
    const theoryQuestions = questions.filter(q => q.question_type !== 'MCQ');
    for (const q of theoryQuestions) {
      const studentAns = answers[q.id] || '';
      const itemFeedback = feedbackMap[q.id] || {
        questionText: q.question_text,
        questionType: q.question_type,
        studentAnswer: studentAns,
        maxMarks: q.points,
        score: 0,
        feedback: '',
        correct: false
      };

      if (studentAns.trim() !== '') {
        let refAnswer = q.correct_answer_json;
        if (!refAnswer || refAnswer.trim() === '' || refAnswer === '[]') {
          refAnswer = 'A logical and concise academic explanation.';
        }

        const rubric = 'Assess grammar, reasoning, terminology accuracy, and completion.';
        const systemPrompt = getSystemPrompt(q.points);
        const userContent = `Question: ${q.question_text}\nAnswer Key: ${refAnswer}\nRubric: ${rubric}\nMaximum Marks: ${q.points}\nStudent Answer: ${studentAns}`;

        try {
          const aiResult = await addToQueue(systemPrompt, userContent);
          const score = Number(aiResult.score) || 0;
          finalScore += score;
          itemFeedback.score = score;
          itemFeedback.feedback = aiResult.feedback || 'AI evaluated successfully.';
          itemFeedback.ai_response = aiResult;
          if (score >= q.points * 0.75) {
            itemFeedback.correct = true;
          }
        } catch (err) {
          console.error(`[Queue Worker] AI evaluation failed for Q ${q.id}:`, err.message);
          const fallback = Math.max(1, Math.floor(q.points / 2));
          finalScore += fallback;
          itemFeedback.score = fallback;
          itemFeedback.feedback = 'AI grader was busy. Awarded half-marks for completion.';
        }
      } else {
        itemFeedback.feedback = attempt.violation_reason ? 'No answer submitted before secure environment termination.' : 'No answer submitted.';
      }

      feedbackMap[q.id] = itemFeedback;
    }

    if (finalScore < 0) finalScore = 0;

    // 4. Update the attempt with the final results
    const { error: updateError } = await getSupabaseAdmin()
      .from('quiz_attempts')
      .update({
        score: Math.round(finalScore),
        ai_feedback: JSON.stringify(feedbackMap)
      })
      .eq('id', attempt.id);

    if (updateError) throw updateError;
    console.log(`[Queue Worker] Successfully graded attempt ID: ${attempt.id}. Final Score: ${finalScore}`);
  } catch (err) {
    console.error(`[Queue Worker] Failed to grade attempt ID ${attempt.id}:`, err.message);
    // Reset status back to 'queued' so it can be retried
    let initialFB = {};
    try {
      initialFB = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      initialFB = {};
    }
    initialFB.status = 'queued';
    await getSupabaseAdmin()
      .from('quiz_attempts')
      .update({ ai_feedback: JSON.stringify(initialFB) })
      .eq('id', attempt.id);
  }
}

export function startBackgroundWorker() {
  if (isWorkerRunning || !getSupabaseAdmin()) return;
  isWorkerRunning = true;
  console.log('[Queue Worker] Background worker loop started.');

  (async function loop() {
    while (true) {
      try {
        const { data: attempts, error } = await getSupabaseAdmin()
          .from('quiz_attempts')
          .select('*')
          .like('ai_feedback', '%"status":"queued"%')
          .order('id', { ascending: true }); // Process oldest first

        if (error) throw error;

        // Filter for attempts that are explicitly marked as "queued" and not in progress
        const queuedAttempt = (attempts || []).filter(att => att.violation_reason !== 'IN_PROGRESS').find(att => {
          try {
            const fb = JSON.parse(att.ai_feedback || '{}');
            return fb.status === 'queued';
          } catch (e) {
            return false;
          }
        });

        if (queuedAttempt) {
          console.log(`[Queue Worker] Found queued attempt ID: ${queuedAttempt.id}. Starting evaluation...`);
          await evaluateAttempt(queuedAttempt);
        }
      } catch (err) {
        console.error('[Queue Worker] Error in background loop:', err.message);
      }

      await sleep(5000);
    }
  })();
}
