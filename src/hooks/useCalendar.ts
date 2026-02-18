import { useEffect, useCallback } from 'react';
import { useCalendarStore } from '../stores/calendarStore';
import { startReminderChecker, stopReminderChecker, showReminderNotification } from '../services/scheduler/reminders';
import type { Reminder } from '../types';

export function useCalendar() {
  const store = useCalendarStore();

  // Initialize the calendar on mount
  useEffect(() => {
    store.initialize();
  }, []);

  // Set up reminder checker
  useEffect(() => {
    if (store.settings?.notificationsEnabled) {
      const handleReminder = (reminder: Reminder, eventTitle: string) => {
        showReminderNotification(reminder, eventTitle);
      };

      startReminderChecker(handleReminder);

      return () => {
        stopReminderChecker();
      };
    }
  }, [store.settings?.notificationsEnabled]);

  return store;
}

export function useCalendarNavigation() {
  const {
    currentDate,
    view,
    setCurrentDate,
    setView,
    navigateForward,
    navigateBackward,
    goToToday,
  } = useCalendarStore();

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, [setCurrentDate]);

  return {
    currentDate,
    view,
    setView,
    navigateForward,
    navigateBackward,
    goToToday,
    goToDate,
  };
}

export function useCalendarEvents() {
  const {
    events,
    visibleEvents,
    selectedEvent,
    isEventFormOpen,
    addEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    openEventForm,
    closeEventForm,
  } = useCalendarStore();

  return {
    events,
    visibleEvents,
    selectedEvent,
    isEventFormOpen,
    addEvent,
    updateEvent,
    deleteEvent,
    selectEvent,
    openEventForm,
    closeEventForm,
  };
}

export function useCalendarSettings() {
  const {
    settings,
    updateSettings,
    isSettingsOpen,
    toggleSettings,
  } = useCalendarStore();

  return {
    settings,
    updateSettings,
    isSettingsOpen,
    toggleSettings,
  };
}

export function useConflicts() {
  const { conflicts, detectConflicts, clearConflicts, visibleEvents } = useCalendarStore();

  return {
    conflicts,
    detectConflicts,
    clearConflicts,
    hasConflicts: conflicts.length > 0,
    conflictingEventIds: conflicts.flatMap(c => c.events),
    getConflictForEvent: (eventId: string) =>
      conflicts.find(c => c.events.includes(eventId)),
  };
}
