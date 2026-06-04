import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type surface for the Web Speech API (not in lib.dom by default).
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [Symbol.iterator](): IterableIterator<{ transcript: string }>;
  readonly length: number;
  item(index: number): { transcript: string };
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const getCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface UseVoiceRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onFinal?: (transcript: string) => void;
}

export interface UseVoiceRecognitionReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;          // partial + final accumulated text
  finalTranscript: string;     // only final segments
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// Wrapper around Web Speech API. Chrome / Edge / Safari support it; Firefox does not.
export const useVoiceRecognition = (
  { lang = "es-ES", continuous = true, onFinal }: UseVoiceRecognitionOptions = {},
): UseVoiceRecognitionReturn => {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => {
      setError(ev.error ?? "voice-error");
      setListening(false);
    };
    rec.onresult = (ev) => {
      let interim = "";
      let finalPiece = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalPiece += text;
        else interim += text;
      }
      if (finalPiece) {
        setFinalTranscript((prev) => (prev ? `${prev} ${finalPiece}`.trim() : finalPiece.trim()));
        onFinalRef.current?.(finalPiece.trim());
      }
      setTranscript((prev) => {
        const base = finalPiece ? `${prev} ${finalPiece}`.trim() : prev;
        return interim ? `${base} ${interim}`.trim() : base;
      });
    };

    recognitionRef.current = rec;
    return () => {
      rec.abort();
      recognitionRef.current = null;
    };
  }, [lang, continuous]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      setError("unsupported");
      return;
    }
    setTranscript("");
    setFinalTranscript("");
    try {
      rec.start();
    } catch (e) {
      // start() throws if already started — ignore
      void e;
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, finalTranscript, error, start, stop, reset };
};
