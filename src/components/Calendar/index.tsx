import { useCalendarStore } from '../../stores/calendarStore';
import { CalendarHeader } from './CalendarHeader';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';

export function Calendar() {
  const { view, conflicts } = useCalendarStore();

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader />

      {/* Conflict warning */}
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Calendar view */}
      {view === 'month' && <MonthView />}
      {view === 'week' && <WeekView />}
      {view === 'day' && <DayView />}
    </div>
  );
}

export { CalendarHeader } from './CalendarHeader';
export { MonthView } from './MonthView';
export { WeekView } from './WeekView';
export { DayView } from './DayView';
