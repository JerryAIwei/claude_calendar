import { db, toStoredTask, fromStoredTask } from './db';
import type { Task, TaskPriority } from '../../types';
import { generateId } from './events';
import { differenceInDays, isBefore } from 'date-fns';

// In-memory dedup: tracks task reminders already fired this session
const notifiedTaskReminders = new Set<string>();

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const now = new Date();
  const newTask: Task = { ...task, id: generateId(), createdAt: now, updatedAt: now };
  await db.tasks.add(toStoredTask(newTask));
  return newTask;
}

export async function getAllTasks(): Promise<Task[]> {
  const stored = await db.tasks.toArray();
  return stored.map(fromStoredTask);
}

export async function getPendingTasks(): Promise<Task[]> {
  const stored = await db.tasks
    .where('status').anyOf(['pending', 'in-progress'])
    .toArray();
  return stored
    .map(fromStoredTask)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  const existing = await db.tasks.get(id);
  if (!existing) return undefined;
  const updated: Task = { ...fromStoredTask(existing), ...updates, id, updatedAt: new Date() };
  await db.tasks.put(toStoredTask(updated));
  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

// Returns days until due (negative = overdue)
export function daysUntilDue(task: Task): number {
  return differenceInDays(task.dueDate, new Date());
}

export function isOverdue(task: Task): boolean {
  return task.status !== 'done' && isBefore(task.dueDate, new Date());
}

// Compute urgency label based on days remaining
export function urgencyLabel(task: Task): { label: string; color: string } {
  if (task.status === 'done') return { label: 'Done', color: 'text-gray-400' };
  const days = daysUntilDue(task);
  if (days < 0)  return { label: 'Overdue', color: 'text-red-600' };
  if (days === 0) return { label: 'Due today', color: 'text-red-500' };
  if (days <= 3)  return { label: `${days}d left`, color: 'text-red-500' };
  if (days <= 7)  return { label: `${days}d left`, color: 'text-orange-500' };
  if (days <= 14) return { label: `${days}d left`, color: 'text-yellow-600' };
  return { label: `${days}d left`, color: 'text-green-600' };
}

// Smart reminder schedule: returns list of Date objects when we should remind
export function computeReminderDates(dueDate: Date): Date[] {
  const now = new Date();
  const days = differenceInDays(dueDate, now);
  const dates: Date[] = [];

  const addDaysBefore = (n: number) => {
    const d = new Date(dueDate);
    d.setDate(d.getDate() - n);
    d.setHours(9, 0, 0, 0); // 9 AM reminder
    if (d > now) dates.push(d);
  };

  if (days > 30)       { addDaysBefore(21); addDaysBefore(14); addDaysBefore(7); addDaysBefore(3); addDaysBefore(1); }
  else if (days > 14)  { addDaysBefore(14); addDaysBefore(7); addDaysBefore(3); addDaysBefore(1); }
  else if (days > 7)   { addDaysBefore(7); addDaysBefore(3); addDaysBefore(1); }
  else if (days > 3)   { addDaysBefore(3); addDaysBefore(2); addDaysBefore(1); }
  else                 { addDaysBefore(2); addDaysBefore(1); addDaysBefore(0); }

  return dates;
}

// Auto-assign priority based on deadline distance
export function suggestPriority(dueDate: Date): TaskPriority {
  const days = differenceInDays(dueDate, new Date());
  if (days <= 7)  return 'high';
  if (days <= 21) return 'medium';
  return 'low';
}

// Check which task reminders are due right now (within a 2-minute window).
// Deduplicates via in-memory Set so each reminder fires once per session.
export async function checkTaskReminders(): Promise<Array<{ title: string; dueDate: Date }>> {
  const now = new Date();
  const WINDOW_MS = 2 * 60 * 1000; // 2-minute window to catch reminders between checks
  const tasks = await getPendingTasks();
  const due: Array<{ title: string; dueDate: Date }> = [];

  for (const task of tasks) {
    for (const rd of computeReminderDates(task.dueDate)) {
      const key = `${task.id}:${rd.toISOString()}`;
      const msSince = now.getTime() - rd.getTime();
      if (!notifiedTaskReminders.has(key) && msSince >= 0 && msSince < WINDOW_MS) {
        notifiedTaskReminders.add(key);
        due.push({ title: task.title, dueDate: task.dueDate });
      }
    }
  }
  return due;
}
