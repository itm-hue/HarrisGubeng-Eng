-- SUPABASE DATABASE MIGRATION SCRIPT
-- Destination: Supabase SQL Editor
-- Target Table: tasks
-- Task: Add 'history' column for progressing chronology logs

-- 1. ADD 'history' COLUMN WITH TYPE jsonb, SYSTEM DEFAULT '[]'::jsonb, ALLOW NULL
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb NULL;

-- 2. RESET/RELOAD POSTGREST SCHEMA CACHE TO RESOLVE PGRST204 ERROR IMMEDIATELY
-- This tells Supabase to reload its REST endpoint cache so it knows 'history' now exists.
NOTIFY pgrst, 'reload schema';

-- 3. FILL NULL/EMPTY VALUES WITH DEFAULTS FOR EXISTENT ROWS
UPDATE tasks 
SET history = '[]'::jsonb 
WHERE history IS NULL;
