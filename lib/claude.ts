// Centralized Anthropic API call wrapper for client-side use
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2048
): Promise<string> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userMessage, maxTokens }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'API call failed');
  }

  const data = await response.json();
  return data.text;
}

export function parseJSON<T>(text: string, fallback: T): T {
  // Strip markdown code fences
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Try extracting the first JSON array or object
    const match = clean.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return fallback;
  }
}
