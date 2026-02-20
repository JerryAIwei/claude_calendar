import { format } from 'date-fns';
import type { CalendarEvent, HabitPattern } from '../../types';

export function getSystemPrompt(): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `You are a friendly AI calendar assistant. You help users manage their schedule through natural conversation.
Today is ${today}.

When the user's message clearly describes a calendar event (with enough time information to schedule it), respond with ONLY this JSON:
{
  "type": "event",
  "events": [{ "title": "...", "start": "ISO8601", "end": "ISO8601", "category": "work|personal|health|social|learning|other", "description": "optional" }],
  "message": "friendly one-line confirmation"
}

When the user's message is ambiguous, unclear, or missing key details (like exact time), respond conversationally as plain text — ask a short, natural clarifying question. Reference any context from earlier in the conversation. Example: "Do you mean after your snowboard trip ending at 6 PM today?"

For general calendar questions or anything not event-related, respond conversationally as plain text.

Never respond with JSON if you need clarification. Never show raw JSON to the user — only use JSON when you are confident about all event details.`;}

export const SYSTEM_PROMPT = getSystemPrompt();

export function createParseEventPrompt(userInput: string, currentDate: Date): string {
  return `Parse this into a calendar event: "${userInput}"

Current date and time: ${format(currentDate, 'EEEE, MMMM d, yyyy h:mm a')}

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "success": true,
  "events": [
    {
      "title": "Event title",
      "start": "ISO 8601 date string",
      "end": "ISO 8601 date string",
      "category": "work|personal|health|social|learning|other",
      "description": "optional description",
      "allDay": false
    }
  ],
  "message": "Human readable confirmation"
}

If the input is unclear or not an event, return:
{
  "success": false,
  "events": [],
  "message": "Explanation of why parsing failed or what additional info is needed"
}

Important rules:
- If no time is specified, default to 9:00 AM start
- If no duration is specified, default to 1 hour
- "tomorrow" means ${format(new Date(currentDate.getTime() + 86400000), 'MMMM d, yyyy')}
- "next week" means ${format(new Date(currentDate.getTime() + 7 * 86400000), 'MMMM d, yyyy')}
- Infer category from context (meeting/work task = work, gym/workout = health, etc.)`;
}

export function createDailyPlanPrompt(
  events: CalendarEvent[],
  habits: HabitPattern[],
  date: Date
): string {
  const eventsList = events.map(e => ({
    title: e.title,
    start: format(new Date(e.start), 'h:mm a'),
    end: format(new Date(e.end), 'h:mm a'),
    category: e.category,
    completed: e.completed,
  }));

  const habitInfo = habits.map(h => ({
    category: h.category,
    preferredTimes: h.preferredTimes,
    avgDuration: h.avgDuration,
  }));

  return `Create an optimized daily plan for ${format(date, 'EEEE, MMMM d, yyyy')}.

Current scheduled events:
${JSON.stringify(eventsList, null, 2)}

User's habit patterns:
${JSON.stringify(habitInfo, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "schedule": [
    {
      "time": "9:00 AM",
      "title": "Event or suggested activity",
      "type": "scheduled|suggested|break",
      "priority": "high|medium|low",
      "notes": "Optional tips or context"
    }
  ],
  "priorities": ["Top priority 1", "Priority 2", "Priority 3"],
  "summary": "Brief overview of the day's focus",
  "tips": ["Tip 1", "Tip 2"]
}

Consider:
- Buffer time between meetings
- User's preferred times for different categories
- Breaks and energy management
- Grouping similar tasks`;
}

export function createSmartSchedulingPrompt(
  taskDescription: string,
  freeSlots: { start: Date; end: Date }[],
  habits: HabitPattern[],
  existingEvents: CalendarEvent[]
): string {
  const formattedSlots = freeSlots.map(s => ({
    start: format(s.start, 'EEEE h:mm a'),
    end: format(s.end, 'h:mm a'),
    date: format(s.start, 'MMM d'),
  }));

  const relevantHabits = habits.map(h => ({
    category: h.category,
    preferredTimes: h.preferredTimes.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`),
    avgDuration: h.avgDuration,
  }));

  const upcoming = existingEvents.slice(0, 10).map(e => ({
    title: e.title,
    time: format(new Date(e.start), 'MMM d h:mm a'),
    category: e.category,
  }));

  return `User wants to schedule: "${taskDescription}"

Available time slots:
${JSON.stringify(formattedSlots, null, 2)}

User's patterns for similar tasks:
${JSON.stringify(relevantHabits, null, 2)}

Upcoming events context:
${JSON.stringify(upcoming, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "recommendation": {
    "slot": {
      "start": "ISO 8601 date string",
      "end": "ISO 8601 date string"
    },
    "score": 0.95,
    "reason": "Why this is the best slot"
  },
  "alternatives": [
    {
      "slot": { "start": "ISO 8601", "end": "ISO 8601" },
      "score": 0.85,
      "reason": "Why this is a good alternative"
    }
  ],
  "suggestedCategory": "work|personal|health|social|learning|other",
  "suggestedDuration": 60
}

Consider:
- User's historical preferences for similar tasks
- Energy levels throughout the day
- Context switching costs
- Buffer time around other events`;
}

export function createConflictResolutionPrompt(
  conflictingEvents: CalendarEvent[],
  availableSlots: { start: Date; end: Date }[]
): string {
  const events = conflictingEvents.map(e => ({
    id: e.id,
    title: e.title,
    start: format(new Date(e.start), 'EEEE, MMM d h:mm a'),
    end: format(new Date(e.end), 'h:mm a'),
    category: e.category,
  }));

  const slots = availableSlots.map(s => ({
    start: format(s.start, 'EEEE, MMM d h:mm a'),
    end: format(s.end, 'h:mm a'),
  }));

  return `These events have a scheduling conflict:
${JSON.stringify(events, null, 2)}

Available alternative slots:
${JSON.stringify(slots, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "analysis": "Brief explanation of the conflict",
  "recommendations": [
    {
      "action": "move|shorten|cancel|split",
      "eventId": "id of event to modify",
      "newTime": { "start": "ISO 8601", "end": "ISO 8601" },
      "reason": "Why this resolves the conflict best"
    }
  ],
  "alternativeApproach": "Optional different way to handle this"
}`;
}
