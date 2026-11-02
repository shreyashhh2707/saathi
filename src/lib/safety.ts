// Deterministic red-flag net. Runs on every input before and after the AI,
// so a symptom that needs a doctor is never missed because the model was wrong.

const RED_FLAGS: { pattern: RegExp; reason: string }[] = [
  { pattern: /chest\s*(pain|tight|pressure|heavy)|seene\s*me(in)?\s*dard|chhati\s*(me|mein)\s*dard/i, reason: "Chest pain or pressure" },
  { pattern: /breath(less|ing\s*(problem|difficult|trouble))|can'?t\s*breathe|saans\s*(nahi|phool|lene)/i, reason: "Trouble breathing" },
  { pattern: /faint(ed|ing)?|passed\s*out|unconscious|behosh|chakkar\s*aa?\s*ke\s*gir/i, reason: "Fainting" },
  { pattern: /\bfell\b|\bfall\b|gir\s*(gaya|gayi|gaye|padi|pada)/i, reason: "A fall" },
  { pattern: /slurred|face\s*(droop|numb)|arm\s*(weak|numb)|one\s*side\s*(weak|numb)|lakwa|stroke/i, reason: "Possible stroke signs" },
  { pattern: /blood\s*in\s*(stool|urine|vomit|cough)|vomit(ing|ed)?\s*blood|khoon/i, reason: "Bleeding" },
  { pattern: /suicid|end\s*my\s*life|want\s*to\s*die|marna\s*chahta|marna\s*chahti/i, reason: "Thoughts of self-harm" },
  { pattern: /sugar\s*(is|was|reading|level)?\s*(at\s*)?([3-5]\d|[3-9]\d{2})\b/i, reason: "Blood sugar reading that may be dangerously low or high" },
  { pattern: /confus(ed|ion)|can'?t\s*remember\s*where/i, reason: "Sudden confusion" },
];

export function redFlagCheck(text: string): string | null {
  for (const { pattern, reason } of RED_FLAGS) {
    if (pattern.test(text)) return reason;
  }
  return null;
}

export const RED_FLAG_ADVICE =
  "Please call your doctor now. If it feels serious, call 108 (ambulance) or ask someone nearby to help.";
