import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Mic,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Pencil,
  Volume2,
  AlertTriangle,
} from "lucide-react";
import { useClient } from "@/hooks/useClient";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useWakeLock } from "@/hooks/useWakeLock";
import { VOICE_BLOCKS, type VoiceBlock } from "@/data/voiceBlocks";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SILENCE_TRIGGER_MS = 5000;   // 5 s of silence → countdown appears
const COUNTDOWN_MS = 3000;         // 3 s countdown before auto-advance
const CANCEL_GRACE_MS = 4000;      // after "j'ai encore qqch", ignore silence
const SHORT_ANSWER_MS = 10_000;    // < 10 s on an open question → soft nudge

const SESSION_KEY = "tdia_voice_session_v1";

interface AnswerRecord {
  blockId: string;
  status: "complete" | "short" | "text_fallback" | "skipped";
  durationMs: number;
  ambientWarning: boolean;
}

interface SessionState {
  clientCode: string;
  blockIndex: number;
  answers: Record<string, AnswerRecord>;
}

type Phase = "intro" | "question" | "done";

function loadSession(clientCode: string): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed.clientCode !== clientCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(state: SessionState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch { /* ignore quota */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function formatSec(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

async function uploadAnswer(params: {
  clientCode: string;
  block: VoiceBlock;
  blob?: Blob;
  mimeType?: string;
  durationMs: number;
  status: AnswerRecord["status"];
  writtenFallback?: string;
  ambientWarning: boolean;
}): Promise<void> {
  const url = `${SUPABASE_URL}/functions/v1/voice-upload`;
  const form = new FormData();
  form.append("client_code", params.clientCode);
  form.append("form_key", params.block.formKey);
  form.append("question_id", params.block.id);
  form.append("duration_ms", String(params.durationMs));
  form.append("status", params.status);
  form.append("target_field_ids", JSON.stringify(params.block.targetFieldIds));
  form.append("ambient_noise_warning", params.ambientWarning ? "true" : "false");
  if (params.writtenFallback) form.append("written_fallback", params.writtenFallback);
  if (params.blob) {
    const ext = (params.mimeType || "").includes("mp4") ? "m4a"
      : (params.mimeType || "").includes("ogg") ? "ogg"
      : "webm";
    form.append("audio", params.blob, `${params.block.id}.${ext}`);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_ANON}`, apikey: SUPABASE_ANON },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`upload_failed_${res.status}: ${text}`);
  }
}

function Waveform({ values, active }: { values: number[]; active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-24 w-full max-w-xs">
      {values.map((v, i) => {
        const h = Math.max(6, Math.round(v * 96));
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-75",
              active ? "bg-emerald-400" : "bg-slate-500/60",
            )}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

const VoiceOnboarding = () => {
  const navigate = useNavigate();
  const { info } = useClient();
  const clientCode: string | null = (info as any)?.client?.client_code ?? null;

  const [phase, setPhase] = useState<Phase>("intro");
  const [blockIndex, setBlockIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [countdownStartAt, setCountdownStartAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(COUNTDOWN_MS);
  const [showShortNudge, setShowShortNudge] = useState(false);
  const [pendingShortSegment, setPendingShortSegment] = useState<{
    blob: Blob; mimeType: string; durationMs: number;
  } | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [ambientWarning, setAmbientWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const graceUntilRef = useRef<number>(0);

  const recorder = useVoiceRecorder();
  useWakeLock(phase === "question" && !textMode);

  const currentBlock = VOICE_BLOCKS[blockIndex];
  const totalBlocks = VOICE_BLOCKS.length;

  // ---------------------------------------------------------------------------
  // Session resume on mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!clientCode) return;
    const s = loadSession(clientCode);
    if (s && s.blockIndex > 0 && s.blockIndex < VOICE_BLOCKS.length) {
      setBlockIndex(s.blockIndex);
      setAnswers(s.answers);
      // Stay on the intro so we can re-request mic permission on user gesture.
      toast.info("On reprend là où vous vous étiez arrêté.");
    }
  }, [clientCode]);

  // Persist session state on every meaningful change.
  useEffect(() => {
    if (!clientCode) return;
    saveSession({ clientCode, blockIndex, answers });
  }, [clientCode, blockIndex, answers]);

  // ---------------------------------------------------------------------------
  // Segment start when moving into "question" phase or advancing.
  // ---------------------------------------------------------------------------
  const beginSegment = useCallback(async () => {
    setPreparing(true);
    setAmbientWarning(false);
    setShowShortNudge(false);
    setPendingShortSegment(null);
    setCountdownStartAt(null);
    setTextMode(false);
    setTextDraft("");
    try {
      await recorder.startSegment();
      const ambient = await recorder.checkAmbient(600);
      if (ambient.tooLoud) setAmbientWarning(true);
    } catch (e) {
      toast.error("Impossible de démarrer l'enregistrement.");
    } finally {
      setPreparing(false);
    }
  }, [recorder]);

  // Kicked off by the intro screen "Commencer" button (user gesture).
  const handleStart = useCallback(async () => {
    if (!clientCode) {
      toast.error("Session client introuvable. Reconnectez-vous.");
      return;
    }
    try {
      await recorder.requestPermission();
    } catch {
      toast.error("On n'a pas eu accès au micro. Vérifiez les autorisations.");
      return;
    }
    setPhase("question");
    // Slight delay so the transition renders before we start capturing.
    setTimeout(() => { beginSegment(); }, 250);
  }, [clientCode, recorder, beginSegment]);

  // ---------------------------------------------------------------------------
  // Silence → countdown wiring.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "question" || textMode || uploading || preparing) return;
    if (showShortNudge) return;
    const now = performance.now();
    if (now < graceUntilRef.current) return;

    // Trigger countdown once enough silence accumulated and we've spoken a bit.
    if (
      recorder.isSilent &&
      recorder.silenceMs >= SILENCE_TRIGGER_MS &&
      recorder.currentDurationMs > SILENCE_TRIGGER_MS + 1000 &&
      countdownStartAt === null
    ) {
      setCountdownStartAt(performance.now());
      setCountdownRemaining(COUNTDOWN_MS);
    }
    // Cancel countdown if speech resumed.
    if (!recorder.isSilent && countdownStartAt !== null) {
      setCountdownStartAt(null);
    }
  }, [
    phase, textMode, uploading, preparing, showShortNudge,
    recorder.isSilent, recorder.silenceMs, recorder.currentDurationMs,
    countdownStartAt,
  ]);

  // Countdown ticker.
  useEffect(() => {
    if (countdownStartAt === null) return;
    const t = setInterval(() => {
      const elapsed = performance.now() - countdownStartAt;
      const rem = Math.max(0, COUNTDOWN_MS - elapsed);
      setCountdownRemaining(rem);
      if (rem <= 0) {
        clearInterval(t);
        setCountdownStartAt(null);
        void finalizeSegment("auto");
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownStartAt]);

  const cancelCountdown = useCallback(() => {
    setCountdownStartAt(null);
    graceUntilRef.current = performance.now() + CANCEL_GRACE_MS;
  }, []);

  // ---------------------------------------------------------------------------
  // Finalize current segment: stop, decide short/complete, upload, advance.
  // ---------------------------------------------------------------------------
  const advanceOrFinish = useCallback((updated: Record<string, AnswerRecord>) => {
    const next = blockIndex + 1;
    if (next >= totalBlocks) {
      setPhase("done");
      clearSession();
      setTimeout(() => {
        recorder.release();
        navigate("/step3");
      }, 1200);
      return;
    }
    setBlockIndex(next);
    setAnswers(updated);
    setTimeout(() => { beginSegment(); }, 200);
  }, [blockIndex, totalBlocks, recorder, navigate, beginSegment]);

  const finalizeSegment = useCallback(async (trigger: "auto" | "manual") => {
    if (!clientCode || uploading) return;
    const segment = await recorder.stopSegment();
    if (!segment) return;

    // Short-answer nudge: only on open questions, only on manual "Terminé".
    if (
      trigger === "manual" &&
      currentBlock.isOpen &&
      segment.durationMs < SHORT_ANSWER_MS
    ) {
      setPendingShortSegment(segment);
      setShowShortNudge(true);
      return;
    }

    await commitSegment(segment, segment.durationMs < SHORT_ANSWER_MS ? "short" : "complete");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientCode, recorder, currentBlock, uploading]);

  const commitSegment = useCallback(async (
    segment: { blob: Blob; mimeType: string; durationMs: number },
    status: AnswerRecord["status"],
  ) => {
    if (!clientCode) return;
    setUploading(true);
    try {
      await uploadAnswer({
        clientCode,
        block: currentBlock,
        blob: segment.blob,
        mimeType: segment.mimeType,
        durationMs: segment.durationMs,
        status,
        ambientWarning,
      });
      const updated = {
        ...answers,
        [currentBlock.id]: {
          blockId: currentBlock.id,
          status,
          durationMs: segment.durationMs,
          ambientWarning,
        },
      };
      advanceOrFinish(updated);
    } catch (e) {
      toast.error("Envoi impossible. Réessayez.");
      // Keep the segment blob so the user can retry: reopen a fresh recording.
      await beginSegment();
    } finally {
      setUploading(false);
    }
  }, [clientCode, currentBlock, ambientWarning, answers, advanceOrFinish, beginSegment]);

  const acceptShortAsIs = useCallback(async () => {
    if (!pendingShortSegment) return;
    setShowShortNudge(false);
    await commitSegment(pendingShortSegment, "short");
    setPendingShortSegment(null);
  }, [pendingShortSegment, commitSegment]);

  const resumeAfterShortNudge = useCallback(async () => {
    // Reopen a fresh segment; the "short" one is discarded (user chose to add more).
    setShowShortNudge(false);
    setPendingShortSegment(null);
    await beginSegment();
  }, [beginSegment]);

  // ---------------------------------------------------------------------------
  // Text fallback ("écrire plutôt").
  // ---------------------------------------------------------------------------
  const enterTextMode = useCallback(async () => {
    // Stop the current segment (discard it — user preferred writing).
    if (recorder.status === "recording") {
      await recorder.stopSegment();
    }
    setTextMode(true);
    setCountdownStartAt(null);
    setShowShortNudge(false);
  }, [recorder]);

  const submitText = useCallback(async () => {
    const value = textDraft.trim();
    if (!value) {
      toast.error("Écrivez quelques mots avant d'enregistrer.");
      return;
    }
    if (!clientCode) return;
    setUploading(true);
    try {
      await uploadAnswer({
        clientCode,
        block: currentBlock,
        durationMs: 0,
        status: "text_fallback",
        writtenFallback: value,
        ambientWarning: false,
      });
      const updated = {
        ...answers,
        [currentBlock.id]: {
          blockId: currentBlock.id,
          status: "text_fallback" as const,
          durationMs: 0,
          ambientWarning: false,
        },
      };
      advanceOrFinish(updated);
    } catch {
      toast.error("Envoi impossible. Réessayez.");
    } finally {
      setUploading(false);
    }
  }, [textDraft, clientCode, currentBlock, answers, advanceOrFinish]);

  // ---------------------------------------------------------------------------
  // Back navigation (re-record previous).
  // ---------------------------------------------------------------------------
  const goBack = useCallback(async () => {
    if (blockIndex === 0) return;
    if (recorder.status === "recording") {
      await recorder.stopSegment();
    }
    setBlockIndex(blockIndex - 1);
    setTimeout(() => { beginSegment(); }, 200);
  }, [blockIndex, recorder, beginSegment]);

  // ---------------------------------------------------------------------------
  // Render.
  // ---------------------------------------------------------------------------
  const progress = useMemo(() => {
    const done = Object.keys(answers).length;
    return Math.round((done / totalBlocks) * 100);
  }, [answers, totalBlocks]);

  if (!clientCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg text-slate-100">Aucune session client active.</p>
          <Button onClick={() => navigate("/client")}>Retour à la connexion</Button>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Mic className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-50">
            {VOICE_BLOCKS.length} notes vocales rapides
          </h1>
          <p className="text-slate-300 leading-relaxed">
            Environ 2 minutes chacune. Vous répondez à voix haute, on s'occupe du
            reste. Comme un vocal à un pote — pas d'écrit, pas de longues phrases
            à taper sur le téléphone.
          </p>
          <ul className="text-sm text-slate-400 text-left space-y-1 mx-auto max-w-xs">
            <li>• Trouvez un endroit calme si possible</li>
            <li>• Prenez votre temps, on enregistre en continu</li>
            <li>• Vous pourrez toujours écrire à la place si vous préférez</li>
          </ul>
          <Button
            size="lg"
            className="w-full text-base"
            onClick={handleStart}
          >
            Commencer
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-50">C'est enregistré.</h2>
          <p className="text-slate-300">
            On finalise le reste avec vous en quelques questions rapides.
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
        </div>
      </div>
    );
  }

  // -------------------- Question phase --------------------
  const remainingSec = Math.max(
    0,
    currentBlock.targetDurationSec - Math.floor(recorder.currentDurationMs / 1000),
  );
  const countdownSec = Math.ceil(countdownRemaining / 1000);

  return (
    <div className="min-h-screen flex flex-col p-5 sm:p-6 animate-fade-in">
      {/* Progress + counter */}
      <div className="w-full max-w-md mx-auto pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Note {blockIndex + 1} / {totalBlocks}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main question card */}
      <div className="flex-1 flex flex-col justify-center items-center max-w-md w-full mx-auto py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBlock.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="w-full text-center space-y-3"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {currentBlock.formKey === "welcome" ? "Votre univers"
                : currentBlock.formKey === "founder_scan" ? "Vous, fondateur·rice"
                : "Votre business"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-50 leading-tight">
              {currentBlock.prompt}
            </h2>
            {currentBlock.subtext && (
              <p className="text-sm text-slate-400 leading-relaxed">
                {currentBlock.subtext}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Ambient warning */}
        {ambientWarning && !textMode && (
          <div className="mt-6 flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 max-w-xs">
            <Volume2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>On vous entend mal, un endroit plus calme si vous pouvez ?</span>
          </div>
        )}

        {/* Waveform + timer */}
        {!textMode && (
          <div className="mt-8 w-full flex flex-col items-center gap-3">
            <Waveform values={recorder.waveform} active={recorder.status === "recording"} />
            <div className="text-sm tabular-nums text-slate-300">
              {preparing ? "…" : `${formatSec(recorder.currentDurationMs)} · reste ${formatSec(remainingSec * 1000)}`}
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {countdownStartAt !== null && !textMode && (
          <div className="mt-6 text-center space-y-3">
            <p className="text-slate-300">
              Question suivante dans <span className="text-emerald-400 font-semibold">{countdownSec}</span>…
            </p>
            <Button variant="outline" onClick={cancelCountdown}>
              J'ai encore quelque chose à dire
            </Button>
          </div>
        )}

        {/* Short-answer nudge */}
        {showShortNudge && !textMode && (
          <div className="mt-6 text-center space-y-3">
            <p className="text-slate-300">Vous voulez ajouter quelque chose ?</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={resumeAfterShortNudge}>
                Oui, je continue
              </Button>
              <Button onClick={acceptShortAsIs}>
                Non, c'est bon
              </Button>
            </div>
          </div>
        )}

        {/* Text fallback */}
        {textMode && (
          <div className="mt-6 w-full space-y-3">
            <Textarea
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Écrivez votre réponse ici…"
              className="min-h-[160px]"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setTextMode(false); beginSegment(); }}>
                Reprendre le vocal
              </Button>
              <Button className="flex-1" onClick={submitText} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="w-full max-w-md mx-auto pb-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={blockIndex === 0 || uploading}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Précédente
          </Button>

          {!textMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={enterTextMode}
              disabled={uploading}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Écrire plutôt
            </Button>
          )}

          {!textMode && !showShortNudge && (
            <Button
              size="sm"
              onClick={() => finalizeSegment("manual")}
              disabled={uploading || preparing || recorder.status !== "recording"}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Terminé
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
        {recorder.error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Micro indisponible : {recorder.error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceOnboarding;
