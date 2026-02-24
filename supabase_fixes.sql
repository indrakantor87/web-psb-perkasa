-- Fix for Supabase Security Issues (RLS)
-- Run this in Supabase SQL Editor

-- 1. Enable Row Level Security (RLS) on all tables
-- This satisfies the "RLS disabled in public tables" security warning.
-- Note: The application connects via the connection string which typically bypasses RLS (postgres/service_role),
-- so this will not break the app but will prevent anonymous public access if exposed.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Priority" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsappTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Isolation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;

-- 2. Performance Optimization (Slow Queries)
-- The application searches using 'contains' (ILIKE) on customerName and pengawalan.
-- Standard B-Tree indexes are not efficient for this. We need pg_trgm and GIN indexes.

-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast text search
CREATE INDEX IF NOT EXISTS idx_ticket_customer_name_gin ON "Ticket" USING gin ("customerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_pengawalan_gin ON "Ticket" USING gin ("pengawalan" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_marketing_name_gin ON "Ticket" USING gin ("marketingName" gin_trgm_ops);

-- Re-analyze table to update statistics
ANALYZE "Ticket";
