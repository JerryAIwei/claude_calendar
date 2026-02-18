# AI-Powered Personal Calendar

A React-based calendar application with Claude AI integration for smart scheduling, natural language input, daily planning assistance, conflict resolution, and habit-learning auto-reminders.

## Features

- **Calendar Views**: Month, week, and day views with event display
- **Natural Language Input**: Create events using natural language (e.g., "Meeting with Sarah tomorrow at 3pm")
- **AI Assistant**: Chat with Claude to manage your schedule
- **Daily Planner**: AI-generated optimized daily schedules
- **Conflict Detection**: Automatic detection of overlapping events
- **Habit Learning**: The app learns your scheduling patterns and suggests optimal times
- **Auto-Reminders**: Smart reminders based on your habits
- **Local Storage**: All data stored locally in IndexedDB
- **Dark Mode**: Toggle between light and dark themes
- **Export/Import**: Backup your calendar data as JSON

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Storage**: IndexedDB via Dexie.js
- **AI**: Claude API (Anthropic SDK)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Claude API key from [console.anthropic.com](https://console.anthropic.com/)

### Installation

1. Install dependencies:
   ```bash
   cd ai-calendar
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

4. Go to Settings (gear icon) and add your Claude API key

## Usage

### Creating Events

**Manual**: Click on any day/time slot or use the "New Event" button

**Natural Language**: Open the AI Chat (computer icon) and type things like:
- "Meeting with Sarah tomorrow at 3pm"
- "Dentist appointment next Monday at 10am for 30 minutes"
- "Weekly team standup every Monday at 9am"

### Daily Planning

Click the clipboard icon to open the Daily Planner. The AI will analyze your scheduled events and habits to generate an optimized daily schedule with priorities and tips.

### Conflict Resolution

The app automatically detects overlapping events and shows a warning banner. Future versions will include AI-powered conflict resolution suggestions.

## Project Structure

```
src/
├── components/
│   ├── Calendar/          # Calendar views (month/week/day)
│   ├── EventForm/         # Event creation/editing modal
│   ├── AIChat/            # AI assistant chat panel
│   ├── DailyPlanner/      # AI-generated daily schedule
│   └── Settings/          # App settings modal
├── hooks/
│   ├── useCalendar.ts     # Calendar state and operations
│   ├── useAI.ts           # Claude API interactions
│   └── useHabits.ts       # Habit tracking and learning
├── services/
│   ├── ai/                # Claude API client and prompts
│   ├── storage/           # IndexedDB operations
│   └── scheduler/         # Conflict detection, suggestions, reminders
├── stores/
│   └── calendarStore.ts   # Zustand store
└── types/
    └── index.ts           # TypeScript interfaces
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Privacy

All calendar data is stored locally in your browser using IndexedDB. Your Claude API key is also stored locally and is never transmitted anywhere except directly to the Anthropic API.

## License

MIT
