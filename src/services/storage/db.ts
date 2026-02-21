import Dexie, { type Table } from 'dexie';
import type { CalendarEvent, HabitPattern, Reminder, UserSettings, AIMessage, Task } from '../../types';

export interface StoredTask extends Omit<Task, 'dueDate' | 'createdAt' | 'updatedAt'> {
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export function toStoredTask(task: Task): StoredTask {
  return { ...task, dueDate: task.dueDate.toISOString(), createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() };
}

export function fromStoredTask(stored: StoredTask): Task {
  return { ...stored, dueDate: new Date(stored.dueDate), createdAt: new Date(stored.createdAt), updatedAt: new Date(stored.updatedAt) };
}

// Serializable versions for storage (dates as ISO strings)
export interface StoredEvent extends Omit<CalendarEvent, 'start' | 'end' | 'createdAt' | 'updatedAt'> {
  start: string;
  end: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredHabitPattern extends Omit<HabitPattern, 'lastOccurrences' | 'createdAt' | 'updatedAt'> {
  lastOccurrences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredReminder extends Omit<Reminder, 'triggerTime' | 'createdAt'> {
  triggerTime: string;
  createdAt: string;
}

export interface StoredAIMessage extends Omit<AIMessage, 'timestamp'> {
  timestamp: string;
}

export class CalendarDatabase extends Dexie {
  events!: Table<StoredEvent, string>;
  habits!: Table<StoredHabitPattern, string>;
  reminders!: Table<StoredReminder, string>;
  settings!: Table<UserSettings & { id: string }, string>;
  aiMessages!: Table<StoredAIMessage, string>;
  tasks!: Table<StoredTask, string>;

  constructor() {
    super('AICalendarDB');

    this.version(1).stores({
      events: 'id, start, end, category, source, createdAt',
      habits: 'id, category, frequency, updatedAt',
      reminders: 'id, eventId, triggerTime, dismissed',
      settings: 'id',
      aiMessages: 'id, timestamp'
    });

    this.version(2).stores({
      events: 'id, start, end, category, source, createdAt',
      habits: 'id, category, frequency, updatedAt',
      reminders: 'id, eventId, triggerTime, dismissed',
      settings: 'id',
      aiMessages: 'id, timestamp',
      tasks: 'id, dueDate, status, priority, category, createdAt'
    });
  }
}

export const db = new CalendarDatabase();

// Helper functions to convert between stored and runtime formats
export function toStoredEvent(event: CalendarEvent): StoredEvent {
  return {
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function fromStoredEvent(stored: StoredEvent): CalendarEvent {
  return {
    ...stored,
    start: new Date(stored.start),
    end: new Date(stored.end),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

export function toStoredHabit(habit: HabitPattern): StoredHabitPattern {
  return {
    ...habit,
    lastOccurrences: habit.lastOccurrences.map(d => d.toISOString()),
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
  };
}

export function fromStoredHabit(stored: StoredHabitPattern): HabitPattern {
  return {
    ...stored,
    lastOccurrences: stored.lastOccurrences.map(s => new Date(s)),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

export function toStoredReminder(reminder: Reminder): StoredReminder {
  return {
    ...reminder,
    triggerTime: reminder.triggerTime.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
  };
}

export function fromStoredReminder(stored: StoredReminder): Reminder {
  return {
    ...stored,
    triggerTime: new Date(stored.triggerTime),
    createdAt: new Date(stored.createdAt),
  };
}

export function toStoredMessage(message: AIMessage): StoredAIMessage {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

export function fromStoredMessage(stored: StoredAIMessage): AIMessage {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  };
}
