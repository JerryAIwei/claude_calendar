import { db, toStoredEvent, fromStoredEvent } from './db';
import type { CalendarEvent } from '../../types';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new event
export async function createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
  const now = new Date();
  const newEvent: CalendarEvent = {
    ...event,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await db.events.add(toStoredEvent(newEvent));
  return newEvent;
}

// Get event by ID
export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
  const stored = await db.events.get(id);
  return stored ? fromStoredEvent(stored) : undefined;
}

// Update an event
export async function updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
  const existing = await db.events.get(id);
  if (!existing) return undefined;

  const updated: CalendarEvent = {
    ...fromStoredEvent(existing),
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date(),
  };

  await db.events.put(toStoredEvent(updated));
  return updated;
}

// Delete an event
export async function deleteEvent(id: string): Promise<boolean> {
  const existing = await db.events.get(id);
  if (!existing) return false;

  await db.events.delete(id);
  // Also delete associated reminders
  await db.reminders.where('eventId').equals(id).delete();
  return true;
}

// Get all events
export async function getAllEvents(): Promise<CalendarEvent[]> {
  const stored = await db.events.toArray();
  return stored.map(fromStoredEvent);
}

// Get events in date range
export async function getEventsInRange(start: Date, end: Date): Promise<CalendarEvent[]> {
  const stored = await db.events
    .where('start')
    .between(start.toISOString(), end.toISOString(), true, true)
    .toArray();

  // Also include events that start before but end within or after the range
  const overlapping = await db.events
    .where('start')
    .below(start.toISOString())
    .and(event => new Date(event.end) >= start)
    .toArray();

  const combined = [...stored, ...overlapping];
  // Remove duplicates
  const unique = Array.from(new Map(combined.map(e => [e.id, e])).values());
  return unique.map(fromStoredEvent);
}

// Get events for a specific day
export async function getEventsForDay(date: Date): Promise<CalendarEvent[]> {
  return getEventsInRange(startOfDay(date), endOfDay(date));
}

// Get events for a specific week
export async function getEventsForWeek(date: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Promise<CalendarEvent[]> {
  return getEventsInRange(
    startOfWeek(date, { weekStartsOn }),
    endOfWeek(date, { weekStartsOn })
  );
}

// Get events for a specific month
export async function getEventsForMonth(date: Date): Promise<CalendarEvent[]> {
  return getEventsInRange(startOfMonth(date), endOfMonth(date));
}

// Get events by category
export async function getEventsByCategory(category: string): Promise<CalendarEvent[]> {
  const stored = await db.events.where('category').equals(category).toArray();
  return stored.map(fromStoredEvent);
}

// Search events by title or description
export async function searchEvents(query: string): Promise<CalendarEvent[]> {
  const lowerQuery = query.toLowerCase();
  const stored = await db.events.toArray();
  return stored
    .filter(event =>
      event.title.toLowerCase().includes(lowerQuery) ||
      (event.description && event.description.toLowerCase().includes(lowerQuery))
    )
    .map(fromStoredEvent);
}

// Get upcoming events
export async function getUpcomingEvents(limit: number = 10): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();
  const stored = await db.events
    .where('start')
    .above(now)
    .limit(limit)
    .sortBy('start');
  return stored.map(fromStoredEvent);
}

// Mark event as completed
export async function toggleEventCompletion(id: string): Promise<CalendarEvent | undefined> {
  const existing = await db.events.get(id);
  if (!existing) return undefined;

  return updateEvent(id, { completed: !existing.completed });
}

// Bulk create events
export async function bulkCreateEvents(events: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<CalendarEvent[]> {
  const now = new Date();
  const newEvents: CalendarEvent[] = events.map(event => ({
    ...event,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }));

  await db.events.bulkAdd(newEvents.map(toStoredEvent));
  return newEvents;
}

// Clear all events (for testing/reset)
export async function clearAllEvents(): Promise<void> {
  await db.events.clear();
  await db.reminders.clear();
}
