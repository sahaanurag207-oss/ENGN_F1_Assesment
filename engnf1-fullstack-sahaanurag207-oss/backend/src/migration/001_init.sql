CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(120) NOT NULL UNIQUE,
  subject VARCHAR(150) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  auto_category VARCHAR(30) NOT NULL CHECK (auto_category IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  is_human_override BOOLEAN NOT NULL DEFAULT FALSE,
  priority VARCHAR(15) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assignee_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_filter_idx ON tickets (status, category, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field VARCHAR(30) NOT NULL CHECK (field IN ('category', 'priority', 'status', 'assigneeId')),
  old_value TEXT NULL,
  new_value TEXT NULL,
  actor VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON ticket_events (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ROOM', 'LAB', 'EQUIPMENT')),
  capacity INT NOT NULL CHECK (capacity >= 1 AND capacity <= 500),
  description VARCHAR(300) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS resources_name_lower_idx ON resources (LOWER(name));

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id UUID NULL REFERENCES tickets(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  purpose VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_note VARCHAR(200) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_time_order CHECK (end_time > start_time),
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING GIST (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'APPROVED'))
);

CREATE INDEX IF NOT EXISTS bookings_user_status_idx ON bookings (user_id, status, start_time);
CREATE INDEX IF NOT EXISTS bookings_resource_time_idx ON bookings (resource_id, start_time, end_time);
