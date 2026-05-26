'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechProps {
  onTranscript?: (text: string) => void;
}

export function useSpeechToText({
  onTranscript,
}: UseSpeechProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const recRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition ||
        window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      setError(event.error || 'Speech recognition error');
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];

        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const updatedTranscript =
        transcript + finalTranscript;

      setTranscript(updatedTranscript);
      setInterimText(interimTranscript);

      const words = updatedTranscript
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      setWordCount(words.length);

      if (onTranscript) {
        onTranscript(updatedTranscript);
      }
    };

    recRef.current = recognition;
  }, [onTranscript, transcript]);

  const startRecording = useCallback(() => {
    try {
      recRef.current?.start();
    } catch (err) {
      console.error(err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch (err) {
      console.error(err);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimText('');
    setWordCount(0);
  }, []);

  const setManualTranscript = useCallback(
    (text: string) => {
      setTranscript(text);

      const words = text
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      setWordCount(words.length);
    },
    []
  );

  return {
    isRecording,
    transcript,
    interimText,
    error,
    wordCount,
    isSupported:
      typeof window !== 'undefined' &&
      !!(
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
      ),
    startRecording,
    stopRecording,
    clearTranscript,
    setManualTranscript,
  };
}