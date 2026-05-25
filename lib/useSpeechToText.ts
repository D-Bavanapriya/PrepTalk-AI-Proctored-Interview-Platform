'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Options {
  onTranscript?: (text: string, isFinal: boolean) => void;
  language?: string;
}

export function useSpeechToText({ onTranscript, language = 'en-US' }: Options = {}) {
  const [isRecording,  setIsRecording]  = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [interimText,  setInterimText]  = useState('');
  const [isSupported,  setIsSupported]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [wordCount,    setWordCount]    = useState(0);

  const recRef   = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef('');
  const cbRef    = useRef(onTranscript);
  useEffect(() => { cbRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    setIsSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Speech recognition not supported. Please use Chrome or Edge.'); return; }
    try {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = language;
      r.maxAlternatives = 3;

      r.onresult = (e: SpeechRecognitionEvent) => {
        let finalSegment = '';
        let interimSegment = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          let bestText = result[0].transcript;
          let bestConf = result[0].confidence || 0;
          for (let j = 1; j < result.length; j++) {
            if ((result[j].confidence || 0) > bestConf) {
              bestConf = result[j].confidence || 0;
              bestText = result[j].transcript;
            }
          }
          if (result.isFinal) finalSegment += bestText + ' ';
          else interimSegment += bestText;
        }
        if (finalSegment) {
          finalRef.current += finalSegment;
          const full = finalRef.current.trim();
          setTranscript(full);
          setWordCount(full.split(/\s+/).filter(Boolean).length);
          setInterimText('');
          cbRef.current?.(full, true);
        }
        if (interimSegment) {
          setInterimText(interimSegment);
          cbRef.current?.((finalRef.current + interimSegment).trim(), false);
        }
      };

      r.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'no-speech') return;
        if (e.error === 'not-allowed') setError('Microphone access denied.');
        if (e.error === 'network') setError('Network error. Check your internet connection.');
      };

      r.onend = () => {
        if (recRef.current === r) {
          try { r.start(); } catch { /* ignore */ }
        }
      };

      recRef.current = r;
      finalRef.current = '';
      setTranscript(''); setInterimText(''); setWordCount(0); setError(null);
      r.start();
      setIsRecording(true);
    } catch { setError('Failed to start recording.'); }
  }, [language]);

  const stopRecording = useCallback(() => {
    if (recRef.current) {
      const r = recRef.current;
      recRef.current = null;
      r.stop();
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  const clearTranscript = useCallback(() => {
    finalRef.current = '';
    setTranscript(''); setInterimText(''); setWordCount(0);
  }, []);

  const setManualTranscript = useCallback((text: string) => {
    finalRef.current = text;
    setTranscript(text);
    setWordCount(text.split(/\s+/).filter(Boolean).length);
  }, []);

  const displayText = transcript + (interimText ? ' ' + interimText : '');

  return {
    isRecording, transcript, displayText, interimText,
    isSupported, error, wordCount,
    startRecording, stopRecording, clearTranscript, setManualTranscript,
  };
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
  interface SpeechRecognitionErrorEvent extends Event { error: string; }
}
