import { z } from "zod";

// Shapes the AI must return. Kept flat and enum-heavy so structured outputs
// can enforce them and the UI never has to guess.

export const ProfileSchema = z.object({
  name: z.string().describe("First name or what they like to be called. Empty string if not said."),
  age: z.number().describe("Age in years. 0 if not said."),
  language: z
    .string()
    .describe("The language/mix they wrote or spoke in, e.g. 'English', 'Hinglish', 'Hindi', 'Marathi', 'Konkani-English'. Replies will use this."),
  diet: z.enum(["veg", "eggetarian", "non-veg", "unknown"]),
  doctor_said: z
    .array(z.string())
    .describe("Only things they say a doctor told them, in their words (e.g. 'sugar is borderline, cut sweets'). Never infer conditions."),
  water_target_glasses: z
    .number()
    .describe("Daily water target in 250 ml glasses. Use what they said or their doctor said; otherwise 8."),
  walk_target_minutes: z.number().describe("Daily walk target in minutes. Use what they said; otherwise 20."),
  wake_time: z.string().describe("HH:MM 24h. '06:30' if not said."),
  sleep_time: z.string().describe("HH:MM 24h. '22:00' if not said."),
  family_name: z.string().describe("Name of the family member who wants updates (e.g. 'Rohan (son)'). Empty string if none."),
  still_missing: z
    .array(z.string())
    .describe("At most 2 short questions worth asking later, e.g. 'Did your doctor give you a water limit?'"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const EntrySchema = z.object({
  kind: z.enum(["meal", "water", "walk", "medicine", "symptom", "report", "mood", "other"]),
  summary: z.string().describe("Under 12 words, in the user's language. E.g. 'Lunch: rice, fish curry, sol kadhi'."),
  glasses: z.number().describe("Water glasses (250 ml) in this entry. 0 if not water."),
  minutes: z.number().describe("Walk/yoga minutes in this entry. 0 if not activity."),
  plate: z
    .enum(["balanced", "carb_heavy", "sweet_or_fried", "light", "not_a_meal"])
    .describe("Rough plate balance for meals. 'not_a_meal' for anything else."),
  confidence: z.enum(["high", "medium", "low"]),
});
export type Entry = z.infer<typeof EntrySchema>;

export const LogResultSchema = z.object({
  entries: z.array(EntrySchema).describe("Everything in this input worth recording. Can be empty."),
  reply: z
    .string()
    .describe("At most 2 short sentences, in the user's language. Warm, specific, no lectures, no numbers of calories."),
  ask_back: z
    .string()
    .describe("One short question if something important was unclear (e.g. an unrecognised dish). Empty string otherwise."),
  red_flag: z.boolean().describe("True if anything described needs a doctor or emergency help."),
  red_flag_reason: z.string().describe("Why, in plain words. Empty string if no red flag."),
});
export type LogResult = z.infer<typeof LogResultSchema>;

export const NudgeSchema = z.object({
  send: z.boolean().describe("True only if a nudge right now would genuinely help. Silence is often better."),
  message: z.string().describe("One sentence, under 20 words, in the user's language. Empty if send is false."),
  why: z.string().describe("Short internal reason for the decision (shown in the activity log, not to the user)."),
});
export type Nudge = z.infer<typeof NudgeSchema>;

export const FamilyUpdateSchema = z.object({
  message: z.string().describe("WhatsApp-ready update for the family member, 3–5 short lines, plain text, no medical judgements."),
});
export type FamilyUpdate = z.infer<typeof FamilyUpdateSchema>;

// What the browser stores for each logged item.
export type LoggedEntry = Entry & { id: string; at: string; source: "voice" | "text" | "photo" | "tap" | "offline" };
