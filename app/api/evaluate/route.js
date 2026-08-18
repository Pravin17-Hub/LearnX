import 'pdf-parse/worker';
import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { supabase } from '@/lib/supabase';
import { addToQueue, startBackgroundWorker } from '@/lib/evaluateQueue';

// Start the background worker process if not already running
startBackgroundWorker();

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

    const { question, answerKey, rubric, maxMarks, studentAnswer, questionPaperUrl } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key is missing. Please configure GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let model = 'gpt-4o-mini';
    let ocrModel = 'gpt-4o-mini';

    if (process.env.GEMINI_API_KEY && apiKey === process.env.GEMINI_API_KEY) {
      apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      model = 'gemini-3.6-flash';
      ocrModel = 'gemini-3.6-flash';
    } else if (process.env.GROQ_API_KEY && apiKey === process.env.GROQ_API_KEY) {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      model = 'qwen/qwen3.6-27b';
      ocrModel = 'qwen/qwen3.6-27b';
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    let questionPaperText = "";
    if (questionPaperUrl) {
      try {
        let qpUrl = questionPaperUrl;
        if (qpUrl.startsWith('/')) {
          qpUrl = `${baseUrl}${qpUrl}`;
        }
        const fileRes = await fetch(qpUrl);
        if (fileRes.ok) {
          const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
          const fileName = qpUrl.split('?')[0].split('/').pop().toLowerCase();
          
          if (fileName.endsWith('.pdf')) {
            const parser = new PDFParse({ data: fileBuffer });
            const parsed = await parser.getText();
            questionPaperText = parsed.text || '';
          } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            questionPaperText = result.value || '';
          } else if (fileName.endsWith('.txt')) {
            questionPaperText = fileBuffer.toString('utf-8');
          } else if (/\.(png|jpg|jpeg)$/i.test(fileName)) {
            // Groq Vision OCR for image question sheets
            const base64Image = fileBuffer.toString('base64');
            const mimeType = fileRes.headers.get('content-type') || 'image/jpeg';
            const dataUrl = `data:${mimeType};base64,${base64Image}`;
            
            const ocrRes = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: ocrModel,
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Transcribe the questions in this question sheet. Return only the raw transcribed text.'
                      },
                      {
                        type: 'image_url',
                        image_url: { url: dataUrl }
                      }
                    ]
                  }
                ],
                temperature: 0.0
              })
            });
            if (ocrRes.ok) {
              const json = await ocrRes.json();
              questionPaperText = json.choices?.[0]?.message?.content?.trim() || '';
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse question paper in evaluate API:', err.message);
      }
    }

    const finalQuestion = questionPaperText 
      ? `${question}\n\n[Question Paper Content]:\n${questionPaperText}`
      : question;

    const systemPrompt = `You are an expert academic evaluator. You are given the Assignment details, an Answer Key, a Grading Rubric, and the Maximum Marks.
Evaluate the student's response methodically and mathematically by following these rules:
1. IDENTIFY OFFICIAL QUESTIONS:
   - Identify the specific questions from the assignment text (\`question\`). If the assignment text lists specific questions (including any extracted question paper content listed in the description under '[Question Paper Content]:'), those are the ONLY official questions to grade.
   - If the assignment text (\`question\`) does not contain specific questions, look at the \`answerKey\` to identify them.
   - If both \`question\` and \`answerKey\` are generic, empty, or contain "Nothing", only then look at the student's submission (\`studentAnswer\`) to identify the questions.
   - If no specific sub-questions can be identified anywhere, treat the entire assignment as a single overall question to be graded.
2. EVALUATE ACCURACY & ALLOCATE MARKS:
   - Determine the exact total number of official questions (N).
   - The maximum marks allocated to EACH individual question MUST be exactly equal to: Maximum Marks (${maxMarks}) / N. Do NOT allocate custom weights, and do NOT group questions together. For example, if Maximum Marks is 100 and there are 20 questions, each question is worth exactly 5 marks.
       - **GRADING RATIOS BASED ON CONTENT LENGTH & COMPLETENESS**:
         - **SHORT AND CORRECT (30% to 40%)**: If the student's answer is very short (e.g. only a few words or a single short sentence) but technically correct according to the rubrics, award between 30% and 40% of the question's maximum marks. DO NOT award 60% to 80% for extremely short/low-effort answers.
         - **PARTIAL ANSWER (50% to 70%)**: If the student attempted the question and provided partial answers or definitions covering all required items from the given rubric, award between 50% and 70% of the question's maximum marks.
         - **ALL CORRECT & COMPLETE (80% to 100%)**: If the answer is correct, technically sound, and does not miss anything specified in the rubrics, award between 80% and 100% of the question's maximum marks.
         - **MISSED TOPIC PENALTY**: Reduce exactly 1 mark (from the question's maximum marks) if any of the key topics or required rubric elements are missed.
         - **MINIMUM MARKS FOR RELATED ANSWERS**: If the student's answer is not empty and contains at least something related to the question/topic (even if the content is incorrect, flawed, or extremely short), you MUST award a minimum of 1.0 mark. However, if the answer is completely unrelated to the question/topic, or is blank/unanswered, you MUST award exactly 0 marks.
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

    const userContent = `Question: ${finalQuestion}

Answer Key: ${answerKey}

Rubric: ${rubric}

Maximum Marks: ${maxMarks}

Student Answer: ${studentAnswer}`;

    const requestBody = {
      model: model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.0,
    };

    const parsedEvaluation = await addToQueue(systemPrompt, userContent);
    
    // Programmatically calculate total score and breakdown text in JS to ensure mathematical consistency
    let finalCalculatedScore = 0;
    let finalMaxMarksSum = 0;
    let breakdownParts = [];

    if (Array.isArray(parsedEvaluation.question_breakdown)) {
      parsedEvaluation.question_breakdown.forEach((q) => {
        // Cap individual question score at its max marks to prevent AI hallucinations/mismatch bugs
        const maxQ = Number(q.max_marks) || 0;
        const cappedScore = Math.min(maxQ, Number(q.score) || 0);
        q.score = cappedScore;

        finalCalculatedScore += cappedScore;
        finalMaxMarksSum += maxQ;
        breakdownParts.push(`Question ${q.question_number}: ${q.score}/${q.max_marks}`);
      });
    }

    const calculatedScoreRounded = Math.round(finalCalculatedScore);
    const calculatedMaxMarksRounded = Math.round(finalMaxMarksSum) || maxMarks;

    // Overwrite fields to ensure mathematical consistency
    parsedEvaluation.score = calculatedScoreRounded;
    
    const breakdownPrefix = breakdownParts.length > 0
      ? breakdownParts.join(', ') + `, Total: ${calculatedScoreRounded}/${calculatedMaxMarksRounded}`
      : `Total: ${calculatedScoreRounded}/${calculatedMaxMarksRounded}`;

    parsedEvaluation.feedback = `${breakdownPrefix}. ${parsedEvaluation.feedback || ''}`;

    return NextResponse.json(parsedEvaluation);
  } catch (error) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
