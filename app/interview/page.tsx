'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useInterviewStore } from '@/lib/store';
import EnvironmentCheck from '@/components/environment/EnvironmentCheck';

type Phase =
  | 'env-check'
  | 'briefing'
  | 'active'
  | 'feedback';

export default function InterviewPage() {
  const router = useRouter();

  const session = useInterviewStore((s) => s.session);

  const { nextQuestion, submitAnswer } =
    useInterviewStore();

  const [phase, setPhase] =
    useState<Phase>('env-check');

  const [answer, setAnswer] = useState('');

  const qi = session?.currentQuestionIndex ?? 0;

  const total = session?.questions.length ?? 0;

  const cq = session?.questions[qi];

  useEffect(() => {
    if (!session) {
      router.replace('/setup');
    }
  }, [session, router]);

  if (!session) return null;

  // ENV CHECK

  if (phase === 'env-check') {
    return (
      <EnvironmentCheck
        onPass={() => setPhase('briefing')}
        onSkip={() => setPhase('briefing')}
      />
    );
  }

  // BRIEFING

  if (phase === 'briefing') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07101f',
          color: 'white',
        }}
      >
        <div
          style={{
            background: '#111827',
            padding: 40,
            borderRadius: 20,
            width: 500,
          }}
        >
          <h1 style={{ marginBottom: 20 }}>
            PrepTalk AI Interview
          </h1>

          <p style={{ marginBottom: 10 }}>
            Role: {session.jobTitle}
          </p>

          <p style={{ marginBottom: 20 }}>
            Questions: {total}
          </p>

          <button
            onClick={() => setPhase('active')}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE INTERVIEW

  if (phase === 'active' && cq) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#07101f',
          color: 'white',
          padding: 30,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
          }}
        >
          <h1 style={{ marginBottom: 20 }}>
            Question {qi + 1} / {total}
          </h1>

          <div
            style={{
              background: '#111827',
              padding: 20,
              borderRadius: 20,
              marginBottom: 20,
            }}
          >
            <h2>{cq.text}</h2>
          </div>

          <textarea
            value={answer}
            onChange={(e) =>
              setAnswer(e.target.value)
            }
            rows={8}
            placeholder="Type your answer..."
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 12,
              background: '#1f2937',
              color: 'white',
              border: 'none',
              marginBottom: 20,
            }}
          />

          <button
            onClick={() => {
              submitAnswer({
                questionId: cq.id,
                text: answer,
                duration: 0,
                score: 0,
                feedback: '',
              });

              setAnswer('');

              if (qi >= total - 1) {
                router.push('/results');
              } else {
                nextQuestion();
              }
            }}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#16a34a',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Submit Answer
          </button>
        </div>
      </div>
    );
  }

  return null;
}