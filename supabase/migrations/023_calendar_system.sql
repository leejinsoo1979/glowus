-- Calendar System Schema
-- Sophisticated calendar with events, reminders, and team integration

-- Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  location_type TEXT CHECK (location_type IN ('in_person', 'online', 'hybrid')),
  meeting_url TEXT,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Asia/Seoul',

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- RRULE format (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  recurrence_end_date DATE,
  parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Appearance
  color TEXT DEFAULT 'blue',
  icon TEXT,

  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('tentative', 'confirmed', 'cancelled')),
  visibility TEXT DEFAULT 'default' CHECK (visibility IN ('public', 'private', 'default')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Attendees
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, -- For external attendees
  name TEXT,

  -- Response
  response_status TEXT DEFAULT 'needs_action' CHECK (response_status IN ('needs_action', 'accepted', 'declined', 'tentative')),
  is_organizer BOOLEAN DEFAULT false,
  is_optional BOOLEAN DEFAULT false,

  -- Notification preferences
  notify_before_minutes INTEGER DEFAULT 30,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, user_id),
  UNIQUE(event_id, email)
);

-- Event Reminders
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reminder settings
  minutes_before INTEGER NOT NULL DEFAULT 30,
  method TEXT DEFAULT 'notification' CHECK (method IN ('notification', 'email', 'sms')),

  -- Status
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Calendar Settings
CREATE TABLE IF NOT EXISTS calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- View preferences
  default_view TEXT DEFAULT 'month' CHECK (default_view IN ('day', 'week', 'month', 'agenda')),
  week_starts_on INTEGER DEFAULT 0 CHECK (week_starts_on >= 0 AND week_starts_on <= 6), -- 0 = Sunday
  show_weekends BOOLEAN DEFAULT true,
  show_declined_events BOOLEAN DEFAULT false,

  -- Working hours
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '18:00',
  working_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 1-5 = Mon-Fri

  -- Notifications
  default_reminder_minutes INTEGER DEFAULT 30,
  email_notifications BOOLEAN DEFAULT true,

  -- Display
  time_format TEXT DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
  date_format TEXT DEFAULT 'YYYY-MM-DD',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Categories/Labels
CREATE TABLE IF NOT EXISTS calendar_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  icon TEXT,
  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Event Categories Junction
CREATE TABLE IF NOT EXISTS event_categories (
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES calendar_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, category_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_team ON calendar_events(team_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events(start_time, end_time)
  WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_pending ON event_reminders(event_id, sent)
  WHERE sent = false;

-- RLS Policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Calendar Events: Users can see their own events and events they're invited to
CREATE POLICY "Users can view own events"
  ON calendar_events FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM event_attendees
      WHERE event_attendees.event_id = calendar_events.id
      AND event_attendees.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Event Attendees: Users can see attendees of events they have access to
CREATE POLICY "Users can view event attendees"
  ON event_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_attendees.event_id
      AND (
        calendar_events.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM event_attendees ea2
          WHERE ea2.event_id = calendar_events.id
          AND ea2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Event owners can manage attendees"
  ON event_attendees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_attendees.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own attendance"
  ON event_attendees FOR UPDATE
  USING (auth.uid() = user_id);

-- Event Reminders: Users can only manage their own reminders
CREATE POLICY "Users can manage own reminders"
  ON event_reminders FOR ALL
  USING (auth.uid() = user_id);

-- Calendar Settings: Users can only access their own settings
CREATE POLICY "Users can manage own settings"
  ON calendar_settings FOR ALL
  USING (auth.uid() = user_id);

-- Calendar Categories: Users can see their own and team categories
CREATE POLICY "Users can view own categories"
  ON calendar_categories FOR SELECT
  USING (
    auth.uid() = user_id OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = calendar_categories.team_id
      AND team_members.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage own categories"
  ON calendar_categories FOR ALL
  USING (auth.uid() = user_id);

-- Event Categories: Based on event access
CREATE POLICY "Users can manage event categories"
  ON event_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_events.id = event_categories.event_id
      AND calendar_events.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_event_attendees_updated_at
  BEFORE UPDATE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_calendar_settings_updated_at
  BEFORE UPDATE ON calendar_settings
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

-- Insert default categories
INSERT INTO calendar_categories (user_id, name, color, icon, is_default)
SELECT id, '회의', 'blue', 'users', true FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO calendar_categories (user_id, name, color, icon, is_default)
SELECT id, '업무', 'green', 'briefcase', true FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO calendar_categories (user_id, name, color, icon, is_default)
SELECT id, '개인', 'purple', 'user', true FROM auth.users
ON CONFLICT DO NOTHING;
