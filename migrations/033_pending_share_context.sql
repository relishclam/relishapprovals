-- Migration 033: Server-side pending share context for cross-device receipt routing.
--
-- Problem: When an Admin opens a Pay Now modal on Device A (desktop OR another phone)
-- and then shares a bank/UPI receipt from Device B (their own phone), localStorage
-- cannot bridge the gap — it is per-session, per-device.
--
-- Solution: Store the pending context in the DB so any device the user is logged
-- into can retrieve and consume it (consume-once, 15-minute TTL enforced server-side).
--
-- Covers ALL cross-device combinations:
--   Desktop Pay Now  → Admin phone shares  receipt  ✓
--   Phone A Pay Now  → Admin phone B shares receipt  ✓
--   Tablet Pay Now   → Admin phone shares  receipt  ✓

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pending_share_ctx JSONB;

COMMENT ON COLUMN public.users.pending_share_ctx IS
  'Ephemeral cross-device receipt-routing context. '
  'Shape: { type, entityId, suspenseId, expiresAt }. '
  'Consumed (cleared) on first read. Max TTL 15 min enforced in API.';
