# AI-Powered Personal Calendar — Design Document

> **Repo**: github.com/JerryAIwei/claude_calendar
> **Last updated**: 2026-02-19
> **Status**: Working MVP (2 commits)

---

## 1. Overview

A fully client-side React calendar that replaces the traditional "create event" form with a conversational AI interface. The user talks to Claude in plain English; the app figures out what to schedule, detects conflicts, learns habits, and generates daily plans — all without a backend server.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | React 18 + Vite 4 | Fast HMR; Vite 4 chosen for Node 16 compat |
| Styling | Tailwind CSS 3 | Utility-first, dark mode via `class` strategy |
| State | Zustand | Minimal boilerplate, no context/provider wrapping |
| Persistence | Dexie.js (IndexedDB) | Structured local storage; survives page refresh |
| AI | Claude API (direct fetch) | SDK avoided — browser security header used instead |
| Dates | date-fns 3 | Tree-shakeable, no moment bloat |
| Language | TypeScript 5 | Full type safety across all layers |

> **Node constraint**: system runs Node 16.10. Vite 5 requires Node 18+, so Vite 4.5.x is pinned.
> **Anthropic SDK**: dropped in favour of raw `fetch` with the `anthropic-dangerous-direct-browser-access: true` header.

---

## 3. Architecture

```
src/
├── types/index.ts              # All shared TypeScript interfaces
├── stores/calendarStore.ts     # Single Zustand store (global state)
├── services/
│   ├── ai/
│   │   ├── claude.ts           # Fetch wrapper + conversation history
│   │   └── prompts.ts          # System prompt + structured prompts
│   ├── storage/
│   │   ├── db.ts               # Dexie schema + serialization helpers
│   │   ├── events.ts           # Event CRUD
│   │   ├── habits.ts           # Habit pattern learning
│   │   └── settings.ts        # User settings + API key
│   └── scheduler/
│       ├── conflicts.ts        # Overlap detection
│       ├── suggestions.ts      # Free-slot finder + scoring
│       └── reminders.ts        # Reminder creation + browser notifications
├── hooks/
│   ├── useCalendar.ts          # Init + reminder loop
│   ├── useAI.ts                # AI action hooks
│   └── useHabits.ts            # Habit insight helpers
└── components/
    ├── Calendar/               # Month / Week / Day views + header
    ├── EventForm/              # Create / edit modal
    ├── AIChat/                 # Conversational AI panel
    ├── DailyPlanner/           # AI-generated daily schedule panel
    └── Settings/               # API key, preferences, export
```

---

## 4. Data Models

### CalendarEvent
```ts
{
  id: string;               // timestamp + random suffix
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  recurring?: RecurrenceRule;
  category?: 'work'|'personal'|'health'|'social'|'learning'|'other';
  completed?: boolean;
  source: 'manual'|'ai-suggested'|'natural-language';
  createdAt: Date;
  updatedAt: Date;
}
```

### HabitPattern
```ts
{
  id: string;
  category: EventCategory;
  preferredTimes: TimeSlot[];   // { dayOfWeek, hour, minute }
  avgDuration: number;          // minutes, rolling average
  frequency: 'daily'|'weekly'|'monthly';
  lastOccurrences: Date[];      // capped at 10
  eventCount: number;
}
```

### UserSettings (IndexedDB, id = "user-settings")
```ts
{
  apiKey?: string;
  defaultView: 'month'|'week'|'day';
  defaultEventDuration: number;
  workingHours: { start: string; end: string };
  weekStartsOn: 0|1|6;
  darkMode: boolean;
  notificationsEnabled: boolean;
  defaultReminders: number[];   // minutes before event
}
```

---

## 5. AI Integration

### 5.1 Single Unified Chat Flow

All user input goes through a **single** `chat()` call. There is no separate "parse" step. The system prompt instructs Claude to:

- Return structured JSON (`{ "type": "event", ... }`) when confident about an event
- Ask a clarifying question in plain text when details are missing
- Respond conversationally for general questions

The AIChat component inspects the response: if it contains `"type": "event"` JSON it shows a confirmation card; otherwise it shows the text as a chat bubble.

```
User input
    │
    ▼
chat(input, useHistory=true)
    │
    ├── Claude returns JSON  ──► show event confirmation → user confirms → addEvent()
    │
    └── Claude returns text ──► show as chat bubble (may ask clarifying question)
```

### 5.2 Conversation Memory

`conversationHistory` is a module-level array in `claude.ts`:

- Every `sendMessage(..., useHistory=true)` call appends the user turn before the request and the assistant turn after a successful response
- History is capped at **20 messages** (10 exchanges) to stay within token limits
- On API error the pending user message is popped (rollback)
- The trash icon in AIChat calls `clearConversationHistory()` to reset

This gives the AI full context across a session — e.g., "remind me after the snowboard trip" resolves correctly because the earlier event is in history.

### 5.3 System Prompt

`getSystemPrompt()` is called fresh per request (not a static constant) so today's date is always accurate. It sets:
- Current date
- JSON schema for event responses
- Instruction to ask clarifying questions conversationally rather than returning failure JSON

### 5.4 Other AI Functions

| Function | Used by | Purpose |
|---|---|---|
| `getDailyPlan()` | DailyPlanner | Sends today's events + habits, gets prioritised schedule |
| `getSmartSchedulingSuggestion()` | `useAI.ts` | Given free slots + habits, scores and ranks best times |
| `getConflictResolution()` | (available) | Suggests how to resolve overlapping events |

---

## 6. Storage Layer (IndexedDB via Dexie)

### Schema (v1)

| Table | Primary key | Indexed fields |
|---|---|---|
| `events` | `id` | `start`, `end`, `category`, `source`, `createdAt` |
| `habits` | `id` | `category`, `frequency`, `updatedAt` |
| `reminders` | `id` | `eventId`, `triggerTime`, `dismissed` |
| `settings` | `id` | — |
| `aiMessages` | `id` | `timestamp` |

Dates are stored as ISO 8601 strings (IndexedDB has no native Date type for indexed queries). Serialization/deserialization is handled by `toStored*` / `fromStored*` helpers in `db.ts`.

---

## 7. Calendar Views

### Month View
- 6-week grid (always starts/ends on configured weekday)
- Event pills colour-coded by category
- Click empty day → pre-fills EventForm with that date
- Click event pill → opens EventForm in edit mode
- Up to 3 pills visible per cell; overflow shows "+N more"

### Week View
- 7-column time grid, 60px per hour
- All-day events in a fixed top row
- Timed events absolutely positioned by `(startMinutes / 60) * 60px`
- Click time slot → pre-fills EventForm with that hour

### Day View
- Single column, 80px per hour (more spacious)
- Shows full title + start–end time + description snippet
- All-day events in header band

---

## 8. Conflict Detection

`detectConflicts()` in `scheduler/conflicts.ts`:
1. Filters out all-day events
2. Sorts events by start time
3. O(n²) pairwise check using `date-fns/areIntervalsOverlapping`
4. Groups transitively connected conflicts (A overlaps B, B overlaps C → one conflict group)
5. Severity: `low` (2 events), `medium` (3), `high` (4+)

Conflicts are recomputed every time `loadVisibleEvents()` is called (view change, navigation, add/edit/delete).

A yellow warning banner is shown in the calendar header when `conflicts.length > 0`.

---

## 9. Habit Learning

Every time an event is created (including via AI), `learnFromEvent()` is called:

1. Looks up or creates a `HabitPattern` for the event's category
2. Updates `preferredTimes` — if a similar time slot already exists (same weekday, within 1 hour), it averages the hours; otherwise appends
3. Updates `avgDuration` with a rolling average: `(old × count + new) / (count + 1)`
4. Appends the start time to `lastOccurrences` (capped at 10)

After enough data (≥ 3 events per category), `analyzeHabitFrequency()` infers `daily / weekly / monthly` from average gap between occurrences.

---

## 10. Reminder System

`scheduler/reminders.ts` manages browser notifications:

- **Default reminders**: created from `settings.defaultReminders` (e.g. 15 min and 60 min before)
- **Smart reminders**: when a habit has ≥ 3 occurrences, `analyzeHabitForReminders()` picks reminder lead-time based on frequency (daily → 10 min, weekly → 30 min, monthly → 60 min)
- **Checker loop**: `startReminderChecker()` polls IndexedDB every 60 seconds; due reminders trigger `Notification` API + auto-dismiss in DB
- Browser notification permission is requested on first use

---

## 11. Settings

Stored in IndexedDB under `id = "user-settings"`. Key fields:

| Setting | Default |
|---|---|
| `apiKey` | undefined (required for AI) |
| `defaultView` | `month` |
| `defaultEventDuration` | 60 min |
| `workingHours` | 09:00–17:00 |
| `weekStartsOn` | Sunday (0) |
| `darkMode` | false |
| `notificationsEnabled` | true |

**Test Connection** button in the Settings panel validates the API key against Claude Haiku before saving (cheap, fast check).

**Export** downloads a JSON snapshot of all events + habits (API key excluded).

---

## 12. Known Gaps / Future Work

| Area | Gap | Suggested fix |
|---|---|---|
| AI Chat | `parseNaturalLanguage()` still exists but is unused — dead code | Remove it |
| Recurring events | `RecurrenceRule` type is defined but never expanded into instances | Expand recurrences on load |
| Conflict resolution UI | Detection works; AI resolution exists but there's no UI to apply suggestions | Add a conflict resolution modal |
| Smart scheduling UI | `getSmartSchedulingSuggestion()` exists in `useAI.ts` but no surface triggers it | Add "Find me a time" button |
| Data import | Export works; import not implemented | Parse JSON + `bulkCreateEvents()` |
| Mobile | Components are responsive but week/day grids scroll horizontally on small screens | Refine breakpoints |
| Tests | Zero automated tests | Add Vitest + React Testing Library |

---

## 13. Commit History

| Hash | Description |
|---|---|
| `8fd6c31` | Initial commit: full MVP (42 files) |
| `d333dac` | AI memory, natural conversation, Test Connection button |
