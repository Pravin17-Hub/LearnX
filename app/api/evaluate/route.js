import { NextResponse } from 'next/server';
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

    const { question, answerKey, rubric, maxMarks, studentAnswer } = await request.json();

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

    const systemPrompt = `You are an expert academic evaluator. You are given the Assignment details, an Answer Key, a Grading Rubric, and the Maximum Marks.
Evaluate the student's response strictly, methodically, and mathematically by following these rules:
1. IDENTIFY OFFICIAL QUESTIONS:
   - Identify specific questions from the assignment text (\`question\`) or the \`answerKey\`.
   - If the assignment text (\`question\`) or \`answerKey\` are generic, empty, or contain "Nothing", look at the student's submission (\`studentAnswer\`) to see if it lists numbered questions and answers (e.g., "Q1:", "1. What is..."). If so, treat those as the official questions to grade.
   - If no specific sub-questions can be identified anywhere, treat the entire assignment as a single overall question to be graded.
2. EVALUATE ACCURACY & ALLOCATE MARKS:
   - Grade the student's answers relative to the provided \`answerKey\` or \`rubric\`.
   - If the \`answerKey\` is generic (e.g., "read the question and give marks"), evaluate the correctness of the student's answers based on objective academic facts and standard knowledge for the assignment's subject matter.
   - Divide the Maximum Marks (${maxMarks}) equally among the identified questions. If there is only one overall question, grade the entire response out of ${maxMarks}.
3. CALCULATE SCORE:
   - Sum the marks obtained for each individual question to calculate the final score.
   - If the student's answer is correct and matches the subject matter, award the appropriate marks. Do not default to 0.
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

    const userContent = `Question: ${question}

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
