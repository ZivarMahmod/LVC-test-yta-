-- ===========================================
-- Kvittra — Setup PostgreSQL roles for Supabase
-- Skapar roller som PostgREST och GoTrue behöver
-- ===========================================

-- Skapa roller om de inte finns
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Ge roller åtkomst till public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Framtida tabeller i public
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Ge roller åtkomst till kvittra schema (om det finns)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'kvittra') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA kvittra TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA kvittra TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA kvittra TO anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra GRANT ALL ON TABLES TO anon, authenticated, service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA kvittra GRANT ALL ON SEQUENCES TO anon, authenticated, service_role';
  END IF;
END $$;
