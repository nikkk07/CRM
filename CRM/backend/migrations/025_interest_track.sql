-- Split Interested leads by course track (CPL / PPL / Flying) in the CRM.
-- New nullable column; does NOT reuse course_interest (original inquiry course stays intact).
ALTER TABLE lead ADD COLUMN IF NOT EXISTS interest_track TEXT;
