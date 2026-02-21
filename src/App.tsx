import { useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { EventForm } from './components/EventForm';
import { AIChat } from './components/AIChat';
import { DailyPlanner } from './components/DailyPlanner';
import { Settings } from './components/Settings';
import { TaskList } from './components/TaskList';
import { useCalendar } from './hooks/useCalendar';

function App() {
  const { isLoading, error, setError } = useCalendar();

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in">
          <div className="bg-red-50 dark:bg-red-900/90 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 dark:text-red-200">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main calendar */}
      <Calendar />

      {/* Modals and side panels */}
      <EventForm />
      <AIChat />
      <DailyPlanner />
      <Settings />
      <TaskList />
    </div>
  );
}

export default App;
