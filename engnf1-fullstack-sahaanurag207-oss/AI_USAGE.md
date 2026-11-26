# AI_USAGE.md

## AI Tools Used
- **Gemini:** Used for scaffolding Express route/controller structure, MySQL 8 InnoDB `FOR UPDATE` transaction logic, and Tailwind CSS layout composition.

## Verification & Manual Override Example
- **AI Suggestion:** Initially suggested relying only on an application-level `SELECT` before `INSERT` inside MySQL's default `REPEATABLE READ` isolation level.
- **Override & Fix:** Under MySQL `REPEATABLE READ`, plain `SELECT` queries use non-locking consistent snapshots, meaning two simultaneous transactions both read zero overlapping rows and both succeed in inserting conflicting bookings. I overrode this by locking the parent `resources` and `users` rows with `SELECT ... FOR UPDATE` inside `backend/src/service/bookingService.js` so concurrent booking transactions serialize on the target resource.
