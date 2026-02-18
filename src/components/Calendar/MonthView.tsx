import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarEvent } from '../../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface EventPillProps {
  event: CalendarEvent;
  onClick: () => void;
}

function EventPill({ event, onClick }: EventPillProps) {
  const category = event.category || 'other';
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`event-pill ${category}`}
      title={`${event.title} - ${format(event.start, 'h:mm a')}`}
    >
      {event.allDay ? (
        event.title
      ) : (
        <>
          <span className="font-medium">{format(event.start, 'h:mm')}</span> {event.title}
        </>
      )}
    </div>
  );
}

export function MonthView() {
  const { currentDate, visibleEvents, openEventForm, selectEvent, settings } = useCalendarStore();

  const weekStartsOn = settings?.weekStartsOn || 0;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Reorder weekdays based on weekStartsOn
  const orderedWeekdays = [
    ...WEEKDAYS.slice(weekStartsOn),
    ...WEEKDAYS.slice(0, weekStartsOn),
  ];

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return visibleEvents
      .filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return isSameDay(eventStart, day) ||
               (eventStart < day && eventEnd >= day);
      })
      .sort((a, b) => {
        // All-day events first, then by start time
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
  };

  const handleDayClick = (day: Date) => {
    const defaultStart = new Date(day);
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date(day);
    defaultEnd.setHours(10, 0, 0, 0);

    openEventForm({
      id: '',
      title: '',
      start: defaultStart,
      end: defaultEnd,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    selectEvent(event);
    openEventForm(event);
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {orderedWeekdays.map(day => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`calendar-day cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                !isCurrentMonth ? 'other-month' : ''
              } ${isCurrentDay ? 'today' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentDay
                  ? 'bg-primary-600 text-white w-7 h-7 rounded-full flex items-center justify-center'
                  : isCurrentMonth
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5 overflow-hidden max-h-[80px]">
                {dayEvents.slice(0, 3).map(event => (
                  <EventPill
                    key={event.id}
                    event={event}
                    onClick={() => handleEventClick(event)}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
