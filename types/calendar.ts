// Calendar System Types

export type CalendarView = 'day' | 'week' | 'month' | 'agenda'
export type EventStatus = 'tentative' | 'confirmed' | 'cancelled'
export type EventVisibility = 'public' | 'private' | 'default'
export type LocationType = 'in_person' | 'online' | 'hybrid'
export type ResponseStatus = 'needs_action' | 'accepted' | 'declined' | 'tentative'
export type ReminderMethod = 'notification' | 'email' | 'sms'

export type EventColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'pink'
  | 'cyan'
  | 'indigo'
  | 'teal'

export interface CalendarEvent {
  id: string
  user_id: string
  team_id?: string
  project_id?: string

  // Event details
  title: string
  description?: string
  location?: string
  location_type?: LocationType
  meeting_url?: string

  // Timing
  start_time: string
  end_time: string
  all_day: boolean
  timezone: string

  // Recurrence
  is_recurring: boolean
  recurrence_rule?: string
  recurrence_end_date?: string
  parent_event_id?: string

  // Appearance
  color: EventColor
  icon?: string

  // Status
  status: EventStatus
  visibility: EventVisibility

  // Relations (populated)
  attendees?: EventAttendee[]
  categories?: CalendarCategory[]
  reminders?: EventReminder[]

  created_at: string
  updated_at: string
}

export interface EventAttendee {
  id: string
  event_id: string
  user_id?: string
  email?: string
  name?: string

  response_status: ResponseStatus
  is_organizer: boolean
  is_optional: boolean
  notify_before_minutes: number

  // Populated user data
  user?: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }

  created_at: string
  updated_at: string
}

export interface EventReminder {
  id: string
  event_id: string
  user_id: string

  minutes_before: number
  method: ReminderMethod

  sent: boolean
  sent_at?: string

  created_at: string
}

export interface CalendarSettings {
  id: string
  user_id: string

  default_view: CalendarView
  week_starts_on: number // 0-6 (Sun-Sat)
  show_weekends: boolean
  show_declined_events: boolean

  working_hours_start: string // HH:mm
  working_hours_end: string
  working_days: number[] // 0-6

  default_reminder_minutes: number
  email_notifications: boolean

  time_format: '12h' | '24h'
  date_format: string

  created_at: string
  updated_at: string
}

export interface CalendarCategory {
  id: string
  user_id: string
  team_id?: string

  name: string
  color: EventColor
  icon?: string
  is_default: boolean

  created_at: string
}

// Form types
export interface CreateEventData {
  title: string
  description?: string
  location?: string
  location_type?: LocationType
  meeting_url?: string

  start_time: string
  end_time: string
  all_day?: boolean
  timezone?: string

  is_recurring?: boolean
  recurrence_rule?: string
  recurrence_end_date?: string

  color?: EventColor
  status?: EventStatus
  visibility?: EventVisibility

  team_id?: string
  project_id?: string

  attendee_emails?: string[]
  category_ids?: string[]
  reminder_minutes?: number[]
}

export interface UpdateEventData extends Partial<CreateEventData> {
  id: string
}

// Query types
export interface CalendarQueryParams {
  start_date: string
  end_date: string
  team_id?: string
  project_id?: string
  category_id?: string
  include_cancelled?: boolean
}

// Calendar grid helpers
export interface CalendarDay {
  date: Date
  dateString: string
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  events: CalendarEvent[]
}

export interface CalendarWeek {
  weekNumber: number
  days: CalendarDay[]
}

// Event positioning for UI
export interface PositionedEvent extends CalendarEvent {
  top: number
  height: number
  left: number
  width: number
  column: number
  totalColumns: number
}

// Drag and drop types
export interface EventDragData {
  event: CalendarEvent
  originalStart: Date
  originalEnd: Date
}

export interface EventResizeData {
  event: CalendarEvent
  edge: 'start' | 'end'
  originalTime: Date
}

// Color configurations
export const EVENT_COLORS: Record<EventColor, {
  bg: string
  bgLight: string
  text: string
  border: string
  dot: string
}> = {
  blue: {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500',
    dot: 'bg-blue-500',
  },
  green: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-500',
    dot: 'bg-green-500',
  },
  purple: {
    bg: 'bg-purple-500',
    bgLight: 'bg-purple-100 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500',
    dot: 'bg-purple-500',
  },
  red: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-500',
    dot: 'bg-red-500',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500',
    dot: 'bg-orange-500',
  },
  yellow: {
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-500',
    dot: 'bg-yellow-500',
  },
  pink: {
    bg: 'bg-pink-500',
    bgLight: 'bg-pink-100 dark:bg-pink-500/20',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-500',
    dot: 'bg-pink-500',
  },
  cyan: {
    bg: 'bg-cyan-500',
    bgLight: 'bg-cyan-100 dark:bg-cyan-500/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-500',
    dot: 'bg-cyan-500',
  },
  indigo: {
    bg: 'bg-indigo-500',
    bgLight: 'bg-indigo-100 dark:bg-indigo-500/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500',
    dot: 'bg-indigo-500',
  },
  teal: {
    bg: 'bg-teal-500',
    bgLight: 'bg-teal-100 dark:bg-teal-500/20',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500',
    dot: 'bg-teal-500',
  },
}

// Recurrence helpers
export const RECURRENCE_OPTIONS = [
  { value: '', label: '반복 안함' },
  { value: 'FREQ=DAILY', label: '매일' },
  { value: 'FREQ=WEEKLY', label: '매주' },
  { value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: '매주 평일' },
  { value: 'FREQ=MONTHLY', label: '매월' },
  { value: 'FREQ=YEARLY', label: '매년' },
]

// Time slot helpers
export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0')
  return [
    { value: `${hour}:00`, label: `${hour}:00` },
    { value: `${hour}:30`, label: `${hour}:30` },
  ]
}).flat()

// Duration options
export const DURATION_OPTIONS = [
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 45, label: '45분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
  { value: 240, label: '4시간' },
  { value: 480, label: '8시간' },
]

// Reminder options
export const REMINDER_OPTIONS = [
  { value: 0, label: '시작 시간' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 120, label: '2시간 전' },
  { value: 1440, label: '1일 전' },
  { value: 2880, label: '2일 전' },
  { value: 10080, label: '1주일 전' },
]
