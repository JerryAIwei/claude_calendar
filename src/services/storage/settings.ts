import { db } from './db';
import type { UserSettings } from '../../types';

const SETTINGS_ID = 'user-settings';

export const defaultSettings: UserSettings = {
  defaultView: 'month',
  defaultEventDuration: 60,
  workingHours: {
    start: '09:00',
    end: '17:00',
  },
  weekStartsOn: 0,
  darkMode: false,
  notificationsEnabled: true,
  defaultReminders: [15, 60], // 15 minutes and 1 hour before
};

// Get user settings
export async function getSettings(): Promise<UserSettings> {
  const stored = await db.settings.get(SETTINGS_ID);
  if (!stored) {
    // Initialize with defaults
    await db.settings.add({ id: SETTINGS_ID, ...defaultSettings });
    return defaultSettings;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...settings } = stored;
  return settings;
}

// Update settings
export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await db.settings.put({ id: SETTINGS_ID, ...updated });
  return updated;
}

// Get API key
export async function getApiKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return settings.apiKey;
}

// Set API key
export async function setApiKey(apiKey: string): Promise<void> {
  await updateSettings({ apiKey });
}

// Clear API key
export async function clearApiKey(): Promise<void> {
  await updateSettings({ apiKey: undefined });
}

// Toggle dark mode
export async function toggleDarkMode(): Promise<boolean> {
  const settings = await getSettings();
  const newDarkMode = !settings.darkMode;
  await updateSettings({ darkMode: newDarkMode });
  return newDarkMode;
}

// Reset to defaults
export async function resetSettings(): Promise<UserSettings> {
  await db.settings.put({ id: SETTINGS_ID, ...defaultSettings });
  return defaultSettings;
}
