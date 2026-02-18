import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import { getDailyPlan } from '../../services/ai/claude';
import { getEventsInRange } from '../../services/storage/events';
import { getAllHabits } from '../../services/storage/habits';

interface PlanItem {
  time: string;
  title: string;
  type: 'scheduled' | 'suggested' | 'break';
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

interface DailyPlanData {
  schedule: PlanItem[];
  priorities: string[];
  summary: string;
  tips: string[];
}

export function DailyPlanner() {
  const { isDailyPlannerOpen, toggleDailyPlanner, currentDate, settings } = useCalendarStore();
  const [plan, setPlan] = useState<DailyPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasApiKey = !!settings?.apiKey;

  useEffect(() => {
    if (isDailyPlannerOpen && hasApiKey && !plan) {
      generatePlan();
    }
  }, [isDailyPlannerOpen, hasApiKey]);

  const generatePlan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);
      const [events, habits] = await Promise.all([
        getEventsInRange(dayStart, dayEnd),
        getAllHabits(),
      ]);

      const planData = await getDailyPlan(events, habits, currentDate);
      setPlan(planData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'scheduled':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'suggested':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'break':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  if (!isDailyPlannerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={toggleDailyPlanner}
      />

      {/* Panel */}
      <div className="fixed left-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold">Daily Planner</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {format(currentDate, 'EEEE, MMM d')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generatePlan}
              disabled={isLoading || !hasApiKey}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Regenerate plan"
            >
              <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={toggleDailyPlanner}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          {!hasApiKey && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                API Key Required
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Please add your Claude API key in Settings to generate daily plans.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Generating your optimized plan...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {plan && !isLoading && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-2">
                  Today's Focus
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{plan.summary}</p>
              </div>

              {/* Top Priorities */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Top Priorities
                </h3>
                <ol className="space-y-2">
                  {plan.priorities.map((priority, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm">{priority}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Schedule */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Optimized Schedule
                </h3>
                <div className="space-y-2">
                  {plan.schedule.map((item, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 ${getTypeStyle(item.type)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {item.time}
                          </span>
                          <h4 className="font-medium">{item.title}</h4>
                          {item.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.type === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200' :
                          item.type === 'suggested' ? 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200' :
                          'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200'
                        }`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              {plan.tips.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Tips for Today
                  </h3>
                  <ul className="space-y-2">
                    {plan.tips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span className="text-yellow-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
