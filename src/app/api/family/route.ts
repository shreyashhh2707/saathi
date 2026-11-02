import { z } from "zod";
import { aiConfigured, errorResponse, structuredCall } from "@/lib/ai";
import { demoFamily } from "@/lib/demo";
import { FamilyUpdateSchema, ProfileSchema, type LoggedEntry } from "@/lib/schemas";

const Body = z.object({
  profile: ProfileSchema,
  today: z.array(z.record(z.string(), z.unknown())).max(60),
  demo: z.boolean().optional(),
});

// Replaces the "guardian dashboard" (F17): a short update the user chooses to send.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { profile, demo } = parsed.data;
  const today = parsed.data.today as unknown as LoggedEntry[];

  if (demo || !aiConfigured()) return Response.json({ update: demoFamily(profile, today), demo: true });

  try {
    const update = await structuredCall({
      schema: FamilyUpdateSchema,
      system: `Write a short, reassuring WhatsApp update from the user to ${profile.family_name || "their family"} about today. Use English unless the profile language suggests otherwise. Facts only from the log: water, walking, meals, anything that went well, and anything worth a phone call (state it plainly, no medical judgement). No emojis overload; at most one.`,
      content: [
        {
          type: "text",
          text: `Profile: ${JSON.stringify(profile)}\nToday: ${today.map((e) => `${e.at} [${e.kind}] ${e.summary}`).join("; ") || "nothing logged"}`,
        },
      ],
      maxTokens: 2000,
    });
    return Response.json({ update, demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
