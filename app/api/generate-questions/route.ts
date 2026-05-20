import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { jobTitle, jobDescription, experienceLevel, questionCount = 8 } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const system = `You are an expert technical interviewer. Generate interview questions based on the job description.
Return ONLY a valid JSON array with no markdown, no explanation, no code fences whatsoever.

Each question object must have exactly these fields:
{
  "id": "q1",
  "text": "question text here",
  "category": "Technical",
  "difficulty": "medium",
  "timeLimit": 120,
  "followUp": "optional follow up question"
}

Rules:
- category must be one of: Technical, Behavioral, Situational, Culture Fit, Domain Knowledge
- difficulty must be one of: easy, medium, hard
- timeLimit must be a number between 60 and 180
- Mix of categories: 3 Technical, 2 Behavioral, 1 Situational, 1 Domain Knowledge, 1 Culture Fit
- Calibrate difficulty to the experience level
- Return ONLY the JSON array, nothing else`;

    const user = `Job Title: ${jobTitle}
Experience Level: ${experienceLevel}
Job Description: ${jobDescription}

Generate exactly ${questionCount} questions as a JSON array. Return only the array.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq request failed');
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '[]';

    // Strip code fences if model adds them
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const questions = JSON.parse(match[0]);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('Invalid questions array');

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Generate questions error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
