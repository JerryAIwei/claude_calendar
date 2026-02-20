import { getSystemPrompt, createParseEventPrompt, createDailyPlanPrompt, createSmartSchedulingPrompt, createConflictResolutionPrompt } from './prompts';
import type { CalendarEvent, HabitPattern, AIParseResult } from '../../types';
import { getApiKey } from '../storage/settings';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Conversation history for memory
type Message = { role: 'user' | 'assistant'; content: string };
let conversationHistory: Message[] = [];

export function resetClient(): void {
  conversationHistory = [];
}

export function clearConversationHistory(): void {
  conversationHistory = [];
}

export function getConversationHistory(): Message[] {
  return [...conversationHistory];
}

async function sendMessage(prompt: string, useHistory: boolean = false): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Please add your Claude API key in Settings.');
  }

  // Build messages array
  let messages: Message[];
  if (useHistory) {
    // Add new user message to history
    conversationHistory.push({ role: 'user', content: prompt });
    messages = [...conversationHistory];
  } else {
    messages = [{ role: 'user', content: prompt }];
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: getSystemPrompt(),
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    // Remove the failed message from history
    if (useHistory) {
      conversationHistory.pop();
    }
    throw new Error(error.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0];

  if (content.type === 'text') {
    // Add assistant response to history
    if (useHistory) {
      conversationHistory.push({ role: 'assistant', content: content.text });
      // Keep history manageable (last 20 messages)
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
    }
    return content.text;
  }

  throw new Error('Unexpected response type from Claude');
}

export async function parseNaturalLanguage(input: string): Promise<AIParseResult> {
  try {
    // History is sent by sendMessage via conversationHistory — no need to embed it again
    const prompt = createParseEventPrompt(input, new Date());
    const response = await sendMessage(prompt, true); // useHistory=true sends full history

    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        events: [],
        message: 'Could not parse the response. Please try rephrasing your request.',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: parsed.success ?? false,
      events: (parsed.events || []).map((e: Record<string, unknown>) => ({
        ...e,
        start: e.start ? new Date(e.start as string) : new Date(),
        end: e.end ? new Date(e.end as string) : new Date(),
      })),
      message: parsed.message || '',
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error('Failed to parse natural language:', error);
    return {
      success: false,
      events: [],
      message: error instanceof Error ? error.message : 'Failed to process your request',
    };
  }
}

export async function getDailyPlan(
  events: CalendarEvent[],
  habits: HabitPattern[],
  date: Date
): Promise<{
  schedule: Array<{
    time: string;
    title: string;
    type: 'scheduled' | 'suggested' | 'break';
    priority: 'high' | 'medium' | 'low';
    notes?: string;
  }>;
  priorities: string[];
  summary: string;
  tips: string[];
}> {
  try {
    const prompt = createDailyPlanPrompt(events, habits, date);
    const response = await sendMessage(prompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to generate daily plan:', error);
    throw error;
  }
}

export async function getSmartSchedulingSuggestion(
  taskDescription: string,
  freeSlots: { start: Date; end: Date }[],
  habits: HabitPattern[],
  existingEvents: CalendarEvent[]
): Promise<{
  recommendation: {
    slot: { start: Date; end: Date };
    score: number;
    reason: string;
  };
  alternatives: Array<{
    slot: { start: Date; end: Date };
    score: number;
    reason: string;
  }>;
  suggestedCategory: string;
  suggestedDuration: number;
}> {
  try {
    const prompt = createSmartSchedulingPrompt(taskDescription, freeSlots, habits, existingEvents);
    const response = await sendMessage(prompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert string dates to Date objects
    return {
      recommendation: {
        slot: {
          start: new Date(parsed.recommendation.slot.start),
          end: new Date(parsed.recommendation.slot.end),
        },
        score: parsed.recommendation.score,
        reason: parsed.recommendation.reason,
      },
      alternatives: (parsed.alternatives || []).map((alt: { slot: { start: string; end: string }; score: number; reason: string }) => ({
        slot: {
          start: new Date(alt.slot.start),
          end: new Date(alt.slot.end),
        },
        score: alt.score,
        reason: alt.reason,
      })),
      suggestedCategory: parsed.suggestedCategory,
      suggestedDuration: parsed.suggestedDuration,
    };
  } catch (error) {
    console.error('Failed to get scheduling suggestion:', error);
    throw error;
  }
}

export async function getConflictResolution(
  conflictingEvents: CalendarEvent[],
  availableSlots: { start: Date; end: Date }[]
): Promise<{
  analysis: string;
  recommendations: Array<{
    action: 'move' | 'shorten' | 'cancel' | 'split';
    eventId: string;
    newTime?: { start: Date; end: Date };
    reason: string;
  }>;
  alternativeApproach?: string;
}> {
  try {
    const prompt = createConflictResolutionPrompt(conflictingEvents, availableSlots);
    const response = await sendMessage(prompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      analysis: parsed.analysis,
      recommendations: (parsed.recommendations || []).map((rec: { action: string; eventId: string; newTime?: { start: string; end: string }; reason: string }) => ({
        action: rec.action,
        eventId: rec.eventId,
        newTime: rec.newTime ? {
          start: new Date(rec.newTime.start),
          end: new Date(rec.newTime.end),
        } : undefined,
        reason: rec.reason,
      })),
      alternativeApproach: parsed.alternativeApproach,
    };
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    throw error;
  }
}

export async function chat(message: string, useHistory: boolean = true): Promise<string> {
  try {
    return await sendMessage(message, useHistory);
  } catch (error) {
    console.error('Chat failed:', error);
    throw error;
  }
}
