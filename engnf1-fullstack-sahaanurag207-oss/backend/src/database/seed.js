import crypto from 'crypto';
import { pool } from '../config/db.js';
import { hashPassword } from '../utils/authUtils.js';
import { classifyTicket } from '../utils/classifier.js';

const RESOURCES = [
  { name: 'War Room Alpha', type: 'ROOM', capacity: 12, description: 'Primary incident escalation room with dual 4K displays', isActive: true },
  { name: 'Customer Bridge Room B', type: 'ROOM', capacity: 6, description: 'Quiet room for live client screen-sharing sessions', isActive: true },
  { name: 'Hardware Diagnostics Lab 1', type: 'LAB', capacity: 8, description: 'ESD-safe workbench with logic analyzers and thermal cameras', isActive: true },
  { name: 'Network Packet Capture Lab', type: 'LAB', capacity: 10, description: 'Isolated VLAN rack for TLS/Wireshark reproduction', isActive: true },
  { name: 'Mobile Device Test Kit #4', type: 'EQUIPMENT', capacity: 1, description: 'iOS & Android flagship test bench', isActive: true },
  { name: 'Legacy Oscilloscope Rig (Decommissioned)', type: 'EQUIPMENT', capacity: 1, description: 'Awaiting calibration — inactive', isActive: false }
];

const TICKETS = [
  { externalId: 'EXT-1001', subject: 'Duplicate invoice charge on monthly subscription', body: 'We received an extra charge on our latest invoice. Please process a refund.', reviewed: true, overrideCat: null, status: 'IN_PROGRESS' },
  { externalId: 'EXT-1002', subject: 'Production API returning 500 exception on checkout', body: 'Urgent: production down since 04:00 UTC due to unhandled null pointer crash.', reviewed: true, overrideCat: null, status: 'IN_PROGRESS' },
  { externalId: 'EXT-1003', subject: 'Locked out of SSO after 2FA reset', body: 'Agent cannot sign in because password and 2FA token loop endlessly.', reviewed: true, overrideCat: 'BUG', status: 'RESOLVED' },
  { externalId: 'EXT-1004', subject: 'My package has not arrived yet', body: 'Tracking shows stalled shipping for 6 days on hardware token delivery.', reviewed: false },
  { externalId: 'EXT-1005', subject: 'Add CSV export to analytics dashboard', body: 'Would love a one-click CSV export for weekly leadership reports.', reviewed: false },
  { externalId: 'EXT-1006', subject: '<script>alert("XSS_TEST")</script> Broken webhook payload', body: '<img src=x onerror="document.body.innerHTML=\'HACKED\'"> Webhook throws 500 error on angle brackets.', reviewed: false },
  { externalId: 'EXT-1007', subject: 'Payment gateway timeout during annual renewal', body: 'Customer card payment failed twice while settling invoice #8831.', reviewed: false },
  { externalId: 'EXT-1008', subject: 'Password reset link expires immediately', body: 'Users trying to login report password reset tokens are already invalid.', reviewed: false },
  { externalId: 'EXT-1009', subject: 'Replacement router package damaged in transit', body: 'Courier tracking marks delivery complete but box was crushed.', reviewed: false },
  { externalId: 'EXT-1010', subject: 'Dashboard crashes when filtering 10k rows', body: 'Browser tab throws out-of-memory exception and becomes completely broken.', reviewed: false },
  { externalId: 'EXT-1011', subject: 'Support dark mode across mobile views', body: 'Requesting high-contrast dark theme for night-shift triage engineers.', reviewed: false },
  { externalId: 'EXT-1012', subject: 'Refund status for cancelled enterprise seat', body: 'Billing portal still shows pending charge after seat downgrade.', reviewed: false },
  { externalId: 'EXT-1013', subject: '2FA backup codes rejected on sign in', body: 'Locked out of primary account after switching authenticator apps.', reviewed: false },
  { externalId: 'EXT-1014', subject: 'International shipping customs invoice missing', body: 'Package held at customs because commercial shipping manifest was omitted.', reviewed: false },
  { externalId: 'EXT-1015', subject: 'Keyboard shortcuts for queue navigation', body: 'Allow J/K navigation keys to move through tickets faster.', reviewed: false }
];

async function seed() {
  const adminHash = await hashPassword('Admin@123');
  const userHash = await hashPassword('User@123');

  await pool.execute(
    `INSERT IGNORE INTO users (id, name, email, password_hash, role)
     VALUES (?, 'Admin Lead', 'admin@triagesync.test', ?, 'ADMIN')`,
    [crypto.randomUUID(), adminHash]
  );

  await pool.execute(
    `INSERT IGNORE INTO users (id, name, email, password_hash, role)
     VALUES (?, 'Agent Demo', 'user@triagesync.test', ?, 'USER')`,
    [crypto.randomUUID(), userHash]
  );

  for (const r of RESOURCES) {
    await pool.execute(
      `INSERT IGNORE INTO resources (id, name, type, capacity, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), r.name, r.type, r.capacity, r.description, r.isActive ? 1 : 0]
    );
  }

  for (const t of TICKETS) {
    const { autoCategory, priority } = classifyTicket(t.subject, t.body);
    const finalCat = t.overrideCat || autoCategory;
    const isOverride = t.overrideCat ? 1 : 0;
    const status = t.status || 'OPEN';
    const ticketId = crypto.randomUUID();

    const [res] = await pool.execute(
      `INSERT IGNORE INTO tickets (id, external_id, subject, body, auto_category, category, is_human_override, priority, status, is_reviewed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, t.externalId, t.subject, t.body, autoCategory, finalCat, isOverride, priority, status, t.reviewed ? 1 : 0]
    );

    if (res.affectedRows > 0 && t.reviewed) {
      await pool.execute(
        `INSERT INTO ticket_events (id, ticket_id, field, old_value, new_value, actor)
         VALUES (?, ?, 'status', 'OPEN', ?, 'admin@triagesync.test')`,
        [crypto.randomUUID(), ticketId, status]
      );
    }
  }

  console.log('MySQL idempotent seed completed successfully.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
