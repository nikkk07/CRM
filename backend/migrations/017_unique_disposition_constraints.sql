-- Add unique constraints to prevent duplicate lead entries in disposition tables
-- A lead should only appear once in each table

ALTER TABLE interested ADD CONSTRAINT unique_interested_lead UNIQUE (lead_id);
ALTER TABLE not_interested ADD CONSTRAINT unique_not_interested_lead UNIQUE (lead_id);
ALTER TABLE not_reachable ADD CONSTRAINT unique_not_reachable_lead UNIQUE (lead_id);
ALTER TABLE callback ADD CONSTRAINT unique_callback_lead UNIQUE (lead_id);
