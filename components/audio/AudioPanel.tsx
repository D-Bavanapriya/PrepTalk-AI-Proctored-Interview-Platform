'use client';
import { useEffect } from 'react';
import { useAudioAnalyser } from '@/lib/useAudioAnalyser';

interface Props { isActive: boolean; }

export default function AudioPanel({ isActive }: Props) {
  const { metrics, error, start, stop } = useAudioAnalyser();

  useEffect(() => {
    if (isActive) start(); else stop();
    return () => stop();
  }, [isActive]);

  const paceColor = metrics.speakingPace === 'good' ? 'var(--green)' : metrics.speakingPace === 'fast' ? 'var(--red)' : 'var(--yellow)';
  const paceLabel = metrics.speakingPace === 'good' ? '✓ Good pace' : metrics.speakingPace === 'fast' ? '⚡ Too fast' : '🐢 Too slow';
  const stressColor = metrics.stressLevel < 30 ? 'var(--green)' : metrics.stressLevel < 60 ? 'var(--yellow)' : 'var(--red)';
  const stressLabel = metrics.stressLevel < 30 ? '😊 Relaxed' : metrics.stressLevel < 60 ? '😐 Moderate' : '😰 Stressed';

  if (error) return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 12, color: '#f87171' }}>
      🎙️ {error}
    </div>
  );

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(15,28,52,.6)' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, fontWeight: 600 }}>🎙️ Voice Analysis</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
          <span>Volume</span>
          <span style={{ color: metrics.isSpeaking ? 'var(--green)' : 'var(--text3)' }}>{metrics.isSpeaking ? '● Speaking' : '○ Silent'}</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${metrics.volume}%`, background: metrics.volume > 60 ? 'var(--green)' : metrics.volume > 20 ? 'var(--blue)' : 'var(--text3)', transition: 'width .1s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text3)' }}>Speaking Pace</span>
        <span style={{ color: paceColor, fontWeight: 600 }}>{paceLabel}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
          <span>Voice Calm</span>
          <span style={{ color: stressColor, fontWeight: 600 }}>{stressLabel}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${100 - metrics.stressLevel}%`, background: stressColor, transition: 'width .5s ease' }} />
        </div>
      </div>

      {metrics.silenceDuration >= 5 && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 7, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', fontSize: 11, color: '#fbbf24' }}>
          ⏸ {metrics.silenceDuration}s silence — start speaking!
        </div>
      )}
    </div>
  );
}
