"use client";

import type { LoggedEntry } from "./schemas";

// Browser-side helpers: storage, dates, image shrinking, speech, API calls.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working for this session.
  }
}

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const clock = (d = new Date()) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const nowLabel = (d = new Date()) =>
  d.toLocaleString("en-IN", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: true });

export const newId = () => Math.random().toString(36).slice(2, 10);

export const totals = (entries: LoggedEntry[]) => ({
  water: entries.reduce((s, e) => s + (e.glasses || 0), 0),
  walk: entries.reduce((s, e) => s + (e.minutes || 0), 0),
  meals: entries.filter((e) => e.kind === "meal"),
});

// Phone photos are 3–8 MB; shrink to ~1024px JPEG so uploads are fast on weak connections.
export function shrinkImage(file: File, maxSide = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Could not read that photo."));
    img.src = url;
  });
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

// Minimal typing for the Web Speech API (not in TS's DOM lib).
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
export type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function makeRecognizer(lang: string): Recognizer | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = true;
  return r;
}

export function transcriptOf(e: SpeechResultEvent) {
  let text = "";
  for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
  return text;
}
