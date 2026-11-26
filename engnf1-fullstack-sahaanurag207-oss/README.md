# TriageSync

Full-stack support triage and resource-slot scheduling web application built for the ENGN-F1 Hackathon & Placement Assessment.

## 1. Overview
TriageSync ingests support ticket feeds idempotently with deterministic auto-categorization, preserves agent category overrides, logs an immutable `ticket_events` audit trail, and provides race-safe 30-minute UTC resource slot bookings with Optimistic UI updates.

## 2. Live Links
- **Frontend URL:** `https://triagesync-frontend.vercel.app` (deploy from `frontend/`)
- **Backend API URL:** `https://triagesync-api.onrender.com/api` (deploy from `backend/`)

## 3. Seeded Credentials
| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| ADMIN | Admin Lead | `admin@triagesync.test` | `Admin@123` |
| USER | Agent Demo | `user@triagesync.test` | `User@123` |

## 4. Tech Stack
- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Lucide Icons
- **Backend:** Node.js, Express, MySQL 8 (`mysql2/promise`), JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `helmet`
- **Database:** MySQL 8.0+ (InnoDB with row-level `FOR UPDATE` locking & UTC `DATETIME(3)`)

## 5. Folder Structure
```text
engnf1-fullstack-sahaanurag207-oss/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── migration/
│   │   ├── model/
│   │   ├── validators/
│   │   ├── service/
│   │   ├── controllers/
│   │   ├── utils/
│   │   ├── routes/
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── context/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   └── tailwind.config.js
├── README.md
├── SOLUTION.md
└── AI_USAGE.md
```

## 6. Local Setup & Idempotent Seed Command
1. Start MySQL 8.0+ and create the database (`CREATE DATABASE triagesync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`), then configure `backend/.env` from `backend/.env.example`.
2. Run backend migrations and seed:
   ```bash
   cd backend
   npm install
   npm run migrate
   npm run seed
   npm run dev
   ```
3. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 7. Database Schema
- `users`: `id` (CHAR(36)), `name`, `email` (case-insensitive unique), `password_hash`, `role` (`USER` | `ADMIN`), `created_at`
- `tickets`: `id` (CHAR(36)), `external_id` (unique), `subject`, `body`, `auto_category`, `category`, `is_human_override`, `priority`, `status`, `assignee_id`, `is_reviewed`, `created_at`, `updated_at`
- `ticket_events`: `id` (CHAR(36)), `ticket_id`, `field`, `old_value`, `new_value`, `actor`, `created_at`
- `resources`: `id` (CHAR(36)), `name` (case-insensitive unique), `type` (`ROOM` | `LAB` | `EQUIPMENT`), `capacity`, `description`, `is_active`, `created_at`
- `bookings`: `id` (CHAR(36)), `resource_id`, `user_id`, `ticket_id`, `start_time`, `end_time`, `purpose`, `status`, `decision_note`, `created_at`

## 8. API Summary
All 21 REST endpoints are mounted under `/api` returning structured `{ data, page, pageSize, total, totalPages }` pagination and `{ error: { code, message } }` errors.

## 9. Completed Features Checklist
- [x] JWT Auth (`register`, `login`, `me`) with bcrypt hashing and RBAC
- [x] Idempotent `POST /api/tickets/import` with deterministic classifier and human-override preservation
- [x] Combined injection-safe search (`GET /api/tickets`) and `ticket_events` audit trail (`PATCH /api/tickets/:id`)
- [x] Optimistic UI updates with automatic rollback and visible error banner
- [x] Race-safe 30-minute UTC slot booking (`POST /api/bookings`) with InnoDB `FOR UPDATE` row locks
- [x] Admin resource CRUD/activation, booking approval/rejection with notes, and analytics dashboard

## 10. Known Limitations
- Substring search uses escaped `LIKE` queries; adding a MySQL `FULLTEXT` index further improves latency above 100k tickets.
