import { useCallback } from 'react';
import { useCalendarStore } from '../stores/calendarStore';
import {
  getAllHabits,
  getHabitByCategory,
  learnFromEvent,
  getSuggestedTimeForCategory,
  getAvgDurationForCategory,
} from '../services/storage/habits';
import type { CalendarEvent, EventCategory, HabitPattern, TimeSlot } from '../types';

export function useHabits() {
  const { habits } = useCalendarStore();

  const getHabitForCategory = useCallback(async (category: EventCategory): Promise<HabitPattern | undefined> => {
    return getHabitByCategory(category);
  }, []);

  const recordEvent = useCallback(async (event: CalendarEvent): Promise<HabitPattern> => {
    return learnFromEvent(event);
  }, []);

  const getSuggestedTime = useCallback(async (
    category: EventCategory,
    date: Date
  ): Promise<TimeSlot | null> => {
    return getSuggestedTimeForCategory(category, date);
  }, []);

  const getExpectedDuration = useCallback(async (category: EventCategory): Promise<number> => {
    return getAvgDurationForCategory(category);
  }, []);

  const getHabitInsights = useCallback((category: EventCategory): {
    hasPattern: boolean;
    preferredDays: string[];
    preferredHours: string[];
    avgDuration: number;
    frequency: string;
  } => {
    const habit = habits.find(h => h.category === category);

    if (!habit) {
      return {
        hasPattern: false,
        preferredDays: [],
        preferredHours: [],
        avgDuration: 60,
        frequency: 'unknown',
      };
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const preferredDays = habit.preferredTimes
      .filter(t => t.dayOfWeek !== undefined)
      .map(t => dayNames[t.dayOfWeek!])
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    const preferredHours = habit.preferredTimes
      .map(t => {
        const hour = t.hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:00 ${ampm}`;
      })
      .filter((v, i, a) => a.indexOf(v) === i);

    return {
      hasPattern: true,
      preferredDays,
      preferredHours,
      avgDuration: habit.avgDuration,
      frequency: habit.frequency,
    };
  }, [habits]);

  return {
    habits,
    getHabitForCategory,
    recordEvent,
    getSuggestedTime,
    getExpectedDuration,
    getHabitInsights,
  };
}
