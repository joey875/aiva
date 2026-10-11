"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; text: string };
type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const HOLD_THRESHOLD_MS = 350;
const MAX_SENT_TURNS = 8;
const MAX_SHOWN_TURNS = 6;

const MicIcon = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
    <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
  </svg>
);

const StopIcon = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const Spinner = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const candidate of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(candidate)) return candidate;
  }
  return undefined;
}

export function AivaVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressStartRef = useRef(0); // ms epoch, 0 means not pressed
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }, []);

  const sendRecording = useCallback(async (blob: Blob, mimeType: string) => {
    setState("thinking");
    setNotice(null);

    const form = new FormData();
    form.append("audio", blob, "voice." + (mimeType.includes("mp4") ? "m4a" : "webm"));
    form.append("history", JSON.stringify(turnsRef.current.slice(-MAX_SENT_TURNS)));

    try {
      const res = await fetch("/api/aiva/voice", { method: "POST", body: form });

      if (res.status === 422) {
        setNotice("Didn't catch that - try again.");
        setState("idle");
        return;
      }
      if (res.status === 401) {
        setNotice("You've been signed out. Sign back in and try again.");
        setState("idle");
        return;
      }
      if (!res.ok) {
        setNotice("Aiva couldn't respond just now. Try again in a moment.");
        setState("idle");
        return;
      }

      const transcript = decodeURIComponent(res.headers.get("X-Aiva-Transcript") ?? "");
      const reply = decodeURIComponent(res.headers.get("X-Aiva-Reply") ?? "");
      setTurns((prev) =>
        [...prev, { role: "user", text: transcript } as const, { role: "assistant", text: reply } as const].slice(-MAX_SHOWN_TURNS * 2),
      );
      setCollapsed(false);

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setState("speaking");
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) {
          audioRef.current = null;
          setState("idle");
        }
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) {
          audioRef.current = null;
          setState("idle");
        }
      });
      await audio.play().catch(() => {
        /* Autoplay can be blocked; the rep can still read the transcript panel. */
      });
    } catch {
      setNotice("Couldn't reach Aiva - check your connection.");
      setState("idle");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) void sendRecording(blob, recorder.mimeType || "audio/webm");
        else setState("idle");
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("listening");
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setNotice(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again."
          : "Couldn't access the microphone on this device.",
      );
      setState("idle");
    }
  }, [sendRecording]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    },
    [],
  );

  const onPressStart = useCallback(() => {
    if (state === "speaking") {
      stopSpeaking();
      return;
    }
    if (state === "listening") {
      // Second tap in tap-to-stop mode.
      pressStartRef.current = 0;
      stopRecording();
      return;
    }
    if (state !== "idle") return; // thinking: ignore presses
    pressStartRef.current = Date.now();
    void startRecording();
  }, [state, startRecording, stopRecording, stopSpeaking]);

  const onPressEnd = useCallback(() => {
    if (state !== "listening" || pressStartRef.current === 0) return;
    const held = Date.now() - pressStartRef.current;
    pressStartRef.current = 0;
    if (held < HOLD_THRESHOLD_MS) return; // quick tap: stays listening until the next tap
    stopRecording();
  }, [state, stopRecording]);

  const label =
    state === "listening" ? "Listening…" : state === "thinking" ? "Aiva is thinking…" : state === "speaking" ? "Aiva is speaking - tap to stop" : "Talk to Aiva";

  return (
    <div className="fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2">
      <div aria-live="polite" className="sr-only">
        {label}
      </div>

      {(turns.length > 0 || notice) && !collapsed && (
        <div className="w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-text-muted">Aiva</p>
            <button type="button" onClick={() => setCollapsed(true)} className="text-xs font-semibold text-text-muted hover:text-text" aria-label="Collapse transcript">
              Hide
            </button>
          </div>
          {notice && <p className="mb-2 text-sm font-medium text-attention">{notice}</p>}
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {turns.slice(-MAX_SHOWN_TURNS * 2).map((t, i) => (
              <li key={i}>
                <span className="font-semibold text-text-muted">{t.role === "user" ? "You: " : "Aiva: "}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {turns.length > 0 && collapsed && (
        <button type="button" onClick={() => setCollapsed(false)} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-[inset_0_0_0_1px_var(--border)] hover:text-text">
          Show transcript
        </button>
      )}

      <div className="relative">
        {state === "listening" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/50" />}
        {state === "speaking" && <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-primary/40" />}
        <button
          type="button"
          aria-label={label}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onPointerLeave={(e) => e.buttons === 1 && onPressEnd()}
          onContextMenu={(e) => e.preventDefault()}
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl select-none hover:bg-primary-hover active:scale-95"
          style={{ touchAction: "none" }}
        >
          {state === "thinking" ? <Spinner /> : state === "speaking" ? <StopIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
  );
}
