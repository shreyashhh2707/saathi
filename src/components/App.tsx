"use client";

import { useCallback, useEffect, useState } from "react";
import { VoiceInput } from "@/components/VoiceInput";
import { clock, dayKey, load, newId, nowLabel, post, save, shrinkImage, totals } from "@/lib/client";
import type { FamilyUpdate, LoggedEntry, LogResult, Nudge, Profile } from "@/lib/schemas";

// Made-up person for trying the app. No real data is ever needed.
const SAMPLE_INTRO =
  "I'm Lata, 67 years old, I live alone in Margao since my husband passed. Pure veg. My doctor said my sugar is borderline, cut down on sweets and walk 30 minutes every day. I forget to drink water. My son Rohan is in Pune and he worries about me. I wake up at 6 and sleep by 10.";

const SAMPLE_LOGS = [
  "Aaj lunch me 2 chapati, dal aur bhindi khayi, aur 2 glass paani piya",
  "Walked to the temple and back, about 25 minutes",
  "Had chai with 2 biscuits and one ladoo at my neighbour's",
];

const LANGS = [
  { code: "en-IN", label: "English / Hinglish" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "mr-IN", label: "मराठी" },
];

type Exchange = { id: string; at: string; you: string; photo?: boolean; saathi: string; ask?: string; flag?: string; flagCleared?: boolean; demo?: boolean };
type Pending = { id: string; text: string; at: string };

export default function App() {
  const today = dayKey();
  // Rendered client-only (see page.tsx), so state can start from what this browser saved.
  const [profile, setProfile] = useState<Profile | null>(() => load<Profile | null>("saathi.profile", null));
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<LoggedEntry[]>(() => load<LoggedEntry[]>(`saathi.entries.${today}`, []));
  const [chat, setChat] = useState<Exchange[]>(() => load<Exchange[]>(`saathi.chat.${today}`, []));
  const [pending, setPending] = useState<Pending[]>(() => load<Pending[]>("saathi.pending", []));
  const [nudge, setNudge] = useState<(Nudge & { at: string }) | null>(() => {
    const saved = load<(Nudge & { at: string; dismissed?: boolean }) | null>(`saathi.nudge.${today}`, null);
    return saved?.dismissed ? null : saved;
  });
  const [family, setFamily] = useState<FamilyUpdate | null>(null);
  const [lang, setLang] = useState(() => load("saathi.lang", "en-IN"));
  const [demo, setDemo] = useState(() => load("saathi.demo", false));
  const [aiLive, setAiLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setAiLive(Boolean(s.ai)))
      .catch(() => setAiLive(false));
  }, []);

  useEffect(() => save(`saathi.entries.${today}`, entries), [today, entries]);
  useEffect(() => save(`saathi.chat.${today}`, chat), [today, chat]);
  useEffect(() => save("saathi.pending", pending), [pending]);
  useEffect(() => save("saathi.lang", lang), [lang]);
  useEffect(() => save("saathi.demo", demo), [demo]);

  const useDemo = demo || aiLive === false;

  // ---- Onboarding: no form, just talk ----
  async function onboard(text: string) {
    setBusy(true);
    setError(null);
    try {
      const { profile } = await post<{ profile: Profile }>("/api/onboard", { text, demo: useDemo });
      setDraftProfile(profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmProfile() {
    if (!draftProfile) return;
    setProfile(draftProfile);
    save("saathi.profile", draftProfile);
    setDraftProfile(null);
  }

  // ---- Logging: anything in, structured entries + short reply out ----
  const logInput = useCallback(
    async (text: string, photo: File | null, opts: { replayOf?: Pending } = {}) => {
      if (!profile) return;
      setBusy(true);
      setError(null);
      const at = opts.replayOf?.at ?? clock();
      try {
        const image = photo ? await shrinkImage(photo) : undefined;
        const { result, demo: wasDemo } = await post<{ result: LogResult; demo: boolean }>("/api/log", {
          text,
          image,
          profile,
          today: entries.map((e) => ({ summary: e.summary, at: e.at })),
          now: nowLabel(),
          demo: useDemo,
        });
        const source = photo ? "photo" : "text";
        setEntries((prev) => [
          ...prev.filter((e) => e.id !== opts.replayOf?.id),
          ...result.entries.map((e) => ({ ...e, id: newId(), at, source }) as LoggedEntry),
        ]);
        setChat((prev) => [
          ...prev,
          {
            id: newId(),
            at,
            you: text || "(photo)",
            photo: Boolean(photo),
            saathi: result.reply,
            ask: result.ask_back || undefined,
            flag: result.red_flag ? result.red_flag_reason : undefined,
            demo: wasDemo,
          },
        ]);
        if (opts.replayOf) setPending((prev) => prev.filter((p) => p.id !== opts.replayOf!.id));
        // They've just acted, so the earlier nudge is stale. Its timestamp stays saved for throttling.
        setNudge(null);
        const savedNudge = load<object | null>(`saathi.nudge.${dayKey()}`, null);
        if (savedNudge) save(`saathi.nudge.${dayKey()}`, { ...savedNudge, dismissed: true });
      } catch (e) {
        // Connectivity (D08): keep what they said, understand it later.
        if (!opts.replayOf && text) {
          const id = newId();
          setPending((prev) => [...prev, { id, text, at }]);
          setEntries((prev) => [
            ...prev,
            { id, at, source: "offline", kind: "other", summary: text.slice(0, 60), glasses: 0, minutes: 0, plate: "not_a_meal", confidence: "low" },
          ]);
          setError(`${(e as Error).message} I saved your note and will read it properly when the connection is back.`);
        } else {
          setError((e as Error).message);
        }
      } finally {
        setBusy(false);
      }
    },
    [profile, entries, useDemo],
  );

  // Retry notes saved while offline.
  useEffect(() => {
    if (!profile || !pending.length) return;
    const retry = () => pending.forEach((p) => logInput(p.text, null, { replayOf: p }));
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [profile, pending, logInput]);

  // ---- Proactive nudge: the AI decides if and what to say ----
  const checkNudge = useCallback(async () => {
    if (!profile) return;
    const last = load<(Nudge & { at: string; ts: number }) | null>(`saathi.nudge.${dayKey()}`, null);
    if (last && Date.now() - last.ts < 60 * 60 * 1000) return; // at most hourly
    try {
      const { nudge } = await post<{ nudge: Nudge }>("/api/nudge", {
        profile,
        today: entries,
        now: nowLabel(),
        hour: new Date().getHours(),
        lastNudge: last ? `${last.at}: ${last.message}` : null,
        demo: useDemo,
      });
      if (!nudge.send) return;
      const record = { ...nudge, at: clock(), ts: Date.now() };
      setNudge(record);
      save(`saathi.nudge.${dayKey()}`, record);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("Saathi", { body: nudge.message });
      }
    } catch {
      // A missed nudge is harmless; stay quiet.
    }
  }, [profile, entries, useDemo]);

  useEffect(() => {
    if (!profile || aiLive === null) return;
    const first = setTimeout(checkNudge, 1500);
    const every = setInterval(checkNudge, 20 * 60 * 1000);
    return () => { clearTimeout(first); clearInterval(every); };
    // Only re-arm when the profile or AI status changes, not on every new entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, aiLive]);

  async function makeFamilyUpdate() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const { update } = await post<{ update: FamilyUpdate }>("/api/family", { profile, today: entries, demo: useDemo });
      setFamily(update);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addWater() {
    setEntries((prev) => [
      ...prev,
      { id: newId(), at: clock(), source: "tap", kind: "water", summary: "1 glass water", glasses: 1, minutes: 0, plate: "not_a_meal", confidence: "high" },
    ]);
  }

  function resetAll() {
    Object.keys(localStorage).filter((k) => k.startsWith("saathi.")).forEach((k) => localStorage.removeItem(k));
    location.reload();
  }

  const t = totals(entries);
  const latestFlag = [...chat].reverse().find((c) => c.flag && !c.flagCleared);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="relative flex-1 overflow-x-hidden bg-cream text-ink">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-saffron/25 via-teal/10 to-transparent blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-12 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Orb />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Saathi</p>
              <h1 className="font-display text-[1.9rem] leading-tight">
                {profile?.name ? `${greeting}, ${profile.name}` : "Namaste"}
              </h1>
              <p className="text-base text-ink-soft">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings((s) => !s)}
            aria-label={showSettings ? "Close settings" : "Settings"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/80 shadow-soft ring-1 ring-line backdrop-blur transition hover:bg-white"
          >
            {showSettings ? <IconClose /> : <IconGear />}
          </button>
        </header>

        {useDemo && (
          <p className="flex items-center gap-2 self-start rounded-full bg-saffron/15 px-4 py-1.5 text-sm font-medium text-saffron-deep">
            <span className="h-2 w-2 rounded-full bg-saffron" /> Demo mode, simple rules instead of AI{aiLive === false ? " (no AI key on this server)" : ""}
          </p>
        )}

        {showSettings && (
          <section className="flex flex-col gap-4 rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-line">
            <h2 className="font-display text-xl">Settings</h2>
            <label className="flex flex-col gap-1.5 text-base font-medium">
              Language for the microphone
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-2xl bg-cream p-3 text-lg ring-1 ring-line">
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            {aiLive && (
              <label className="flex items-center gap-3 text-base">
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-6 w-6 accent-teal" />
                Demo mode (no AI calls)
              </label>
            )}
            {"Notification" in globalThis && (
              <button onClick={() => Notification.requestPermission()} className="rounded-2xl bg-cream p-3 text-left text-base font-medium ring-1 ring-line">
                🔔 Allow reminders as notifications
              </button>
            )}
            {profile && (
              <div className="rounded-2xl bg-cream p-4">
                <p className="mb-2 font-semibold">What Saathi knows about you</p>
                <ProfileSummary profile={profile} />
              </div>
            )}
            <button onClick={resetAll} className="rounded-2xl p-3 text-left text-base font-medium text-coral ring-1 ring-coral/30">
              Start over (delete everything on this phone)
            </button>
          </section>
        )}

        {error && <p className="rounded-2xl bg-coral/10 px-4 py-3 text-base text-coral-deep ring-1 ring-coral/25">{error}</p>}

        {!profile ? (
          <Onboarding
            lang={lang}
            busy={busy}
            draft={draftProfile}
            onSubmit={onboard}
            onSample={() => onboard(SAMPLE_INTRO)}
            onConfirm={confirmProfile}
            onRetry={() => setDraftProfile(null)}
          />
        ) : (
          <>
            {latestFlag && (
              <section className="animate-rise overflow-hidden rounded-[28px] bg-gradient-to-br from-coral to-coral-deep p-5 text-white shadow-lift">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/80">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-white" /> Please check with a doctor
                </p>
                <p className="mt-2 font-display text-2xl leading-snug">{latestFlag.flag}</p>
                <a href="tel:108" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-bold text-coral-deep">
                  📞 Call 108
                </a>
                <button
                  onClick={() => setChat((prev) => prev.map((c) => (c.flag ? { ...c, flagCleared: true } : c)))}
                  className="mt-2 min-h-12 w-full rounded-2xl text-base font-medium text-white/90 ring-1 ring-white/40"
                >
                  I&apos;ve spoken to my doctor
                </button>
              </section>
            )}

            {nudge && (
              <section className="animate-rise flex gap-3 rounded-[28px] bg-white p-4 shadow-soft ring-1 ring-saffron/40">
                <Orb small />
                <div>
                  <p className="text-sm font-medium text-ink-soft">Saathi · {nudge.at}</p>
                  <p className="mt-0.5 text-xl leading-snug">{nudge.message}</p>
                </div>
              </section>
            )}

            <section className="rounded-[32px] bg-gradient-to-br from-teal to-teal-deep p-5 text-white shadow-lift">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Today</h2>
                <p className="text-sm text-white/70">{entries.length} {entries.length === 1 ? "note" : "notes"}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Ring label="Water" value={t.water} target={profile.water_target_glasses} unit="glasses" color="#7DD3FC" />
                <Ring label="Walk" value={t.walk} target={profile.walk_target_minutes} unit="min" color="#FCD34D" />
                <Ring label="Meals" value={t.meals.length} target={3} unit="logged" color="#86EFAC" />
              </div>
              <div className="mt-5 rounded-2xl bg-white/10 p-3">
                <p className="text-sm text-white/80">Tap a glass when you drink water</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: Math.max(profile.water_target_glasses, t.water + 1) }).map((_, i) => (
                    <button
                      key={i}
                      onClick={i >= t.water ? addWater : undefined}
                      aria-label={i < t.water ? `Glass ${i + 1}, done` : "Add a glass of water"}
                      className={`grid h-11 w-8 place-items-center rounded-b-xl rounded-t-md border-2 transition ${
                        i < t.water ? "border-sky-200 bg-sky-300/90" : "border-white/40 hover:border-white"
                      }`}
                    >
                      {i === t.water && <span className="text-lg font-bold text-white/90">+</span>}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <VoiceInput
              lang={lang}
              busy={busy}
              allowPhoto
              submitLabel="Tell Saathi"
              placeholder="What did you eat, drink or do? How are you feeling?"
              onSubmit={(text, photo) => logInput(text, photo)}
            />
            {chat.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink-soft">Or try one of these:</p>
                {SAMPLE_LOGS.map((s) => (
                  <button key={s} onClick={() => logInput(s, null)} disabled={busy} className="rounded-2xl bg-white/70 px-4 py-3 text-left text-base text-ink shadow-soft ring-1 ring-line transition hover:bg-white">
                    “{s}”
                  </button>
                ))}
              </div>
            )}

            {chat.length > 0 && (
              <section className="flex flex-col gap-4">
                {[...chat].reverse().map((c) => (
                  <div key={c.id} className="flex flex-col gap-2">
                    <div className="ml-10 self-end rounded-3xl rounded-br-md bg-ink px-4 py-3 text-base text-white">
                      {c.photo && <span className="mr-1">📷</span>}
                      {c.you}
                      <span className="mt-1 block text-right text-xs text-white/50">{c.at}</span>
                    </div>
                    <div className="mr-6 flex items-end gap-2">
                      <Orb small />
                      <div className={`rounded-3xl rounded-bl-md px-4 py-3 text-lg leading-snug shadow-soft ring-1 ${c.flag ? "bg-coral/10 font-semibold text-coral-deep ring-coral/30" : "bg-white ring-line"}`}>
                        {c.saathi}
                        {c.ask && <span className="mt-2 block text-saffron-deep">{c.ask}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {entries.length > 0 && (
              <section className="rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-line">
                <h2 className="font-display text-xl">Your day so far</h2>
                <ol className="mt-3 flex flex-col">
                  {entries.map((e, i) => (
                    <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < entries.length - 1 && <span aria-hidden className="absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px bg-line" />}
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream text-xl">{KIND_ICON[e.kind] ?? "•"}</span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-base leading-snug">{e.summary}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                          {e.at}
                          {e.kind === "meal" && <PlateTag plate={e.plate} />}
                          {e.source === "offline" && <span className="text-saffron-deep">waiting for connection</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-line">
              <h2 className="font-display text-xl">Let {profile.family_name ? profile.family_name.split(" ")[0] : "family"} know</h2>
              <p className="mt-1 text-base text-ink-soft">A short message about your day. You read it first, then you send it.</p>
              <button onClick={makeFamilyUpdate} disabled={busy} className="mt-3 min-h-14 w-full rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-lg font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-40">
                Write today&apos;s update
              </button>
              {family && (
                <div className="mt-4 animate-rise">
                  <div className="rounded-3xl rounded-tl-md bg-[#DCF8C6] p-4 text-base leading-relaxed text-ink">
                    <p className="whitespace-pre-wrap">{family.message}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(family.message)}`} target="_blank" rel="noreferrer" className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[#128C7E] text-lg font-semibold text-white">
                      Open WhatsApp
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(family.message)} className="min-h-12 flex-1 rounded-2xl bg-cream text-lg font-semibold ring-1 ring-line">
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="mt-2 rounded-2xl border border-line bg-white/50 p-4 text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">Not medical advice.</strong> Saathi does not diagnose or prescribe. For chest pain,
          breathlessness, a fall, fainting or anything that worries you, call your doctor or{" "}
          <a href="tel:108" className="font-semibold text-coral-deep underline">108</a>. Student prototype: use made-up data only.
          Everything stays on this phone.
        </footer>
      </div>
    </main>
  );
}

const KIND_ICON: Record<string, string> = {
  meal: "🍛",
  water: "💧",
  walk: "🚶",
  medicine: "💊",
  symptom: "🩺",
  report: "📄",
  mood: "🙂",
  other: "📝",
};

function Onboarding(props: {
  lang: string;
  busy: boolean;
  draft: Profile | null;
  onSubmit: (text: string) => void;
  onSample: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  if (props.draft) {
    return (
      <section className="animate-rise flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-lift ring-1 ring-line">
        <div className="flex items-center gap-3">
          <Orb small />
          <h2 className="font-display text-2xl">Did I get this right?</h2>
        </div>
        <ProfileSummary profile={props.draft} />
        <div className="flex gap-2">
          <button onClick={props.onConfirm} className="min-h-14 flex-[2] rounded-2xl bg-teal text-lg font-bold text-white shadow-soft">Yes, let&apos;s start</button>
          <button onClick={props.onRetry} className="min-h-14 flex-1 rounded-2xl bg-cream text-lg font-semibold ring-1 ring-line">Say it again</button>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-lift">
        <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-saffron/40 blur-2xl" />
        <p className="relative text-sm font-semibold uppercase tracking-[0.18em] text-white/70">No forms. No sign-up.</p>
        <h2 className="relative mt-2 font-display text-[2rem] leading-tight">Tell me a little about yourself</h2>
        <p className="relative mt-3 text-lg leading-relaxed text-white/85">
          Speak or type in any language: your name and age, what you eat, what your doctor told you, and who in your family
          would like to hear how you are.
        </p>
      </div>
      <VoiceInput lang={props.lang} busy={props.busy} submitLabel="Continue" placeholder="I'm 68, vegetarian, my doctor said to walk every day…" onSubmit={(t) => props.onSubmit(t)} />
      <button onClick={props.onSample} disabled={props.busy} className="rounded-2xl bg-white/70 p-4 text-left text-base shadow-soft ring-1 ring-line transition hover:bg-white">
        <span className="font-semibold">Just looking?</span> Try it as a made-up person: Lata, 67, from Margao →
      </button>
    </section>
  );
}

function ProfileSummary({ profile }: { profile: Profile }) {
  const rows: [string, string][] = [
    ["Name", profile.name || "—"],
    ["Age", profile.age ? String(profile.age) : "—"],
    ["Food", profile.diet],
    ["Language", profile.language],
    ["Doctor said", profile.doctor_said.join("; ") || "—"],
    ["Water goal", `${profile.water_target_glasses} glasses`],
    ["Walk goal", `${profile.walk_target_minutes} min`],
    ["Day", `${profile.wake_time} – ${profile.sleep_time}`],
    ["Updates to", profile.family_name || "—"],
  ];
  return (
    <dl className="divide-y divide-line text-base">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="shrink-0 text-ink-soft">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Ring({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, target ? value / target : 0);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[84px] w-[84px]">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-xl font-bold leading-none">
            {value}
            <span className="text-sm font-medium text-white/60">/{target}</span>
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-base font-semibold">{label}</p>
      <p className="text-xs text-white/60">{unit}</p>
    </div>
  );
}

function PlateTag({ plate }: { plate: LoggedEntry["plate"] }) {
  const map: Record<string, [string, string]> = {
    balanced: ["Balanced plate", "bg-emerald-100 text-emerald-900"],
    light: ["Light", "bg-sky-100 text-sky-900"],
    carb_heavy: ["Heavy on rice/roti", "bg-amber-100 text-amber-900"],
    sweet_or_fried: ["Sweet / fried", "bg-orange-100 text-orange-900"],
  };
  const tag = map[plate];
  if (!tag) return null;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag[1]}`}>{tag[0]}</span>;
}

export function Orb({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`${small ? "h-9 w-9" : "h-14 w-14"} relative inline-block shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE68A,#F2A33A_45%,#0F766E_100%)] shadow-[0_6px_20px_-6px_rgba(242,163,58,0.7)]`}
    >
      <span className="absolute inset-[22%] rounded-full bg-white/25 blur-[2px]" />
    </span>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
