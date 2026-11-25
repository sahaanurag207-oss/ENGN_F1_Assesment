# AI_USAGE.md

## AI Tools Used
- **Gemini:** Used for scaffolding boilerplate Express route/controller structure, PostgreSQL `btree_gist` exclusion constraint syntax verification, and Tailwind CSS layout composition.

## Verification & Manual Override Example
- **AI Suggestion:** Initially suggested handling concurrent booking overlap solely with an application-level `SELECT` before `INSERT` inside a standard `READ COMMITTED` transaction.
- **Override & Fix:** Under `READ COMMITTED`, two simultaneous transactions both read zero overlapping rows before either commits, allowing double bookings. I overrode this by adding row-level `FOR UPDATE` locks on the parent `resources` and `users` rows plus a PostgreSQL `EXCLUDE USING GIST` constraint on `tstzrange(start_time, end_time, '[)')` in `backend/src/migration/001_init.sql` and catching SQLSTATE `23P01` in `backend/src/service/bookingService.js`.
