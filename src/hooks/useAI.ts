import { useState, useCallback } from 'react';
import { useCalendarStore } from '../stores/calendarStore';
import {
  parseNaturalLanguage,
  getDailyPlan,
  getSmartSchedulingSuggestion,
  chat,
} from '../services/ai/claude';
import { findFreeSlots, suggestBestTimes } from '../services/scheduler/suggestions';
import { getAllHabits } from '../services/storage/habits';
import { getAllEvents, getEventsInRange } from '../services/storage/events';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import type { CalendarEvent, EventCategory } from '../types';

export function useAI() {
  const { settings, addEvent, addAIMessage } = useCalendarStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasApiKey = !!settings?.apiKey;

  const parseAndCreateEvent = useCallback(async (input: string): Promise<CalendarEvent[] | null> => {
    if (!hasApiKey) {
      setError('API key not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await parseNaturalLanguage(input);

      if (result.success && result.events.length > 0) {
        const createdEvents: CalendarEvent[] = [];

        for (const eventData of result.events) {
          const event = await addEvent({
            title: eventData.title || 'Untitled Event',
            start: eventData.start ? new Date(eventData.start) : new Date(),
            end: eventData.end ? new Date(eventData.end) : new Date(),
            category: eventData.category as EventCategory,
            description: eventData.description,
            allDay: eventData.allDay,
            source: 'natural-language',
          });
          createdEvents.push(event);
        }

        return createdEvents;
      }

      setError(result.message);
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to parse input';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasApiKey, addEvent]);

  const suggestTimeForTask = useCallback(async (
    taskDescription: string,
    duration: number = 60,
    category?: EventCategory
  ) => {
    if (!hasApiKey) {
      setError('API key not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [events, habits] = await Promise.all([
        getAllEvents(),
        getAllHabits(),
      ]);

      const workingHours = settings?.workingHours || { start: '09:00', end: '17:00' };
      const freeSlots = findFreeSlots(
        events,
        new Date(),
        addDays(new Date(), 7),
        workingHours,
        duration
      );

      // Get AI suggestion
      const suggestion = await getSmartSchedulingSuggestion(
        taskDescription,
        freeSlots.map(s => ({ start: s.start, end: s.end })),
        habits,
        events
      );

      return suggestion;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to suggest time';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasApiKey, settings]);

  const generateDailyPlan = useCallback(async (date: Date = new Date()) => {
    if (!hasApiKey) {
      setError('API key not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [events, habits] = await Promise.all([
        getEventsInRange(startOfDay(date), endOfDay(date)),
        getAllHabits(),
      ]);

      const plan = await getDailyPlan(events, habits, date);
      return plan;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate plan';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasApiKey]);

  const askAssistant = useCallback(async (message: string): Promise<string | null> => {
    if (!hasApiKey) {
      setError('API key not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await chat(message);
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Chat failed';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasApiKey]);

  return {
    isLoading,
    error,
    hasApiKey,
    parseAndCreateEvent,
    suggestTimeForTask,
    generateDailyPlan,
    askAssistant,
  };
}
