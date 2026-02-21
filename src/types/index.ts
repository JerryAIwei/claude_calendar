// Event Types
export type EventSource = 'manual' | 'ai-suggested' | 'natural-language';
export type EventCategory = 'work' | 'personal' | 'health' | 'social' | 'learning' | 'other';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  dayOfMonth?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  recurring?: RecurrenceRule;
  category?: EventCategory;
  completed?: boolean;
  createdAt: Date;
  updatedAt: Date;
  source: EventSource;
  color?: string;
  location?: string;
  reminders?: string[]; // Reminder IDs
}

// Habit Types
export type FrequencyType = 'daily' | 'weekly' | 'monthly';

export interface TimeSlot {
  dayOfWeek?: number; // 0-6
  hour: number;
  minute: number;
}

export interface HabitPattern {
  id: string;
  category: EventCategory;
  preferredTimes: TimeSlot[];
  avgDuration: number; // in minutes
  frequency: FrequencyType;
  lastOccurrences: Date[];
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Reminder Types
export type ReminderType = 'time-based' | 'habit-learned';

export interface Reminder {
  id: string;
  eventId: string;
  triggerTime: Date;
  type: ReminderType;
  dismissed: boolean;
  minutesBefore: number;
  createdAt: Date;
}

// AI Types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parsedEvents?: Partial<CalendarEvent>[];
}

export interface AIParseResult {
  success: boolean;
  events: Partial<CalendarEvent>[];
  message: string;
  confidence?: number;
}

export interface AISuggestion {
  id: string;
  type: 'time-slot' | 'reminder' | 'conflict-resolution' | 'habit';
  title: string;
  description: string;
  suggestedEvent?: Partial<CalendarEvent>;
  alternativeSlots?: { start: Date; end: Date; score: number }[];
  createdAt: Date;
  dismissed: boolean;
}

// Calendar View Types
export type CalendarView = 'month' | 'week' | 'day';

// Conflict Types
export interface Conflict {
  id: string;
  events: string[]; // Event IDs
  type: 'overlap' | 'back-to-back' | 'overbooking';
  severity: 'low' | 'medium' | 'high';
  suggestedResolutions?: AISuggestion[];
}

// Settings Types
export interface UserSettings {
  apiKey?: string;
  defaultView: CalendarView;
  defaultEventDuration: number; // in minutes
  workingHours: {
    start: string; // HH:mm format
    end: string;
  };
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  darkMode: boolean;
  notificationsEnabled: boolean;
  defaultReminders: number[]; // minutes before event
}

// UI State Types
export interface CalendarUIState {
  currentDate: Date;
  view: CalendarView;
  selectedEvent: CalendarEvent | null;
  isEventFormOpen: boolean;
  isAIChatOpen: boolean;
  isDailyPlannerOpen: boolean;
  isSettingsOpen: boolean;
}

// Daily Plan Types
export interface DailyPlan {
  id: string;
  date: Date;
  events: CalendarEvent[];
  priorities: string[];
  aiSummary?: string;
  createdAt: Date;
}

// Task Types
export type TaskStatus = 'pending' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  category?: EventCategory;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedDuration?: number; // minutes
  notes?: string;
  source: 'manual' | 'natural-language';
  createdAt: Date;
  updatedAt: Date;
}

// Export/Import Types
export interface CalendarExport {
  version: string;
  exportedAt: Date;
  events: CalendarEvent[];
  habits: HabitPattern[];
  settings: UserSettings;
}
