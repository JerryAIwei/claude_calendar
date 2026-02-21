import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useCalendarStore } from '../../stores/calendarStore';
import { getPendingTasks, updateTask, deleteTask, urgencyLabel, daysUntilDue, suggestPriority } from '../../services/storage/tasks';
import type { Task, TaskPriority, EventCategory } from '../../types';

const CATEGORIES: EventCategory[] = ['work', 'personal', 'health', 'social', 'learning', 'other'];

const priorityBadge: Record<TaskPriority, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export function TaskList() {
  const { isTaskListOpen, toggleTaskList } = useCalendarStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New task form state
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<EventCategory>('personal');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isTaskListOpen) reload();
  }, [isTaskListOpen]);

  const reload = async () => {
    setTasks(await getPendingTasks());
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setIsSaving(true);
    const due = new Date(dueDate);
    await import('../../services/storage/tasks').then(m =>
      m.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: due,
        category,
        priority: suggestPriority(due),
        status: 'pending',
        source: 'manual',
      })
    );
    setTitle(''); setDueDate(''); setDescription(''); setIsSaving(false);
    setShowAddForm(false);
    reload();
  };

  const handleDone = async (task: Task) => {
    await updateTask(task.id, { status: 'done' });
    reload();
  };

  const handleDelete = async (task: Task) => {
    await deleteTask(task.id);
    reload();
  };

  const handleStarted = async (task: Task) => {
    await updateTask(task.id, { status: task.status === 'in-progress' ? 'pending' : 'in-progress' });
    reload();
  };

  if (!isTaskListOpen) return null;

  const overdue  = tasks.filter(t => daysUntilDue(t) < 0);
  const urgent   = tasks.filter(t => daysUntilDue(t) >= 0 && daysUntilDue(t) <= 7);
  const upcoming = tasks.filter(t => daysUntilDue(t) > 7);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={toggleTaskList} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold">Tasks</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tasks.length} pending</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddForm(v => !v)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Add task">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button onClick={toggleTaskList} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Add task form */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 bg-gray-50 dark:bg-gray-900/50">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?" required autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700" />
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Deadline</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as EventCategory)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="submit" disabled={isSaving || !title.trim() || !dueDate}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {isSaving ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </form>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-6">
          {tasks.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No pending tasks</p>
              <button onClick={() => setShowAddForm(true)} className="mt-2 text-sm text-primary-600 hover:underline">
                Add your first task
              </button>
            </div>
          )}

          {overdue.length > 0 && <Section title="Overdue" tasks={overdue} onDone={handleDone} onDelete={handleDelete} onToggleStarted={handleStarted} />}
          {urgent.length > 0  && <Section title="Due within 7 days" tasks={urgent} onDone={handleDone} onDelete={handleDelete} onToggleStarted={handleStarted} />}
          {upcoming.length > 0 && <Section title="Upcoming" tasks={upcoming} onDone={handleDone} onDelete={handleDelete} onToggleStarted={handleStarted} />}
        </div>
      </div>
    </>
  );
}

function Section({ title, tasks, onDone, onDelete, onToggleStarted }: {
  title: string;
  tasks: Task[];
  onDone: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleStarted: (t: Task) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{title}</h3>
      <div className="space-y-2">
        {tasks.map(task => <TaskCard key={task.id} task={task} onDone={onDone} onDelete={onDelete} onToggleStarted={onToggleStarted} />)}
      </div>
    </div>
  );
}

function TaskCard({ task, onDone, onDelete, onToggleStarted }: {
  task: Task;
  onDone: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleStarted: (t: Task) => void;
}) {
  const { label, color } = urgencyLabel(task);

  return (
    <div className={`rounded-lg border p-3 transition-all ${
      task.status === 'in-progress'
        ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button onClick={() => onDone(task)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-500 hover:border-primary-500 transition-colors" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{task.title}</span>
            {task.status === 'in-progress' && (
              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200 px-1.5 py-0.5 rounded-full">In progress</span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs font-medium ${color}`}>{label}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Due {format(task.dueDate, 'MMM d, yyyy')}
            </span>
            {task.category && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{task.category}</span>
              </>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityBadge[task.priority]}`}>
              {task.priority}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onToggleStarted(task)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={task.status === 'in-progress' ? 'Mark as pending' : 'Mark as in progress'}>
            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          <button onClick={() => onDelete(task)}
            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
            <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
