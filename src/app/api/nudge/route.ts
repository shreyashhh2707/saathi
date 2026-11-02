import { z } from "zod";
import { aiConfigured, errorResponse, structuredCall } from "@/lib/ai";
import { demoNudge } from "@/lib/demo";
import { NudgeSchema, ProfileSchema, type LoggedEntry } from "@/lib/schemas";

const Body = z.object({
  profile: ProfileSchema,
  today: z.array(z.record(z.string(), z.unknown())).max(60),
  now: z.string(),
  hour: z.number(),
  lastNudge: z.string().nullable(),
  demo: z.boolean().optional(),
});

// The proactive part: the AI decides whether to speak up at all, and what to say.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { profile, now, hour, lastNudge, demo } = parsed.data;
  const today = parsed.data.today as unknown as LoggedEntry[];

  // Hard rule, not left to the AI: never nudge before wake-up or after bedtime.
  const wake = Number(profile.wake_time.split(":")[0]);
  const sleep = Number(profile.sleep_time.split(":")[0]);
  if (hour < wake || hour >= sleep) {
    return Response.json({ nudge: { send: false, message: "", why: "Quiet hours." }, demo: Boolean(demo || !aiConfigured()) });
  }

  if (demo || !aiConfigured()) return Response.json({ nudge: demoNudge(profile, today, hour), demo: true });

  try {
    const nudge = await structuredCall({
      schema: NudgeSchema,
      system:
        "Decide whether to send ONE gentle nudge right now. Consider time of day versus their wake/sleep times, water and walk so far versus targets, gaps since their last meal, anything they flagged earlier, and when they were last nudged (never more than once an hour; never before wake or after sleep time). Prefer silence when they are on track. If you nudge, make it specific to their day, not generic advice.",
      content: [
        {
          type: "text",
          text: [
            `Now: ${now}`,
            `Profile: ${JSON.stringify(profile)}`,
            `Today so far: ${today.map((e) => `${e.at} [${e.kind}] ${e.summary}${e.glasses ? ` (${e.glasses} glasses)` : ""}${e.minutes ? ` (${e.minutes} min)` : ""}`).join("; ") || "nothing logged"}`,
            `Last nudge sent: ${lastNudge ?? "none today"}`,
          ].join("\n"),
        },
      ],
      maxTokens: 2000,
    });
    return Response.json({ nudge, demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
