import { create } from 'zustand';
import type {
  CalendarEvent,
  CalendarView,
  UserSettings,
  HabitPattern,
  AIMessage,
  AISuggestion,
  Conflict
} from '../types';
import {
  getAllEvents,
  createEvent,
  updateEvent as updateEventInDb,
  deleteEvent as deleteEventInDb,
  getEventsInRange,
} from '../services/storage/events';
import { getAllHabits, learnFromEvent } from '../services/storage/habits';
import { getSettings, updateSettings as updateSettingsInDb } from '../services/storage/settings';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';

interface CalendarState {
  // Data
  events: CalendarEvent[];
  visibleEvents: CalendarEvent[];
  habits: HabitPattern[];
  settings: UserSettings | null;
  aiMessages: AIMessage[];
  suggestions: AISuggestion[];
  conflicts: Conflict[];

  // UI State
  currentDate: Date;
  view: CalendarView;
  selectedEvent: CalendarEvent | null;
  isEventFormOpen: boolean;
  isAIChatOpen: boolean;
  isDailyPlannerOpen: boolean;
  isSettingsOpen: boolean;
  isTaskListOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarView) => void;
  navigateForward: () => void;
  navigateBackward: () => void;
  goToToday: () => void;

  // Event actions
  loadVisibleEvents: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CalendarEvent>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  selectEvent: (event: CalendarEvent | null) => void;

  // UI actions
  openEventForm: (event?: CalendarEvent) => void;
  closeEventForm: () => void;
  toggleAIChat: () => void;
  toggleDailyPlanner: () => void;
  toggleSettings: () => void;
  toggleTaskList: () => void;

  // Settings actions
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;

  // AI actions
  addAIMessage: (message: AIMessage) => void;
  clearAIMessages: () => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  dismissSuggestion: (id: string) => void;

  // Conflict actions
  detectConflicts: () => void;
  clearConflicts: () => void;

  // Error handling
  setError: (error: string | null) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state
  events: [],
  visibleEvents: [],
  habits: [],
  settings: null,
  aiMessages: [],
  suggestions: [],
  conflicts: [],

  currentDate: new Date(),
  view: 'month',
  selectedEvent: null,
  isEventFormOpen: false,
  isAIChatOpen: false,
  isDailyPlannerOpen: false,
  isSettingsOpen: false,
  isTaskListOpen: false,
  isLoading: false,
  error: null,

  // Initialize store from IndexedDB
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const [events, habits, settings] = await Promise.all([
        getAllEvents(),
        getAllHabits(),
        getSettings(),
      ]);

      set({
        events,
        habits,
        settings,
        isLoading: false,
      });

      // Load visible events for current view
      await get().loadVisibleEvents();

      // Apply dark mode from settings
      if (settings.darkMode) {
        document.documentElement.classList.add('dark');
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
      });
    }
  },

  // Navigation
  setCurrentDate: (date: Date) => {
    set({ currentDate: date });
    get().loadVisibleEvents();
  },

  setView: (view: CalendarView) => {
    set({ view });
    get().loadVisibleEvents();
  },

  navigateForward: () => {
    const { currentDate, view } = get();
    let newDate: Date;
    switch (view) {
      case 'month':
        newDate = addMonths(currentDate, 1);
        break;
      case 'week':
        newDate = addWeeks(currentDate, 1);
        break;
      case 'day':
        newDate = addDays(currentDate, 1);
        break;
    }
    set({ currentDate: newDate });
    get().loadVisibleEvents();
  },

  navigateBackward: () => {
    const { currentDate, view } = get();
    let newDate: Date;
    switch (view) {
      case 'month':
        newDate = subMonths(currentDate, 1);
        break;
      case 'week':
        newDate = subWeeks(currentDate, 1);
        break;
      case 'day':
        newDate = subDays(currentDate, 1);
        break;
    }
    set({ currentDate: newDate });
    get().loadVisibleEvents();
  },

  goToToday: () => {
    set({ currentDate: new Date() });
    get().loadVisibleEvents();
  },

  // Event loading based on view
  loadVisibleEvents: async () => {
    const { currentDate, view, settings } = get();
    const weekStartsOn = settings?.weekStartsOn || 0;

    let start: Date, end: Date;
    switch (view) {
      case 'month':
        // Include days from adjacent months visible in the month view
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
        break;
      case 'week':
        start = startOfWeek(currentDate, { weekStartsOn });
        end = endOfWeek(currentDate, { weekStartsOn });
        break;
      case 'day':
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        break;
    }

    const visibleEvents = await getEventsInRange(start, end);
    set({ visibleEvents });
    get().detectConflicts();
  },

  // Event CRUD
  addEvent: async (eventData) => {
    set({ isLoading: true, error: null });
    try {
      const newEvent = await createEvent(eventData);

      // Learn from the event for habit tracking
      await learnFromEvent(newEvent);
      const habits = await getAllHabits();

      set(state => ({
        events: [...state.events, newEvent],
        habits,
        isLoading: false,
      }));

      await get().loadVisibleEvents();
      return newEvent;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add event',
        isLoading: false,
      });
      throw error;
    }
  },

  updateEvent: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await updateEventInDb(id, updates);
      if (updated) {
        set(state => ({
          events: state.events.map(e => e.id === id ? updated : e),
          selectedEvent: state.selectedEvent?.id === id ? updated : state.selectedEvent,
          isLoading: false,
        }));
        await get().loadVisibleEvents();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update event',
        isLoading: false,
      });
    }
  },

  deleteEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteEventInDb(id);
      set(state => ({
        events: state.events.filter(e => e.id !== id),
        selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent,
        isLoading: false,
      }));
      await get().loadVisibleEvents();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete event',
        isLoading: false,
      });
    }
  },

  selectEvent: (event) => {
    set({ selectedEvent: event });
  },

  // UI actions
  openEventForm: (event) => {
    set({
      isEventFormOpen: true,
      selectedEvent: event || null,
    });
  },

  closeEventForm: () => {
    set({
      isEventFormOpen: false,
      selectedEvent: null,
    });
  },

  toggleAIChat: () => {
    set(state => ({ isAIChatOpen: !state.isAIChatOpen }));
  },

  toggleDailyPlanner: () => {
    set(state => ({ isDailyPlannerOpen: !state.isDailyPlannerOpen }));
  },

  toggleSettings: () => {
    set(state => ({ isSettingsOpen: !state.isSettingsOpen }));
  },

  toggleTaskList: () => {
    set(state => ({ isTaskListOpen: !state.isTaskListOpen }));
  },

  // Settings
  updateSettings: async (updates) => {
    try {
      const updated = await updateSettingsInDb(updates);
      set({ settings: updated });

      // Apply dark mode
      if ('darkMode' in updates) {
        if (updates.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  },

  // AI
  addAIMessage: (message) => {
    set(state => ({
      aiMessages: [...state.aiMessages, message],
    }));
  },

  clearAIMessages: () => {
    set({ aiMessages: [] });
  },

  addSuggestion: (suggestion) => {
    set(state => ({
      suggestions: [...state.suggestions, suggestion],
    }));
  },

  dismissSuggestion: (id) => {
    set(state => ({
      suggestions: state.suggestions.filter(s => s.id !== id),
    }));
  },

  // Conflicts
  detectConflicts: () => {
    const { visibleEvents } = get();
    const conflicts: Conflict[] = [];

    // Sort events by start time
    const sortedEvents = [...visibleEvents].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );

    // Check for overlaps
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const eventA = sortedEvents[i];
        const eventB = sortedEvents[j];

        // If event B starts before event A ends, they overlap
        if (eventB.start < eventA.end && eventB.end > eventA.start) {
          const existingConflict = conflicts.find(
            c => c.events.includes(eventA.id) || c.events.includes(eventB.id)
          );

          if (existingConflict) {
            if (!existingConflict.events.includes(eventA.id)) {
              existingConflict.events.push(eventA.id);
            }
            if (!existingConflict.events.includes(eventB.id)) {
              existingConflict.events.push(eventB.id);
            }
          } else {
            conflicts.push({
              id: `conflict-${Date.now()}-${i}-${j}`,
              events: [eventA.id, eventB.id],
              type: 'overlap',
              severity: 'medium',
            });
          }
        }
      }
    }

    set({ conflicts });
  },

  clearConflicts: () => {
    set({ conflicts: [] });
  },

  setError: (error) => {
    set({ error });
  },
}));
