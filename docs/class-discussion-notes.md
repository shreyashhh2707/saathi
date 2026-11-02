# Class Discussion Notes: Health AI App

*What the class built together, cleaned up for reference. Read with the Individual Project Brief.*

> **How to use this.** This is the starting point for your project, not a specification. Features are numbered F01–F18 and concerns D01–D11 so that you can refer to them in your report.

## 1. Where we got to

Over two sessions the class brainstormed a Health AI app, at first "for our family members". The first session produced 18 features and 11 concerns. We then listed our guesses about why existing health apps fail, and the faculty critiqued the whole approach. The second session started to narrow things down, with two possible customer groups and an open question: should the app be a chatbot or a proactive agent?

## 2. Feature list (version 0)

| ID | Feature | What the class meant |
|---|---|---|
| F01 | Food photo to calories | Photograph the plate in real time; the app estimates calories from the image alone. |
| F02 | Profile and goals | Height, weight, BMI, and veg or non-veg preference. Targets such as goal weight, how much to lose or gain, body-fat percentage, or simply a healthier lifestyle. Input by voice, or by a reference image ("this is how I want to look"), possibly AI-generated, from which everything else is calculated. |
| F03 | Activity tracking | Steps and calories burned; cycling distance and time. |
| F04 | Diet plan | A calorie-deficit plan based on the target profile, with a daily water-intake target. |
| F05 | Progress tracker | Daily progress against the target, including a fasting tracker (hours fasted). When the user is on track, it may suggest health products or supplements, linked to reward points or discounts. |
| F06 | Sleep tracking | Track sleep. |
| F07 | Challenges and motivation | Custom challenges and motivational videos. |
| F08 | AI health coach | A chatbot, used by voice or video, that also acts as a health coach. |
| F09 | Catch-up planning | If the user misses a meal plan or a workout, the app rebalances the plan going forward. |
| F10 | Reports | Weekly or monthly reports to export. Format to be decided. |
| F11 | Wearables | Connect to smartwatches and other devices. |
| F12 | Subscription tiers | Features split across three plans, such as Silver, Gold and Platinum. |
| F13 | Free consultation | A free consultation every Sunday or every fortnight. |
| F14 | Community activities | Tie-ups with local groups for yoga, marathons, or campaigns such as blood donation. |
| F15 | Emergency: hospital | Connect to a hospital in an emergency. |
| F16 | Emergency: caretaker or nurse | Connect to a caretaker or nurse when needed. |
| F17 | Guardian access | A guardian can see the user's progress through shared access. |
| F18 | Friends groups | Groups where friends compete, rate and comment, to keep momentum high. |

The list spans five themes:

- **Tracking and input:** F01, F02, F03, F06, F10, F11
- **Planning and coaching:** F04, F05, F07, F08, F09
- **Business model:** F12, F13
- **Care and safety:** F15, F16, F17
- **Community:** F14, F18

## 3. Concerns the class raised

| ID | Concern | Detail |
|---|---|---|
| D01 | Prioritisation | Unclear which features belong in the baseline version, and which in the next two releases. |
| D02 | Too many features | The app feels dense and could overwhelm some family members. |
| D03 | No target age group | We do not know which age group most users will come from. |
| D04 | Cost grows with features | Deployment cost rises with every feature. AI may make development cheaper, but we are not sure. |
| D05 | Wearable integration | Connecting to smartwatches and other third-party devices may be clunky. |
| D06 | Accuracy | Measured numbers, such as calories and progress, may be wrong. |
| D07 | Privacy and security | Photos, text and sensitive data such as blood reports need protection and encryption. |
| D08 | Connectivity | Poor connectivity; AI features depend on API calls that can fail. |
| D09 | Copyright | Avatar videos of real people, such as a sporting idol like Ronaldo, raise copyright and likeness issues. |
| D10 | Scale | Scalability and concurrency should be designed in from the start. |
| D11 | AI errors on regional food | AI may misidentify regional dishes, which then corrupts calorie counts and progress tracking. |

## 4. Why existing apps fail: our guesses

> *These are hypotheses from class, not research findings. Testing them is part of Q1 in your project.*

| ID | Guess | Detail |
|---|---|---|
| H1 | Too complex | Too many features. |
| H2 | Too expensive | Few people want to pay for an app that only counts calories. |
| H3 | Too many ads | Free versions are cluttered with advertising. |
| H4 | Too wordy | AI output is often longer than it needs to be; people prefer short answers. We expect this to be a risk for our own app too. |

## 5. Faculty critique

**1. We are still building Software 2.0.** We treated the app as point-and-click software, with AI in a superficial role. Voice and image input are a start, but we have not used what AI is good at: taking unstructured input and generating what the user needs.

**2. We have no target user.** We started with "an app for our family members" and then added every feature we could think of. We need to step back and decide exactly who this is for.

**3. We skipped the research.** Thousands of health apps exist, some of them popular, and many already have most of these features. Yet few people stick with them. Something makes these apps fail, whether the UI/UX, the functionality or something else, and we have not studied it. If we do not, we may rediscover the same pain points by building, which wastes effort.

**The way forward:** research why these apps fail and where the gaps are; be clear about the target user and their pain points; and make AI a core part of how the app solves them.

## 6. Session 2: starting to narrow (version 1)

Two possible customer groups were discussed:

| Group | Notes from class |
|---|---|
| Young people (15–30) | Loyalty, churn and switching between apps are concerns. Under-25s have limited ability to pay. |
| Adults over 60 | Help with general nutrition and water intake. Tracking gentle activity such as walking, jogging and yoga. |

Open questions from the session:

- Should a chatbot that gives personalised recommendations work the same way for every age group?
- Proactive agent or chatbot: should the app act on its own, or wait to be asked?
- The working idea at the end of the session: a **Health Agent**.

## 7. Questions to carry into your project

- Which of these features would your customer actually miss if it were gone?
- Which of the concerns D01–D11 disappear once you choose one customer?
- Which of the guesses H1–H4 survive contact with real reviews and real people?
- Where does AI do the work itself, rather than help the user do the work?
