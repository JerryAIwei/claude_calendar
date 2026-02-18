import { db, toStoredHabit, fromStoredHabit } from './db';
import type { HabitPattern, CalendarEvent, EventCategory, TimeSlot } from '../../types';
import { generateId } from './events';
import { getHours, getMinutes, getDay, differenceInMinutes } from 'date-fns';

// Create a new habit pattern
export async function createHabit(habit: Omit<HabitPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<HabitPattern> {
  const now = new Date();
  const newHabit: HabitPattern = {
    ...habit,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await db.habits.add(toStoredHabit(newHabit));
  return newHabit;
}

// Get habit by ID
export async function getHabit(id: string): Promise<HabitPattern | undefined> {
  const stored = await db.habits.get(id);
  return stored ? fromStoredHabit(stored) : undefined;
}

// Get habit by category
export async function getHabitByCategory(category: EventCategory): Promise<HabitPattern | undefined> {
  const stored = await db.habits.where('category').equals(category).first();
  return stored ? fromStoredHabit(stored) : undefined;
}

// Get all habits
export async function getAllHabits(): Promise<HabitPattern[]> {
  const stored = await db.habits.toArray();
  return stored.map(fromStoredHabit);
}

// Update a habit
export async function updateHabit(id: string, updates: Partial<HabitPattern>): Promise<HabitPattern | undefined> {
  const existing = await db.habits.get(id);
  if (!existing) return undefined;

  const updated: HabitPattern = {
    ...fromStoredHabit(existing),
    ...updates,
    id,
    updatedAt: new Date(),
  };

  await db.habits.put(toStoredHabit(updated));
  return updated;
}

// Delete a habit
export async function deleteHabit(id: string): Promise<boolean> {
  const existing = await db.habits.get(id);
  if (!existing) return false;

  await db.habits.delete(id);
  return true;
}

// Learn from an event - update or create habit pattern
export async function learnFromEvent(event: CalendarEvent): Promise<HabitPattern> {
  const category = event.category || 'other';
  let habit = await getHabitByCategory(category);

  const eventTimeSlot: TimeSlot = {
    dayOfWeek: getDay(event.start),
    hour: getHours(event.start),
    minute: getMinutes(event.start),
  };

  const duration = differenceInMinutes(event.end, event.start);

  if (habit) {
    // Update existing habit
    const newOccurrences = [...habit.lastOccurrences, event.start].slice(-10); // Keep last 10
    const newPreferredTimes = updatePreferredTimes(habit.preferredTimes, eventTimeSlot);
    const newAvgDuration = Math.round(
      (habit.avgDuration * habit.eventCount + duration) / (habit.eventCount + 1)
    );

    return (await updateHabit(habit.id, {
      preferredTimes: newPreferredTimes,
      avgDuration: newAvgDuration,
      lastOccurrences: newOccurrences,
      eventCount: habit.eventCount + 1,
    }))!;
  } else {
    // Create new habit
    return createHabit({
      category,
      preferredTimes: [eventTimeSlot],
      avgDuration: duration,
      frequency: 'weekly', // Default, will be updated over time
      lastOccurrences: [event.start],
      eventCount: 1,
    });
  }
}

// Update preferred times based on new occurrence
function updatePreferredTimes(existing: TimeSlot[], newSlot: TimeSlot): TimeSlot[] {
  // Check if similar time slot exists (within 1 hour)
  const similarIndex = existing.findIndex(slot =>
    slot.dayOfWeek === newSlot.dayOfWeek &&
    Math.abs(slot.hour - newSlot.hour) <= 1
  );

  if (similarIndex >= 0) {
    // Average the times
    const similar = existing[similarIndex];
    const avgHour = Math.round((similar.hour + newSlot.hour) / 2);
    const avgMinute = Math.round((similar.minute + newSlot.minute) / 2);

    const updated = [...existing];
    updated[similarIndex] = {
      ...similar,
      hour: avgHour,
      minute: avgMinute,
    };
    return updated;
  } else {
    // Add new time slot (keep max 5)
    return [...existing, newSlot].slice(-5);
  }
}

// Analyze habits to determine frequency
export async function analyzeHabitFrequency(habitId: string): Promise<HabitPattern['frequency']> {
  const habit = await getHabit(habitId);
  if (!habit || habit.lastOccurrences.length < 2) return 'weekly';

  const occurrences = habit.lastOccurrences.sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];

  for (let i = 1; i < occurrences.length; i++) {
    const daysDiff = (occurrences[i].getTime() - occurrences[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(daysDiff);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap <= 1.5) return 'daily';
  if (avgGap <= 10) return 'weekly';
  return 'monthly';
}

// Get suggested time for a category based on habits
export async function getSuggestedTimeForCategory(
  category: EventCategory,
  date: Date
): Promise<TimeSlot | null> {
  const habit = await getHabitByCategory(category);
  if (!habit || habit.preferredTimes.length === 0) return null;

  const dayOfWeek = getDay(date);

  // Try to find a time slot for this day of week
  const matchingSlot = habit.preferredTimes.find(slot => slot.dayOfWeek === dayOfWeek);
  if (matchingSlot) return matchingSlot;

  // Return most common time slot
  return habit.preferredTimes[0];
}

// Get average duration for a category
export async function getAvgDurationForCategory(category: EventCategory): Promise<number> {
  const habit = await getHabitByCategory(category);
  return habit?.avgDuration || 60; // Default 60 minutes
}

// Clear all habits (for testing/reset)
export async function clearAllHabits(): Promise<void> {
  await db.habits.clear();
}
