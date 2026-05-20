'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useInterviewStore } from '@/lib/store';

interface Props {
  isActive: boolean;
  onViolation?: (type: string, severity: 'low' | 'medium' | 'high') => void;
  onCoachingMessage?: (message: string, type: 'calm' | 'encourage' | 'warn' | 'tip') => void;
}

interface FrameSnapshot {
  centerX: number;
  centerY: number;
  faceArea: number;
  brightness: number;
  skinRatio: number;
  timestamp: number;
}

interface NervousnessState {
  score: number;           // 0–100
  level: 'calm' | 'mild' | 'moderate' | 'high';
  signals: string[];       // active nervousness signals detected
  headMovement: number;    // how much head is moving frame to frame
  faceJitter: number;      // micro-movement intensity
  positionVariance: number;// variance in face position
}

const CALM_MESSAGES = [
  "😊 Take a deep breath — you're doing great!",
  "🌟 Relax, you've got this. Speak slowly and clearly.",
  "💪 Don't worry — just answer naturally as you would in a conversation.",
  "🎯 You're doing well! Take a moment to collect your thoughts.",
  "🧘 Breathe in... breathe out. You know this material!",
  "✨ Stay calm — the interviewer wants you to succeed.",
  "👍 Slow down a little — take your time, there's no rush.",
  "💬 Speak from your experience — your answer is valid!",
];

const ENCOURAGE_MESSAGES = [
  "🔥 Great answer! Keep that energy going!",
  "⭐ Excellent eye contact — that shows confidence!",
  "👏 You're speaking clearly and confidently. Well done!",
  "💡 Great structure to your answer — keep it up!",
  "🚀 You sound very confident — that's impressive!",
];

const POSTURE_MESSAGES = [
  "📐 Sit up straight — good posture signals confidence.",
  "🪑 Try to sit upright — it helps you breathe and speak better.",
  "💺 Adjust your posture — shoulders back, chin up!",
];

const TIP_MESSAGES = [
  "💡 Tip: Use the STAR method — Situation, Task, Action, Result.",
  "💡 Tip: Pause briefly before answering — it shows you're thinking.",
  "💡 Tip: Make eye contact with the camera, not the screen.",
  "💡 Tip: Speak at 80% of your normal speed — it sounds more confident.",
  "💡 Tip: Use specific examples from your past experience.",
];

export default function ProctoringEngine({ isActive, onViolation, onCoachingMessage }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intRef      = useRef<NodeJS.Timeout | null>(null);
  const coachIntRef = useRef<NodeJS.Timeout | null>(null);
  const lastTs      = useRef<Record<string, number>>({});
  const frameHistory = useRef<FrameSnapshot[]>([]);
  const lastCoachMsg = useRef<number>(0);
  const consecutiveNervous = useRef<number>(0);
  const consecutiveCalm    = useRef<number>(0);
  const encourageCount     = useRef<number>(0);

  const [faceOk,      setFaceOk]      = useState(false);
  const [multiface,   setMultiface]   = useState(false);
  const [lookAway,    setLookAway]    = useState(false);
  const [badPost,     setBadPost]     = useState(false);
  const [lowLight,    setLowLight]    = useState(false);
  const [tabOk,       setTabOk]       = useState(true);
  const [camErr,      setCamErr]      = useState<string | null>(null);
  const [vCount,      setVCount]      = useState(0);
  const [nervousness, setNervousness] = useState<NervousnessState>({
    score: 0, level: 'calm', signals: [],
    headMovement: 0, faceJitter: 0, positionVariance: 0,
  });
  const [liveMsg, setLiveMsg]         = useState<{ text: string; type: 'calm' | 'encourage' | 'warn' | 'tip' } | null>(null);
  const liveMsgTimer = useRef<NodeJS.Timeout | null>(null);

  const addEvent = useInterviewStore(s => s.addProctoringEvent);

  // ── Show a coaching message on screen + fire callback ──
  const showCoachingMessage = useCallback((
    message: string,
    type: 'calm' | 'encourage' | 'warn' | 'tip',
    minGapMs = 12000,
  ) => {
    const now = Date.now();
    if (now - lastCoachMsg.current < minGapMs) return;
    lastCoachMsg.current = now;
    setLiveMsg({ text: message, type });
    onCoachingMessage?.(message, type);
    if (liveMsgTimer.current) clearTimeout(liveMsgTimer.current);
    liveMsgTimer.current = setTimeout(() => setLiveMsg(null), 7000);
  }, [onCoachingMessage]);

  // ── Throttled integrity event logger ──
  const fireEvent = useCallback((
    type: 'tab_switch' | 'face_not_visible' | 'multiple_faces' | 'poor_posture' | 'looking_away' | 'low_light',
    severity: 'low' | 'medium' | 'high',
    description: string,
  ) => {
    const now = Date.now();
    const cd = severity === 'high' ? 5000 : severity === 'medium' ? 8000 : 15000;
    if (now - (lastTs.current[type] || 0) < cd) return;
    lastTs.current[type] = now;
    addEvent({ type, severity, description });
    onViolation?.(type, severity);
    if (severity !== 'low') setVCount(v => v + 1);
  }, [addEvent, onViolation]);

  // ── Camera init ──
  const initCam = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }, audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
      setCamErr(null);
    } catch {
      setCamErr('Camera access denied. Please allow camera access.');
    }
  }, []);

  // ── Compute nervousness from frame history ──
  const computeNervousness = useCallback((history: FrameSnapshot[]): NervousnessState => {
    if (history.length < 4) {
      return { score: 0, level: 'calm', signals: [], headMovement: 0, faceJitter: 0, positionVariance: 0 };
    }

    const recent = history.slice(-12); // last ~20 seconds at 1.8s interval

    // Head movement: average displacement between consecutive frames
    let totalMovement = 0;
    let totalAreaChange = 0;
    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].centerX - recent[i-1].centerX;
      const dy = recent[i].centerY - recent[i-1].centerY;
      totalMovement += Math.sqrt(dx*dx + dy*dy);
      totalAreaChange += Math.abs(recent[i].faceArea - recent[i-1].faceArea);
    }
    const avgMovement   = totalMovement / (recent.length - 1);
    const avgAreaChange = totalAreaChange / (recent.length - 1);

    // Position variance: how much face bounces around
    const avgX = recent.reduce((s, f) => s + f.centerX, 0) / recent.length;
    const avgY = recent.reduce((s, f) => s + f.centerY, 0) / recent.length;
    const variance = recent.reduce((s, f) => {
      const dx = f.centerX - avgX; const dy = f.centerY - avgY;
      return s + dx*dx + dy*dy;
    }, 0) / recent.length;
    const posVariance = Math.sqrt(variance);

    // Jitter: high-frequency small movements (nervousness signature)
    let jitter = 0;
    for (let i = 2; i < recent.length; i++) {
      const d1x = recent[i-1].centerX - recent[i-2].centerX;
      const d2x = recent[i].centerX   - recent[i-1].centerX;
      const d1y = recent[i-1].centerY - recent[i-2].centerY;
      const d2y = recent[i].centerY   - recent[i-1].centerY;
      // Direction reversals = jitter
      if (d1x * d2x < 0 || d1y * d2y < 0) jitter++;
    }
    const jitterRatio = jitter / Math.max(recent.length - 2, 1);

    // Brightness variance: rapid lighting changes = phone/movement
    const brightVar = recent.reduce((s, f) => {
      const diff = f.brightness - (recent.reduce((a, b) => a + b.brightness, 0) / recent.length);
      return s + diff * diff;
    }, 0) / recent.length;

    // Build nervousness score
    let score = 0;
    const signals: string[] = [];

    // Head movement contribution (0-30)
    if (avgMovement > 8) { score += 30; signals.push('Excessive head movement'); }
    else if (avgMovement > 4) { score += 18; signals.push('Frequent head movement'); }
    else if (avgMovement > 2) { score += 8; }

    // Jitter contribution (0-25)
    if (jitterRatio > 0.6) { score += 25; signals.push('Rapid micro-movements detected'); }
    else if (jitterRatio > 0.4) { score += 15; signals.push('Slight fidgeting detected'); }
    else if (jitterRatio > 0.25) { score += 8; }

    // Position variance (0-20)
    if (posVariance > 12) { score += 20; signals.push('Unstable position'); }
    else if (posVariance > 7) { score += 12; }
    else if (posVariance > 4) { score += 5; }

    // Face area change = leaning in/out (0-15)
    if (avgAreaChange > 300) { score += 15; signals.push('Leaning forward/backward frequently'); }
    else if (avgAreaChange > 150) { score += 8; }

    // Brightness instability (0-10)
    if (brightVar > 100) { score += 10; signals.push('Unstable lighting / movement'); }
    else if (brightVar > 40) { score += 5; }

    score = Math.min(100, Math.round(score));
    const level: NervousnessState['level'] =
      score >= 65 ? 'high' : score >= 40 ? 'moderate' : score >= 20 ? 'mild' : 'calm';

    return {
      score, level, signals,
      headMovement: Math.round(avgMovement * 10) / 10,
      faceJitter: Math.round(jitterRatio * 100),
      positionVariance: Math.round(posVariance * 10) / 10,
    };
  }, []);

  // ── Main frame analysis ──
  const analyse = useCallback(() => {
    const v = videoRef.current; const c = canvasRef.current;
    if (!v || !c || v.readyState < 2) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const W = c.width = v.videoWidth || 320;
    const H = c.height = v.videoHeight || 240;
    ctx.drawImage(v, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;

    // ── Brightness ──
    let bright = 0, bs = 0;
    for (let i = 0; i < d.length; i += 4 * 20) {
      bright += d[i] * .299 + d[i+1] * .587 + d[i+2] * .114; bs++;
    }
    const avgBright = bs ? bright / bs : 128;
    const isLow = avgBright < 38;

    // ── Skin pixel detection ──
    let total = 0, wLeft = 0, wRight = 0, wUpper = 0, wLower = 0, wBottom = 0;
    let sumX = 0, sumY = 0;
    const step = 5;
    const midY = H * .5, botY = H * .65, edgeX = W * .22;

    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const idx = (y * W + x) * 4;
        const r = d[idx], g = d[idx+1], b = d[idx+2];
        if (r > 60 && g > 30 && b > 15 && r > g && r > b && (r-g) > 10 && (r-b) > 15 && r < 250) {
          total++;
          sumX += x; sumY += y;
          if (x < edgeX)       wLeft++;
          if (x > W - edgeX)   wRight++;
          if (y < midY)        wUpper++; else wLower++;
          if (y > botY)        wBottom++;
        }
      }
    }

    const area = (W / step) * (H / step);
    const skinRatio = total / area;
    const face  = skinRatio > 0.052 && !isLow;
    const multi = face && wLeft > 30 && wRight > 30;
    const away  = face && wLower > wUpper * 1.75;
    const post  = face && wBottom > 50;

    // Face center for movement tracking
    const faceCenterX = total > 0 ? sumX / total : W / 2;
    const faceCenterY = total > 0 ? sumY / total : H / 2;
    const faceArea    = total;

    setFaceOk(face); setMultiface(multi); setLookAway(away); setBadPost(post); setLowLight(isLow);

    // ── Store frame snapshot for nervousness analysis ──
    if (face) {
      const snapshot: FrameSnapshot = {
        centerX: faceCenterX, centerY: faceCenterY,
        faceArea, brightness: avgBright, skinRatio,
        timestamp: Date.now(),
      };
      frameHistory.current.push(snapshot);
      if (frameHistory.current.length > 30) frameHistory.current.shift(); // keep last 30 frames

      // Compute nervousness every 5 frames
      if (frameHistory.current.length % 5 === 0) {
        const ns = computeNervousness(frameHistory.current);
        setNervousness(ns);

        // Nervousness-based coaching
        if (ns.level === 'high' || ns.level === 'moderate') {
          consecutiveNervous.current++;
          consecutiveCalm.current = 0;

          if (consecutiveNervous.current >= 2) {
            // Trigger calm message
            const msg = CALM_MESSAGES[Math.floor(Math.random() * CALM_MESSAGES.length)];
            showCoachingMessage(msg, 'calm', 15000);
          }
        } else if (ns.level === 'calm') {
          consecutiveCalm.current++;
          consecutiveNervous.current = 0;

          // Encourage when calm for a while
          if (consecutiveCalm.current >= 4 && encourageCount.current < 3) {
            encourageCount.current++;
            const msg = ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)];
            showCoachingMessage(msg, 'encourage', 20000);
          }
        }
      }
    } else {
      // No face — clear history to avoid stale nervousness
      if (frameHistory.current.length > 0) {
        frameHistory.current = [];
      }
    }

    // ── Integrity events ──
    if (multi)              fireEvent('multiple_faces',   'high',   'Multiple faces detected in frame');
    else if (!face && !isLow) fireEvent('face_not_visible', 'medium', 'Face not visible in camera');
    else if (away)          fireEvent('looking_away',     'low',    'Candidate appears to be looking away');
    else if (post)          fireEvent('poor_posture',     'low',    'Poor posture detected');
    if (isLow)              fireEvent('low_light',        'low',    'Insufficient lighting detected');

    // Posture coaching
    if (post) {
      const msg = POSTURE_MESSAGES[Math.floor(Math.random() * POSTURE_MESSAGES.length)];
      showCoachingMessage(msg, 'warn', 20000);
    }
  }, [fireEvent, computeNervousness, showCoachingMessage]);

  // ── Periodic tips (every 45 seconds) ──
  useEffect(() => {
    if (!isActive) return;
    const tipInterval = setInterval(() => {
      const msg = TIP_MESSAGES[Math.floor(Math.random() * TIP_MESSAGES.length)];
      showCoachingMessage(msg, 'tip', 30000);
    }, 45000);
    return () => clearInterval(tipInterval);
  }, [isActive, showCoachingMessage]);

  // ── Tab focus ──
  useEffect(() => {
    if (!isActive) return;
    const fn = () => {
      const ok = !document.hidden;
      setTabOk(ok);
      if (!ok) fireEvent('tab_switch', 'high', 'Candidate switched browser tab or window');
    };
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, [isActive, fireEvent]);

  // ── Camera + analysis interval ──
  useEffect(() => {
    if (!isActive) return;
    initCam();
    intRef.current = setInterval(analyse, 1800);
    return () => {
      if (intRef.current)      clearInterval(intRef.current);
      if (coachIntRef.current) clearInterval(coachIntRef.current);
      if (liveMsgTimer.current) clearTimeout(liveMsgTimer.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isActive, initCam, analyse]);

  // Nervousness level colours & labels
  const nervColor =
    nervousness.level === 'calm'     ? 'var(--green)'  :
    nervousness.level === 'mild'     ? '#a3e635'       :
    nervousness.level === 'moderate' ? 'var(--yellow)' : 'var(--red)';

  const nervLabel =
    nervousness.level === 'calm'     ? '😊 Calm'      :
    nervousness.level === 'mild'     ? '🙂 Slightly tense' :
    nervousness.level === 'moderate' ? '😰 Nervous'   : '😱 Very Nervous';

  const overallOk = !multiface && (!(!faceOk && !lowLight));
  const camBorderColor =
    multiface || (!faceOk && !lowLight) ? 'var(--red)'    :
    badPost || lookAway || lowLight      ? 'var(--yellow)' : 'var(--green)';

  const statusLabel =
    multiface || (!faceOk && !lowLight) ? 'VIOLATION' :
    badPost || lookAway || lowLight      ? 'WARNING'   : 'CLEAR';

  const rows = [
    { l: 'Face Detected', ok: faceOk,    w: 'Not visible'  },
    { l: 'Single Person', ok: !multiface, w: 'Multi-face'   },
    { l: 'Eye Contact',   ok: !lookAway,  w: 'Looking away' },
    { l: 'Posture',       ok: !badPost,   w: 'Poor posture' },
    { l: 'Lighting',      ok: !lowLight,  w: 'Low light'    },
    { l: 'Tab Focus',     ok: tabOk,      w: 'Tab switched' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Live Coaching Message (inside panel) ── */}
      {liveMsg && (
        <div style={{
          padding: '12px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.55, fontWeight: 500,
          animation: 'slideUp .4s ease',
          background:
            liveMsg.type === 'calm'      ? 'rgba(16,185,129,.12)'  :
            liveMsg.type === 'encourage' ? 'rgba(26,127,232,.12)'  :
            liveMsg.type === 'warn'      ? 'rgba(245,158,11,.12)'  : 'rgba(139,92,246,.12)',
          border:
            liveMsg.type === 'calm'      ? '1px solid rgba(16,185,129,.35)'  :
            liveMsg.type === 'encourage' ? '1px solid rgba(26,127,232,.35)'  :
            liveMsg.type === 'warn'      ? '1px solid rgba(245,158,11,.35)'  : '1px solid rgba(139,92,246,.35)',
          color:
            liveMsg.type === 'calm'      ? '#34d399' :
            liveMsg.type === 'encourage' ? '#7dc1ff' :
            liveMsg.type === 'warn'      ? '#fbbf24' : '#c4b5fd',
        }}>
          {liveMsg.text}
        </div>
      )}

      {/* ── Camera Feed ── */}
      <div className="cam-wrap" style={{ border: `1.5px solid ${camBorderColor}`, transition: 'border-color .3s', position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', background: '#000' }}>
        {/* Corner brackets */}
        {([
          { top: 5, left: 5,   bw: '2px 0 0 2px', br: '4px 0 0 0' },
          { top: 5, right: 5,  bw: '2px 2px 0 0', br: '0 4px 0 0' },
          { bottom: 5, left: 5,  bw: '0 0 2px 2px', br: '0 0 0 4px' },
          { bottom: 5, right: 5, bw: '0 2px 2px 0', br: '0 0 4px 0' },
        ]).map((s, i) => (
          <div key={i} style={{
            position: 'absolute', width: 15, height: 15, zIndex: 10,
            border: `solid ${camBorderColor}`, borderWidth: s.bw, borderRadius: s.br,
            transition: 'border-color .3s',
            ...('top'    in s ? { top:    s.top }    : { bottom: (s as {bottom:number}).bottom }),
            ...('left'   in s ? { left:   s.left }   : { right:  (s as {right:number}).right }),
          }} />
        ))}

        {/* Scan line */}
        <div style={{ position: 'absolute', width: '100%', height: 2, background: `linear-gradient(90deg,transparent,${camBorderColor}60,transparent)`, animation: 'scan 3s linear infinite', pointerEvents: 'none', zIndex: 5 }} />

        <video ref={videoRef} autoPlay muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', opacity: camErr ? 0 : 1 }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Camera error */}
        {camErr && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,13,26,.9)', padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 26, marginBottom: 8 }}>📷</span>
            <span style={{ fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>{camErr}</span>
          </div>
        )}

        {/* Status badge */}
        <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.78)', borderRadius: 6, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 5, zIndex: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: camBorderColor, flexShrink: 0 }} className="pulse" />
          <span style={{ fontSize: 10, color: camBorderColor, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{statusLabel}</span>
        </div>

        {/* Face detection box */}
        {faceOk && !multiface && (
          <div style={{ position: 'absolute', top: '10%', left: '18%', width: '64%', height: '72%', border: `1.5px solid ${camBorderColor}`, borderRadius: 8, pointerEvents: 'none', transition: 'border-color .3s', zIndex: 8 }}>
            <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: camBorderColor, borderRadius: 4, padding: '1px 7px', fontSize: 9, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Face ✓
            </div>
          </div>
        )}

        {/* Nervousness overlay on camera */}
        {faceOk && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(0,0,0,.7)', borderRadius: 6, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
            <span style={{ fontSize: 11, color: nervColor, fontWeight: 600, whiteSpace: 'nowrap' }}>{nervLabel}</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${nervousness.score}%`, background: nervColor, borderRadius: 2, transition: 'width .8s ease, background .5s' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>{nervousness.score}</span>
          </div>
        )}

        {/* Tab switch overlay */}
        {!tabOk && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', zIndex: 20 }}>
            <div style={{ textAlign: 'center', color: '#f87171' }}>
              <div style={{ fontSize: 22 }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: 10, marginTop: 4 }}>TAB SWITCH</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Nervousness Detail Card ── */}
      {faceOk && (
        <div style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${nervColor}30`, background: `${nervColor}08` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: nervColor }}>Composure Analysis</span>
            <span style={{ fontSize: 11, color: nervColor, fontWeight: 600 }}>{nervLabel}</span>
          </div>

          {/* Mini bars */}
          {[
            { label: 'Head Stability',   value: Math.max(0, 100 - nervousness.headMovement * 12) },
            { label: 'Steadiness',       value: Math.max(0, 100 - nervousness.faceJitter) },
            { label: 'Position Calm',    value: Math.max(0, 100 - nervousness.positionVariance * 6) },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>
                <span>{item.label}</span>
                <span style={{ color: item.value >= 70 ? 'var(--green)' : item.value >= 45 ? 'var(--yellow)' : 'var(--red)' }}>
                  {Math.round(item.value)}%
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, transition: 'width .8s ease',
                  width: `${item.value}%`,
                  background: item.value >= 70 ? 'var(--green)' : item.value >= 45 ? 'var(--yellow)' : 'var(--red)',
                }} />
              </div>
            </div>
          ))}

          {/* Active signals */}
          {nervousness.signals.length > 0 && (
            <div style={{ marginTop: 7 }}>
              {nervousness.signals.slice(0, 2).map((sig, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--yellow)', padding: '2px 0', display: 'flex', gap: 5 }}>
                  <span>⚠</span><span>{sig}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Integrity Status Rows ── */}
      <div style={{ padding: '10px 12px', background: 'rgba(15,28,52,.6)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, fontWeight: 600 }}>Integrity Monitor</div>
        {[
          { l: 'Face Detected', ok: faceOk,    w: 'Not visible'  },
          { l: 'Single Person', ok: !multiface, w: 'Multi-face'   },
          { l: 'Eye Contact',   ok: !lookAway,  w: 'Looking away' },
          { l: 'Posture',       ok: !badPost,   w: 'Poor posture' },
          { l: 'Lighting',      ok: !lowLight,  w: 'Low light'    },
          { l: 'Tab Focus',     ok: tabOk,      w: 'Tab switched' },
        ].map(r => (
          <div key={r.l} className="prow">
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>{r.l}</span>
            <span style={{ color: r.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 11 }}>
              {r.ok ? '● OK' : `⚠ ${r.w}`}
            </span>
          </div>
        ))}
      </div>

      {/* Violation count */}
      {vCount > 0 && (
        <div style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', display: 'flex', gap: 7, alignItems: 'center' }}>
          ⚠ {vCount} integrity violation{vCount !== 1 ? 's' : ''} logged
        </div>
      )}
    </div>
  );
}
