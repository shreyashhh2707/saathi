import { z } from "zod";
import { aiConfigured, errorResponse, structuredCall } from "@/lib/ai";
import { demoProfile } from "@/lib/demo";
import { ProfileSchema } from "@/lib/schemas";

const Body = z.object({ text: z.string().min(3).max(4000), demo: z.boolean().optional() });

// Replaces the sign-up form: the person describes themselves in their own words.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Please say a little about yourself first." }, { status: 400 });
  const { text, demo } = parsed.data;

  if (demo || !aiConfigured()) return Response.json({ profile: demoProfile(text), demo: true });

  try {
    const profile = await structuredCall({
      schema: ProfileSchema,
      system:
        "Turn what this person said about themselves into a profile. Only record what they actually said; use the stated defaults for anything missing and list at most two gentle follow-up questions.",
      content: [{ type: "text", text }],
    });
    return Response.json({ profile, demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
