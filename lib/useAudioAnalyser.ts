'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

export interface AudioMetrics {
  volume: number;          // 0-100 current volume
  avgVolume: number;       // 0-100 rolling average
  speakingPace: 'slow' | 'good' | 'fast';
  silenceDuration: number; // seconds of current silence
  isSpeaking: boolean;
  stressLevel: number;     // 0-100 based on pitch variance
  pitchVariance: number;   // raw pitch variance
  totalSilences: number;   // count of long silences
}

export function useAudioAnalyser() {
  const ctxRef       = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number | null>(null);
  const intRef       = useRef<NodeJS.Timeout | null>(null);

  const volumeHistory  = useRef<number[]>([]);
  const silenceStart   = useRef<number | null>(null);
  const wordTimestamps = useRef<number[]>([]);
  const pitchHistory   = useRef<number[]>([]);
  const totalSilences  = useRef(0);

  const [metrics, setMetrics] = useState<AudioMetrics>({
    volume: 0, avgVolume: 0, speakingPace: 'good',
    silenceDuration: 0, isSpeaking: false,
    stressLevel: 0, pitchVariance: 0, totalSilences: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      ctxRef.current      = ctx;
      analyserRef.current = analyser;

      const bufLen   = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufLen);
      const timeData = new Uint8Array(bufLen);

      const SILENCE_THRESHOLD = 12;
      const LONG_SILENCE_SEC  = 4;

      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        // RMS volume
        let sum = 0;
        for (let i = 0; i < bufLen; i++) sum += freqData[i] * freqData[i];
        const rms    = Math.sqrt(sum / bufLen);
        const volume = Math.min(100, Math.round(rms * 100 / 128));

        volumeHistory.current.push(volume);
        if (volumeHistory.current.length > 60) volumeHistory.current.shift();
        const avgVol = Math.round(
          volumeHistory.current.reduce((a, b) => a + b, 0) / volumeHistory.current.length
        );

        const isSpeaking = volume > SILENCE_THRESHOLD;
        const now = Date.now();

        // Silence tracking
        if (!isSpeaking) {
          if (!silenceStart.current) silenceStart.current = now;
        } else {
          if (silenceStart.current) {
            const dur = (now - silenceStart.current) / 1000;
            if (dur >= LONG_SILENCE_SEC) totalSilences.current++;
          }
          silenceStart.current = null;
          wordTimestamps.current.push(now);
          if (wordTimestamps.current.length > 100)
            wordTimestamps.current = wordTimestamps.current.slice(-100);
        }

        const silenceDuration = silenceStart.current
          ? Math.round((now - silenceStart.current) / 1000) : 0;

        // Speaking pace (words per 10 seconds)
        const recent = wordTimestamps.current.filter(t => now - t < 10000);
        const wpm    = recent.length * 6; // approximate wpm
        const pace: AudioMetrics['speakingPace'] =
          wpm > 180 ? 'fast' : wpm < 60 ? 'slow' : 'good';

        // Pitch variance from zero crossings in time domain
        let crossings = 0;
        for (let i = 1; i < timeData.length; i++) {
          if ((timeData[i] - 128) * (timeData[i-1] - 128) < 0) crossings++;
        }
        const normCross = crossings / timeData.length;
        pitchHistory.current.push(normCross);
        if (pitchHistory.current.length > 30) pitchHistory.current.shift();

        const avgPitch = pitchHistory.current.reduce((a, b) => a + b, 0) / pitchHistory.current.length;
        const pitchVar = pitchHistory.current.reduce((s, v) => s + Math.abs(v - avgPitch), 0) / pitchHistory.current.length;
        const stress   = Math.min(100, Math.round(pitchVar * 2000));

        setMetrics({
          volume, avgVolume: avgVol, speakingPace: pace,
          silenceDuration, isSpeaking, stressLevel: stress,
          pitchVariance: Math.round(pitchVar * 1000) / 1000,
          totalSilences: totalSilences.current,
        });

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      setIsActive(true);
      setError(null);
    } catch {
      setError('Microphone access denied or unavailable.');
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (intRef.current)  clearInterval(intRef.current);
    ctxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current      = null;
    analyserRef.current = null;
    streamRef.current   = null;
    rafRef.current      = null;
    volumeHistory.current  = [];
    wordTimestamps.current = [];
    pitchHistory.current   = [];
    silenceStart.current   = null;
    totalSilences.current  = 0;
    setIsActive(false);
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { metrics, isActive, error, start, stop };
}
