'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '@/lib/store';

const LEVELS = [
  { v: 'entry',  l: 'Entry Level',     d: '0–2 yrs',  i: '🌱' },
  { v: 'mid',    l: 'Mid Level',        d: '2–5 yrs',  i: '🚀' },
  { v: 'senior', l: 'Senior',           d: '5–10 yrs', i: '⭐' },
  { v: 'lead',   l: 'Lead / Principal', d: '10+ yrs',  i: '👑' },
];

const EXAMPLES = [
  { t: 'Full Stack Dev', j: 'Full Stack Developer', d: 'We are looking for a Full Stack Developer proficient in React, Node.js, TypeScript, PostgreSQL, and REST APIs. You will build scalable web applications, collaborate with design teams, write clean maintainable code, and participate in code reviews. Experience with cloud platforms (AWS/GCP) and CI/CD pipelines is a plus.' },
  { t: 'Data Scientist', j: 'Data Scientist', d: 'Seeking a Data Scientist with strong Python skills (pandas, scikit-learn, TensorFlow/PyTorch). You will build ML models, perform statistical analysis, work with large datasets, communicate insights to stakeholders, and deploy models to production. SQL and data visualisation experience required.' },
  { t: 'Product Manager', j: 'Product Manager', d: 'Looking for a Product Manager to lead our SaaS product roadmap. You will conduct user research, define product requirements, work cross-functionally with engineering and design, prioritise features using data-driven decisions, and drive product launches. Agile experience required.' },
  { t: 'DevOps Engineer', j: 'DevOps Engineer', d: 'We need a DevOps Engineer experienced with Kubernetes, Docker, Terraform, AWS, CI/CD pipelines, and monitoring tools like Prometheus and Grafana. You will manage infrastructure, improve deployments, ensure reliability, and implement security best practices.' },
];

export default function SetupPage() {
  const router = useRouter();
  const { createSession, setQuestions } = useInterviewStore();

  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [level, setLevel]       = useState('mid');
  const [qCount, setQCount]     = useState(8);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const valid = title.trim().length >= 3 && desc.trim().length >= 50;

  const handleStart = async () => {
    if (!valid || loading) return;
    setLoading(true); setError('');
    try {
      createSession(title.trim(), desc.trim(), level);
      const res = await fetch('/api/generate-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: title, jobDescription: desc, experienceLevel: level, questionCount: qCount }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (!data.questions || !Array.isArray(data.questions)) throw new Error('bad response');
      setQuestions(data.questions);
      router.push('/interview');
    } catch {
      setError('Failed to generate questions. Check your GEMINI_API_KEY in .env.local and try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="bg-dots" /><div className="bg-glow" />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }} className="bounce">🧠</div>
          <h2 style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 700, marginBottom: 10 }}>Crafting Your Interview</h2>
          <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 32 }}>
            Generating <strong style={{ color: 'var(--text)' }}>{qCount} tailored questions</strong> for{' '}
            <strong style={{ color: 'var(--text)' }}>{title}</strong>…
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[0,1,2].map(i => <div key={i} className="tdot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--blue)' }} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="bg-dots" /><div className="bg-glow" />

      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/')} className="btn btn-g btn-sm">← Back</button>
          <div className="nav-logo" style={{ marginLeft: 6 }}>P</div>
          <span className="nav-title">PrepTalk</span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text3)', display: 'none' }} id="setup-sub">Setup Interview</span>
      </nav>

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 760, margin: '0 auto', padding: '86px 16px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 800, marginBottom: 10 }}>
            Configure Your <span className="gt">Interview</span>
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>Paste the job description — get perfectly tailored questions.</p>
        </div>

        {/* Examples */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Quick Examples</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EXAMPLES.map(ex => (
              <button key={ex.t} onClick={() => { setTitle(ex.j); setDesc(ex.d); }}
                className="btn btn-g btn-sm" style={{ borderRadius: 8 }}>{ex.t}</button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '28px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>JOB TITLE *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Senior Full Stack Developer"
                className="inp" style={{ borderColor: title.length >= 3 ? 'var(--border-h)' : 'var(--border)' }} />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>
                JOB DESCRIPTION * <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(min 50 chars)</span>
              </label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Paste the full job description here — the more detail, the better the questions…"
                rows={7} className="inp" style={{ borderColor: desc.length >= 50 ? 'var(--border-h)' : 'var(--border)' }} />
              <div style={{ fontSize: 12, color: desc.length >= 50 ? 'var(--green)' : 'var(--text3)', marginTop: 5, textAlign: 'right' }}>
                {desc.length} chars {desc.length >= 50 ? '✓' : `· ${50 - desc.length} more needed`}
              </div>
            </div>

            {/* Level */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text2)' }}>EXPERIENCE LEVEL</label>
              <div className="level-grid">
                {LEVELS.map(l => (
                  <button key={l.v} onClick={() => setLevel(l.v)} className={`level-btn ${level === l.v ? 'on' : ''}`}>
                    <div style={{ fontSize: 24, marginBottom: 5 }}>{l.i}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{l.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.d}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text2)' }}>NUMBER OF QUESTIONS</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[4, 6, 8, 10, 12].map(n => (
                  <button key={n} onClick={() => setQCount(n)} style={{
                    width: 48, height: 48, borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${qCount === n ? 'var(--blue)' : 'var(--border)'}`,
                    background: qCount === n ? 'rgba(26,127,232,.15)' : 'rgba(6,13,26,.5)',
                    color: qCount === n ? '#7dc1ff' : 'var(--text2)',
                    fontSize: 16, fontWeight: 600, fontFamily: 'Inter,sans-serif', transition: 'all .2s',
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Proctoring notice */}
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(26,127,232,.06)', border: '1px solid rgba(26,127,232,.2)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Live proctoring will be enabled</div>
                  <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55 }}>
                    Camera access will be requested. Sit in a well-lit, quiet space with only you visible on camera.
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', fontSize: 13, lineHeight: 1.5 }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleStart} disabled={!valid} className="btn btn-p btn-full" style={{ padding: '16px', fontSize: 16, borderRadius: 12 }}>
              Generate {qCount} Questions &amp; Start →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
