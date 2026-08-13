const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Load primary API key from environment
const groqApiKey = process.env.GROQ_API_KEY || '';

// Initialize Supabase Admin client with safe fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

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
      model: 'llama-3.1-8b-instant',
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
          reject(new Error(`Groq status ${res.statusCode}: ${body}`));
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
  return `You are an expert academic evaluator. You are given the Assignment details, an Answer Key, a Grading Rubric, and the Maximum Marks.
Evaluate the student's response methodically and mathematically by following these rules:
1. IDENTIFY OFFICIAL QUESTIONS:
   - Identify the specific questions from the assignment text (\`question\`). If the assignment text lists specific questions (including any extracted question paper content listed in the description under '[Question Paper Content]:'), those are the ONLY official questions to grade.
   - If the assignment text (\`question\`) does not contain specific questions, look at the \`answerKey\` to identify them.
   - If both \`question\` and \`answerKey\` are generic, empty, or contain "Nothing", only then look at the student's submission (\`studentAnswer\`) to identify the questions.
   - If no specific sub-questions can be identified anywhere, treat the entire assignment as a single overall question to be graded.
2. EVALUATE ACCURACY & ALLOCATE MARKS:
   - Determine the total number of official questions (N).
   - The maximum marks allocated to EACH individual question MUST be exactly equal to: Maximum Marks (${maxMarks}) / N. Do NOT allocate custom weights, and do NOT group questions together. For example, if Maximum Marks is 100 and there are 20 questions, each question is worth exactly 5 marks.
       - **GRADING RATIOS BASED ON CONTENT LENGTH & COMPLETENESS**:
         - **SHORT AND CORRECT (30% to 40%)**: If the student's answer is very short (e.g. only a few words or a single short sentence) but technically correct according to the rubrics, award between 30% and 40% of the question's maximum marks. DO NOT award 60% to 80% for extremely short/low-effort answers.
         - **PARTIAL ANSWER (50% to 70%)**: If the student attempted the question and provided partial answers or definitions covering all required items from the given rubric, award between 50% and 70% of the question's maximum marks.
         - **ALL CORRECT & COMPLETE (80% to 100%)**: If the answer is correct, technically sound, and does not miss anything specified in the rubrics, award between 80% and 100% of the question's maximum marks.
         - **MISSED TOPIC PENALTY**: Reduce exactly 1 mark (from the question's maximum marks) if any of the key topics or required rubric elements are missed.
         - **MINIMUM MARKS FOR RELATED ANSWERS**: If the student's answer is not empty and contains at least something related to the question/topic, you MUST award a minimum of 1.0 mark (even if the content is incorrect, flawed, or extremely short). Only award exactly 0 marks if the answer is completely blank, unanswered, or contains nothing related to the topic.
         - **LENIENCY ON CODE SYNTAX & TYPOS**: Keep leniency for minor syntax errors and simple typos since students write code under exam pressure without autocomplete IDEs.
      - If a question is unanswered or missing in the student's submission, you MUST award exactly 0 marks for that specific question.
3. OUTPUT FORMAT:
   - Return a JSON object with a structured \`question_breakdown\` array. The array must contain exactly N items (one for each of the N official questions).
   - Each item in the \`question_breakdown\` array must contain:
     - "question_number": the integer question number (1, 2, ..., N).
     - "max_marks": the maximum marks for this question (exactly ${maxMarks} / N).
     - "score": the student's score for this question (from 0 to max_marks).
     - "reason": a brief reason for the score (e.g., "Correct answer", "Partially correct", "Unanswered").

Respond ONLY with a JSON object in the following format:
{
  "question_breakdown": [
    {
      "question_number": 1,
      "max_marks": 5.0,
      "score": 5.0,
      "reason": "Correct definition"
    },
    ...
  ],
  "confidence": 95.0,
  "feedback": "Detailed overall feedback about the grading...",
  "strengths": "Key positive elements of the student's answer.",
  "weaknesses": "Areas where the answer falls short or is missing."
}
The response must be valid JSON and contain no other text.`;
}

// Background Worker Loop
let isWorkerRunning = false;

async function evaluateAttempt(attempt) {
  try {
    // 1. Lock this attempt by setting status to 'grading'
    let initialFB = {};
    try {
      initialFB = JSON.parse(attempt.ai_feedback || '{}');
    } catch (e) {
      initialFB = {};
    }
    initialFB.status = 'grading';
    await supabaseAdmin
      .from('quiz_attempts')
      .update({ ai_feedback: JSON.stringify(initialFB) })
      .eq('id', attempt.id);

    // 2. Fetch the questions for this quiz
    const { data: questions, error: qError } = await supabaseAdmin
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', attempt.quiz_id);

    if (qError) throw qError;

    // 3. Fetch the quiz details (for negative marking etc.)
    const { data: quiz, error: quizError } = await supabaseAdmin
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
    const { error: updateError } = await supabaseAdmin
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
    await supabaseAdmin
      .from('quiz_attempts')
      .update({ ai_feedback: JSON.stringify(initialFB) })
      .eq('id', attempt.id);
  }
}

export function startBackgroundWorker() {
  if (isWorkerRunning || !supabaseAdmin) return;
  isWorkerRunning = true;
  console.log('[Queue Worker] Background worker loop started.');

  (async function loop() {
    while (true) {
      try {
        const { data: attempts, error } = await supabaseAdmin
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
