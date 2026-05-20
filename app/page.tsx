'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const FEATURES = [
  { icon: '🧠', title: 'AI-Generated Questions', desc: 'Gemini AI crafts questions tailored to your exact job description and experience level.' },
  { icon: '👁️', title: 'Real-Time Proctoring', desc: 'Live face detection, posture analysis, and gaze tracking via your webcam.' },
  { icon: '🎯', title: 'Instant Evaluation', desc: 'Every answer scored 0–100 with detailed feedback, strengths, and improvement tips.' },
  { icon: '📊', title: 'Full Report', desc: 'Radar charts, per-question breakdowns, and an AI hiring recommendation.' },
  { icon: '🔒', title: 'Integrity Monitoring', desc: 'Detects tab switches, multiple faces, and suspicious behaviour in real time.' },
  { icon: '🎙️', title: 'Voice or Text', desc: 'Answer by speaking (speech-to-text) or typing — your choice.' },
];

export default function HomePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.3 + 0.08, r: Math.random() * 1.6 + 0.6,
    }));
    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x = (p.x + p.vx + canvas.width) % canvas.width;
        p.y = (p.y + p.vy + canvas.height) % canvas.height;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56,158,248,${p.o})`; ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <main className="page-wrapper">
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div className="bg-grid" />
      <div className="bg-radial-glow" />

      <nav className="app-nav">
        <div className="nav-brand">
          <div className="nav-logo">P</div>
          <span className="nav-title">PrepTalk</span>
          <span style={{ fontSize: 11, padding: '2px 7px', background: 'rgba(14,128,233,.2)', borderRadius: 4, color: '#7dc1ff', border: '1px solid rgba(14,128,233,.3)', flexShrink: 0 }}>v2.0</span>
        </div>
        <button onClick={() => router.push('/setup')} className="btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>
          Start →
        </button>
      </nav>

      <section className="hero-section" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="animate-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: 'rgba(14,128,233,.1)', border: '1px solid rgba(14,128,233,.3)', fontSize: 13, color: '#7dc1ff', marginBottom: 28 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="recording-pulse" />
          AI-Powered Proctored Interview Platform
        </div>

        <h1 className="hero-title animate-in animate-in-delay-1">
          <span>Interview with </span><span className="gradient-text">Integrity.</span>
          <br /><span>Prepare with </span><span className="gradient-text">Intelligence.</span>
        </h1>

        <p className="hero-subtitle animate-in animate-in-delay-2">
          Real-time AI interviews with live proctoring. Enter any job description — get custom questions,
          instant answer evaluation, and a full integrity report.
        </p>

        <div className="animate-in animate-in-delay-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/setup')} className="btn-primary" style={{ padding: '15px 36px', fontSize: 16, borderRadius: 14 }}>
            🚀 Start Interview Now
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="btn-ghost" style={{ padding: '15px 36px', fontSize: 16, borderRadius: 14 }}>
            How It Works
          </button>
        </div>

        <div className="stats-bar animate-in animate-in-delay-4">
          {[{ value: '98%', label: 'Accuracy' }, { value: '< 2s', label: 'Eval Speed' }, { value: '50+', label: 'Roles' }, { value: '24/7', label: 'Available' }].map((s, i) => (
            <div key={i} className="stat-item">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview mockup */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 960, margin: '0 auto', padding: '0 16px 80px' }}>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'rgba(17,31,56,.85)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 60px rgba(0,0,0,.5)' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {['#ef4444', '#f59e0b', '#10b981'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: .8 }} />)}
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>PrepTalk — Live Interview Session</div>
          </div>
          <div style={{ padding: '24px 20px' }}>
            <div style={{ fontSize: 11, color: '#7dc1ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>Question 3 of 8 · Technical · Medium</div>
            <div style={{ fontSize: 'clamp(14px,2.5vw,18px)', fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
              Explain the difference between REST and GraphQL, and when you would choose one over the other.
            </div>
            <div style={{ background: 'rgba(6,13,26,.5)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              REST uses fixed endpoints while GraphQL allows clients to query exactly what they need...
              <span style={{ display: 'inline-block', width: 2, height: 15, background: '#0e80e9', marginLeft: 2, verticalAlign: 'middle' }} className="recording-pulse" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                {[8, 14, 20, 14, 8].map((h, i) => <div key={i} className="waveform-bar" style={{ height: h }} />)}
              </div>
              <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>● REC</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[['Face ✓', '#10b981'], ['Posture ✓', '#10b981'], ['Tab Active', '#10b981'], ['⏱ 01:45', 'var(--text-muted)']].map(([l, c], i) => (
                  <span key={i} style={{ fontSize: 12, color: c as string, fontWeight: 500 }}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '0 16px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,5vw,42px)', fontWeight: 700, marginBottom: 12 }}>
            Everything for a <span className="gradient-text">fair assessment</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            Built for candidates who want to prove their worth and organisations that demand integrity.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card glass-card-hover">
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '60px 16px 100px', background: 'linear-gradient(180deg,transparent,rgba(14,128,233,.05),transparent)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,5vw,42px)', fontWeight: 700, marginBottom: 18 }}>Ready to prove your worth?</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32 }}>No sign-up required. Paste a job description and start.</p>
        <button onClick={() => router.push('/setup')} className="btn-primary" style={{ padding: '16px 48px', fontSize: 17, borderRadius: 14 }}>
          Begin Your Interview →
        </button>
      </section>

      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border-subtle)', padding: '18px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>PrepTalk v2.0</span>
        <span>MEDO Hackathon · Powered by Gemini AI</span>
      </footer>
    </main>
  );
}
