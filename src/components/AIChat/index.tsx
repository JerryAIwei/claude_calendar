import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import { chat, clearConversationHistory } from '../../services/ai/claude';
import { createTask, suggestPriority } from '../../services/storage/tasks';
import type { AIMessage, CalendarEvent } from '../../types';

export function AIChat() {
  const {
    isAIChatOpen,
    toggleAIChat,
    aiMessages,
    addAIMessage,
    clearAIMessages,
    addEvent,
    settings,
  } = useCalendarStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEvents, setPendingEvents] = useState<Partial<CalendarEvent>[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasApiKey = !!settings?.apiKey;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  useEffect(() => {
    if (isAIChatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAIChatOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !hasApiKey) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    addAIMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      // Single unified call — Claude decides whether to return JSON or chat naturally
      const response = await chat(input);

      // Check if response contains a task JSON
      const taskMatch = response.match(/\{\s*"type"\s*:\s*"task"[\s\S]*\}/);
      if (taskMatch) {
        try {
          const parsed = JSON.parse(taskMatch[0]);
          if (parsed.type === 'task' && parsed.task?.title) {
            const dueDate = new Date(parsed.task.dueDate);
            await createTask({
              title: parsed.task.title,
              description: parsed.task.description || undefined,
              dueDate,
              category: parsed.task.category || 'personal',
              priority: suggestPriority(dueDate),
              status: 'pending',
              source: 'natural-language',
            });
            addAIMessage({
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `${parsed.message || 'Done!'} I've added "${parsed.task.title}" to your task list. You can view it by clicking the tasks icon in the header.`,
              timestamp: new Date(),
            });
            setIsLoading(false);
            return;
          }
        } catch { /* fall through */ }
      }

      // Check if response contains an event JSON
      const jsonMatch = response.match(/\{\s*"type"\s*:\s*"event"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === 'event' && parsed.events?.length > 0) {
            const events = parsed.events.map((e: Record<string, unknown>) => ({
              ...e,
              start: e.start ? new Date(e.start as string) : new Date(),
              end: e.end ? new Date(e.end as string) : new Date(),
            }));
            setPendingEvents(events);

            const eventDescriptions = events.map((e: { title?: string; start?: Date }) =>
              `"${e.title}" on ${e.start ? format(e.start, 'MMM d, yyyy h:mm a') : 'TBD'}`
            ).join(', ');

            addAIMessage({
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `Got it! ${parsed.message || ''}\n\nI'll add: ${eventDescriptions}\n\nShall I add this to your calendar?`,
              timestamp: new Date(),
              parsedEvents: events,
            });
            setIsLoading(false);
            return;
          }
        } catch { /* fall through to plain text */ }
      }

      // Plain conversational response
      addAIMessage({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });
    } catch (error) {
      const errorMessage: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };

      addAIMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEvents = async () => {
    if (pendingEvents.length === 0) return;

    setIsLoading(true);

    try {
      for (const event of pendingEvents) {
        await addEvent({
          title: event.title || 'Untitled Event',
          start: event.start ? new Date(event.start) : new Date(),
          end: event.end ? new Date(event.end) : new Date(),
          category: event.category,
          description: event.description,
          allDay: event.allDay,
          source: 'natural-language',
        });
      }

      const confirmMessage: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Done! I've added ${pendingEvents.length} event${pendingEvents.length > 1 ? 's' : ''} to your calendar.`,
        timestamp: new Date(),
      };

      addAIMessage(confirmMessage);
      setPendingEvents([]);
    } catch (error) {
      const errorMessage: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Failed to add events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };

      addAIMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEvents = () => {
    setPendingEvents([]);

    const cancelMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'No problem! Let me know if you want to try again or need anything else.',
      timestamp: new Date(),
    };

    addAIMessage(cancelMessage);
  };

  if (!isAIChatOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={toggleAIChat}
      />

      {/* Chat panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold">AI Assistant</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Powered by Claude
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearAIMessages();
                clearConversationHistory();
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Clear chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={toggleAIChat}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
          {!hasApiKey && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                API Key Required
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Please add your Claude API key in Settings to use the AI assistant.
              </p>
            </div>
          )}

          {aiMessages.length === 0 && hasApiKey && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="mb-4">Hi! I can help you with your calendar.</p>
              <p className="text-sm">Try saying things like:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"Meeting with Sarah tomorrow at 3pm"</li>
                <li>"Schedule gym for Monday and Wednesday"</li>
                <li>"Remind me to renew my registration by March 31"</li>
                <li>"What do I have planned for today?"</li>
              </ul>
            </div>
          )}

          {aiMessages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-primary-200' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {format(new Date(message.timestamp), 'h:mm a')}
                </p>
              </div>
            </div>
          ))}

          {/* Pending events confirmation */}
          {pendingEvents.length > 0 && (
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelEvents}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEvents}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                Add to Calendar
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasApiKey ? "Type a message or describe an event..." : "Add API key in Settings first"}
              disabled={!hasApiKey || isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!hasApiKey || isLoading || !input.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
