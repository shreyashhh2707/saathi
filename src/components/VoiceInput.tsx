"use client";

import { useEffect, useRef, useState } from "react";
import { makeRecognizer, transcriptOf, type Recognizer } from "@/lib/client";

// One big box: speak or type, optionally attach a photo. Used for onboarding and logging.
export function VoiceInput(props: {
  lang: string;
  placeholder: string;
  busy: boolean;
  submitLabel: string;
  rows?: number;
  allowPhoto?: boolean;
  onSubmit: (text: string, photo: File | null) => void;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const baseRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = makeRecognizer(props.lang);
    if (!rec) {
      setMicError("Voice isn't supported in this browser. Please type instead (Chrome works best).");
      return;
    }
    setMicError(null);
    baseRef.current = text ? `${text} ` : "";
    rec.onresult = (e) => setText(baseRef.current + transcriptOf(e));
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") setMicError("Microphone permission was blocked. You can type instead.");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function submit() {
    recRef.current?.stop();
    if (!text.trim() && !photo) return;
    props.onSubmit(text.trim(), photo);
    setText("");
    setPhoto(null);
    setPreview(null);
  }

  return (
    <div className="rounded-[32px] bg-white p-4 shadow-lift ring-1 ring-line">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={listening ? "Listening… speak now" : props.placeholder}
        aria-label="What would you like to tell Saathi?"
        rows={props.rows ?? 3}
        className="w-full resize-none rounded-2xl bg-cream/60 p-3 text-lg leading-snug outline-none placeholder:text-ink-soft/70"
      />
      {preview && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-cream p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="h-16 w-16 rounded-xl object-cover" />
          <button onClick={() => { setPhoto(null); setPreview(null); }} className="text-base font-medium text-ink-soft underline">
            Remove photo
          </button>
        </div>
      )}
      {micError && <p className="mt-2 text-base text-saffron-deep">{micError}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleMic}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Speak"}
          className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-soft transition active:scale-95 ${
            listening ? "bg-coral" : "bg-gradient-to-br from-teal to-teal-deep"
          }`}
        >
          {listening && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-coral/40" />
              <span className="absolute -inset-2 animate-pulse rounded-full ring-4 ring-coral/25" />
            </>
          )}
          {listening ? (
            <span className="relative h-5 w-5 rounded-md bg-white" />
          ) : (
            <svg viewBox="0 0 24 24" className="relative h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>
        {props.allowPhoto && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-cream px-5 text-lg font-semibold ring-1 ring-line transition hover:bg-white"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Photo
            </button>
          </>
        )}
        <button
          onClick={submit}
          disabled={props.busy || (!text.trim() && !photo)}
          className="min-h-14 flex-1 rounded-2xl bg-saffron px-4 text-lg font-bold text-ink shadow-soft transition active:scale-[0.99] disabled:opacity-35"
        >
          {props.busy ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> Thinking…</span> : props.submitLabel}
        </button>
      </div>
    </div>
  );
}
