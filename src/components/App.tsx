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

type Exchange = { id: string; at: string; you: string; photo?: boolean; saathi: string; ask?: string; flag?: string; demo?: boolean };
type Pending = { id: string; text: string; at: string };

export default function App() {
  const today = dayKey();
  // Rendered client-only (see page.tsx), so state can start from what this browser saved.
  const [profile, setProfile] = useState<Profile | null>(() => load<Profile | null>("saathi.profile", null));
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<LoggedEntry[]>(() => load<LoggedEntry[]>(`saathi.entries.${today}`, []));
  const [chat, setChat] = useState<Exchange[]>(() => load<Exchange[]>(`saathi.chat.${today}`, []));
  const [pending, setPending] = useState<Pending[]>(() => load<Pending[]>("saathi.pending", []));
  const [nudge, setNudge] = useState<(Nudge & { at: string }) | null>(() => load(`saathi.nudge.${today}`, null));
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
  const latestFlag = [...chat].reverse().find((c) => c.flag);

  return (
    <main className="flex-1 bg-stone-100 text-stone-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-10 pt-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-teal-800">Saathi</h1>
            <p className="text-base text-stone-600">
              {profile?.name ? `Namaste, ${profile.name}` : "Your daily health companion"} ·{" "}
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
          <button onClick={() => setShowSettings((s) => !s)} className="rounded-2xl bg-white px-4 py-3 text-base font-semibold ring-1 ring-stone-300">
            {showSettings ? "Close" : "Settings"}
          </button>
        </header>

        {useDemo && (
          <p className="rounded-2xl bg-amber-100 px-4 py-2 text-base text-amber-900">
            Demo mode: simple rules instead of AI{aiLive === false ? " (no AI key on this server)" : ""}.
          </p>
        )}

        {showSettings && (
          <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-stone-200">
            <label className="flex flex-col gap-1 text-base">
              Language for the microphone
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-xl bg-stone-50 p-3 text-lg ring-1 ring-stone-300">
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            {aiLive && (
              <label className="flex items-center gap-3 text-base">
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-6 w-6" />
                Demo mode (no AI calls)
              </label>
            )}
            {"Notification" in globalThis && (
              <button onClick={() => Notification.requestPermission()} className="rounded-2xl bg-stone-100 p-3 text-left text-base ring-1 ring-stone-300">
                Allow reminders as notifications
              </button>
            )}
            {profile && (
              <div className="rounded-2xl bg-stone-50 p-3 text-base">
                <p className="font-semibold">What Saathi knows about you</p>
                <ProfileSummary profile={profile} />
              </div>
            )}
            <button onClick={resetAll} className="rounded-2xl bg-red-50 p-3 text-left text-base text-red-800 ring-1 ring-red-200">
              Start over (delete everything on this phone)
            </button>
          </section>
        )}

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-base text-red-800 ring-1 ring-red-200">{error}</p>}

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
              <section className="rounded-3xl bg-red-600 p-4 text-white">
                <p className="text-xl font-bold">Please check with a doctor</p>
                <p className="mt-1 text-lg">{latestFlag.flag}</p>
                <div className="mt-3 flex gap-2">
                  <a href="tel:108" className="flex-1 rounded-2xl bg-white py-3 text-center text-lg font-bold text-red-700">Call 108</a>
                </div>
              </section>
            )}

            {nudge && (
              <section className="rounded-3xl bg-teal-800 p-4 text-white">
                <p className="text-sm uppercase tracking-wide text-teal-200">Saathi · {nudge.at}</p>
                <p className="mt-1 text-xl leading-snug">{nudge.message}</p>
              </section>
            )}

            <section className="grid grid-cols-3 gap-2">
              <Stat label="Water" value={`${t.water}/${profile.water_target_glasses}`} unit="glasses" pct={t.water / profile.water_target_glasses} />
              <Stat label="Walk" value={`${t.walk}/${profile.walk_target_minutes}`} unit="minutes" pct={t.walk / profile.walk_target_minutes} />
              <Stat label="Meals" value={`${t.meals.length}`} unit="logged" pct={Math.min(1, t.meals.length / 3)} />
            </section>
            <button onClick={addWater} className="min-h-14 rounded-2xl bg-sky-100 text-lg font-semibold text-sky-900 ring-1 ring-sky-200">
              + I drank a glass of water
            </button>

            <VoiceInput
              lang={lang}
              busy={busy}
              allowPhoto
              submitLabel="Tell Saathi"
              placeholder="What did you eat, drink or do? Or how are you feeling? Speak, type, or send a photo of your plate."
              onSubmit={(text, photo) => logInput(text, photo)}
            />
            {chat.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SAMPLE_LOGS.map((s) => (
                  <button key={s} onClick={() => logInput(s, null)} disabled={busy} className="rounded-full bg-white px-3 py-2 text-left text-sm text-stone-700 ring-1 ring-stone-300">
                    Try: “{s}”
                  </button>
                ))}
              </div>
            )}

            {chat.length > 0 && (
              <section className="flex flex-col gap-3">
                {[...chat].reverse().map((c) => (
                  <div key={c.id} className="rounded-3xl bg-white p-4 ring-1 ring-stone-200">
                    <p className="text-sm text-stone-500">{c.at} · You{c.photo ? " (photo)" : ""}</p>
                    <p className="text-base text-stone-700">{c.you}</p>
                    <p className={`mt-2 text-lg leading-snug ${c.flag ? "font-semibold text-red-700" : "text-teal-900"}`}>{c.saathi}</p>
                    {c.ask && <p className="mt-1 text-lg text-amber-800">{c.ask}</p>}
                  </div>
                ))}
              </section>
            )}

            {entries.length > 0 && (
              <section className="rounded-3xl bg-white p-4 ring-1 ring-stone-200">
                <h2 className="text-lg font-bold">Today</h2>
                <ul className="mt-2 flex flex-col gap-1">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-2 text-base">
                      <span>
                        <span className="text-stone-500">{e.at}</span> {e.summary}
                        {e.source === "offline" && <span className="text-amber-700"> (waiting for connection)</span>}
                      </span>
                      {e.kind === "meal" && <PlateTag plate={e.plate} />}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-3xl bg-white p-4 ring-1 ring-stone-200">
              <button onClick={makeFamilyUpdate} disabled={busy} className="min-h-14 w-full rounded-2xl bg-green-700 text-lg font-semibold text-white disabled:opacity-40">
                Send today&apos;s update to {profile.family_name || "family"}
              </button>
              {family && (
                <div className="mt-3">
                  <pre className="whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 font-sans text-base">{family.message}</pre>
                  <div className="mt-2 flex gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(family.message)}`} target="_blank" rel="noreferrer" className="flex-1 rounded-2xl bg-green-600 py-3 text-center text-lg font-semibold text-white">
                      Open WhatsApp
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(family.message)} className="flex-1 rounded-2xl bg-stone-200 py-3 text-lg font-semibold">
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="mt-2 text-sm leading-relaxed text-stone-600">
          <strong>Not medical advice.</strong> Saathi does not diagnose or prescribe. For chest pain, breathlessness, a fall,
          fainting or anything that worries you, call your doctor or <a href="tel:108" className="underline">108</a>. Student
          prototype: use made-up data only. Everything stays in this browser.
        </footer>
      </div>
    </main>
  );
}

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
      <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="text-2xl font-bold">Did I get this right?</h2>
        <ProfileSummary profile={props.draft} />
        <div className="flex gap-2">
          <button onClick={props.onConfirm} className="min-h-14 flex-1 rounded-2xl bg-teal-700 text-lg font-bold text-white">Yes, start</button>
          <button onClick={props.onRetry} className="min-h-14 flex-1 rounded-2xl bg-stone-200 text-lg font-semibold">Say it again</button>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-3xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="text-2xl font-bold">Namaste! Tell me about yourself.</h2>
        <p className="mt-2 text-lg text-stone-700">
          No forms. Just speak or type, in any language: your name and age, what you eat, what your doctor told you, and who in
          your family would like updates.
        </p>
      </div>
      <VoiceInput lang={props.lang} busy={props.busy} submitLabel="Continue" placeholder="e.g. I'm 68, vegetarian, doctor said to walk daily…" onSubmit={(t) => props.onSubmit(t)} />
      <button onClick={props.onSample} disabled={props.busy} className="rounded-2xl bg-white p-3 text-base text-stone-700 ring-1 ring-stone-300">
        Try with a made-up person (Lata, 67, Margao)
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
    ["Family updates to", profile.family_name || "—"],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-stone-500">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ label, value, unit, pct }: { label: string; value: string; unit: string; pct: number }) {
  return (
    <div className="rounded-3xl bg-white p-3 ring-1 ring-stone-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-stone-500">{unit}</p>
      <div className="mt-2 h-2 rounded-full bg-stone-200">
        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }} />
      </div>
    </div>
  );
}

function PlateTag({ plate }: { plate: LoggedEntry["plate"] }) {
  const map: Record<string, [string, string]> = {
    balanced: ["Balanced", "bg-green-100 text-green-900"],
    light: ["Light", "bg-sky-100 text-sky-900"],
    carb_heavy: ["Heavy on rice/roti", "bg-amber-100 text-amber-900"],
    sweet_or_fried: ["Sweet/fried", "bg-orange-100 text-orange-900"],
  };
  const tag = map[plate];
  if (!tag) return null;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm ${tag[1]}`}>{tag[0]}</span>;
}
