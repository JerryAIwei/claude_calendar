import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  isToday,
  isSameDay,
  differenceInMinutes,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarEvent } from '../../types';

export function WeekView() {
  const { currentDate, visibleEvents, openEventForm, selectEvent, settings } = useCalendarStore();

  const weekStartsOn = settings?.weekStartsOn || 0;
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = eachHourOfInterval({
    start: startOfDay(currentDate),
    end: endOfDay(currentDate),
  });

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return visibleEvents.filter(event => {
      const eventStart = new Date(event.start);
      return isSameDay(eventStart, day) && !event.allDay;
    });
  };

  const getAllDayEvents = (day: Date): CalendarEvent[] => {
    return visibleEvents.filter(event => {
      const eventStart = new Date(event.start);
      return isSameDay(eventStart, day) && event.allDay;
    });
  };

  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const duration = differenceInMinutes(eventEnd, eventStart);

    return {
      top: `${(startMinutes / 60) * 60}px`,
      height: `${Math.max((duration / 60) * 60, 20)}px`,
    };
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      work: 'bg-blue-500',
      personal: 'bg-green-500',
      health: 'bg-red-500',
      social: 'bg-purple-500',
      learning: 'bg-yellow-500',
      other: 'bg-gray-500',
    };
    return colors[category || 'other'] || colors.other;
  };

  const handleTimeSlotClick = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);

    openEventForm({
      id: '',
      title: '',
      start,
      end,
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* All-day events row */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="w-16 flex-shrink-0 py-2 px-2 text-xs text-gray-500 border-r border-gray-200 dark:border-gray-700">
          All day
        </div>
        <div className="flex-1 grid grid-cols-7">
          {days.map(day => {
            const allDayEvents = getAllDayEvents(day);
            return (
              <div
                key={day.toISOString()}
                className="min-h-[40px] p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
              >
                {allDayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className={`text-xs px-2 py-1 rounded text-white truncate cursor-pointer ${getCategoryColor(event.category)}`}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 grid grid-cols-7">
          {days.map(day => (
            <div
              key={day.toISOString()}
              className={`py-2 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-semibold ${
                isToday(day) ? 'text-primary-600' : ''
              }`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 flex overflow-auto custom-scrollbar">
        {/* Time labels */}
        <div className="w-16 flex-shrink-0">
          {hours.map(hour => (
            <div
              key={hour.toISOString()}
              className="h-[60px] border-b border-gray-100 dark:border-gray-800 pr-2 text-right"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400 relative -top-2">
                {format(hour, 'h a')}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={day.toISOString()}
                className={`relative border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                  isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                {/* Hour slots */}
                {hours.map(hour => (
                  <div
                    key={hour.toISOString()}
                    onClick={() => handleTimeSlotClick(day, hour.getHours())}
                    className="h-[60px] border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                  />
                ))}

                {/* Events */}
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                    style={getEventStyle(event)}
                    className={`absolute left-1 right-1 rounded px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:ring-2 ring-offset-1 ${getCategoryColor(event.category)}`}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="opacity-80">
                      {format(new Date(event.start), 'h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
