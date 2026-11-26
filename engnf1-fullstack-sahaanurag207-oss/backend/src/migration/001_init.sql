CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(36) PRIMARY KEY,
  external_id VARCHAR(120) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  auto_category ENUM('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY') NOT NULL,
  category ENUM('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY') NOT NULL,
  is_human_override BOOLEAN NOT NULL DEFAULT FALSE,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  assignee_id CHAR(36) NULL,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY tickets_external_id_unique (external_id),
  KEY tickets_filter_idx (status, category, priority, created_at),
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_events (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  field ENUM('category', 'priority', 'status', 'assigneeId') NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  actor VARCHAR(254) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ticket_events_ticket_idx (ticket_id, created_at),
  CONSTRAINT fk_ticket_events_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  type ENUM('ROOM', 'LAB', 'EQUIPMENT') NOT NULL,
  capacity INT NOT NULL,
  description VARCHAR(300) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY resources_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) PRIMARY KEY,
  resource_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  ticket_id CHAR(36) NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  purpose VARCHAR(200) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  decision_note VARCHAR(200) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY bookings_user_status_idx (user_id, status, start_time),
  KEY bookings_resource_time_idx (resource_id, start_time, end_time),
  CONSTRAINT fk_bookings_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
