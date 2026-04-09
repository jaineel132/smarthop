-- SmartHop hotfix
-- Fix demand_level datatype mismatch after rebuild.
-- Run this once in Supabase SQL Editor if you already executed Phase 1 schema.

ALTER TABLE public.ride_requests
  ALTER COLUMN demand_level TYPE numeric(4, 2)
  USING demand_level::numeric;
