import { useCallback, useEffect, useRef, useState } from "react";

// Audio lifecycle for the voice onboarding.
//
// Design constraints (from spec):
//  - getUserMedia is called ONCE per session and the MediaStream stays alive.
//    Closing/re-opening the stream on iOS re-prompts permission and adds
//    noticeable delay.
//  - Per-question segmentation: a fresh MediaRecorder is spun up over the
//    same stream for each question, and stopped to produce a Blob.
//  - The AnalyserNode is shared for the whole session and drives both the
//    waveform and the silence signal.

const WAVEFORM_BARS = 32;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export type VoiceStatus = "idle" | "requesting" | "ready" | "recording" | "error";

export interface Segment {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface AmbientCheck {
  rms: number;
  tooLoud: boolean;
}

export interface UseVoiceRecorderOptions {
  // RMS above which we consider the room too noisy (0..1). ~0.12 in practice.
  ambientThreshold?: number;
  // RMS below which we consider it silent. ~0.02.
  silenceThreshold?: number;
}

export interface UseVoiceRecorderApi {
  status: VoiceStatus;
  error: string | null;
  waveform: number[];
  isSilent: boolean;
  silenceMs: number;
  currentDurationMs: number;
  requestPermission: () => Promise<void>;
  startSegment: () => Promise<void>;
  stopSegment: () => Promise<Segment | null>;
  checkAmbient: (sampleMs?: number) => Promise<AmbientCheck>;
  release: () => void;
}

export function useVoiceRecorder(opts: UseVoiceRecorderOptions = {}): UseVoiceRecorderApi {
  const ambientThreshold = opts.ambientThreshold ?? 0.14;
  const silenceThreshold = opts.silenceThreshold ?? 0.02;

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>(() => new Array(WAVEFORM_BARS).fill(0));
  const [isSilent, setIsSilent] = useState(false);
  const [silenceMs, setSilenceMs] = useState(0);
  const [currentDurationMs, setCurrentDurationMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const segmentStartRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // Analyser loop: waveform + silence signal + duration ticker.
  // ---------------------------------------------------------------------------
  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = timeDataRef.current;
    if (analyser && buf) {
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      const bars = new Array<number>(WAVEFORM_BARS);
      const chunkSize = Math.floor(buf.length / WAVEFORM_BARS);
      for (let b = 0; b < WAVEFORM_BARS; b++) {
        let peak = 0;
        const start = b * chunkSize;
        const end = start + chunkSize;
        for (let i = start; i < end; i++) {
          const v = (buf[i] - 128) / 128;
          sumSq += v * v;
          const abs = Math.abs(v);
          if (abs > peak) peak = abs;
        }
        bars[b] = peak;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      setWaveform(bars);

      // Silence tracking only while recording.
      if (recorderRef.current?.state === "recording") {
        const now = performance.now();
        setCurrentDurationMs(now - segmentStartRef.current);
        if (rms < silenceThreshold) {
          if (silenceStartRef.current === null) silenceStartRef.current = now;
          setSilenceMs(now - silenceStartRef.current);
          setIsSilent(true);
        } else {
          silenceStartRef.current = null;
          setSilenceMs(0);
          setIsSilent(false);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [silenceThreshold]);

  // ---------------------------------------------------------------------------
  // Permission + stream + audio graph. Called once at intro screen.
  // ---------------------------------------------------------------------------
  const requestPermission = useCallback(async () => {
    if (streamRef.current) return;
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const Ctx: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      timeDataRef.current = new Uint8Array(analyser.fftSize);
      mimeTypeRef.current = pickMimeType();

      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      const msg = e instanceof Error ? e.message : "microphone_error";
      setError(msg);
      throw e;
    }
  }, [tick]);

  // ---------------------------------------------------------------------------
  // Per-question segment: spin a new MediaRecorder over the shared stream.
  // ---------------------------------------------------------------------------
  const startSegment = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) throw new Error("stream_not_ready");
    if (recorderRef.current?.state === "recording") return;

    // Resume the AudioContext if the browser suspended it (iOS behaviour after
    // backgrounding). Cheap when already running.
    if (audioCtxRef.current?.state === "suspended") {
      try { await audioCtxRef.current.resume(); } catch { /* ignore */ }
    }

    chunksRef.current = [];
    const mime = mimeTypeRef.current;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    silenceStartRef.current = null;
    setSilenceMs(0);
    setIsSilent(false);
    setCurrentDurationMs(0);
    segmentStartRef.current = performance.now();
    // Flush chunks every second so we never hold the entire recording in a
    // single blob until stop().
    recorder.start(1000);
    setStatus("recording");
  }, []);

  const stopSegment = useCallback(async (): Promise<Segment | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    const mimeType = recorder.mimeType || mimeTypeRef.current || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const durationMs = Math.max(0, Math.round(performance.now() - segmentStartRef.current));
    chunksRef.current = [];
    recorderRef.current = null;
    setStatus("ready");
    setIsSilent(false);
    setSilenceMs(0);
    setCurrentDurationMs(0);
    silenceStartRef.current = null;
    return { blob, mimeType, durationMs };
  }, []);

  // ---------------------------------------------------------------------------
  // Ambient noise probe — called right after startSegment so the analyser
  // is already fed by the active stream. Samples ~500ms and returns the mean
  // RMS + a bool.
  // ---------------------------------------------------------------------------
  const checkAmbient = useCallback(
    async (sampleMs: number = 500): Promise<AmbientCheck> => {
      const analyser = analyserRef.current;
      const buf = timeDataRef.current;
      if (!analyser || !buf) return { rms: 0, tooLoud: false };
      const start = performance.now();
      let sumSq = 0;
      let samples = 0;
      await new Promise<void>((resolve) => {
        const loop = () => {
          analyser.getByteTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sumSq += v * v;
            samples++;
          }
          if (performance.now() - start >= sampleMs) return resolve();
          requestAnimationFrame(loop);
        };
        loop();
      });
      const rms = samples > 0 ? Math.sqrt(sumSq / samples) : 0;
      return { rms, tooLoud: rms > ambientThreshold };
    },
    [ambientThreshold],
  );

  // ---------------------------------------------------------------------------
  // Full teardown — used when leaving the voice flow entirely.
  // ---------------------------------------------------------------------------
  const release = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch { /* ignore */ }
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    timeDataRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    waveform,
    isSilent,
    silenceMs,
    currentDurationMs,
    requestPermission,
    startSegment,
    stopSegment,
    checkAmbient,
    release,
  };
}
