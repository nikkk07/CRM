-- Migration 026: Map a raw biometric device person id to a CRM person.
--
-- The Hikvision terminal only knows its own employeeNoString (e.g. '1042').
-- This table lets Admin bind that raw id to an actual CRM employee or student
-- so attendance rows can be labelled correctly (and past rows backfilled).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS device_person_map (
    device_person_id TEXT PRIMARY KEY,     -- the raw employeeNoString, e.g. '1042'
    person_type      TEXT NOT NULL,        -- 'employee' | 'student'
    crm_person_id    UUID,                 -- employee.id or student.id
    display_name     TEXT NOT NULL,
    role             TEXT NOT NULL,        -- 'employee' | 'student'
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
