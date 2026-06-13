-- SUPABASE DATABASE MIGRATION SCRIPT
-- Destination: Supabase SQL Editor
-- Target Table: tasks
-- Task: Add columns for progressing chronology logs and co-technician partners

-- 1. ADD 'history' COLUMN WITH TYPE jsonb, SYSTEM DEFAULT '[]'::jsonb, ALLOW NULL
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb NULL;

-- 2. ADD 'co_technicians' COLUMN WITH TYPE text, ALLOW NULL
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS co_technicians text NULL;

-- 3. RESET/RELOAD POSTGREST SCHEMA CACHE TO RESOLVE PGRST204 ERROR IMMEDIATELY
-- This tells Supabase to reload its REST endpoint cache so it knows new columns exist.
NOTIFY pgrst, 'reload schema';

-- 4. FILL NULL/EMPTY VALUES WITH DEFAULTS FOR EXISTENT ROWS
UPDATE tasks 
SET history = '[]'::jsonb 
WHERE history IS NULL;

