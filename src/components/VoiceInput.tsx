"use client";

import { useEffect, useRef, useState } from "react";
import { makeRecognizer, transcriptOf, type Recognizer } from "@/lib/client";

// One big box: speak or type, optionally attach a photo. Used for onboarding and logging.
export function VoiceInput(props: {
  lang: string;
  placeholder: string;
  busy: boolean;
  submitLabel: string;
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
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={props.placeholder}
        rows={3}
        className="w-full resize-none rounded-2xl bg-stone-50 p-3 text-lg leading-snug outline-none ring-1 ring-stone-200 focus:ring-2 focus:ring-teal-600"
      />
      {preview && (
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="h-20 w-20 rounded-xl object-cover" />
          <button onClick={() => { setPhoto(null); setPreview(null); }} className="text-base text-stone-600 underline">
            Remove photo
          </button>
        </div>
      )}
      {micError && <p className="mt-2 text-base text-amber-800">{micError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={toggleMic}
          aria-pressed={listening}
          className={`flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-lg font-semibold ${
            listening ? "animate-pulse bg-red-600 text-white" : "bg-teal-700 text-white"
          }`}
        >
          <span aria-hidden>{listening ? "■" : "🎤"}</span> {listening ? "Stop" : "Speak"}
        </button>
        {props.allowPhoto && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-stone-800 px-4 text-lg font-semibold text-white"
            >
              <span aria-hidden>📷</span> Photo
            </button>
          </>
        )}
        <button
          onClick={submit}
          disabled={props.busy || (!text.trim() && !photo)}
          className="min-h-14 flex-1 rounded-2xl bg-amber-500 px-4 text-lg font-bold text-stone-900 disabled:opacity-40"
        >
          {props.busy ? "Thinking…" : props.submitLabel}
        </button>
      </div>
    </div>
  );
}
