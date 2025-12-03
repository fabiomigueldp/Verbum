import { useState, useEffect, useRef, useCallback } from 'react';

// Type definitions for SpeechRecognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface Window {
  SpeechRecognition: {
    new(): SpeechRecognition;
  };
  webkitSpeechRecognition: {
    new(): SpeechRecognition;
  };
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  volume: number; // Normalized 0-1
  error: string | null;
  isSupported: boolean;
}

export interface VoiceInputActions {
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useVoiceInput = (): [VoiceInputState, VoiceInputActions] => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      setIsSupported(true);
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, []);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      // Normalize to 0-1 range (approximate, usually doesn't go full 255 avg)
      // Enhance low volume sensitivity
      const normalized = Math.min(1, average / 100);

      setVolume(normalized);

      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  }, []);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      analyzeAudio();
    } catch (err) {
      console.warn('Audio analysis failed to start (visualizer will be disabled):', err);
    }
  };

  const startListening = useCallback(() => {
    if (!isSupported) return;
    setError(null);

    // Stop existing instance if any
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      startAudioAnalysis();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interimStr += event.results[i][0].transcript;
        }
      }

      if (finalStr) {
        setTranscript(prev => {
          // Add space if needed
          const prefix = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + prefix + finalStr;
        });
      }
      setInterimTranscript(interimStr);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'no-speech') {
        // Ignore temporary silence
        return;
      }
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      } else {
        setError(`Error: ${event.error}`);
      }
      stopListening();
    };

    recognition.onend = () => {
      // If we are still supposed to be listening (e.g. paused for some reason), maybe restart?
      // But typically onend means it stopped.
      // We will rely on React state to know if we triggered the stop or if it happened automatically.
      // If `isListening` is true, it might have stopped unexpectedly, but usually we just sync state.
      // However, for "continuous" recognition, sometimes it stops on silence.
      // For now, let's treat end as stop.
      if (isListening) {
        setIsListening(false);
        cleanupAudio();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isListening, cleanupAudio, analyzeAudio]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    cleanupAudio();
    setVolume(0);
    setInterimTranscript('');
  }, [cleanupAudio]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return [
    { isListening, transcript, interimTranscript, volume, error, isSupported },
    { startListening, stopListening, resetTranscript }
  ];
};
