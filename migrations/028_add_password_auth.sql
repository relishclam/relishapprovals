-- =====================================================
-- Migration 028: Password Authentication & WebAuthn
-- =====================================================
-- Adds server-side password login and per-device passkey
-- (WebAuthn / biometric) registration for the app.
-- All existing users will be required to set a password
-- on their next login (password_hash IS NULL until then).

-- Add password fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at  TIMESTAMPTZ;

-- Per-device WebAuthn (passkey) credentials
-- One row per registered device per user.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id    TEXT         NOT NULL UNIQUE,   -- base64url encoded credential ID
  public_key_json  TEXT         NOT NULL,           -- JSON: { id, publicKey(base64), counter, transports }
  sign_count       BIGINT       NOT NULL DEFAULT 0, -- replay-attack counter
  device_name      TEXT,                             -- user-visible label, e.g. "iPhone 15"
  transports       TEXT[],                           -- ['internal','hybrid',...]
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_creds_user_id ON webauthn_credentials(user_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON webauthn_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Temporary WebAuthn challenge storage (serverless-compatible)
-- Challenges expire in 5 minutes; use expires_at for TTL filtering.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge   TEXT         NOT NULL,
  type        TEXT         NOT NULL,  -- 'registration' | 'authentication'
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON webauthn_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
