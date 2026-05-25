'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface CheckResult {
  camera:     'checking' | 'pass' | 'fail';
  lighting:   'checking' | 'pass' | 'fail';
  faceCenter: 'checking' | 'pass' | 'fail';
  microphone: 'checking' | 'pass' | 'fail';
  singlePerson:'checking'| 'pass' | 'fail';
}

interface Props {
  onPass: () => void;
  onSkip: () => void;
}

export default function EnvironmentCheck({ onPass, onSkip }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [checks,    setChecks]    = useState<CheckResult>({ camera: 'checking', lighting: 'checking', faceCenter: 'checking', microphone: 'checking', singlePerson: 'checking' });
  const [countdown, setCountdown] = useState(12);
  const [allPassed, setAllPassed] = useState(false);
  const [feedback,  setFeedback]  = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(true);

  const runChecks = useCallback(async () => {
    const newChecks: CheckResult = { camera: 'fail', lighting: 'fail', faceCenter: 'fail', microphone: 'fail', singlePerson: 'fail' };
    const tips: string[] = [];

    // Camera check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      newChecks.camera = 'pass';
    } catch {
      newChecks.camera = 'fail';
      tips.push('Allow camera access in your browser settings.');
    }

    // Microphone check
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach(t => t.stop());
      newChecks.microphone = 'pass';
    } catch {
      newChecks.microphone = 'fail';
      tips.push('Allow microphone access for voice answers.');
    }

    // Wait for video to be ready then analyse frame
    await new Promise(res => setTimeout(res, 1500));

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const W = canvas.width  = video.videoWidth  || 320;
        const H = canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0);
        const d = ctx.getImageData(0, 0, W, H).data;

        // Brightness
        let bright = 0, bs = 0;
        for (let i = 0; i < d.length; i += 4 * 16) { bright += d[i] * .299 + d[i+1] * .587 + d[i+2] * .114; bs++; }
        const avgB = bs ? bright / bs : 0;
        if (avgB >= 45) newChecks.lighting = 'pass';
        else { tips.push('Improve your lighting — face a window or lamp.'); }

        // Skin / face detection
        let skinTotal = 0, skinLeft = 0, skinRight = 0, skinCenter = 0;
        const step = 5, cxL = W * .25, cxR = W * .75;
        for (let y = 0; y < H; y += step) {
          for (let x = 0; x < W; x += step) {
            const idx = (y * W + x) * 4;
            const r = d[idx], g = d[idx+1], b = d[idx+2];
            if (r > 60 && g > 30 && b > 15 && r > g && r > b && (r-g) > 10 && (r-b) > 15 && r < 250) {
              skinTotal++;
              if (x < cxL) skinLeft++;
              else if (x > cxR) skinRight++;
              else skinCenter++;
            }
          }
        }
        const area = (W / step) * (H / step);
        const ratio = skinTotal / area;

        if (ratio > 0.05) {
          newChecks.faceCenter  = skinCenter > skinLeft * 0.6 && skinCenter > skinRight * 0.6 ? 'pass' : 'fail';
          newChecks.singlePerson = (skinLeft < 35 && skinRight < 35) ? 'pass' : 'fail';
          if (newChecks.faceCenter === 'fail')   tips.push('Centre your face in the camera frame.');
          if (newChecks.singlePerson === 'fail') tips.push('Ensure only you are visible on camera.');
        } else {
          tips.push('Move closer to the camera so your face is clearly visible.');
        }
      }
    }

    setChecks(newChecks);
    setFeedback(tips);
    setAnalyzing(false);

    const passed = Object.values(newChecks).every(v => v === 'pass');
    if (passed) setAllPassed(true);
  }, []);

  // Countdown + auto-advance
  useEffect(() => {
    runChecks();
  }, [runChecks]);

  useEffect(() => {
    if (!allPassed) return;
    const t = setInterval(() => setCountdown(p => { if (p <= 1) { clearInterval(t); onPass(); } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [allPassed, onPass]);

  // Cleanup
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const statusIcon = (s: CheckResult[keyof CheckResult]) =>
    s === 'checking' ? <span style={{ color: 'var(--yellow)', fontSize: 16 }} className="pulse">⟳</span> :
    s === 'pass'     ? <span style={{ color: 'var(--green)',  fontSize: 16 }}>✓</span> :
                       <span style={{ color: 'var(--red)',    fontSize: 16 }}>✗</span>;

  const ITEMS: { key: keyof CheckResult; label: string; icon: string }[] = [
    { key: 'camera',      label: 'Camera Working',     icon: '📷' },
    { key: 'lighting',    label: 'Good Lighting',       icon: '💡' },
    { key: 'faceCenter',  label: 'Face Centred',        icon: '👤' },
    { key: 'singlePerson',label: 'Single Person',       icon: '👥' },
    { key: 'microphone',  label: 'Microphone Working',  icon: '🎙️' },
  ];

  const passCount = Object.values(checks).filter(v => v === 'pass').length;

  return (
    <div className="loading" style={{ padding: 24 }}>
      <div className="bg-dots" />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 560 }}>
        <div className="card" style={{ padding: '28px 22px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <h2 style={{ fontSize: 'clamp(18px,4vw,24px)', fontWeight: 800, marginBottom: 6 }}>Environment Check</h2>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>
              Checking your setup before the interview starts…
            </p>
          </div>

          {/* Camera preview */}
          {checks.camera === 'pass' && (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 20, aspectRatio: '4/3', background: '#000', maxWidth: 240, margin: '0 auto 20px' }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}
          {checks.camera !== 'pass' && <canvas ref={canvasRef} style={{ display: 'none' }} />}

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              <span>Checks passed</span>
              <span style={{ fontWeight: 600, color: passCount === 5 ? 'var(--green)' : 'var(--text2)' }}>{passCount} / 5</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${(passCount / 5) * 100}%`, background: passCount === 5 ? 'var(--green)' : 'var(--blue)', transition: 'width .5s ease' }} />
            </div>
          </div>

          {/* Check items */}
          <div style={{ marginBottom: 20 }}>
            {ITEMS.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1, fontSize: 14, color: checks[item.key] === 'fail' ? '#f87171' : 'var(--text2)' }}>{item.label}</span>
                {statusIcon(checks[item.key])}
              </div>
            ))}
          </div>

          {/* Feedback tips */}
          {feedback.length > 0 && !analyzing && (
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', marginBottom: 8 }}>Fix these before starting:</div>
              {feedback.map((tip, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text2)', padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--yellow)', flexShrink: 0 }}>•</span>{tip}
                </div>
              ))}
            </div>
          )}

          {/* All passed */}
          {allPassed && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                ✅ All checks passed! Starting in {countdown}s…
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            {!analyzing && !allPassed && (
              <button onClick={runChecks} className="btn btn-p btn-full" style={{ padding: '13px', fontSize: 15, borderRadius: 11 }}>
                🔄 Retry Checks
              </button>
            )}
            {allPassed && (
              <button onClick={onPass} className="btn btn-p btn-full" style={{ padding: '13px', fontSize: 15, borderRadius: 11 }}>
                🚀 Start Now
              </button>
            )}
            <button onClick={onSkip} className="btn btn-g btn-full" style={{ padding: '11px', fontSize: 14, borderRadius: 11 }}>
              Skip Check &amp; Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
