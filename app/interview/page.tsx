'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '@/lib/store';
import ProctoringEngine from '@/components/proctoring/ProctoringEngine';
import AudioPanel from '@/components/audio/AudioPanel';
import EnvironmentCheck from '@/components/environment/EnvironmentCheck';
import { useSpeechToText } from '@/lib/useSpeechToText';

type Phase = 'env-check' | 'briefing' | 'active' | 'evaluating' | 'feedback';
type Mode  = 'speech' | 'text';

interface CoachMsg { text: string; type: 'calm' | 'encourage' | 'warn' | 'tip'; id: number; }

export default function InterviewPage() {
  const router  = useRouter();
  const session = useInterviewStore(s => s.session);
  const { submitAnswer, nextQuestion } = useInterviewStore();

  const [phase,        setPhase]        = useState<Phase>('env-check');
  const [mode,         setMode]         = useState<Mode>('speech');
  const [textAns,      setTextAns]      = useState('');
  const [speechAns,    setSpeechAns]    = useState('');
  const [timeLeft,     setTimeLeft]     = useState(0);
  const [qStart,       setQStart]       = useState(0);
  const [evalData,     setEvalData]     = useState<Record<string, unknown> | null>(null);
  const [vMsg,         setVMsg]         = useState<string | null>(null);
  const [started,      setStarted]      = useState(false);
  const [showSide,     setShowSide]     = useState(false);
  const [isPaused,     setIsPaused]     = useState(false);
  const [pausedTime,   setPausedTime]   = useState(0);
  const [coachBanner,  setCoachBanner]  = useState<CoachMsg | null>(null);
  const [coachHistory, setCoachHistory] = useState<CoachMsg[]>([]);
  const [showScoreExp, setShowScoreExp] = useState(false);

  const timerRef    = useRef<NodeJS.Timeout | null>(null);
  const alertRef    = useRef<NodeJS.Timeout | null>(null);
  const bannerTimer = useRef<NodeJS.Timeout | null>(null);
  const coachId     = useRef(0);
  const savedTime   = useRef(0);

  const qi    = session?.currentQuestionIndex ?? 0;
  const total = session?.questions.length ?? 0;
  const cq    = session?.questions[qi];
  const prog  = total > 0 ? (qi / total) * 100 : 0;

  const {
    isRecording, displayText, transcript, interimText,
    isSupported, error: speechError, wordCount,
    startRecording, stopRecording, clearTranscript, setManualTranscript,
  } = useSpeechToText({ onTranscript: (t) => setSpeechAns(t) });

  useEffect(() => { if (!session) router.replace('/setup'); }, [session, router]);

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'active' || !cq || isPaused) return;
    if (savedTime.current > 0) {
      setTimeLeft(savedTime.current);
      savedTime.current = 0;
    } else {
      setTimeLeft(cq.timeLimit);
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(timerRef.current!); handleSubmit(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, qi, isPaused]);

  // ── Pause / Resume ──
  const handlePause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    savedTime.current = timeLeft;
    if (isRecording) stopRecording();
    setIsPaused(true);
  }, [timeLeft, isRecording, stopRecording]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    if (mode === 'speech' && isSupported) startRecording();
  }, [mode, isSupported, startRecording]);

  // ── Coaching banner ──
  const handleCoachingMessage = useCallback((message: string, type: 'calm' | 'encourage' | 'warn' | 'tip') => {
    if (isPaused) return;
    const id = ++coachId.current;
    const msg: CoachMsg = { text: message, type, id };
    setCoachBanner(msg);
    setCoachHistory(prev => [msg, ...prev].slice(0, 8));
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setCoachBanner(null), 7000);
  }, [isPaused]);

  // ── Submit answer ──
  const handleSubmit = useCallback(async () => {
    if (!cq || !session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (isRecording) stopRecording();
    const ans = mode === 'speech' ? transcript : textAns;
    if (!ans.trim()) { nextQuestion(); reset(); goNext(); return; }
    setPhase('evaluating');
    const dur = Math.floor((Date.now() - qStart) / 1000);
    try {
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cq, answer: ans, jobTitle: session.jobTitle, experienceLevel: session.experienceLevel, duration: dur }),
      });
      const data = await res.json();
      const ev = data.evaluation || {};
      submitAnswer({ questionId: cq.id, text: ans, duration: dur, score: ev.score || 0, feedback: ev.feedback || '', strengths: ev.strengths || [], improvements: ev.improvements || [], expectedAnswer: ev.modelAnswer || '' });
      setEvalData(ev);
      setPhase('feedback');
    } catch {
      submitAnswer({ questionId: cq.id, text: ans, duration: dur, score: 0, feedback: 'Evaluation unavailable.' });
      setPhase('feedback');
    }
  }, [cq, session, mode, transcript, textAns, qStart, isRecording, stopRecording, submitAnswer, nextQuestion]);

  const reset = () => { setSpeechAns(''); setTextAns(''); clearTranscript(); setEvalData(null); savedTime.current = 0; };

  const goNext = () => {
    nextQuestion(); reset();
    if (qi >= total - 1 || session?.status === 'completed') { router.push('/results'); return; }
    setPhase('active');
    setQStart(Date.now());
    if (mode === 'speech' && isSupported) setTimeout(() => startRecording(), 400);
  };

  const handleViolation = useCallback((type: string, sev: 'low' | 'medium' | 'high') => {
    if (isPaused) return;
    const msgs: Record<string, string> = {
      tab_switch: '⚠️ Tab switch detected! Stay on this page.',
      face_not_visible: '⚠️ Your face is not visible — please reposition.',
      multiple_faces: '🚨 Multiple faces detected — integrity violation!',
      poor_posture: '📐 Please sit up straight.',
      looking_away: '👁️ Please look at the screen.',
      low_light: '💡 Improve your lighting conditions.',
    };
    if (sev !== 'low') {
      setVMsg(msgs[type] || '⚠️ Violation detected');
      if (alertRef.current) clearTimeout(alertRef.current);
      alertRef.current = setTimeout(() => setVMsg(null), 4000);
    }
  }, [isPaused]);

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const timePct   = cq ? (timeLeft / cq.timeLimit) * 100 : 0;
  const timeColor = timePct > 50 ? 'var(--green)' : timePct > 20 ? 'var(--yellow)' : 'var(--red)';
  const score     = (evalData?.score as number) ?? 0;
  const scoreCol  = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';

  const bannerBg = (t: CoachMsg['type']) =>
    t === 'calm'      ? 'linear-gradient(135deg,rgba(16,185,129,.95),rgba(5,150,105,.95))'  :
    t === 'encourage' ? 'linear-gradient(135deg,rgba(26,127,232,.95),rgba(15,92,178,.95))'  :
    t === 'warn'      ? 'linear-gradient(135deg,rgba(245,158,11,.95),rgba(180,110,0,.95))'  :
                        'linear-gradient(135deg,rgba(139,92,246,.95),rgba(109,40,217,.95))';

  if (!session) return null;

  // ── Environment Check ──
  if (phase === 'env-check') {
    return <EnvironmentCheck onPass={() => setPhase('briefing')} onSkip={() => setPhase('briefing')} />;
  }

  // ── Briefing ──
  if (phase === 'briefing') {
    return (
      <div className="loading">
        <div className="bg-dots" />
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 600 }}>
          <div className="card" style={{ padding: '28px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🎯</div>
              <h1 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 800, marginBottom: 8 }}>Interview Briefing</h1>
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                Role: <strong style={{ color: 'var(--text)' }}>{session.jobTitle}</strong> &nbsp;·&nbsp;
                Level: <strong style={{ color: 'var(--text)' }}>{session.experienceLevel}</strong> &nbsp;·&nbsp;
                {total} Questions
              </p>
            </div>

            {/* Rules */}
            <div style={{ marginBottom: 20 }}>
              {[
                { i:'📸', t:'Keep your face clearly visible in the camera throughout' },
                { i:'🚫', t:'Do not switch tabs — every switch is logged as a violation' },
                { i:'👥', t:'Only you should be visible on camera at all times' },
                { i:'💡', t:'Ensure good lighting and a quiet environment' },
                { i:'⏱️', t:'Each question has a timer — submit before it runs out' },
                { i:'⏸️', t:'Use the Pause button for genuine interruptions only' },
                { i:'😊', t:'Stay calm — the AI coach will guide you if you seem nervous' },
              ].map((r, i, a) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom: i<a.length-1?'1px solid var(--border)':'none' }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>{r.i}</span>
                  <span style={{ color:'var(--text2)', fontSize:13, lineHeight:1.5 }}>{r.t}</span>
                </div>
              ))}
            </div>

            {/* How scoring works */}
            <div style={{ marginBottom: 20, padding:'12px 14px', borderRadius:10, background:'rgba(26,127,232,.06)', border:'1px solid rgba(26,127,232,.2)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#7dc1ff', marginBottom:8 }}>📊 HOW YOU ARE JUDGED</div>
              {[
                ['Answer Quality', '70%', 'Depth, accuracy, examples, clarity'],
                ['Integrity Score', '30%', 'Face visible, no tab switches, posture'],
              ].map(([label,pct,desc]) => (
                <div key={label} style={{ display:'flex', gap:10, marginBottom:6, alignItems:'flex-start' }}>
                  <span style={{ fontSize:12, color:'var(--blue)', fontWeight:700, minWidth:48 }}>{pct}</span>
                  <div>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>{label}: </span>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mode select */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'var(--text2)' }}>ANSWER MODE</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {([['speech','🎙️','Voice','Speak your answers — best accuracy'],['text','⌨️','Type','Type for maximum precision']] as const).map(([m,ic,lb,ds]) => (
                  <button key={m} onClick={() => setMode(m as Mode)} style={{ padding:'13px 10px', borderRadius:10, cursor:'pointer', textAlign:'left', border:`1px solid ${mode===m?'var(--blue)':'var(--border)'}`, background:mode===m?'rgba(26,127,232,.1)':'rgba(6,13,26,.4)', fontFamily:'Inter,sans-serif', transition:'all .2s' }}>
                    <div style={{ fontSize:20, marginBottom:5 }}>{ic}</div>
                    <div style={{ fontWeight:600, fontSize:13, color:mode===m?'#7dc1ff':'var(--text)', marginBottom:2 }}>{lb}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{ds}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => {
              setPhase('active'); setStarted(true); setQStart(Date.now());
              if (mode==='speech' && isSupported) startRecording();
            }} className="btn btn-p btn-full" style={{ padding:'15px', fontSize:16, borderRadius:12 }}>
              🚀 Start Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active Interview ──
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', position:'relative' }}>
      <div className="bg-dots" />

      {/* Progress */}
      <div className="prog-bar"><div className="prog-fill" style={{ width:`${prog}%` }} /></div>

      {/* ── Coaching Banner ── */}
      {coachBanner && !isPaused && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)', zIndex:500, borderRadius:14, padding:'13px 20px', background:bannerBg(coachBanner.type), boxShadow:'0 8px 32px rgba(0,0,0,.4)', fontSize:14, fontWeight:600, color:'#fff', maxWidth:'calc(100vw - 32px)', textAlign:'center', animation:'coachIn .4s cubic-bezier(.16,1,.3,1)', backdropFilter:'blur(10px)', lineHeight:1.5, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ flex:1 }}>{coachBanner.text}</span>
          <button onClick={() => setCoachBanner(null)} style={{ background:'rgba(255,255,255,.25)', border:'none', borderRadius:6, color:'#fff', cursor:'pointer', padding:'2px 8px', fontSize:12, fontFamily:'Inter,sans-serif', flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* Violation banner */}
      {vMsg && <div className="vbanner">{vMsg}</div>}

      {/* ── PAUSE OVERLAY ── */}
      {isPaused && (
        <div className="pause-overlay">
          <div style={{ fontSize:56, marginBottom:20 }}>⏸</div>
          <h2 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:800, marginBottom:12 }}>Interview Paused</h2>
          <p style={{ color:'var(--text2)', fontSize:15, marginBottom:8, maxWidth:400, lineHeight:1.6 }}>
            The timer and proctoring are paused. Take a moment, then click Resume when you are ready.
          </p>
          <p style={{ color:'var(--text3)', fontSize:13, marginBottom:36 }}>
            Time remaining: <strong style={{ color:'var(--yellow)' }}>{fmt(savedTime.current || timeLeft)}</strong>
          </p>
          <button onClick={handleResume} className="btn btn-p" style={{ padding:'16px 48px', fontSize:17, borderRadius:14 }}>
            ▶ Resume Interview
          </button>
        </div>
      )}

      {/* Header */}
      <header style={{ position:'fixed', top:3, left:0, right:0, zIndex:200, background:'rgba(7,16,31,.92)', backdropFilter:'blur(18px)', borderBottom:'1px solid var(--border)', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <div className="nav-logo" style={{ width:28, height:28, fontSize:13, flexShrink:0 }}>P</div>
          <span style={{ fontWeight:700, fontSize:14, flexShrink:0 }}>PrepTalk</span>
          <span style={{ color:'var(--text3)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>| {session.jobTitle}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {phase==='active' && (
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <svg width="24" height="24" viewBox="0 0 36 36" style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(56,158,248,.2)" strokeWidth="3"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={timeColor} strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*14}`}
                  strokeDashoffset={`${2*Math.PI*14*(1-timePct/100)}`}
                  style={{ transition:'stroke-dashoffset 1s linear,stroke .3s' }}/>
              </svg>
              <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:600, color:timeColor, minWidth:36 }}>{fmt(timeLeft)}</span>
            </div>
          )}
          <span style={{ fontSize:11, color:'var(--text3)' }}>Q{qi+1}/{total}</span>

          {/* Pause button */}
          {phase==='active' && !isPaused && (
            <button onClick={handlePause} className="btn btn-g btn-sm" style={{ padding:'5px 10px', fontSize:12 }}>⏸</button>
          )}

          {/* Camera toggle (mobile) */}
          <button onClick={() => setShowSide(p=>!p)} className="btn btn-g btn-sm" style={{ padding:'5px 9px', fontSize:12 }}>📷</button>

          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: isPaused?'var(--yellow)':'var(--red)' }} className={isPaused?'':'pulse'}/>
            <span style={{ fontSize:10, color: isPaused?'#fbbf24':'#f87171', fontWeight:600 }}>{isPaused?'PAUSED':'LIVE'}</span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="iv-wrap">

        {/* ── Side panel ── */}
        <div className="iv-side" style={{ display:showSide?'block':undefined }}>
          <div style={{ marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: isPaused?'var(--yellow)':'var(--red)' }} className={isPaused?'':'pulse'}/>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'1px' }}>
              {isPaused ? 'Paused' : 'Live Proctoring'}
            </span>
          </div>

          <ProctoringEngine isActive={started && !isPaused} onViolation={handleViolation} onCoachingMessage={handleCoachingMessage} />

          {/* Audio analysis */}
          <div style={{ marginTop:12 }}>
            <AudioPanel isActive={started && !isPaused && mode==='speech'} />
          </div>

          {/* Session info */}
          <div style={{ marginTop:12, padding:'12px', background:'rgba(15,28,52,.6)', borderRadius:10, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8, fontWeight:600 }}>Session</div>
            {[
              { l:'Role',       v: session.jobTitle.length>18?session.jobTitle.slice(0,18)+'…':session.jobTitle },
              { l:'Level',      v: session.experienceLevel },
              { l:'Progress',   v: `${qi+(phase==='feedback'?1:0)}/${total}` },
              { l:'Mode',       v: mode==='speech'?'🎙️ Voice':'⌨️ Text' },
              { l:'Violations', v: `${session.proctoringEvents.length}` },
            ].map(item => (
              <div key={item.l} className="prow">
                <span style={{ color:'var(--text3)' }}>{item.l}</span>
                <span style={{ color:'var(--text2)', fontWeight:500 }}>{item.v}</span>
              </div>
            ))}
          </div>

          {/* Coach history */}
          {coachHistory.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6, fontWeight:600 }}>AI Coach Log</div>
              {coachHistory.slice(0,3).map(m => (
                <div key={m.id} style={{ fontSize:11, color:'var(--text3)', padding:'4px 0', borderBottom:'1px solid var(--border)', lineHeight:1.4 }}>{m.text}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div className="iv-main">

          {/* Score explanation toggle */}
          <button onClick={() => setShowScoreExp(p=>!p)} style={{ fontSize:12, color:'#7dc1ff', background:'rgba(26,127,232,.08)', border:'1px solid rgba(26,127,232,.2)', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontFamily:'Inter,sans-serif', textAlign:'left', width:'100%' }}>
            📊 {showScoreExp ? 'Hide' : 'Show'} how you are being scored
          </button>

          {showScoreExp && (
            <div className="score-explain check-enter">
              <div style={{ fontSize:12, fontWeight:700, color:'#7dc1ff', marginBottom:10 }}>HOW YOUR SCORE IS CALCULATED</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                {[
                  { label:'Answer Quality', pct:'70%', color:'var(--blue)' },
                  { label:'Integrity',      pct:'30%', color:'var(--green)' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'10px', background:'rgba(6,13,26,.4)', borderRadius:8, textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color, marginBottom:4 }}>{s.pct}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.7 }}>
                <strong style={{ color:'var(--text2)' }}>Answer scored on:</strong> Accuracy · Depth · Examples used · Communication clarity<br/>
                <strong style={{ color:'var(--text2)' }}>Grades:</strong> 90–100 Exceptional · 75–89 Good · 60–74 Average · Below 60 Needs Work<br/>
                <strong style={{ color:'var(--text2)' }}>Integrity deductions:</strong> Tab switch −15pts · Multiple faces −15pts · Face hidden −5pts
              </div>
            </div>
          )}

          {/* Question */}
          {cq && (
            <div className="card" style={{ padding:'18px' }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:12 }}>
                <span className={`b-${cq.category==='Technical'?'blue':cq.category==='Behavioral'?'green':'yellow'}`}>{cq.category}</span>
                <span className={`b-${cq.difficulty==='hard'?'red':cq.difficulty==='medium'?'yellow':'green'}`}>{cq.difficulty}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)' }}>⏱ {Math.floor(cq.timeLimit/60)}:{(cq.timeLimit%60).toString().padStart(2,'0')}</span>
              </div>
              <p style={{ fontSize:'clamp(14px,2.5vw,18px)', fontWeight:600, lineHeight:1.55, marginBottom: cq.followUp?12:0 }}>{cq.text}</p>
              {cq.followUp && (
                <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(26,127,232,.07)', borderRadius:8, border:'1px solid rgba(26,127,232,.2)', fontSize:13, color:'var(--text2)' }}>
                  💡 <em>Follow-up: {cq.followUp}</em>
                </div>
              )}
            </div>
          )}

          {/* Answer area */}
          {phase === 'active' && (
            <div className="card" style={{ padding:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>Your Answer</span>
                  {mode==='speech' && wordCount > 0 && (
                    <span style={{ fontSize:11, color:'var(--text3)', background:'rgba(255,255,255,.06)', borderRadius:4, padding:'2px 7px' }}>{wordCount} words</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {(['speech','text'] as Mode[]).map(m => (
                    <button key={m} onClick={() => {
                      if (m==='speech'&&mode!=='speech'){setMode('speech');if(isSupported)startRecording();}
                      if (m==='text'&&mode!=='text'){setMode('text');if(transcript)setManualTranscript(transcript);stopRecording();}
                    }} style={{ padding:'4px 10px', fontSize:12, borderRadius:6, cursor:'pointer', border:`1px solid ${mode===m?'var(--blue)':'var(--border)'}`, background:mode===m?'rgba(26,127,232,.15)':'transparent', color:mode===m?'#7dc1ff':'var(--text3)', fontFamily:'Inter,sans-serif' }}>
                      {m==='speech'?'🎙️ Voice':'⌨️ Type'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'speech' ? (
                <>
                  {speechError && (
                    <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', fontSize:13, color:'#f87171', marginBottom:10 }}>
                      ⚠️ {speechError} — Switch to Type mode or check microphone permissions.
                    </div>
                  )}
                  <div style={{ minHeight:110, padding:'12px 14px', background:'rgba(6,13,26,.65)', border:`1px solid ${isRecording?'var(--border-h)':'var(--border)'}`, borderRadius:10, marginBottom:10, lineHeight:1.75, fontSize:15, transition:'border-color .2s', position:'relative', color:'var(--text)' }}>
                    {transcript && <span>{transcript}</span>}
                    {interimText && <span style={{ color:'var(--text3)', fontStyle:'italic' }}>{transcript?' ':''}{interimText}</span>}
                    {!transcript && !interimText && <span style={{ color:'var(--text3)' }}>Your speech will appear here as you talk…</span>}
                    {isRecording && <span style={{ display:'inline-block', width:2, height:15, background:'var(--blue)', marginLeft:2, verticalAlign:'middle' }} className="pulse"/>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    {isRecording ? (
                      <>
                        <div style={{ display:'flex', gap:3, alignItems:'flex-end' }}>
                          {[8,14,20,14,8].map((h,i) => <div key={i} className="wbar" style={{ height:h }}/>)}
                        </div>
                        <span style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>● Recording</span>
                        <button onClick={stopRecording} className="btn btn-g btn-sm" style={{ marginLeft:'auto' }}>⏸ Pause mic</button>
                      </>
                    ) : (
                      <button onClick={startRecording} className="btn btn-g btn-sm">🎙️ Resume mic</button>
                    )}
                  </div>
                </>
              ) : (
                <textarea value={textAns} onChange={e => setTextAns(e.target.value)}
                  placeholder="Type your answer here…" rows={6} className="inp" />
              )}

              <button onClick={handleSubmit} disabled={mode==='speech'?(!transcript&&!textAns):!textAns.trim()} className="btn btn-p btn-full" style={{ padding:'13px', fontSize:15, borderRadius:11, marginTop:12 }}>
                Submit &amp; Evaluate →
              </button>
            </div>
          )}

          {/* Evaluating */}
          {phase === 'evaluating' && (
            <div className="card" style={{ padding:'40px 20px', textAlign:'center' }}>
              <div style={{ fontSize:38, marginBottom:12 }} className="bounce">🧠</div>
              <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Evaluating Your Answer</h3>
              <p style={{ color:'var(--text2)', marginBottom:28, fontSize:14 }}>AI is analysing your response…</p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                {[0,1,2].map(i => <div key={i} className="tdot" style={{ width:11,height:11,borderRadius:'50%',background:'var(--blue)' }}/>)}
              </div>
            </div>
          )}

          {/* Feedback */}
          {phase === 'feedback' && evalData && (
            <div className="card" style={{ padding:'18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <h3 style={{ fontWeight:700, fontSize:'clamp(15px,3vw,19px)' }}>Answer Evaluation</h3>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, padding:'4px 10px', borderRadius:6, fontWeight:700, background:`color-mix(in srgb,${scoreCol} 15%,transparent)`, border:`1px solid ${scoreCol}`, color:scoreCol }}>
                    {evalData.grade as string}
                  </span>
                  <div style={{ width:52, height:52, borderRadius:'50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:`color-mix(in srgb,${scoreCol} 15%,transparent)`, border:`2px solid ${scoreCol}`, flexShrink:0 }}>
                    <span style={{ fontSize:18, fontWeight:800, color:scoreCol }}>{score}</span>
                    <span style={{ fontSize:9, color:'var(--text3)' }}>/100</span>
                  </div>
                </div>
              </div>

              <div style={{ padding:'11px 13px', borderRadius:8, background:'rgba(26,127,232,.05)', border:'1px solid var(--border)', marginBottom:12, fontSize:14, color:'var(--text2)', lineHeight:1.65 }}>
                {evalData.feedback as string}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', marginBottom:7 }}>✓ Strengths</div>
                  {((evalData.strengths as string[])||[]).map((s,i) => (
                    <div key={i} style={{ fontSize:12, color:'var(--text2)', padding:'3px 0', display:'flex', gap:5 }}>
                      <span style={{ color:'var(--green)', flexShrink:0 }}>+</span>{s}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--yellow)', marginBottom:7 }}>↑ Improve</div>
                  {((evalData.improvements as string[])||[]).map((s,i) => (
                    <div key={i} style={{ fontSize:12, color:'var(--text2)', padding:'3px 0', display:'flex', gap:5 }}>
                      <span style={{ color:'var(--yellow)', flexShrink:0 }}>→</span>{s}
                    </div>
                  ))}
                </div>
              </div>

              {evalData.modelAnswer && (
                <div style={{ padding:'9px 12px', borderRadius:8, background:'rgba(26,127,232,.06)', border:'1px solid rgba(26,127,232,.2)', marginBottom:12 }}>
                  <div style={{ fontSize:10, color:'#7dc1ff', fontWeight:700, marginBottom:4 }}>💡 MODEL ANSWER HINT</div>
                  <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{evalData.modelAnswer as string}</div>
                </div>
              )}

              <button onClick={goNext} className="btn btn-p btn-full" style={{ padding:'13px', fontSize:15, borderRadius:11 }}>
                {qi>=total-1 ? '🏁 View Full Report →' : `Next Question (${qi+1}/${total}) →`}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes coachIn { from{opacity:0;transform:translateY(-10px) translateX(-50%)} to{opacity:1;transform:translateY(0) translateX(-50%)} }
        @media(min-width:880px){
          .iv-side{display:block!important;}
          .iv-wrap{display:grid!important;grid-template-columns:1fr 300px;}
        }
      `}</style>
    </div>
  );
}
