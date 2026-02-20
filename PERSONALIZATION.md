# AI Personalization — Design & Examples

> This document explores how the AI assistant can gradually learn about the user
> and surface suggestions that feel personal rather than generic.
> It is a proposal document — nothing here is implemented yet.

---

## The Core Idea

Right now the AI knows:
- Today's date
- The current conversation
- Raw habit patterns (category → preferred hour, avg duration)

What it doesn't know is **who the person is** — their energy rhythm, stress signals,
social style, productivity preferences, or life context.

The goal is to passively observe the calendar over days and weeks, build a
**UserProfile** in IndexedDB, and inject relevant slices of it into every Claude
request so suggestions feel like they come from someone who actually knows you.

---

## What Signals We Can Learn From

| Signal | Source | What it reveals |
|---|---|---|
| What time events are scheduled | `event.start` hour | Morning person vs night owl |
| How often events are rescheduled | `updatedAt - createdAt` gap | Indecisiveness, over-commitment |
| How often events are marked complete | `event.completed` | Follow-through rate by category |
| How long events actually run vs planned | future: actual end vs `event.end` | Chronic under/over-estimator |
| Which days have the most events | day-of-week distribution | Busy days to protect vs free days |
| How many back-to-back events exist | conflict detector | Tendency to overbook |
| Event title keywords | NLP on titles | Recurring people, projects, places |
| Gap between creating and scheduling | `createdAt` vs `event.start` | Planner vs last-minute scheduler |
| Category distribution over time | ratio of work/health/social | Work-life balance trend |
| Time between last health event and now | `lastOccurrences` gap | Self-care neglect detection |

---

## Proposed UserProfile Model

```ts
interface UserProfile {
  // Energy & time preferences
  chronotype: 'morning' | 'afternoon' | 'evening' | 'unknown';
  peakProductivityHours: [number, number];   // e.g. [9, 12]
  preferredMeetingDays: number[];            // e.g. [2, 3, 4] = Tue/Wed/Thu
  preferredFocusBlockLength: number;         // minutes

  // Behaviour patterns
  avgLeadTime: number;           // days between creating and scheduling
  rescheduleRate: number;        // 0–1, how often events get moved
  completionRates: Record<EventCategory, number>;  // per-category follow-through

  // Life balance signals
  workloadTrend: 'increasing' | 'stable' | 'decreasing';
  lastHealthEvent: Date | null;
  lastSocialEvent: Date | null;
  workToLifeRatio: number;       // 0–1, fraction of time that is "work"

  // Recurring context
  frequentPeople: string[];      // names extracted from event titles
  frequentProjects: string[];    // keywords that recur

  // Meta
  dataPoints: number;            // how many events trained on
  lastUpdated: Date;
}
```

---

## Progressive Learning Phases

The AI should be upfront about what it knows and doesn't know.

### Phase 1 — New user (0–5 events)
The AI has no signal. It behaves like a smart assistant but doesn't make personal claims.

> **User**: "Schedule a workout"
> **AI**: "When would you like to schedule it? I don't have enough history yet to
> suggest your preferred time — let me know and I'll learn from it."

---

### Phase 2 — Emerging pattern (6–20 events)
Enough data to make tentative suggestions, stated with low confidence.

> **User**: "Schedule a workout"
> **AI**: "You've done your last 3 workouts around 7 AM — want me to try the same
> time tomorrow? I'll keep learning as you add more."

---

### Phase 3 — Established profile (20+ events)
Confident, personalised, proactive.

> **User**: "Schedule a workout"
> **AI**: "You usually work out Tuesday and Thursday mornings at 7 AM for about
> 45 minutes. This Thursday is free — shall I add it?"

---

## Concrete Suggestion Examples

### 1. Chronotype-aware scheduling

**Observed signal**: User's focus-work events (deep work, coding, writing) consistently
appear between 8–10 AM. Meetings are clustered in the afternoon.

> **User**: "I need to write the Q1 report, should take 2 hours"
>
> **Without personalisation**:
> "I found a free slot Tuesday at 2 PM."
>
> **With personalisation**:
> "You do your best focused writing in the mornings — you have a clear 8–10 AM
> block on Monday. Want me to protect that for the Q1 report?"

---

### 2. Over-commitment warning

**Observed signal**: User has rescheduled 6 of their last 10 events. Monday currently
has 7 events scheduled.

> **User**: "Add team lunch Monday at 12"
>
> **Without personalisation**:
> "Done — team lunch Monday 12–1 PM added."
>
> **With personalisation**:
> "You already have 7 items on Monday, and I've noticed you often end up moving
> things when Mondays get this full. Want me to add it anyway, or find another day?"

---

### 3. Work-life balance nudge

**Observed signal**: 85% of events in the past 14 days are work category. Last
health event was 12 days ago.

> **User**: "Add a team sync Friday 4 PM"
>
> **Without personalisation**:
> "Team sync Friday 4 PM added."
>
> **With personalisation**:
> "Added! Side note — you haven't had any exercise or personal time in 12 days,
> and your schedule this week is 90% work. Want me to find a slot for something
> just for you?"

---

### 4. Frequent-person awareness

**Observed signal**: "Sarah" appears in 8 event titles over 3 weeks (1:1s, reviews,
lunches). Their last meeting was 2 weeks ago.

> **User**: "I should catch up with Sarah soon"
>
> **Without personalisation**:
> "When would you like to schedule a catch-up with Sarah?"
>
> **With personalisation**:
> "You usually meet Sarah every week or two — it's been 14 days since your last
> 1:1. You're both free Wednesday at 3 PM. Want me to add it?"

---

### 5. Chronic under-estimation

**Observed signal**: User schedules meetings for 30 minutes but the next event
consistently starts late (inferred: meetings run over). Average actual duration
is ~50 minutes.

> **User**: "Schedule a kickoff meeting for 30 minutes"
>
> **Without personalisation**:
> "Kickoff meeting 30 min — when?"
>
> **With personalisation**:
> "Your meetings tend to run about 50 minutes in practice. Want me to block
> 45 minutes instead so the next thing isn't rushed?"

---

### 6. Streak / habit encouragement

**Observed signal**: User has gone to the gym every Monday and Wednesday for
5 consecutive weeks.

> *(Proactive suggestion, no user prompt needed)*
>
> **AI in Daily Planner**:
> "You've kept your Monday gym streak going for 5 weeks — great consistency!
> It's on your schedule for 7 AM today."

---

### 7. Recovery time after intense periods

**Observed signal**: User had 9 events per day for the past 4 days (above their
personal average of 5). Nothing is scheduled Saturday.

> **AI in Daily Planner on Friday**:
> "It's been a dense week — you've averaged 9 events a day, well above your
> usual 5. You have Saturday clear. I'd suggest keeping it that way rather than
> scheduling anything new."

---

### 8. Preferred meeting cadence by person/project

**Observed signal**: "Design review" events happen every 2 weeks. The last one
was 13 days ago.

> **AI proactive suggestion**:
> "Your design review is usually every two weeks — the last one was 13 days ago.
> Want me to add one for next Tuesday?"

---

## How It Flows into the System Prompt

A compact summary of the UserProfile would be injected per request:

```
User profile (learned from 47 events):
- Peak focus hours: 8–10 AM
- Prefers meetings: Tuesday–Thursday afternoons
- Typical workout: Mon/Wed 7 AM, ~45 min
- Completion rate: health 90%, work 70%, social 45%
- Current workload: high (8.2 events/day, personal avg 5.1)
- Last social event: 9 days ago
- Frequent contacts: Sarah (weekly 1:1), David (bi-weekly), team standup (daily)
- Tends to underestimate meeting duration by ~20 min
```

This context travels with every message, so Claude can reference it naturally
without needing the user to repeat themselves.

---

## Learning Triggers

| Event | What gets updated |
|---|---|
| New event created | preferredTimes, avgDuration, frequentPeople, frequentProjects, leadTime |
| Event completed | completionRates (per category) |
| Event rescheduled / deleted | rescheduleRate |
| Daily planner opened | workloadTrend snapshot |
| Week ends | workToLifeRatio, lastHealthEvent, lastSocialEvent |

---

## Privacy Notes

- All profile data stays in the browser (IndexedDB) — never sent to any server
- The API key and profile summary are only sent to the Anthropic API as part of the system prompt
- Users can view their full profile in Settings and delete it at any time
- The profile summary injected into Claude is capped at ~200 tokens to avoid bloating every request

---

## Implementation Roadmap (suggested order)

| Step | What to build | Effort |
|---|---|---|
| 1 | `UserProfile` type + IndexedDB table | Small |
| 2 | `profileService.ts` — compute profile from events on demand | Medium |
| 3 | Inject profile summary into `getSystemPrompt()` | Small |
| 4 | Keyword extraction for `frequentPeople` / `frequentProjects` | Medium |
| 5 | Completion tracking (mark event done, record actual end time) | Medium |
| 6 | Proactive suggestion surface in Daily Planner | Medium |
| 7 | Profile viewer in Settings | Small |

---

## What This Does NOT Do

- No persistent memory across devices (browser-only)
- No learning from free-text descriptions (only structured event metadata)
- No emotion/sentiment analysis
- No external calendar sync (Google, Outlook) — local data only
