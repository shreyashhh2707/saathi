# Saathi

**[Your full name]** · Roll No. **[roll number]** · MAI-594 Introduction to Vibe Coding · AY 2026–27

> **For an older adult living on their own who has been told by a doctor to eat better, drink more water and walk daily: Saathi lets them just say or snap what they did, in their own language, and quietly keeps them (and the family member who worries) on track.**

- **Live app:** [https://…]
- **Report:** [REPORT.md](REPORT.md)

Not medical advice. Student prototype — use made-up data only.

## What it does

- **No sign-up form.** You describe yourself in your own words (voice or text, any language); the AI builds the profile and asks you to confirm it.
- **Log anything, any way.** A voice note in Hinglish, a typed line in Marathi, a photo of your thali or a lab report. The AI turns it into entries (meal, water, walk, symptom, report) and replies in at most two short sentences.
- **Speaks up only when useful.** Every 20 minutes the AI decides whether a nudge would help right now, based on your day so far. Most of the time it stays quiet. Never during sleep hours, never more than once an hour.
- **Family update, on your terms.** One tap writes a short WhatsApp message for your son or daughter, which you choose to send.
- **Safety first.** A rule-based red-flag check runs on every input alongside the AI (chest pain, falls, very low/high sugar, etc.) and shows a "call 108 / your doctor" banner. The AI never diagnoses, never gives calorie numbers, and never advises on medicines.
- **Works on weak connections.** If the AI can't be reached, your note is saved and understood later.
- **Demo mode.** Without an API key the app runs on simple rules so it always opens; this is clearly labelled.

All data stays in the browser (localStorage). Nothing is stored on a server.

## Run it locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local   # optional; without it the app runs in demo mode
npm run dev
```

Optional: `CLAUDE_MODEL` overrides the model (default `claude-opus-5-5`).

## Deploy (Vercel)

1. Import this repository at [vercel.com/new](https://vercel.com/new).
2. Add `ANTHROPIC_API_KEY` under **Settings → Environment Variables**. Set a low monthly spend limit in the Anthropic Console.
3. Deploy, then put the URL at the top of this README.

## Test the AI (report Q3)

```bash
node scripts/ai-tests.mjs https://your-app.vercel.app
```

Runs 13+ realistic inputs (Hinglish, Marathi, Goan dishes, red flags, medicine and calorie questions, a lab report, nudge timing) and writes `docs/ai-test-results.md`.

## Code map

| Path | What it is |
|---|---|
| `src/components/App.tsx` | The whole UI: onboarding, today, nudges, family update |
| `src/components/VoiceInput.tsx` | Speak / type / photo input (Web Speech API) |
| `src/app/api/*/route.ts` | `onboard`, `log`, `nudge`, `family`, `status` endpoints |
| `src/lib/ai.ts` | Claude API call with structured output, and the safety rules every call gets |
| `src/lib/schemas.ts` | The exact shapes the AI must return |
| `src/lib/safety.ts` | Rule-based red-flag check |
| `src/lib/demo.ts` | Demo-mode fallbacks |

## Credits

- [Next.js](https://nextjs.org) (MIT), [React](https://react.dev) (MIT), [Tailwind CSS](https://tailwindcss.com) (MIT), [Zod](https://zod.dev) (MIT)
- [Anthropic Claude API](https://docs.anthropic.com) and `@anthropic-ai/sdk` (MIT) for the AI
- Geist font by Vercel (SIL Open Font License)
- Built with Claude Code (AI coding assistant). See the AI-use disclosure in the report.
- No third-party images or videos are used.
