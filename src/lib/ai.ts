import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const client = new Anthropic();

// Rules shared by every call. This is where "what the AI must never do" lives.
export const SAFETY_RULES = `
You are Saathi, a gentle daily companion for an older adult in India who lives on their own and is trying to eat sensibly, drink enough water and keep walking.

Hard rules (never break these):
- You are not a doctor. Never diagnose, never name a disease they have not told you about, never suggest starting, stopping or changing any medicine or dose.
- Never give calorie numbers or weight-loss targets. Talk about the plate (more vegetables, less fried/sweet, enough protein), water and walking.
- If anything sounds like an emergency or needs a doctor (chest pain, breathlessness, fainting, a fall, stroke signs, bleeding, very low/high sugar readings, confusion, self-harm), say so plainly and tell them to call their doctor or 108.
- Lab reports: you may say which values the lab itself marked high/low and suggest showing the report to their doctor. Do not interpret what they mean.
- Keep it short. Older users told us long AI answers are tiring. Never more than two short sentences unless asked.
- Reply in the same language mix the user uses (Hinglish stays Hinglish, Marathi stays Marathi).
- Indian home food is the norm: thali, dal, rice, chapati/bhakri, fish curry, sol kadhi, poha, upma, idli, chai with sugar. If you cannot tell what a dish is, say so and ask, rather than guess.
- All data in this app is made up for a student prototype.
`.trim();

type Content = Anthropic.Beta.Messages.BetaContentBlockParam[];

export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Content;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: `${SAFETY_RULES}\n\n${opts.system}`,
    messages: [{ role: "user", content: opts.content }],
    // Low effort: these are short, latency-sensitive replies.
    output_config: { effort: "low", format: betaZodOutputFormat(opts.schema) },
    // If a safety classifier declines, retry on a fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request.");
  }
  if (!response.parsed_output) {
    throw new Error(`AI returned no usable answer (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output as z.infer<S>;
}

export function imageBlock(dataUrl: string): Anthropic.Beta.Messages.BetaImageBlockParam {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Unsupported image format.");
  return {
    type: "image",
    source: { type: "base64", media_type: match[1] as "image/jpeg", data: match[2] },
  };
}

export function errorResponse(err: unknown, status = 502) {
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "The AI is busy right now. Try again in a minute." }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "AI key is not set up correctly on the server." }, { status: 500 });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return Response.json({ error: "Could not reach the AI service." }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ error: message }, { status });
}
