'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useInterviewStore } from '@/lib/store';
import ProctoringEngine from '@/components/proctoring/ProctoringEngine';
import AudioPanel from '@/components/audio/AudioPanel';
import EnvironmentCheck from '@/components/environment/EnvironmentCheck';
import { useSpeechToText } from '@/lib/useSpeechToText';

type Phase =
  | 'env-check'
  | 'briefing'
  | 'active'
  | 'evaluating'
  | 'feedback';

type Mode = 'speech' | 'text';

interface CoachMsg {
  text: string;
  type: 'calm' | 'encourage' | 'warn' | 'tip';
  id: number;
}

export default function InterviewPage() {
  const router = useRouter();

  const session = useInterviewStore((s) => s.session);

  const { submitAnswer, nextQuestion } = useInterviewStore();

  const [phase, setPhase] = useState<Phase>('env-check');
  const [mode, setMode] = useState<Mode>('speech');

  const [textAns, setTextAns] = useState('');
  const [speechAns, setSpeechAns] = useState('');

  const [timeLeft, setTimeLeft] = useState(0);
  const [qStart, setQStart] = useState(0);

  const [evalData, setEvalData] =
    useState<Record<string, unknown> | null>(null);

  const [vMsg, setVMsg] = useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [showSide, setShowSide] = useState(false);

  const [isPaused, setIsPaused] = useState(false);

  const [coachBanner, setCoachBanner] =
    useState<CoachMsg | null>(null);

  const [coachHistory, setCoachHistory] = useState<CoachMsg[]>([]);

  const [showScoreExp, setShowScoreExp] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const alertRef = useRef<NodeJS.Timeout | null>(null);
  const bannerTimer = useRef<NodeJS.Timeout | null>(null);

  const coachId = useRef(0);

  const savedTime = useRef(0);

  const qi = session?.currentQuestionIndex ?? 0;

  const total = session?.questions.length ?? 0;

  const cq = session?.questions[qi];

  const prog = total > 0 ? (qi / total) * 100 : 0;

  const {
    isRecording,
    transcript,
    interimText,
    isSupported,
    error: speechError,
    wordCount,
    startRecording,
    stopRecording,
    clearTranscript,
    setManualTranscript,
  } = useSpeechToText({
    onTranscript: (t) => setSpeechAns(t),
  });

  useEffect(() => {
    if (!session) {
      router.replace('/setup');
    }
  }, [session, router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (alertRef.current) clearTimeout(alertRef.current);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  // =========================
  // TIMER
  // =========================

  useEffect(() => {
    if (phase !== 'active' || !cq || isPaused) return;

    if (savedTime.current > 0) {
      setTimeLeft(savedTime.current);
      savedTime.current = 0;
    } else {
      setTimeLeft(cq.timeLimit);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }

        return p - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, qi, isPaused]);

  // =========================
  // PAUSE
  // =========================

  const handlePause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    savedTime.current = timeLeft;

    if (isRecording) stopRecording();

    setIsPaused(true);
  }, [timeLeft, isRecording, stopRecording]);

  const handleResume = useCallback(() => {
    setIsPaused(false);

    if (mode === 'speech' && isSupported) {
      startRecording();
    }
  }, [mode, isSupported, startRecording]);

  // =========================
  // COACH
  // =========================

  const handleCoachingMessage = useCallback(
    (
      message: string,
      type: 'calm' | 'encourage' | 'warn' | 'tip'
    ) => {
      if (isPaused) return;

      const id = ++coachId.current;

      const msg: CoachMsg = {
        text: message,
        type,
        id,
      };

      setCoachBanner(msg);

      setCoachHistory((prev) => [msg, ...prev].slice(0, 8));

      if (bannerTimer.current) {
        clearTimeout(bannerTimer.current);
      }

      bannerTimer.current = setTimeout(() => {
        setCoachBanner(null);
      }, 7000);
    },
    [isPaused]
  );

  // =========================
  // SUBMIT
  // =========================

  const handleSubmit = useCallback(async () => {
    if (!cq || !session) return;

    if (timerRef.current) clearInterval(timerRef.current);

    if (isRecording) stopRecording();

    const ans = mode === 'speech' ? transcript : textAns;

    if (!ans.trim()) {
      nextQuestion();
      reset();
      goNext();
      return;
    }

    setPhase('evaluating');

    const dur = Math.floor((Date.now() - qStart) / 1000);

    try {
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          question: cq,
          answer: ans,
          jobTitle: session.jobTitle,
          experienceLevel: session.experienceLevel,
          duration: dur,
        }),
      });

      const data = await res.json();

      const ev = data.evaluation || {};

      submitAnswer({
        questionId: cq.id,
        text: ans,
        duration: dur,
        score: ev.score || 0,
        feedback: ev.feedback || '',
        strengths: ev.strengths || [],
        improvements: ev.improvements || [],
        expectedAnswer: ev.modelAnswer || '',
      });

      setEvalData(ev);

      setPhase('feedback');
    } catch (err) {
      submitAnswer({
        questionId: cq.id,
        text: ans,
        duration: dur,
        score: 0,
        feedback: 'Evaluation unavailable.',
      });

      setPhase('feedback');
    }
  }, [
    cq,
    session,
    mode,
    transcript,
    textAns,
    qStart,
    isRecording,
    stopRecording,
    submitAnswer,
    nextQuestion,
  ]);

  // =========================
  // HELPERS
  // =========================

  const reset = () => {
    setSpeechAns('');
    setTextAns('');

    clearTranscript();

    setEvalData(null);

    savedTime.current = 0;
  };

  const goNext = () => {
    nextQuestion();

    reset();

    if (
      qi >= total - 1 ||
      session?.status === 'completed'
    ) {
      router.push('/results');
      return;
    }

    setPhase('active');

    setQStart(Date.now());

    if (mode === 'speech' && isSupported) {
      setTimeout(() => {
        startRecording();
      }, 400);
    }
  };

  // =========================
  // VIOLATIONS
  // =========================

  const handleViolation = useCallback(
    (type: string, sev: 'low' | 'medium' | 'high') => {
      if (isPaused) return;

      const msgs: Record<string, string> = {
        tab_switch:
          '⚠️ Tab switch detected! Stay on this page.',
        face_not_visible:
          '⚠️ Your face is not visible.',
        multiple_faces:
          '🚨 Multiple faces detected!',
        poor_posture:
          '📐 Please sit properly.',
        looking_away:
          '👁️ Please look at the screen.',
        low_light:
          '💡 Improve your lighting.',
      };

      if (sev !== 'low') {
        setVMsg(msgs[type] || 'Violation detected');

        if (alertRef.current) {
          clearTimeout(alertRef.current);
        }

        alertRef.current = setTimeout(() => {
          setVMsg(null);
        }, 4000);
      }
    },
    [isPaused]
  );

  // =========================
  // UTILS
  // =========================

  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60)
      .toString()
      .padStart(2, '0')}`;

  const timePct = cq
    ? (timeLeft / cq.timeLimit) * 100
    : 0;

  const timeColor =
    timePct > 50
      ? 'var(--green)'
      : timePct > 20
      ? 'var(--yellow)'
      : 'var(--red)';

  const score = (evalData?.score as number) ?? 0;

  const scoreCol =
    score >= 75
      ? 'var(--green)'
      : score >= 50
      ? 'var(--yellow)'
      : 'var(--red)';

  if (!session) return null;

  // =========================
  // ENV CHECK
  // =========================

  if (phase === 'env-check') {
    return (
      <EnvironmentCheck
        onPass={() => setPhase('briefing')}
        onSkip={() => setPhase('briefing')}
      />
    );
  }

  // =========================
  // BRIEFING
  // =========================

  if (phase === 'briefing') {
    return (
      <div>
        {/* YOUR BRIEFING UI HERE */}
      </div>
    );
  }

  // =========================
  // MAIN UI
  // =========================

  return (
    <div>
      {/* YOUR FULL UI JSX HERE */}

      <style jsx>{`
        @keyframes coachIn {
          from {
            opacity: 0;
            transform: translateY(-10px)
              translateX(-50%);
          }

          to {
            opacity: 1;
            transform: translateY(0)
              translateX(-50%);
          }
        }

        @keyframes pulse {
          0% {
            opacity: 0.4;
          }

          50% {
            opacity: 1;
          }

          100% {
            opacity: 0.4;
          }
        }

        .pulse {
          animation: pulse 1.5s infinite;
        }

        @media (min-width: 880px) {
          .iv-side {
            display: block !important;
          }

          .iv-wrap {
            display: grid !important;
            grid-template-columns: 1fr 300px;
          }
        }
      `}</style>
    </div>
  );
}