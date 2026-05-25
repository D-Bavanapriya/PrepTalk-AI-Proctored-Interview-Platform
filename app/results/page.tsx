'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '@/lib/store';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface Report {
  overallAssessment: string; technicalProficiency: string;
  communicationScore: number; technicalScore: number;
  behavioralScore: number; integrityScore: number;
  hiringRecommendation: string; recommendationReason: string;
  topStrengths: string[]; developmentAreas: string[];
  nextSteps: string[]; executiveSummary: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const { session, resetSession } = useInterviewStore();
  const [report,          setReport]          = useState<Report|null>(null);
  const [avgScore,        setAvgScore]        = useState(0);
  const [procScore,       setProcScore]       = useState(100);
  const [loading,         setLoading]         = useState(true);
  const [loadingMsg,      setLoadingMsg]      = useState('Generating your report…');
  const [tab,             setTab]             = useState<'overview'|'answers'|'proctoring'>('overview');
  const [exporting,       setExporting]       = useState(false);
  const [expectedAnswers, setExpectedAnswers] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) { router.replace('/setup'); return; }
    genAll();
  }, []);

  const genAll = async () => {
    if (!session) return;
    try {
      setLoadingMsg('Generating report and expected answers…');
      const [reportRes, expectedRes] = await Promise.all([
        fetch('/api/generate-report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session }),
        }),
        fetch('/api/generate-expected-answers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: session.questions,
            jobTitle: session.jobTitle,
            experienceLevel: session.experienceLevel,
          }),
        }),
      ]);

      const reportData = await reportRes.json();
      setReport(reportData.report);
      setAvgScore(reportData.avgScore || 0);
      setProcScore(reportData.proctoringScore || 100);

      // Build map { questionId -> expectedAnswer }
      const map: Record<string, string> = {};
      // First use answers saved during the interview (already have modelAnswer)
      session.answers.forEach(a => { if (a.expectedAnswer?.trim()) map[a.questionId] = a.expectedAnswer; });
      // Fill in the rest from the bulk call (covers unanswered questions)
      if (expectedRes.ok) {
        const expectedData = await expectedRes.json();
        (expectedData.expectedAnswers || []).forEach((item: { questionId: string; expectedAnswer: string }) => {
          if (!map[item.questionId]) map[item.questionId] = item.expectedAnswer;
        });
      }
      setExpectedAnswers(map);

    } catch {
      const a = session.answers.length>0 ? Math.round(session.answers.reduce((s,a)=>s+(a.score||0),0)/session.answers.length) : 0;
      const h = session.proctoringEvents.filter(e=>e.severity==='high').length;
      const p = Math.max(0,100-h*15-session.proctoringEvents.filter(e=>e.severity==='medium').length*5);
      setAvgScore(a); setProcScore(p);
      setReport({ overallAssessment:'Report generated from local data.', technicalProficiency:'See individual scores.', communicationScore:a, technicalScore:a, behavioralScore:a, integrityScore:p, hiringRecommendation:a>=70?'Hire':a>=50?'Maybe':'No Hire', recommendationReason:`Based on average score of ${a}/100.`, topStrengths:['Completed the interview','Provided thoughtful answers'], developmentAreas:['Continue practising','Review technical concepts'], nextSteps:['Review each question feedback','Practice more mock interviews'], executiveSummary:`Candidate completed the ${session.jobTitle} interview with an average score of ${a}/100.` });
      const fallbackMap: Record<string, string> = {};
      session.answers.forEach(a => { if (a.expectedAnswer?.trim()) fallbackMap[a.questionId] = a.expectedAnswer; });
      setExpectedAnswers(fallbackMap);
    } finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Use print dialog with print-optimised CSS
      const style = document.createElement('style');
      style.id = 'pdf-export-style';
      style.innerHTML = `
        @media print {
          body { background: white !important; color: black !important; }
          .nav, .tabs, .btn, .no-print { display: none !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; background: white !important; break-inside: avoid; }
          .gt { -webkit-text-fill-color: #1a7fe8 !important; }
          * { color: inherit !important; }
          [style*="var(--text)"] { color: #111 !important; }
          [style*="var(--text2)"] { color: #444 !important; }
          [style*="var(--text3)"] { color: #777 !important; }
          [style*="var(--green)"] { color: #059669 !important; }
          [style*="var(--yellow)"] { color: #d97706 !important; }
          [style*="var(--red)"] { color: #dc2626 !important; }
          [style*="var(--blue)"] { color: #1a7fe8 !important; }
          .score-grid { grid-template-columns: 1fr 1fr !important; }
          body::before { content: 'PrepTalk Interview Report — ${session?.jobTitle} — ${new Date().toLocaleDateString()}'; display: block; text-align: center; font-size: 14px; color: #666; padding: 10px 0 20px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => { document.getElementById('pdf-export-style')?.remove(); setExporting(false); }, 1000);
    } catch { setExporting(false); }
  };

  if (!session) return null;

  const overall = Math.round(avgScore*.7 + procScore*.3);
  const rec     = report?.hiringRecommendation || 'No Hire';
  const recCol  = rec==='Strong Hire'||rec==='Hire'?'var(--green)':rec==='Maybe'?'var(--yellow)':'var(--red)';

  const radarData = report ? [
    {s:'Technical',  A:report.technicalScore},
    {s:'Comms',      A:report.communicationScore},
    {s:'Behavioral', A:report.behavioralScore},
    {s:'Integrity',  A:report.integrityScore},
    {s:'Overall',    A:avgScore},
  ] : [];

  const barData = session.answers.map((a,i)=>({n:`Q${i+1}`,s:a.score||0}));

  const evCounts:[string,number,boolean][] = [
    ['Tab Switches',    session.proctoringEvents.filter(e=>e.type==='tab_switch').length,       true],
    ['Face Not Visible',session.proctoringEvents.filter(e=>e.type==='face_not_visible').length, false],
    ['Multiple Faces',  session.proctoringEvents.filter(e=>e.type==='multiple_faces').length,   true],
    ['Poor Posture',    session.proctoringEvents.filter(e=>e.type==='poor_posture').length,      false],
    ['Looking Away',    session.proctoringEvents.filter(e=>e.type==='looking_away').length,      false],
    ['Low Light',       session.proctoringEvents.filter(e=>e.type==='low_light').length,         false],
  ];

  if (loading) {
    return (
      <div className="loading">
        <div className="bg-dots"/><div className="bg-glow"/>
        <div style={{ position:'relative', zIndex:10 }}>
          <div style={{ fontSize:48, marginBottom:18 }} className="bounce">📊</div>
          <h2 style={{ fontSize:'clamp(20px,4vw,28px)', fontWeight:800, marginBottom:10 }}>Generating Your Report</h2>
          <p style={{ color:'var(--text2)', fontSize:15, marginBottom:32 }}>{loadingMsg}</p>
          <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
            {[0,1,2].map(i=><div key={i} className="tdot" style={{ width:12, height:12, borderRadius:'50%', background:'var(--blue)' }}/>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight:'100vh', background:'var(--bg)', position:'relative' }} ref={reportRef}>
      <div className="bg-dots"/><div className="bg-glow"/>

      <nav className="nav">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="nav-logo">P</div>
          <span className="nav-title">PrepTalk</span>
          <span style={{ color:'var(--text3)', fontSize:13 }}>/ Report</span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={handleExportPDF} disabled={exporting} className="btn btn-g btn-sm">
            {exporting?'Preparing…':'📄 Export PDF'}
          </button>
          <button onClick={handlePrint} className="btn btn-g btn-sm">🖨️ Print</button>
          <button onClick={()=>{resetSession();router.push('/setup');}} className="btn btn-p btn-sm">+ New Interview</button>
        </div>
      </nav>

      <div style={{ position:'relative', zIndex:10, maxWidth:1060, margin:'0 auto', padding:'80px 16px 60px' }}>

        {/* Hero score card */}
        <div className="card" style={{ padding:'24px 18px', marginBottom:20, overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', top:0, right:0, width:130, height:130, background:'radial-gradient(circle,rgba(26,127,232,.07),transparent)', pointerEvents:'none' }}/>
          <div className="rh">
            {/* Score circle */}
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <svg width="90" height="90" viewBox="0 0 120 120" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(56,158,248,.15)" strokeWidth="8"/>
                <circle cx="60" cy="60" r="52" fill="none" stroke={overall>=75?'var(--green)':overall>=50?'var(--yellow)':'var(--red)'} strokeWidth="8" strokeDasharray={`${2*Math.PI*52}`} strokeDashoffset={`${2*Math.PI*52*(1-overall/100)}`} strokeLinecap="round"/>
              </svg>
              <div style={{ marginTop:-76, fontSize:26, fontWeight:800 }}>{overall}</div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:48 }}>Overall</div>
            </div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>
                {new Date(session.endTime||Date.now()).toLocaleDateString()} · Interview Complete
              </div>
              <h1 style={{ fontSize:'clamp(16px,3vw,24px)', fontWeight:800, marginBottom:8 }}>{session.jobTitle}</h1>
              <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.65, maxWidth:440 }}>{report?.executiveSummary}</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginTop:14 }}>
                {[
                  {v:avgScore,  l:'Answer Score', c:'#7dc1ff'},
                  {v:procScore, l:'Integrity',     c:procScore>=80?'var(--green)':'var(--yellow)'},
                  {v:session.answers.length, l:"Q's Done", c:'var(--text)'},
                  {v:session.proctoringEvents.filter(e=>e.severity==='high').length, l:'High Violations', c:session.proctoringEvents.filter(e=>e.severity==='high').length===0?'var(--green)':'#f87171'},
                ].map((s,i)=>(
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation */}
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ padding:'14px 18px', borderRadius:12, background:`color-mix(in srgb,${recCol} 12%,transparent)`, border:`2px solid ${recCol}`, minWidth:120 }}>
                <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:5 }}>Recommendation</div>
                <div style={{ fontSize:16, fontWeight:800, color:recCol }}>{rec}</div>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:8, maxWidth:120, lineHeight:1.5 }}>
                {report?.recommendationReason?.slice(0,60)}…
              </div>
            </div>
          </div>
        </div>

        {/* Scoring explanation */}
        <div className="card" style={{ padding:'16px 18px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📊 How Your Score Is Calculated</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            {[
              {label:'Answer Quality', pct:'70%', desc:'Depth, relevance, examples, structure', color:'var(--blue)'},
              {label:'Integrity Score', pct:'30%', desc:'Based on proctoring violations logged', color:'var(--green)'},
              {label:'Tab Switch',      pct:'-15pts', desc:'Each tab switch deducts 15 points', color:'var(--red)'},
              {label:'Multi-Face',      pct:'-15pts', desc:'Multiple people detected = -15 pts', color:'var(--red)'},
            ].map((item,i)=>(
              <div key={i} style={{ padding:'10px 12px', borderRadius:8, background:'rgba(15,28,52,.6)', border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:700, fontSize:13, color:item.color, marginBottom:4 }}>{item.label} <span style={{ fontSize:12 }}>{item.pct}</span></div>
                <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom:20 }}>
          {[['overview','📊 Overview'],['answers','💬 Answers'],['proctoring','🔒 Integrity']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id as typeof tab)} className={`tab ${tab===id?'on':''}`}>{label}</button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview' && (
          <div className="score-grid">
            <div className="card" style={{ padding:'22px 16px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Performance Radar</div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(56,158,248,.18)"/>
                  <PolarAngleAxis dataKey="s" tick={{ fill:'var(--text3)', fontSize:11 }}/>
                  <Radar dataKey="A" stroke="var(--blue)" fill="rgba(26,127,232,.2)" fillOpacity={.8}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding:'22px 18px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Score Breakdown</div>
              {report && [
                {l:'Technical',     s:report.technicalScore},
                {l:'Communication', s:report.communicationScore},
                {l:'Behavioral',    s:report.behavioralScore},
                {l:'Integrity',     s:report.integrityScore},
              ].map(item=>(
                <div key={item.l} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                    <span style={{ color:'var(--text2)' }}>{item.l}</span>
                    <span style={{ fontWeight:600, color:item.s>=75?'var(--green)':item.s>=50?'var(--yellow)':'var(--red)' }}>{item.s}/100</span>
                  </div>
                  <div style={{ height:6, background:'rgba(56,158,248,.12)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${item.s}%`, borderRadius:3, background:item.s>=75?'var(--green)':item.s>=50?'var(--yellow)':'var(--red)', transition:'width 1s ease' }}/>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding:'22px 18px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:14, color:'var(--green)' }}>✓ Top Strengths</div>
              {report?.topStrengths?.map((s,i,a)=>(
                <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom:i<a.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(16,185,129,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--green)', fontWeight:700, flexShrink:0 }}>{i+1}</div>
                  <span style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{s}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding:'22px 18px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:14, color:'var(--yellow)' }}>↑ Development Areas</div>
              {report?.developmentAreas?.map((s,i,a)=>(
                <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom:i<a.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(245,158,11,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--yellow)', fontWeight:700, flexShrink:0 }}>{i+1}</div>
                  <span style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{s}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding:'22px 18px', gridColumn:'1/-1' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🚀 Recommended Next Steps</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                {report?.nextSteps?.map((step,i)=>(
                  <div key={i} style={{ padding:'14px', background:'rgba(26,127,232,.05)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:20, marginBottom:8 }}>{'📚🎯💪🔍🤝'[i]||'•'}</div>
                    <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.55 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Answers */}
        {/* Answers */}
        {tab==='answers' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Score bar chart */}
            <div className="card" style={{ padding:'22px 16px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Score Per Question</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top:0, right:0, bottom:0, left:-22 }}>
                  <XAxis dataKey="n" tick={{ fill:'var(--text3)', fontSize:12 }}/>
                  <YAxis domain={[0,100]} tick={{ fill:'var(--text3)', fontSize:12 }}/>
                  <Tooltip contentStyle={{ background:'#0d1b30', border:'1px solid var(--border)', borderRadius:8, color:'#fff' }}/>
                  <Bar dataKey="s" radius={[4,4,0,0]}>
                    {barData.map((e,i)=><Cell key={i} fill={e.s>=75?'#10b981':e.s>=50?'#f59e0b':'#ef4444'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', padding:'10px 14px', background:'rgba(26,127,232,.04)', border:'1px solid rgba(26,127,232,.15)', borderRadius:10 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#7dc1ff' }}>📖 How to use:</span>
              {[
                { dot:'rgba(16,185,129,.8)', label:'Your Answer' },
                { dot:'rgba(26,127,232,.8)', label:'Expected Answer' },
                { dot:'rgba(245,158,11,.8)', label:'Improvements' },
              ].map(({dot,label})=>(
                <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:dot, flexShrink:0 }}/>
                  {label}
                </div>
              ))}
            </div>

            {/* Per-question comparison cards */}
            {session.questions.map((q,i)=>{
              const ans = session.answers.find(a=>a.questionId===q.id);
              const s   = ans?.score||0;
              const sc  = s>=75?'var(--green)':s>=50?'var(--yellow)':'var(--red)';
              const expectedAnswer = expectedAnswers[q.id] || ans?.expectedAnswer || '';
              const hasExpected = !!expectedAnswer.trim();
              return (
                <div key={q.id} className="card" style={{ padding:'22px 18px' }}>

                  {/* Question header */}
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:18 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'rgba(26,127,232,.12)', border:'1px solid rgba(26,127,232,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#7dc1ff', flexShrink:0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'clamp(13px,2vw,15px)', fontWeight:600, lineHeight:1.55, marginBottom:8 }}>{q.text}</div>
                      <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                        <span className={`b-${q.category==='Technical'?'blue':q.category==='Behavioral'?'green':'yellow'}`}>{q.category}</span>
                        <span className={`b-${q.difficulty==='hard'?'red':q.difficulty==='medium'?'yellow':'green'}`}>{q.difficulty}</span>
                        {ans && <span style={{ fontSize:11, color:'var(--text3)' }}>⏱ {ans.duration}s</span>}
                      </div>
                    </div>
                    {ans ? (
                      <div style={{ width:50, height:50, borderRadius:'50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, background:`color-mix(in srgb,${sc} 12%,transparent)`, border:`2px solid ${sc}` }}>
                        <span style={{ fontSize:16, fontWeight:800, color:sc, lineHeight:1 }}>{s}</span>
                        <span style={{ fontSize:9, color:'var(--text3)' }}>/100</span>
                      </div>
                    ) : (
                      <div style={{ width:50, height:50, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(6,13,26,.4)', border:'1px solid var(--border)' }}>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>—</span>
                      </div>
                    )}
                  </div>

                  {/* ── Side-by-side comparison — shown for ALL questions ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>

                    {/* Your Answer */}
                    <div style={{ borderRadius:10, overflow:'hidden', border:`1px solid ${ans ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.2)'}` }}>
                      <div style={{ padding:'8px 12px', background: ans ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.06)', borderBottom:`1px solid ${ans ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.15)'}`, display:'flex', alignItems:'center', gap:7 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background: ans ? '#10b981' : '#ef4444', flexShrink:0 }}/>
                        <span style={{ fontSize:11, fontWeight:700, color: ans ? '#34d399' : '#f87171', textTransform:'uppercase', letterSpacing:'.5px' }}>Your Answer</span>
                        {!ans && <span style={{ fontSize:10, color:'#f87171', marginLeft:'auto', fontStyle:'italic' }}>Not attempted</span>}
                      </div>
                      <div style={{ padding:'12px', background:'rgba(6,13,26,.5)', fontSize:13, color:'var(--text2)', lineHeight:1.75, minHeight:90 }}>
                        {ans?.text?.trim()
                          ? ans.text
                          : <span style={{ color:'var(--text3)', fontStyle:'italic' }}>No answer was provided for this question</span>
                        }
                      </div>
                    </div>

                    {/* Expected Answer */}
                    <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid rgba(26,127,232,.25)' }}>
                      <div style={{ padding:'8px 12px', background:'rgba(26,127,232,.08)', borderBottom:'1px solid rgba(26,127,232,.2)', display:'flex', alignItems:'center', gap:7 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:'#1a7fe8', flexShrink:0 }}/>
                        <span style={{ fontSize:11, fontWeight:700, color:'#7dc1ff', textTransform:'uppercase', letterSpacing:'.5px' }}>Expected Answer</span>
                      </div>
                      <div style={{ padding:'12px', background:'rgba(6,13,26,.5)', fontSize:13, color:'var(--text2)', lineHeight:1.75, minHeight:90 }}>
                        {hasExpected
                          ? expectedAnswer
                          : <span style={{ color:'var(--text3)', fontStyle:'italic' }}>Generating expected answer…</span>
                        }
                      </div>
                    </div>
                  </div>

                  {ans && (
                    <>
                      {/* AI Feedback */}
                      {ans.feedback && (
                        <div style={{ padding:'10px 13px', borderRadius:9, background:'rgba(26,127,232,.05)', border:'1px solid rgba(26,127,232,.15)', marginBottom:12, fontSize:13, color:'var(--text2)', lineHeight:1.65 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#7dc1ff', marginRight:8 }}>📝 AI FEEDBACK</span>
                          {ans.feedback}
                        </div>
                      )}

                      {/* Strengths & Improvements */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(16,185,129,.05)', border:'1px solid rgba(16,185,129,.15)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', marginBottom:7, textTransform:'uppercase', letterSpacing:'.4px' }}>✓ Strengths</div>
                          {(ans.strengths||[]).length > 0
                            ? (ans.strengths||[]).map((s,j)=>(
                                <div key={j} style={{ fontSize:12, color:'var(--text2)', padding:'3px 0', display:'flex', gap:6, lineHeight:1.5 }}>
                                  <span style={{ color:'var(--green)', flexShrink:0, fontWeight:700 }}>+</span>{s}
                                </div>
                              ))
                            : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
                          }
                        </div>
                        <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,.05)', border:'1px solid rgba(245,158,11,.15)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--yellow)', marginBottom:7, textTransform:'uppercase', letterSpacing:'.4px' }}>↑ To Improve</div>
                          {(ans.improvements||[]).length > 0
                            ? (ans.improvements||[]).map((s,j)=>(
                                <div key={j} style={{ fontSize:12, color:'var(--text2)', padding:'3px 0', display:'flex', gap:6, lineHeight:1.5 }}>
                                  <span style={{ color:'var(--yellow)', flexShrink:0, fontWeight:700 }}>→</span>{s}
                                </div>
                              ))
                            : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
                          }
                        </div>
                      </div>
                    </>
                  )}
                  {!ans && (
                    <div style={{ padding:'10px 13px', borderRadius:9, background:'rgba(239,68,68,.04)', border:'1px solid rgba(239,68,68,.15)', fontSize:12, color:'#f87171', display:'flex', alignItems:'center', gap:8 }}>
                      <span>⚠️</span>
                      <span>This question was skipped. Study the expected answer above to prepare for your next interview.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}


        {/* Proctoring */}
        {tab==='proctoring' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card" style={{ padding:'24px 18px' }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:22, alignItems:'center' }}>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ width:84, height:84, borderRadius:'50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:`color-mix(in srgb,${procScore>=80?'var(--green)':procScore>=60?'var(--yellow)':'var(--red)'} 12%,transparent)`, border:`3px solid ${procScore>=80?'var(--green)':procScore>=60?'var(--yellow)':'var(--red)'}` }}>
                    <span style={{ fontSize:26, fontWeight:800, color:procScore>=80?'var(--green)':procScore>=60?'var(--yellow)':'var(--red)' }}>{procScore}</span>
                    <span style={{ fontSize:9, color:'var(--text3)' }}>/100</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>Integrity</div>
                </div>
                <div style={{ flex:1, minWidth:200 }}>
                  <h3 style={{ fontSize:'clamp(15px,2.5vw,20px)', fontWeight:700, marginBottom:8 }}>
                    {procScore>=80?'✅ Excellent Integrity':procScore>=60?'⚠️ Some Concerns':'🚨 Integrity Issues'}
                  </h3>
                  <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.65 }}>
                    {procScore>=80?'No significant violations. High integrity maintained.':procScore>=60?'Minor concerns noted. May warrant a follow-up.':'Multiple violations detected. May indicate dishonest behaviour.'}
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:16, marginTop:14 }}>
                    {[
                      {v:session.proctoringEvents.filter(e=>e.severity==='high').length,   l:'High',   c:'var(--red)'},
                      {v:session.proctoringEvents.filter(e=>e.severity==='medium').length, l:'Medium', c:'var(--yellow)'},
                      {v:session.proctoringEvents.filter(e=>e.severity==='low').length,    l:'Low',    c:'var(--green)'},
                      {v:session.proctoringEvents.length, l:'Total', c:'var(--text)'},
                    ].map((s,i)=>(
                      <div key={i} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:20, fontWeight:700, color:s.c }}>{s.v}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding:'22px 18px' }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Violation Breakdown</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12 }}>
                {evCounts.map(([label,count,serious])=>(
                  <div key={label} style={{ padding:'13px', borderRadius:10, background:count>0?(serious?'rgba(239,68,68,.07)':'rgba(245,158,11,.07)'):'rgba(16,185,129,.05)', border:`1px solid ${count>0?(serious?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)'):'rgba(16,185,129,.2)'}` }}>
                    <div style={{ fontSize:22, fontWeight:800, color:count>0?(serious?'#f87171':'#fbbf24'):'#34d399', marginBottom:4 }}>{count}</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {session.proctoringEvents.length>0 ? (
              <div className="card" style={{ padding:'22px 18px' }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Event Timeline</div>
                {session.proctoringEvents.map(ev=>(
                  <div key={ev.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', borderRadius:8, background:ev.severity==='high'?'rgba(239,68,68,.07)':ev.severity==='medium'?'rgba(245,158,11,.07)':'rgba(6,13,26,.4)', border:`1px solid ${ev.severity==='high'?'rgba(239,68,68,.25)':ev.severity==='medium'?'rgba(245,158,11,.25)':'var(--border)'}`, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', marginTop:5, flexShrink:0, background:ev.severity==='high'?'var(--red)':ev.severity==='medium'?'var(--yellow)':'var(--text3)' }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, marginBottom:2 }}>{ev.description}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{new Date(ev.timestamp).toLocaleTimeString()} · {ev.severity}</div>
                    </div>
                    <span className={`b-${ev.severity==='high'?'red':ev.severity==='medium'?'yellow':'blue'}`} style={{ flexShrink:0 }}>{ev.severity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:44, marginBottom:14 }}>✅</div>
                <h3 style={{ fontWeight:700, fontSize:20, marginBottom:8, color:'var(--green)' }}>Perfect Integrity Record</h3>
                <p style={{ color:'var(--text2)', fontSize:14 }}>No violations detected during this session.</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginTop:40 }} className="no-print">
          <button onClick={handleExportPDF} className="btn btn-g btn-md">📄 Export PDF</button>
          <button onClick={handlePrint}     className="btn btn-g btn-md">🖨️ Print</button>
          <button onClick={()=>{resetSession();router.push('/setup');}} className="btn btn-p btn-md">🎯 New Interview</button>
          <button onClick={()=>{resetSession();router.push('/');}}      className="btn btn-g btn-md">🏠 Home</button>
        </div>
      </div>
    </main>
  );
}
