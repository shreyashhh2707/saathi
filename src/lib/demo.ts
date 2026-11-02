import type { FamilyUpdate, LogResult, Nudge, Profile, LoggedEntry } from "./schemas";

// Demo mode: canned, rule-based answers used when no API key is configured
// (or the viewer switches it on), so the app always opens and can be explored.
// It is deliberately simple and is labelled "demo" in the UI.

export function demoProfile(text: string): Profile {
  const age = Number(/(\d{2})\s*(years|yrs|saal|varsh)/i.exec(text)?.[1] ?? 0);
  const name = /(?:\bi am|\bi'm|my name is|naam)\s+([a-z]+)/i.exec(text)?.[1] ?? "";
  const diet = /non[-\s]?veg|fish|chicken|mutton/i.test(text)
    ? "non-veg"
    : /egg/i.test(text)
      ? "eggetarian"
      : /veg/i.test(text)
        ? "veg"
        : "unknown";
  const family = /(son|daughter|beta|beti)\s+([A-Z][a-z]+)/i.exec(text);
  return {
    name,
    age,
    language: /\b(hai|nahi|mujhe|khana|paani)\b/i.test(text) ? "Hinglish" : "English",
    diet,
    doctor_said: /doctor/i.test(text) ? [text.split(/doctor\s*(?:said|told me)?/i)[1]?.split(/[.!]/)[0]?.replace(/^[\s,:]*(that\s+)?/i, "").trim() || "follow doctor's advice"] : [],
    water_target_glasses: 8,
    walk_target_minutes: 20,
    wake_time: "06:30",
    sleep_time: "22:00",
    family_name: family ? `${family[2]} (${family[1].toLowerCase()})` : "",
    still_missing: ["Did your doctor give you a water limit?"],
  };
}

export function demoLog(text: string, hasImage: boolean): LogResult {
  const t = text.toLowerCase();
  const glasses = Number(/(\d+)\s*(glass|gilas|glas)/.exec(t)?.[1] ?? (/(water|paani|pani)/.test(t) ? 1 : 0));
  const minutes = Number(/(\d+)\s*(min|minute)/.exec(t)?.[1] ?? (/(walk|chala|yoga)/.test(t) ? 15 : 0));
  const entries: LogResult["entries"] = [];
  if (glasses) entries.push({ kind: "water", summary: `${glasses} glass water`, glasses, minutes: 0, plate: "not_a_meal", confidence: "high" });
  if (minutes) entries.push({ kind: "walk", summary: `Walk ${minutes} min`, glasses: 0, minutes, plate: "not_a_meal", confidence: "high" });
  if (hasImage || /(ate|khaya|lunch|dinner|breakfast|nashta|rice|chapati|dal|thali|poha)/.test(t)) {
    const sweet = /(sweet|mithai|jalebi|fried|bhajji|vada|samosa|sugar)/.test(t);
    entries.push({
      kind: "meal",
      summary: hasImage ? "Meal (photo)" : text.slice(0, 60),
      glasses: 0,
      minutes: 0,
      plate: sweet ? "sweet_or_fried" : /(rice|chapati|bhakri)/.test(t) && !/(sabzi|bhaji|bhindi|palak|salad|vegetable|veg)/.test(t) ? "carb_heavy" : "balanced",
      confidence: "low",
    });
  }
  return {
    entries,
    reply: entries.length ? "Noted. (Demo mode: answers are simple rules, not AI.)" : "I couldn't find anything to note. (Demo mode.)",
    ask_back: "",
    red_flag: false,
    red_flag_reason: "",
  };
}

export function demoNudge(profile: Profile, today: LoggedEntry[], hour: number): Nudge {
  const water = today.reduce((s, e) => s + e.glasses, 0);
  const expected = Math.round((profile.water_target_glasses * Math.max(0, hour - 7)) / 14);
  if (water < expected - 1) {
    return { send: true, message: `${water} of ${profile.water_target_glasses} glasses so far — a glass now?`, why: "Behind on water for this time of day (demo rule)." };
  }
  return { send: false, message: "", why: "On track; staying quiet (demo rule)." };
}

export function demoFamily(profile: Profile, today: LoggedEntry[]): FamilyUpdate {
  const water = today.reduce((s, e) => s + e.glasses, 0);
  const walk = today.reduce((s, e) => s + e.minutes, 0);
  const meals = today.filter((e) => e.kind === "meal").length;
  return {
    message: `Update for today${profile.name ? ` from ${profile.name}` : ""}:\n• Water: ${water}/${profile.water_target_glasses} glasses\n• Walk: ${walk} min\n• Meals logged: ${meals}\n(Sent from Saathi — demo mode)`,
  };
}
