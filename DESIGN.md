# AI-Powered Personal Calendar — Design Document

> **Repo**: github.com/JerryAIwei/claude_calendar
> **Last updated**: 2026-02-21
> **Status**: Working MVP with Task system (3 commits)

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
│   │   ├── tasks.ts            # Task CRUD + urgency/reminder logic
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
    ├── TaskList/               # Deadline-based task panel
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

### Task
```ts
{
  id: string;
  title: string;
  description?: string;
  dueDate: Date;                // deadline, no fixed start time
  category?: EventCategory;
  priority: 'low'|'medium'|'high';  // auto-suggested from days until due
  status: 'pending'|'in-progress'|'done';
  source: 'manual'|'natural-language';
  createdAt: Date;
  updatedAt: Date;
}
```

Priority auto-assign: ≤7 days → high, ≤21 days → medium, >21 days → low.

Progressive reminder schedule (`computeReminderDates`):
- >30 days out: remind at 21d, 14d, 7d, 3d, 1d before
- >14 days: 14d, 7d, 3d, 1d
- >7 days: 7d, 3d, 1d
- ≤7 days: 3d, 2d, 1d, day-of

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

The AIChat component inspects the response:
- `"type": "task"` JSON → immediately saves to IndexedDB via `createTask()`, shows confirmation bubble
- `"type": "event"` JSON → shows confirmation card, waits for user to click "Add to Calendar"
- Plain text → shows as a chat bubble (may ask clarifying question)

```
User input
    │
    ▼
chat(input, useHistory=true)
    │
    ├── JSON type=task   ──► createTask() immediately → confirm bubble
    ├── JSON type=event  ──► show event card → user confirms → addEvent()
    │
    └── Plain text       ──► show as chat bubble
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
- JSON schema for **event** responses (`"type": "event"`)
- JSON schema for **task** responses (`"type": "task"`) — triggered when describing a to-do with a deadline but no specific start time
- Instruction to ask clarifying questions conversationally rather than returning failure JSON

### 5.4 Other AI Functions

| Function | Used by | Purpose |
|---|---|---|
| `getDailyPlan()` | DailyPlanner | Sends today's events + habits, gets prioritised schedule |
| `getSmartSchedulingSuggestion()` | `useAI.ts` | Given free slots + habits, scores and ranks best times |
| `getConflictResolution()` | (available) | Suggests how to resolve overlapping events |

---

## 6. Storage Layer (IndexedDB via Dexie)

### Schema

**v1** — original tables:

| Table | Primary key | Indexed fields |
|---|---|---|
| `events` | `id` | `start`, `end`, `category`, `source`, `createdAt` |
| `habits` | `id` | `category`, `frequency`, `updatedAt` |
| `reminders` | `id` | `eventId`, `triggerTime`, `dismissed` |
| `settings` | `id` | — |
| `aiMessages` | `id` | `timestamp` |

**v2** — adds:

| Table | Primary key | Indexed fields |
|---|---|---|
| `tasks` | `id` | `dueDate`, `status`, `priority`, `category`, `createdAt` |

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

## 12. Task System

The Task system handles important-but-not-urgent items with future deadlines (e.g. renew registration, file DS160, handle traffic ticket) — distinct from CalendarEvents because tasks have **no fixed start time**, only a deadline.

### UI Panel
- Opened via the orange checklist icon in the header
- Sections: **Overdue** / **Due within 7 days** / **Upcoming**
- Inline add-form (title, notes, deadline date, category; priority auto-suggested)
- Each card shows: urgency label + colour, due date, category, priority badge
- Actions per card: ✓ mark done, ⚡ toggle in-progress, 🗑 delete

### AI Integration
Say "remind me to renew my registration by March 31" → Claude returns `{"type":"task",...}` → task saved immediately to IndexedDB.

### Smart Urgency Logic
```
urgencyLabel(task) → { label: string; color: string }
  Overdue       → red "Overdue"
  Due today     → red "Due today"
  1–3 days left → red "Xd left"
  4–7 days left → orange "Xd left"
  8–14 days     → yellow "Xd left"
  15+ days      → green "Xd left"
```

---

## 13. Known Gaps / Future Work

| Area | Gap | Suggested fix |
|---|---|---|
| AI Chat | `parseNaturalLanguage()` still exists but is unused — dead code | Remove it |
| Recurring events | `RecurrenceRule` type is defined but never expanded into instances | Expand recurrences on load |
| Conflict resolution UI | Detection works; AI resolution exists but there's no UI to apply suggestions | Add a conflict resolution modal |
| Smart scheduling UI | `getSmartSchedulingSuggestion()` exists in `useAI.ts` but no surface triggers it | Add "Find me a time" button |
| Task reminders | `computeReminderDates()` exists but not hooked into the reminder checker loop | Hook into `startReminderChecker()` |
| Data import | Export works; import not implemented | Parse JSON + `bulkCreateEvents()` |
| Mobile | Components are responsive but week/day grids scroll horizontally on small screens | Refine breakpoints |
| Tests | Zero automated tests | Add Vitest + React Testing Library |

---

## 14. Commit History

| Hash | Description |
|---|---|
| `8fd6c31` | Initial commit: full MVP (42 files) |
| `d333dac` | AI memory, natural conversation, Test Connection button |
| `7e1135c` | Task system: deadline-based to-dos with AI integration |
