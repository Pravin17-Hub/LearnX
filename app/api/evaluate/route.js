import 'pdf-parse/worker';
import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { supabase } from '@/lib/supabase';

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

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key is missing. Please configure GROQ_API_KEY or OPENAI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const isGroq = apiKey.startsWith('gsk_');
    const apiUrl = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

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
                model: isGroq ? 'qwen/qwen3.6-27b' : 'gpt-4o-mini',
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
Evaluate the student's response strictly, methodically, and mathematically by following these rules:
1. IDENTIFY OFFICIAL QUESTIONS:
   - Identify the specific questions from the assignment text (\`question\`). If the assignment text lists specific questions (including any extracted question paper content listed in the description under '[Question Paper Content]:'), those are the ONLY official questions to grade.
   - If the assignment text (\`question\`) does not contain specific questions, look at the \`answerKey\` to identify them.
   - If both \`question\` and \`answerKey\` are generic, empty, or contain "Nothing", only then look at the student's submission (\`studentAnswer\`) to identify the questions.
   - If no specific sub-questions can be identified anywhere, treat the entire assignment as a single overall question to be graded.
2. EVALUATE ACCURACY & ALLOCATE MARKS:
   - Calculate the marks per question by dividing the Maximum Marks (${maxMarks}) by the number of official questions identified in the question paper/assignment text (\`question\`), NOT by the number of answers in the student's answer sheet. (For example, if the question paper has 10 questions but the student has written 20 answers, split the marks among the 10 official questions, grading only those 10 questions).
   - Grade each official question relative to the provided \`answerKey\` or \`rubric\`. If the \`answerKey\` is generic (e.g., "read the question and give marks"), evaluate the correctness of the student's answers based on objective academic facts and standard knowledge for the assignment's subject matter.
   - If an official question from the question paper is unanswered in the student's submission, you MUST award 0 marks for that specific question.
3. CALCULATE SCORE:
   - Sum the marks obtained for each individual official question to calculate the final score.
   - If the student's answer is correct and matches the subject matter, award the appropriate marks.
4. BREAKDOWN IN FEEDBACK:
   - You MUST list the individual question-by-question marks breakdown in the \`feedback\` JSON property (e.g., 'Question 1: 10/10, Question 2: 8/10, ... Total: 18/20') followed by explanations.

Respond ONLY with a JSON object in the following format:
{
  "score": 85,
  "confidence": 95.0,
  "feedback": "[Mandatory Question-by-Question Marks Breakdown here] Detailed feedback about the grading, explaining why marks were deducted or awarded.",
  "strengths": "Key positive elements of the student's answer.",
  "weaknesses": "Areas where the answer falls short or is missing.",
}
Ensure the score is an integer between 0 and ${maxMarks}. The response must be valid JSON and contain no other text.`;

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
      seed: 42,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `AI service status ${response.status}: ${errorText}` },
        { status: 500 }
      );
    }

    const responseJson = await response.json();
    const jsonText = responseJson.choices?.[0]?.message?.content || '{}';
    
    // Robust cleanup of markdown wrappers if present
    let cleanJson = jsonText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    
    const parsedEvaluation = JSON.parse(cleanJson);
    return NextResponse.json(parsedEvaluation);
  } catch (error) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
