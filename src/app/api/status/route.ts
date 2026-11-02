import { connection } from "next/server";
import { aiConfigured, MODEL } from "@/lib/ai";

export async function GET() {
  // Read the key at request time, not build time.
  await connection();
  return Response.json({ ai: aiConfigured(), model: aiConfigured() ? MODEL : null });
}
