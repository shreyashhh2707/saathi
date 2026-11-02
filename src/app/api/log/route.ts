import { z } from "zod";
import { aiConfigured, errorResponse, imageBlock, structuredCall } from "@/lib/ai";
import { demoLog } from "@/lib/demo";
import { RED_FLAG_ADVICE, redFlagCheck } from "@/lib/safety";
import { LogResultSchema, type LogResult } from "@/lib/schemas";

const Body = z.object({
  text: z.string().max(4000).default(""),
  image: z.string().max(4_000_000).optional(),
  profile: z.record(z.string(), z.unknown()),
  today: z.array(z.object({ summary: z.string(), at: z.string() })).max(60),
  now: z.string(),
  demo: z.boolean().optional(),
});

// The core loop: anything messy in (voice note, typed Hinglish, photo of a thali
// or a lab report) -> structured entries + one short reply.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Nothing to log." }, { status: 400 });
  const { text, image, profile, today, now, demo } = parsed.data;
  if (!text.trim() && !image) return Response.json({ error: "Say or snap something first." }, { status: 400 });

  // Safety net runs before the AI, so red flags are caught even in demo mode or if the AI fails.
  const ruleFlag = redFlagCheck(text);

  let result: LogResult;
  let usedDemo = false;
  if (demo || !aiConfigured()) {
    result = demoLog(text, Boolean(image));
    usedDemo = true;
  } else {
    try {
      const content: Parameters<typeof structuredCall>[0]["content"] = [];
      if (image) content.push(imageBlock(image));
      content.push({
        type: "text",
        text: [
          `Now: ${now}`,
          `About them: ${JSON.stringify(profile)}`,
          `Already logged today: ${today.map((e) => `${e.at} ${e.summary}`).join("; ") || "nothing yet"}`,
          image ? "They sent the photo above." : "",
          text ? `They said: """${text}"""` : "",
          "Record what they did, ate or felt. For a meal photo, name the dishes you can actually see and judge plate balance; if unsure what a dish is, use low confidence and ask. For a lab report, record kind 'report' with only the values the lab marked high/low. Then reply briefly, noticing patterns from earlier today if useful.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      result = await structuredCall({ schema: LogResultSchema, system: "You are logging the user's day.", content });
    } catch (err) {
      return errorResponse(err);
    }
  }

  if (ruleFlag && !result.red_flag) {
    result = { ...result, red_flag: true, red_flag_reason: ruleFlag };
  }
  if (result.red_flag) {
    result = { ...result, reply: `${result.reply} ${RED_FLAG_ADVICE}`.trim() };
  }
  return Response.json({ result, demo: usedDemo });
}
