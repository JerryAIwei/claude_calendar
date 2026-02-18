import type { CalendarEvent, Conflict } from '../../types';
import { areIntervalsOverlapping, differenceInMinutes } from 'date-fns';

export function detectConflicts(events: CalendarEvent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const conflictMap = new Map<string, Set<string>>();

  // Sort events by start time
  const sortedEvents = [...events]
    .filter(e => !e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Check each pair of events
  for (let i = 0; i < sortedEvents.length; i++) {
    for (let j = i + 1; j < sortedEvents.length; j++) {
      const eventA = sortedEvents[i];
      const eventB = sortedEvents[j];

      const startA = new Date(eventA.start);
      const endA = new Date(eventA.end);
      const startB = new Date(eventB.start);
      const endB = new Date(eventB.end);

      // Check if events overlap
      if (areIntervalsOverlapping(
        { start: startA, end: endA },
        { start: startB, end: endB }
      )) {
        // Track which events conflict with which
        if (!conflictMap.has(eventA.id)) {
          conflictMap.set(eventA.id, new Set());
        }
        if (!conflictMap.has(eventB.id)) {
          conflictMap.set(eventB.id, new Set());
        }
        conflictMap.get(eventA.id)!.add(eventB.id);
        conflictMap.get(eventB.id)!.add(eventA.id);
      }
    }
  }

  // Group conflicts
  const processedEvents = new Set<string>();

  for (const [eventId, conflictingIds] of conflictMap) {
    if (processedEvents.has(eventId)) continue;

    const allRelatedEvents = new Set<string>([eventId]);

    // Find all transitively connected conflicts
    const queue = [eventId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const related = conflictMap.get(currentId);
      if (related) {
        for (const relatedId of related) {
          if (!allRelatedEvents.has(relatedId)) {
            allRelatedEvents.add(relatedId);
            queue.push(relatedId);
          }
        }
      }
    }

    // Mark all as processed
    allRelatedEvents.forEach(id => processedEvents.add(id));

    // Determine severity
    const eventCount = allRelatedEvents.size;
    const severity = eventCount > 3 ? 'high' : eventCount > 2 ? 'medium' : 'low';

    conflicts.push({
      id: `conflict-${Date.now()}-${conflicts.length}`,
      events: Array.from(allRelatedEvents),
      type: eventCount > 2 ? 'overbooking' : 'overlap',
      severity,
    });
  }

  return conflicts;
}

export function checkBackToBackEvents(
  events: CalendarEvent[],
  bufferMinutes: number = 15
): Array<{ eventA: string; eventB: string; gap: number }> {
  const backToBack: Array<{ eventA: string; eventB: string; gap: number }> = [];

  const sortedEvents = [...events]
    .filter(e => !e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    const gap = differenceInMinutes(new Date(next.start), new Date(current.end));

    if (gap >= 0 && gap < bufferMinutes) {
      backToBack.push({
        eventA: current.id,
        eventB: next.id,
        gap,
      });
    }
  }

  return backToBack;
}

export function hasConflict(
  newEvent: { start: Date; end: Date },
  existingEvents: CalendarEvent[]
): boolean {
  for (const event of existingEvents) {
    if (event.allDay) continue;

    if (areIntervalsOverlapping(
      { start: newEvent.start, end: newEvent.end },
      { start: new Date(event.start), end: new Date(event.end) }
    )) {
      return true;
    }
  }

  return false;
}
