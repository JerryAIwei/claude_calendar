import {
  startOfDay,
  endOfDay,
  addDays,
  setHours,
  setMinutes,
  isWithinInterval,
  addMinutes,
  isBefore,
  isAfter,
  differenceInMinutes,
} from 'date-fns';
import type { CalendarEvent, HabitPattern, TimeSlot, EventCategory } from '../../types';
import { hasConflict } from './conflicts';

export interface FreeSlot {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

export interface TimeSuggestion {
  slot: FreeSlot;
  score: number;
  reasons: string[];
}

export function findFreeSlots(
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date,
  workingHours: { start: string; end: string },
  minDuration: number = 30 // minimum slot duration in minutes
): FreeSlot[] {
  const freeSlots: FreeSlot[] = [];
  const [workStartHour, workStartMin] = workingHours.start.split(':').map(Number);
  const [workEndHour, workEndMin] = workingHours.end.split(':').map(Number);

  let currentDay = startOfDay(startDate);
  const lastDay = startOfDay(endDate);

  while (currentDay <= lastDay) {
    const dayStart = setMinutes(setHours(currentDay, workStartHour), workStartMin);
    const dayEnd = setMinutes(setHours(currentDay, workEndHour), workEndMin);

    // Get events for this day
    const dayEvents = events
      .filter(e => {
        if (e.allDay) return false;
        const eventStart = new Date(e.start);
        return isWithinInterval(eventStart, { start: dayStart, end: dayEnd }) ||
               isWithinInterval(new Date(e.end), { start: dayStart, end: dayEnd }) ||
               (isBefore(eventStart, dayStart) && isAfter(new Date(e.end), dayEnd));
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Find free slots between events
    let slotStart = dayStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Clamp event times to working hours
      const effectiveStart = isBefore(eventStart, dayStart) ? dayStart : eventStart;
      const effectiveEnd = isAfter(eventEnd, dayEnd) ? dayEnd : eventEnd;

      // Check for free slot before this event
      if (isBefore(slotStart, effectiveStart)) {
        const duration = differenceInMinutes(effectiveStart, slotStart);
        if (duration >= minDuration) {
          freeSlots.push({
            start: slotStart,
            end: effectiveStart,
            duration,
          });
        }
      }

      // Move slot start to after this event
      if (isAfter(effectiveEnd, slotStart)) {
        slotStart = effectiveEnd;
      }
    }

    // Check for remaining time at end of day
    if (isBefore(slotStart, dayEnd)) {
      const duration = differenceInMinutes(dayEnd, slotStart);
      if (duration >= minDuration) {
        freeSlots.push({
          start: slotStart,
          end: dayEnd,
          duration,
        });
      }
    }

    currentDay = addDays(currentDay, 1);
  }

  return freeSlots;
}

export function suggestBestTimes(
  freeSlots: FreeSlot[],
  desiredDuration: number,
  habits: HabitPattern[],
  category?: EventCategory
): TimeSuggestion[] {
  const suggestions: TimeSuggestion[] = [];

  // Get habit for this category if available
  const categoryHabit = habits.find(h => h.category === category);

  for (const slot of freeSlots) {
    // Skip slots that are too short
    if (slot.duration < desiredDuration) continue;

    let score = 0.5; // Base score
    const reasons: string[] = [];

    const slotHour = slot.start.getHours();
    const slotDayOfWeek = slot.start.getDay();

    // Score based on habit patterns
    if (categoryHabit) {
      for (const preferredTime of categoryHabit.preferredTimes) {
        // Check if slot matches preferred day
        if (preferredTime.dayOfWeek === slotDayOfWeek) {
          score += 0.1;
          reasons.push(`You often schedule ${category} events on this day`);
        }

        // Check if slot hour is close to preferred hour
        const hourDiff = Math.abs(preferredTime.hour - slotHour);
        if (hourDiff <= 1) {
          score += 0.2;
          reasons.push(`This matches your usual time for ${category} tasks`);
        } else if (hourDiff <= 2) {
          score += 0.1;
        }
      }
    }

    // Prefer morning slots for focus work
    if (category === 'work' || category === 'learning') {
      if (slotHour >= 9 && slotHour < 12) {
        score += 0.15;
        reasons.push('Morning hours are great for focused work');
      }
    }

    // Prefer afternoon/evening for social
    if (category === 'social') {
      if (slotHour >= 17) {
        score += 0.1;
        reasons.push('Evening is typically better for social activities');
      }
    }

    // Prefer mid-morning or mid-afternoon for health/exercise
    if (category === 'health') {
      if ((slotHour >= 6 && slotHour < 8) || (slotHour >= 17 && slotHour < 19)) {
        score += 0.15;
        reasons.push('Great time for exercise');
      }
    }

    // Prefer longer slots to allow for buffer time
    if (slot.duration >= desiredDuration + 30) {
      score += 0.1;
      reasons.push('Extra buffer time available');
    }

    // Cap score at 1
    score = Math.min(score, 1);

    suggestions.push({
      slot: {
        start: slot.start,
        end: addMinutes(slot.start, desiredDuration),
        duration: desiredDuration,
      },
      score,
      reasons,
    });
  }

  // Sort by score descending
  return suggestions.sort((a, b) => b.score - a.score);
}

export function findNextAvailableSlot(
  events: CalendarEvent[],
  duration: number,
  workingHours: { start: string; end: string },
  startFrom: Date = new Date()
): FreeSlot | null {
  // Look up to 14 days ahead
  const endDate = addDays(startFrom, 14);
  const freeSlots = findFreeSlots(events, startFrom, endDate, workingHours, duration);

  // Return the first slot that can fit the duration
  for (const slot of freeSlots) {
    if (slot.duration >= duration) {
      return {
        start: slot.start,
        end: addMinutes(slot.start, duration),
        duration,
      };
    }
  }

  return null;
}
