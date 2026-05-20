import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { session } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const avgScore = session.answers.length > 0
      ? Math.round(session.answers.reduce((s: number, a: { score?: number }) => s + (a.score || 0), 0) / session.answers.length)
      : 0;

    const highEvents   = session.proctoringEvents.filter((e: { severity: string }) => e.severity === 'high').length;
    const mediumEvents = session.proctoringEvents.filter((e: { severity: string }) => e.severity === 'medium').length;
    const proctoringScore = Math.max(0, 100 - highEvents * 15 - mediumEvents * 5);

    const system = `You are a senior HR consultant writing a final interview evaluation report.
Return ONLY a valid JSON object with no markdown, no explanation, no code fences.

The JSON must have exactly these fields:
{
  "overallAssessment": "2-3 sentence overall candidate assessment",
  "technicalProficiency": "brief assessment of technical skills demonstrated",
  "communicationScore": 75,
  "technicalScore": 80,
  "behavioralScore": 70,
  "integrityScore": 90,
  "hiringRecommendation": "Hire",
  "recommendationReason": "one sentence reason for recommendation",
  "topStrengths": ["strength 1", "strength 2", "strength 3"],
  "developmentAreas": ["area 1", "area 2"],
  "nextSteps": ["step 1", "step 2", "step 3"],
  "executiveSummary": "4-5 sentence executive summary of the candidate"
}

hiringRecommendation must be exactly one of: Strong Hire, Hire, Maybe, No Hire
All score fields must be numbers between 0 and 100.
Return ONLY the JSON object, nothing else.`;

    const user = `Job Title: ${session.jobTitle}
Experience Level: ${session.experienceLevel}
Average Answer Score: ${avgScore}/100
Proctoring Integrity Score: ${proctoringScore}/100
Total proctoring incidents: ${session.proctoringEvents.length} (${highEvents} high severity, ${mediumEvents} medium severity)
Questions answered: ${session.answers.length} out of ${session.questions.length}

Individual answer scores:
${session.answers.slice(0, 8).map((a: { score?: number; feedback?: string }, i: number) =>
  `Q${i + 1}: ${a.score || 0}/100 — ${a.feedback || 'No feedback available'}`
).join('\n')}

Generate the complete interview report as a JSON object only.`;

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
    let text = data.choices?.[0]?.message?.content || '{}';

    // Strip code fences
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');

    const report = JSON.parse(match[0]);
    return NextResponse.json({ report, avgScore, proctoringScore });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
  }
}
