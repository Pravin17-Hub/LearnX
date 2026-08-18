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
      model = 'openai/gpt-oss-20b';
      ocrModel = 'openai/gpt-oss-20b';
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

    const systemPrompt = `You are an expert academic evaluator strictly following the official faculty grading rubric and model answer for each question:

EVALUATION & GRADING INSTRUCTIONS:
1. STRICT ADHERENCE TO FACULTY RUBRIC:
   - Carefully read the Faculty Model Answer & Rubric provided in the prompt.
   - Award marks strictly based on the specific points and criteria specified by the faculty (e.g. Definition, Syntax, Example Program, Types/Operations with Code, Overall Understanding).
   - If a rubric specifies point allocations (e.g., 2 marks for definition, 3 marks for example program), allocate marks strictly according to those components.

2. LENIENCY ON MINOR ERRORS (DO NOT OVER-PENALIZE):
   - **ZERO PENALTY FOR MINOR SYNTAX ERRORS & TYPOS**: Do NOT deduct marks for minor code typos, casing mistakes, missing semicolons, or simple syntax errors in handwritten/typed code under exam conditions. If the logic, intent, or syntax structure is clear, award full credit for that code component.
   - **DEDUCT ONLY FOR MISSING OR FACTUALLY WRONG CONTENT**: Deduct marks ONLY when required definitions, concepts, explanations, requested code examples, or operations are omitted, incomplete, or incorrect.

3. SCORE ALLOCATION PER SUB-QUESTION:
   - Total Maximum Marks: ${maxMarks}.0.
   - For multiple sub-questions, allocate marks proportionally or according to the faculty rubric breakdown.
   - If unanswered, blank, or completely unrelated to the topic, award 0.0 for that question.
   - If at least something related to the topic is attempted, award at least 1.0.

4. OUTPUT FORMAT:
   - Return a JSON object with a structured \`question_breakdown\` array.
   - Respond ONLY with a valid JSON object matching this schema:
{
  "question_breakdown": [
    {
      "question_number": 1,
      "max_marks": 5.0,
      "score": 4.5,
      "reason": "Detailed summary of marks awarded across each faculty rubric criterion..."
    }
  ],
  "confidence": 98.0,
  "feedback": "Comprehensive summary of marks awarded across each faculty rubric criterion...",
  "strengths": "Specific points from the faculty rubric where the student scored marks...",
  "weaknesses": "Specific points from the faculty rubric where marks were lost (e.g. omitted operations, missing code)..."
}`;

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
