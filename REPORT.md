# Report: Saathi

**[Your full name] · Roll No. [roll number]**

> DRAFT. Sections marked **TODO** need your own research, your own people and your own words. Q3 and Q4 describe what the app does today and the reasoning built into it. Check every decision against what you found in Q1, change anything you disagree with, and rewrite it in your voice. Delete these guidance lines before you submit. Limit: 2,500 words, not counting tables, screenshots and references.

## Q1. Why do health apps fail?

> **TODO (you):** at least 30 one- and two-star reviews across 2–3 apps (for example HealthifyMe, MyFitnessPal, Google Fit); at least 3 real people who tried a health app and stopped; at least 2 published sources. Keep a table of the reviews in `docs/` and cite it.
>
> Hypotheses to test, from class: H1 too complex, H2 too expensive, H3 too many ads, H4 too wordy. The app below was designed around these likely reasons; confirm or reject each with your evidence:
> - Logging takes effort every single day (forms, searching food databases, portion sizes), and regional food is missing or wrong (D11).
> - The app waits to be opened and gives generic advice that does not fit the person's day.
> - The app is built for young, fitness-focused users (calorie targets, workouts, leaderboards), not for someone managing what their doctor told them.

**My three most important reasons, ranked:**

1. **[Reason]**: [evidence, with sources]
2. **[Reason]**: [evidence]
3. **[Reason]**: [evidence]

## Q2. Who exactly is your customer?

> **TODO (you):** describe one specific person. Base it on someone real you spoke to (change the name), not on the made-up sample in the app. The app's sample person shows the shape:

**Who they are, what they are trying to get done, what they have tried, and why it did not work:**

*Example shape:* Lata, 67, a retired teacher living alone in Margao since her husband died. Her doctor told her that her sugar is borderline: cut sweets, walk 30 minutes a day, drink more water. Her son Rohan in Pune worries and installed a calorie app on her phone. She stopped after four days: it wanted her weight and a goal, could not find *sol kadhi* or *bhakri*, showed calorie numbers she did not understand, and never noticed she had not walked. What she wants is simple: to follow her doctor's advice without filling in forms, and for Rohan to stop worrying.

**Customers I considered and rejected, and why:**

- **Young people 15–30 trying to lose weight:** [e.g. crowded market, high switching and churn, low ability to pay (class notes), and calorie counting is the job existing apps already do]
- **Busy professionals with lifestyle conditions:** [why rejected]
- **The worried adult child as the main user:** [e.g. they pay but don't use the app daily; a guardian dashboard turns the parent into someone being watched]

**How this choice follows from Q1:** [link each Q1 reason to this customer]

## Q3. What does AI do in my app that ordinary software could not?

In the class version, AI counted calories from a photo and answered questions in a chat window. In Saathi there is no chat window and no form. The AI is the input layer and the timing layer of the product:

1. **It replaces the sign-up form.** The person describes themselves in their own words, in any language. The AI extracts name, diet, what their doctor told them, water and walk targets, routine, and who to send updates to, then asks them to confirm. It records only what was said: it never infers a condition.
2. **It turns messy input into structured records.** A Hinglish voice note ("2 chapati, dal aur bhindi khayi, 2 glass paani piya"), a Marathi sentence, a photo of a thali or a lab report all become typed entries (meal with plate balance, water glasses, walk minutes, symptom, report). A form would need five screens and a food database with Goan dishes in it.
3. **It decides when to speak.** Every 20 minutes the AI looks at the time, the person's routine, what has and hasn't happened today, and when they were last nudged, then decides whether to say anything. Most of the time the right answer is silence. When it does speak, the message is specific ("Only 2 glasses since morning and it's 4 pm. One with your tea?"), not a generic reminder.
4. **It writes the family update.** One short WhatsApp message from the day's log, which the person chooses to send.

**What the AI decides on its own:** what each input means; the plate-balance label; whether to ask a follow-up question; whether to nudge now and what to say; the wording of the family update.

**What it must never do** (in the system prompt for every call, and enforced in code where possible):

| Rule | How it is enforced |
|---|---|
| Never diagnose or name a condition the user didn't mention | System prompt; profile schema only stores "doctor said" in the user's words |
| Never advise starting, stopping or changing medicine | System prompt; tested (test 6) |
| Never give calorie numbers | System prompt; the schema has no calorie field at all |
| Always send red flags to a doctor / 108 | System prompt **plus** a rule-based check (`src/lib/safety.ts`) that runs on every input even if the AI misses it, fails, or the app is in demo mode |
| Lab reports: only repeat what the lab marked high/low | System prompt; tested (tests 8, 13) |
| At most two short sentences (H4: "too wordy") | System prompt; schema field description |
| Never nudge during sleep hours or more than once an hour | Code (`api/nudge/route.ts` and the client), not left to the AI |
| Never act without the user (no auto-messages to family) | The family update is only drafted; the user presses send |

**Test results:** see `docs/ai-test-results.md`, produced by `node scripts/ai-tests.mjs <live-url>`.

> **TODO (you):** run the script against the live app, paste the table here, and fill in "Good enough?" honestly, including the failures. Add your own thali and report photos to `tests/images/`. One failure is already known: during development, test 14 (a nudge check at 11:15 pm) produced a nudge after bedtime. This led to the quiet-hours rule moving from the prompt into code.

| # | Input | What the AI did | Good enough? |
|---|---|---|---|
| 1 | | | |

## Q4. What I will build, and what I will leave out

| ID | Feature | Decision | Reason |
|---|---|---|---|
| F01 | Food photo to calories | **Build now (changed)** | Photo → named dishes and *plate balance*, not calories. Calorie estimates from photos are unreliable (D06), worst on regional food (D11), and calories are not what her doctor asked her to track. |
| F02 | Profile and goals | **Build now (changed)** | Spoken self-description replaces the form. The "this is how I want to look" reference image is **Never**: wrong goal for this customer, and likeness issues (D09). |
| F03 | Activity tracking | **Build now (minimal)** | Walk/yoga minutes said in passing ("walked to the temple, 25 min"). No step counting. |
| F04 | Diet plan | **Later** | A generated calorie-deficit plan for someone with borderline sugar is risky without a clinician. Her doctor's advice *is* the plan; the app helps her follow it. |
| F05 | Progress tracker | **Build now (light)** | Today's water, walk and meals at a glance. The product/supplement suggestions are **Never**: a conflict of interest and the ad clutter users hate (H3). |
| F06 | Sleep tracking | **Later** | Useful, but needs a wearable or more daily input. Not core to her problem. |
| F07 | Challenges and motivation | **Never** | Motivational videos raise copyright and likeness issues (D09) and the wrong tone for this customer. Encouragement is in the replies instead. |
| F08 | AI health coach | **Build now (changed)** | No chat window. The AI sits behind every input and decides when to speak (see Q3). |
| F09 | Catch-up planning | **Build now (light)** | Nudges adapt to what has and hasn't happened today. There is no rigid plan to rebalance. |
| F10 | Reports | **Build now (changed)** | The daily family update. A PDF export can come later. |
| F11 | Wearables | **Never (for this customer)** | She doesn't own one. Integration is clunky (D05) and adds cost (D04). |
| F12 | Subscription tiers | **Later** | Needs pricing research. A likely payer is the adult child (H2). |
| F13 | Free consultation | **Never (in app)** | Needs clinicians. The app points to *her* doctor instead. |
| F14 | Community activities | **Later** | Local walking groups could fit, but they are a partnership business, not a prototype feature. |
| F15 | Emergency: hospital | **Build now (minimal)** | Red-flag detection plus a "Call 108" button. No hospital integration. |
| F16 | Emergency: caretaker or nurse | **Later** | Needs a service network. |
| F17 | Guardian access | **Build now (changed)** | Not a dashboard watching her. She sends a short update she can read first. This respects her dignity, avoids a sign-up and protects her privacy (D07). |
| F18 | Friends groups | **Never** | Competition and leaderboards suit young users, not this customer. |
| N01 | Red-flag safety net | **Build now** | Rule-based check alongside the AI, so emergencies are never missed. |
| N02 | Offline notes | **Build now** | Notes are kept when the connection drops and processed later (D08). |
| N03 | Multilingual voice | **Build now** | English/Hinglish, Hindi and Marathi speech input. Replies in her language. |
| N04 | Quiet hours and nudge limit | **Build now** | Never at night, at most hourly. |

**The core experience** (first two minutes, and a normal day), with screenshots:

- **First two minutes:** She opens the link, with no install and no sign-up. She taps **Speak** and says who she is, what she eats and what her doctor said. Saathi shows "Did I get this right?" with her details. She taps **Yes, start** and sees today's water, walk and meals, plus one big box to tell Saathi anything.
- **A normal day:** After lunch she says "2 chapati, dal, bhindi, 2 glass paani". Saathi notes it and replies in one line. At 4 pm, with only two glasses logged, a nudge suggests a glass with her tea. She photographs dinner. At 8 pm she taps **Send today's update to Rohan**, reads it and sends it on WhatsApp.

> **TODO:** add screenshots of the live app (onboarding, confirm profile, today screen, a reply, a nudge, a red-flag banner, the family update) to `docs/screenshots/` and embed them here.

**My three hardest calls** (what I weighed, what I chose, what would change my mind):

1. **Dropping calorie counting.** It was the class's headline feature, and the one existing apps compete on. I chose plate balance, water and walking because they match what her doctor asked for and survive regional food better. *I would change my mind* if users in the target group said they actually want calorie numbers, or if photo-calorie accuracy on Indian home food were shown to be good.
2. **A family update instead of guardian access.** A live dashboard would reassure the child more, and the child may be the payer. But being watched is a reason older users give up apps. *I would change my mind* if parents in testing said they would prefer their children to see everything automatically.
3. **Proactive nudges vs. leaving her alone.** Nudges are what turn a tracker into a companion, but too many feel like nagging. I let the AI choose silence and added hard limits in code. *I would change my mind* based on user tests: if nudges are ignored or annoying, cut them to one a day; if they are welcomed, allow more.

## Q5. User test

> **TODO (you):** put the live app in front of at least one person from your target group. Record what they did, what confused them, what you changed (with commit links), and before/after screenshots. Watch especially for: whether they find **Speak**, whether the mic language setting confuses them, whether replies are short enough, and whether they would send the family update.

**Who tested it, what they did, what confused them, and what I changed:**

## References

> **TODO:** cite the apps whose reviews you read (with dates), your published sources, and the libraries in the README credits.

1.

---

## Student declaration

1. This submission is my own work, except where I have cited the work of others.
2. I have not submitted this work, in whole or in part, for assessment in any other course.
3. I have used generative AI tools only as permitted by the project brief, and I have disclosed that use below.

**Name:** [ ] · **Roll No.:** [ ] · **Date:** [ ]

**AI-use disclosure**

| Tool used | What it was used for | How I checked its output |
|---|---|---|
| Claude Code (Claude Opus 5.5) | Wrote the app code (Next.js UI, API routes, prompts, safety rules, test script) and drafted the Q3/Q4 sections of this report | [TODO: e.g. read through the code, ran the app on my phone, ran the test script and judged each result, changed X after testing] |
| Claude API (Claude Opus 5.5) | The AI inside the app | 13+ test inputs in `docs/ai-test-results.md`, failures reported |
| [other tools] | | |
