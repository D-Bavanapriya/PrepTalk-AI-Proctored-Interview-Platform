<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { questions, jobTitle, experienceLevel } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const system = `You are a senior technical interviewer.
For each question provided, generate a concise ideal model answer (3-5 sentences).
Return ONLY a valid JSON array with no markdown, no explanation, no code fences.

The JSON array must follow this exact format:
[
  { "questionId": "q_id_here", "expectedAnswer": "Ideal answer in 3-5 sentences." },
  { "questionId": "q_id_here", "expectedAnswer": "Ideal answer in 3-5 sentences." }
]

Rules:
- Match the answer depth to the question difficulty (easy = concise, hard = detailed)
- Include specific examples, techniques, or frameworks where relevant
- Keep each answer practical and relevant to the job title and experience level
- Return ONLY the JSON array, nothing else.`;

    const questionList = questions.map((q: {
      id: string; text: string; category: string; difficulty: string;
    }, i: number) =>
      `Q${i + 1} [id: ${q.id}] [${q.category}] [${q.difficulty}]\n${q.text}`
    ).join('\n\n');

    const user = `Job Title: ${jobTitle}
Experience Level: ${experienceLevel}

Generate ideal expected answers for all of the following interview questions:

${questionList}

Return a JSON array only.`;

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
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq request failed');
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '[]';

    // Strip code fences if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const expectedAnswers: { questionId: string; expectedAnswer: string }[] = JSON.parse(match[0]);

    return NextResponse.json({ expectedAnswers });

  } catch (error) {
    console.error('Generate expected answers error:', error);
    return NextResponse.json({ error: 'Failed to generate expected answers' }, { status: 500 });
  }
}
=======
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { questions, jobTitle, experienceLevel } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const system = `You are a senior technical interviewer.
For each question provided, generate a concise ideal model answer (3-5 sentences).
Return ONLY a valid JSON array with no markdown, no explanation, no code fences.

The JSON array must follow this exact format:
[
  { "questionId": "q_id_here", "expectedAnswer": "Ideal answer in 3-5 sentences." },
  { "questionId": "q_id_here", "expectedAnswer": "Ideal answer in 3-5 sentences." }
]

Rules:
- Match the answer depth to the question difficulty (easy = concise, hard = detailed)
- Include specific examples, techniques, or frameworks where relevant
- Keep each answer practical and relevant to the job title and experience level
- Return ONLY the JSON array, nothing else.`;

    const questionList = questions.map((q: {
      id: string; text: string; category: string; difficulty: string;
    }, i: number) =>
      `Q${i + 1} [id: ${q.id}] [${q.category}] [${q.difficulty}]\n${q.text}`
    ).join('\n\n');

    const user = `Job Title: ${jobTitle}
Experience Level: ${experienceLevel}

Generate ideal expected answers for all of the following interview questions:

${questionList}

Return a JSON array only.`;

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
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq request failed');
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '[]';

    // Strip code fences if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const expectedAnswers: { questionId: string; expectedAnswer: string }[] = JSON.parse(match[0]);

    return NextResponse.json({ expectedAnswers });

  } catch (error) {
    console.error('Generate expected answers error:', error);
    return NextResponse.json({ error: 'Failed to generate expected answers' }, { status: 500 });
  }
}
>>>>>>> 2971d9ebc80599e70654021a2d5fdaea23e9e6ce
