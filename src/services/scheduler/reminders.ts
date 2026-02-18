import { addMinutes, isBefore, differenceInMinutes } from 'date-fns';
import { db, toStoredReminder, fromStoredReminder } from '../storage/db';
import type { Reminder, CalendarEvent, HabitPattern } from '../../types';
import { generateId } from '../storage/events';

// Create a reminder for an event
export async function createReminder(
  eventId: string,
  minutesBefore: number,
  type: 'time-based' | 'habit-learned' = 'time-based'
): Promise<Reminder> {
  const event = await db.events.get(eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  const triggerTime = addMinutes(new Date(event.start), -minutesBefore);

  const reminder: Reminder = {
    id: generateId(),
    eventId,
    triggerTime,
    type,
    dismissed: false,
    minutesBefore,
    createdAt: new Date(),
  };

  await db.reminders.add(toStoredReminder(reminder));
  return reminder;
}

// Get pending reminders (not dismissed, trigger time not passed)
export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString();
  const stored = await db.reminders
    .where('dismissed')
    .equals(0) // false in IndexedDB
    .and(r => r.triggerTime <= now)
    .toArray();

  return stored.map(fromStoredReminder);
}

// Get upcoming reminders for an event
export async function getRemindersForEvent(eventId: string): Promise<Reminder[]> {
  const stored = await db.reminders
    .where('eventId')
    .equals(eventId)
    .toArray();

  return stored.map(fromStoredReminder);
}

// Dismiss a reminder
export async function dismissReminder(reminderId: string): Promise<void> {
  await db.reminders.update(reminderId, { dismissed: true });
}

// Delete reminders for an event
export async function deleteRemindersForEvent(eventId: string): Promise<void> {
  await db.reminders.where('eventId').equals(eventId).delete();
}

// Create default reminders based on settings
export async function createDefaultReminders(
  event: CalendarEvent,
  defaultMinutes: number[] = [15, 60]
): Promise<Reminder[]> {
  const reminders: Reminder[] = [];

  for (const minutes of defaultMinutes) {
    const triggerTime = addMinutes(new Date(event.start), -minutes);
    if (isBefore(new Date(), triggerTime)) {
      const reminder = await createReminder(event.id, minutes, 'time-based');
      reminders.push(reminder);
    }
  }

  return reminders;
}

// Analyze habit patterns to suggest reminder times
export function analyzeHabitForReminders(
  habit: HabitPattern,
  events: CalendarEvent[]
): number {
  // Get completion times for events in this category
  const categoryEvents = events.filter(e =>
    e.category === habit.category && e.completed
  );

  if (categoryEvents.length < 3) {
    // Not enough data, return default
    return 15;
  }

  // Analyze how early users typically complete tasks vs start time
  // This would be more sophisticated in a real implementation
  // For now, return a reasonable default based on frequency

  switch (habit.frequency) {
    case 'daily':
      return 10; // Daily tasks need quick reminders
    case 'weekly':
      return 30; // Weekly tasks benefit from more lead time
    case 'monthly':
      return 60; // Monthly tasks need even more preparation
    default:
      return 15;
  }
}

// Create smart reminders based on learned habits
export async function createSmartReminders(
  event: CalendarEvent,
  habits: HabitPattern[]
): Promise<Reminder[]> {
  const reminders: Reminder[] = [];

  // Find matching habit
  const habit = habits.find(h => h.category === event.category);

  if (habit && habit.eventCount >= 3) {
    // We have enough data to make smart suggestions
    const suggestedMinutes = analyzeHabitForReminders(habit, []);

    const triggerTime = addMinutes(new Date(event.start), -suggestedMinutes);
    if (isBefore(new Date(), triggerTime)) {
      const reminder = await createReminder(event.id, suggestedMinutes, 'habit-learned');
      reminders.push(reminder);
    }
  } else {
    // Fall back to default reminders
    return createDefaultReminders(event);
  }

  return reminders;
}

// Check and trigger due reminders
export async function checkAndTriggerReminders(): Promise<Reminder[]> {
  const now = new Date();
  const pending = await getPendingReminders();

  const dueReminders = pending.filter(r =>
    isBefore(new Date(r.triggerTime), now) && !r.dismissed
  );

  return dueReminders;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show notification for a reminder
export async function showReminderNotification(
  reminder: Reminder,
  eventTitle: string
): Promise<void> {
  const hasPermission = await requestNotificationPermission();

  if (hasPermission) {
    const notification = new Notification('Calendar Reminder', {
      body: `${eventTitle} starts in ${reminder.minutesBefore} minutes`,
      icon: '/calendar.svg',
      tag: reminder.id,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  }
}

// Start reminder checking loop
let reminderInterval: number | null = null;

export function startReminderChecker(
  onReminder: (reminder: Reminder, eventTitle: string) => void,
  intervalMs: number = 60000 // Check every minute
): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  const checkReminders = async () => {
    const dueReminders = await checkAndTriggerReminders();

    for (const reminder of dueReminders) {
      const event = await db.events.get(reminder.eventId);
      if (event) {
        onReminder(reminder, event.title);
        await dismissReminder(reminder.id);
      }
    }
  };

  // Initial check
  checkReminders();

  // Set up interval
  reminderInterval = window.setInterval(checkReminders, intervalMs);
}

export function stopReminderChecker(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
