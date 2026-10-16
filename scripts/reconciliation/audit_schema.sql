-- STAGED CANDIDATE, NOT AN EXISTING-SANDBOX MIGRATION.
-- No auto-install in native_repair. This file deliberately REFUSES existing DBs.
-- Used only after creating a fresh hs_recon_it_<uuid> disposable test database
-- and marking it with COMMENT ON DATABASE ... 'hs-reconciliation-isolated-test-v1'.
BEGIN;
DO $$
BEGIN
  IF current_database() !~ '^hs_recon_it_[a-f0-9]{32}$' OR
     (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database())
       IS DISTINCT FROM 'hs-reconciliation-isolated-test-v1' THEN
    RAISE EXCEPTION 'audit candidate installation is isolated-test-only';
  END IF;
END $$;
CREATE TABLE public.reconciliation_repair_audit (
  id text NOT NULL PRIMARY KEY,
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  case_id text NOT NULL CHECK (length(case_id) BETWEEN 1 AND 255),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 255),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object'),
  before_snapshot jsonb NOT NULL CHECK (jsonb_typeof(before_snapshot)='object'),
  after_snapshot jsonb NOT NULL CHECK (jsonb_typeof(after_snapshot)='object'),
  created_at timestamptz NOT NULL,
  CHECK (id='recon_' || plan_hash),
  CHECK ((evidence->'provider'->>'account_id' ~ '^acct_[A-Za-z0-9]{1,200}$' AND
    evidence->'provider'->>'provider_effect_id' ~ '^(ch|re)_[A-Za-z0-9]{1,200}$') IS TRUE)
);
CREATE UNIQUE INDEX reconciliation_repair_audit_effect_once ON public.reconciliation_repair_audit
  ((evidence->'provider'->>'account_id'), (evidence->'provider'->>'provider_effect_id'));
CREATE FUNCTION public.reconciliation_repair_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'reconciliation audit is immutable: update/delete/truncate forbidden';
END $$;
CREATE TRIGGER reconciliation_repair_audit_immutable
  BEFORE UPDATE OR DELETE ON public.reconciliation_repair_audit
  FOR EACH ROW EXECUTE FUNCTION public.reconciliation_repair_audit_immutable();
CREATE TRIGGER reconciliation_repair_audit_no_truncate
  BEFORE TRUNCATE ON public.reconciliation_repair_audit
  FOR EACH STATEMENT EXECUTE FUNCTION public.reconciliation_repair_audit_immutable();
COMMIT;
