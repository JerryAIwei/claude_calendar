import {
  format,
  eachHourOfInterval,
  startOfDay,
  endOfDay,
  isToday,
  differenceInMinutes,
} from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarEvent } from '../../types';

export function DayView() {
  const { currentDate, visibleEvents, openEventForm, selectEvent } = useCalendarStore();

  const hours = eachHourOfInterval({
    start: startOfDay(currentDate),
    end: endOfDay(currentDate),
  });

  const dayEvents = visibleEvents.filter(event => !event.allDay);
  const allDayEvents = visibleEvents.filter(event => event.allDay);

  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const duration = differenceInMinutes(eventEnd, eventStart);

    return {
      top: `${(startMinutes / 60) * 80}px`,
      height: `${Math.max((duration / 60) * 80, 30)}px`,
    };
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      work: 'bg-blue-500 border-blue-600',
      personal: 'bg-green-500 border-green-600',
      health: 'bg-red-500 border-red-600',
      social: 'bg-purple-500 border-purple-600',
      learning: 'bg-yellow-500 border-yellow-600',
      other: 'bg-gray-500 border-gray-600',
    };
    return colors[category || 'other'] || colors.other;
  };

  const handleTimeSlotClick = (hour: number) => {
    const start = new Date(currentDate);
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
      {/* Day header */}
      <div className={`p-4 text-center border-b border-gray-200 dark:border-gray-700 ${
        isToday(currentDate) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(currentDate, 'EEEE')}
        </div>
        <div className={`text-4xl font-bold ${
          isToday(currentDate) ? 'text-primary-600' : ''
        }`}>
          {format(currentDate, 'd')}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(currentDate, 'MMMM yyyy')}
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs text-gray-500 mb-2">All day</div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map(event => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium cursor-pointer hover:ring-2 ${getCategoryColor(event.category)}`}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="flex">
          {/* Time labels */}
          <div className="w-20 flex-shrink-0">
            {hours.map(hour => (
              <div
                key={hour.toISOString()}
                className="h-[80px] border-b border-gray-100 dark:border-gray-800 pr-3 text-right"
              >
                <span className="text-sm text-gray-500 dark:text-gray-400 relative -top-2">
                  {format(hour, 'h:mm a')}
                </span>
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className="flex-1 relative border-l border-gray-200 dark:border-gray-700">
            {/* Hour slots */}
            {hours.map(hour => (
              <div
                key={hour.toISOString()}
                onClick={() => handleTimeSlotClick(hour.getHours())}
                className="h-[80px] border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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
                className={`absolute left-2 right-2 rounded-lg px-3 py-2 text-white border-l-4 cursor-pointer hover:ring-2 ring-offset-1 ${getCategoryColor(event.category)}`}
              >
                <div className="font-medium">{event.title}</div>
                <div className="text-sm opacity-80">
                  {format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')}
                </div>
                {event.description && (
                  <div className="text-sm mt-1 opacity-70 line-clamp-2">
                    {event.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
