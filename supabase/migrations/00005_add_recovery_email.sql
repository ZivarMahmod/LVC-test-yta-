-- Migration 00005: Add recovery_email to organization_members
-- Purpose: Store alternate email for password reset

ALTER TABLE kvittra.organization_members
ADD COLUMN recovery_email text;

CREATE INDEX idx_org_members_recovery_email ON kvittra.organization_members(recovery_email);

COMMENT ON COLUMN kvittra.organization_members.recovery_email IS
'Alternate email for password recovery — can differ from auth.users.email (login email)';
