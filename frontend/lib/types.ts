/**
 * TypeScript type definitions for the application
 */

// Meeting-related types
export interface Meeting {
  job_id: string;
  user_id?: number;
  created_at: string;
  raw_transcript?: string;
  final_summary: string | FinalSummary;
  user_input?: string;
  user_input_result?: string | Record<string, unknown>;
  calendar_synced?: boolean;
  events?: EventData[];
}

export interface FinalSummary {
  english?: string;
  arabic?: string;
  dated_events?: DatedEvent[];
  notes?: Note[];
  key_takeaways?: {
    english?: string;
    arabic?: string;
  };
}

export interface DatedEvent {
  date: string;
  title?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  time?: string;
}

export interface Note {
  title?: string;
  description?: string;
  date?: string;
  type?: 'task' | 'deadline' | 'note';
  priority?: 'high' | 'medium' | 'low';
}

export interface EventData {
  id: number;
  meeting_id: number;
  event_type: 'dated_events' | 'notes';
  event_data: string | DatedEvent | Note;
}

// Calendar event type (for UI)
export interface CalendarEvent {
  id: string;
  eventItemId?: number;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  attendees?: string[];
  meetingId?: string;
  type: 'meeting' | 'task' | 'deadline';
  synced?: boolean;
  calendarEventId?: string;
  isManual?: boolean;
  completed?: boolean;
  urgency?: 'yes' | 'no' | 'high' | 'medium' | 'low';
}

// User types
export interface User {
  id: number;
  email: string;
  name?: string;
  picture?: string;
  calendar_connected?: boolean;
  created_at?: string;
}

// Preset types
export interface Preset {
  id: number;
  name: string;
  config: ProcessingConfig;
  is_default: boolean;
  created_at: string;
}

export interface ProcessingConfig {
  role?: string;
  output_fields?: {
    transcript?: boolean;
    summary_english?: boolean;
    summary_arabic?: boolean;
    action_items?: boolean;
    deadlines?: boolean;
    calendar_sync?: boolean;
    budget_notes?: boolean;
    decisions?: boolean;
    general_notes?: boolean;
  };
  user_input?: string;
  custom_field_only?: boolean;
}
