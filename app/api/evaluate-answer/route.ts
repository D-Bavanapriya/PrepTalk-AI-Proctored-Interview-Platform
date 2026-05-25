import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { question, answer, jobTitle, experienceLevel, duration } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const system = `You are an expert interviewer evaluating a candidate response.
Return ONLY a valid JSON object with no markdown, no explanation, no code fences.

The JSON object must have exactly these fields:
{
  "score": 75,
  "grade": "Good",
  "feedback": "2-3 sentence overall assessment of the answer",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "modelAnswer": "A brief ideal answer in 2-3 sentences"
}

Scoring guide:
- 90-100: Exceptional, comprehensive, with specific examples
- 75-89: Good, covers key points, minor gaps
- 60-74: Average, addresses question but lacks depth
- 40-59: Below average, misses important aspects
- 0-39: Poor, off-topic or very incomplete

grade must be one of: Excellent, Good, Average, Below Average, Poor
Return ONLY the JSON object, nothing else.`;

    const user = `Job: ${jobTitle} (${experienceLevel} level)
Question category: ${question.category}
Question difficulty: ${question.difficulty}
Question: ${question.text}
Time taken by candidate: ${duration} seconds

Candidate answer: "${answer}"

Evaluate this answer and return the JSON object only.`;

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
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq request failed');
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '{}';

    // Strip code fences
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');

    const evaluation = JSON.parse(match[0]);
    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('Evaluate answer error:', error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
