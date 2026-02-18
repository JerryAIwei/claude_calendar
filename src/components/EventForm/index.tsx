import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarEvent, EventCategory } from '../../types';

const CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: 'bg-blue-500' },
  { value: 'personal', label: 'Personal', color: 'bg-green-500' },
  { value: 'health', label: 'Health', color: 'bg-red-500' },
  { value: 'social', label: 'Social', color: 'bg-purple-500' },
  { value: 'learning', label: 'Learning', color: 'bg-yellow-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

export function EventForm() {
  const {
    isEventFormOpen,
    selectedEvent,
    closeEventForm,
    addEvent,
    updateEvent,
    deleteEvent,
    settings,
  } = useCalendarStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [allDay, setAllDay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = selectedEvent && selectedEvent.id;

  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title || '');
      setDescription(selectedEvent.description || '');
      setStartDate(format(new Date(selectedEvent.start), 'yyyy-MM-dd'));
      setStartTime(format(new Date(selectedEvent.start), 'HH:mm'));
      setEndDate(format(new Date(selectedEvent.end), 'yyyy-MM-dd'));
      setEndTime(format(new Date(selectedEvent.end), 'HH:mm'));
      setCategory(selectedEvent.category || 'other');
      setAllDay(selectedEvent.allDay || false);
    } else {
      // Reset form for new event
      const now = new Date();
      const defaultDuration = settings?.defaultEventDuration || 60;
      const endDefault = new Date(now.getTime() + defaultDuration * 60000);

      setTitle('');
      setDescription('');
      setStartDate(format(now, 'yyyy-MM-dd'));
      setStartTime(format(now, 'HH:mm'));
      setEndDate(format(endDefault, 'yyyy-MM-dd'));
      setEndTime(format(endDefault, 'HH:mm'));
      setCategory('other');
      setAllDay(false);
    }
  }, [selectedEvent, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsSubmitting(true);

    try {
      const start = new Date(`${startDate}T${allDay ? '00:00' : startTime}`);
      const end = new Date(`${endDate}T${allDay ? '23:59' : endTime}`);

      const eventData: Partial<CalendarEvent> = {
        title: title.trim(),
        description: description.trim() || undefined,
        start,
        end,
        category,
        allDay,
      };

      if (isEditing) {
        await updateEvent(selectedEvent.id, eventData);
      } else {
        await addEvent({
          ...eventData,
          source: 'manual',
        } as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>);
      }

      closeEventForm();
    } catch (error) {
      console.error('Failed to save event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !confirm('Are you sure you want to delete this event?')) return;

    setIsSubmitting(true);
    try {
      await deleteEvent(selectedEvent.id);
      closeEventForm();
    } catch (error) {
      console.error('Failed to delete event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEventFormOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop animate-fade-in"
        onClick={closeEventForm}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">
              {isEditing ? 'Edit Event' : 'New Event'}
            </h2>
            <button
              onClick={closeEventForm}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700"
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 resize-none"
              />
            </div>

            {/* All day toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="allDay" className="text-sm font-medium">
                All day event
              </label>
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700"
                  required
                />
              </div>
              {!allDay && (
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700"
                  required
                />
              </div>
              {!allDay && (
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700"
                    required
                  />
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      category === cat.value
                        ? `${cat.color} text-white ring-2 ring-offset-2 ring-${cat.color.replace('bg-', '')}`
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEventForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
