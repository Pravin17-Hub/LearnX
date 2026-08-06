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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Missing file argument.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name.toLowerCase();
    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        extractedText = data.text || '';
        
        // If extracted text is very short/empty, the PDF is likely scanned. 
        // Suggest the user upload it as an image to use visual OCR.
        if (extractedText.trim().length < 50) {
          extractedText += "\n[Warning: PDF appears to contain scanned images. For accurate handwriting/visual grading, please upload as a JPG or PNG image.]";
        }
      } catch (err) {
        return NextResponse.json({ error: `Failed to parse PDF document text: ${err.message}` }, { status: 500 });
      }
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const result = await mammoth.extractRawText({ buffer: buffer });
        extractedText = result.value || '';
      } catch (err) {
        return NextResponse.json({ error: `Failed to parse Word Document text: ${err.message}` }, { status: 500 });
      }
    } else if (
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png')
    ) {
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: 'API key is missing. Please configure GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in environment variables.' },
            { status: 500 }
          );
        }

        let apiUrl = 'https://api.openai.com/v1/chat/completions';
        let model = 'gpt-4o-mini';

        if (process.env.GEMINI_API_KEY && apiKey === process.env.GEMINI_API_KEY) {
          apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
          model = 'gemini-2.5-flash';
        } else if (process.env.GROQ_API_KEY && apiKey === process.env.GROQ_API_KEY) {
          apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
          model = 'qwen/qwen3.6-27b';
        }

        // base64 encode the image
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Transcribe the text in this image. Do not add any conversational remarks, explanations or markdown headers. Return ONLY the raw transcribed text. If it is a handwritten test or exam sheet, transcribe the handwriting as accurately as possible.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl
                    }
                  }
                ]
              }
            ],
            temperature: 0.0
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Vision AI request failed status ${response.status}: ${errText}`);
        }

        const json = await response.json();
        extractedText = json.choices?.[0]?.message?.content?.trim() || 'No text detected in the image.';
      } catch (err) {
        return NextResponse.json({ error: `Vision OCR processing error: ${err.message}` }, { status: 500 });
      }
    } else if (fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: `Unsupported file format: ${fileName}` }, { status: 400 });
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
