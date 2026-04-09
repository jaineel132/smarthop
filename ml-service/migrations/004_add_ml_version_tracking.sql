-- Phase 4: Add ml_version column to ride_groups for attribution and observability
-- Tracks which ML service version (v1 or v2) was used for this ride group

ALTER TABLE ride_groups ADD COLUMN IF NOT EXISTS ml_version VARCHAR(10) DEFAULT 'v1' CHECK (ml_version IN ('v1', 'v2'));

-- Add index for future analysis/filtering by ml_version
CREATE INDEX IF NOT EXISTS idx_ride_groups_ml_version ON ride_groups(ml_version);

-- Add comment for clarity
COMMENT ON COLUMN ride_groups.ml_version IS 'ML service version used for this ride group (v1=legacy, v2=canonical contract). Set at group creation time for audit trail.';
