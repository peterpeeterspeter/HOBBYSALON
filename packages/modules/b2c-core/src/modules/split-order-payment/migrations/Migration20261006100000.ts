import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** SOURCE CANDIDATE ONLY. Reserve distinct NO-EFFECT semantics, never refund success.
 * This is intentionally NOT an executable closure migration: there is no retained
 * pre-dispatch boundary or independently authenticated inventory/fence/approval
 * verifier. Receipt issuance and the phase transition remain unconditionally denied.
 * Existing phase guards/index remain intact (NO-EFFECT still blocks the whole scope).
 * A later reviewed protocol must atomically derive actual before/after audit under
 * cart -> scope ownership; merely inserting these reserved columns is NOT authority.
 */
export class Migration20261006100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='refund_settlement'::regclass
        AND tgname='refund_settlement_guard_trigger' AND tgenabled IN ('O','A')) OR
         NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='commerce_refund_dispatch'::regclass
        AND tgname='commerce_refund_dispatch_guard_trigger' AND tgenabled IN ('O','A')) THEN
        RAISE EXCEPTION 'No-effect candidate requires existing enabled quarantine guards';
      END IF;
    END $$;`)
    this.addSql(`ALTER TABLE refund_settlement ADD COLUMN no_effect_receipt_id text NULL;
      ALTER TABLE refund_settlement DROP CONSTRAINT refund_settlement_phase_check;
      ALTER TABLE refund_settlement ADD CONSTRAINT refund_settlement_phase_check CHECK
        (phase IN ('pending','refund_started','refund_completed','reversal_started','completed','refund_no_effect'));
      ALTER TABLE refund_settlement ADD CONSTRAINT refund_settlement_no_effect_marker CHECK
        (no_effect_receipt_id IS NULL OR (phase='refund_no_effect' AND reversal_receipt_id IS NULL));`)
    // Reserved immutable evidence/audit shape, NOT caller-issued proof. No existing
    // settlement is migrated/closed, no accounting or provider row is synthesized.
    this.addSql(`CREATE TABLE refund_no_effect_closure (
      receipt_id text PRIMARY KEY,
      operation_id text NOT NULL UNIQUE REFERENCES refund_settlement(operation_id),
      scope_id text NOT NULL,
      protocol text NOT NULL CHECK (protocol='refund-no-effect/v1-candidate-disabled'),
      terminal_phase text NOT NULL CHECK (terminal_phase='refund_no_effect'),
      terminal_result text NOT NULL CHECK (terminal_result='NO-EFFECT'),
      financial_obligation text NOT NULL CHECK (financial_obligation='unchanged_unresolved'),
      immutable_input jsonb NOT NULL CHECK (jsonb_typeof(immutable_input)='object'),
      immutable_plan jsonb NOT NULL CHECK (jsonb_typeof(immutable_plan)='object'),
      provider_inventory jsonb NOT NULL CHECK (jsonb_typeof(provider_inventory)='object'),
      retained_predispatch_boundary jsonb NOT NULL CHECK (jsonb_typeof(retained_predispatch_boundary)='object'),
      writer_fence jsonb NOT NULL CHECK (jsonb_typeof(writer_fence)='object'),
      operator_authorization jsonb NOT NULL CHECK (jsonb_typeof(operator_authorization)='object'),
      actual_before jsonb NOT NULL CHECK (jsonb_typeof(actual_before)='object'),
      actual_after jsonb NOT NULL CHECK (jsonb_typeof(actual_after)='object'),
      audit_sha256 text NOT NULL CHECK (audit_sha256 ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE refund_settlement ADD CONSTRAINT refund_settlement_no_effect_receipt_fk
      FOREIGN KEY (no_effect_receipt_id) REFERENCES refund_no_effect_closure(receipt_id);
    REVOKE ALL ON refund_no_effect_closure FROM PUBLIC;`)
    this.addSql(`CREATE FUNCTION refund_no_effect_candidate_deny() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'NO-EFFECT closure protocol unavailable; reconciliation required';
      END;
    $$;
    CREATE TRIGGER refund_no_effect_closure_sealed
      BEFORE INSERT OR UPDATE OR DELETE ON refund_no_effect_closure
      FOR EACH STATEMENT EXECUTE FUNCTION refund_no_effect_candidate_deny();
    CREATE TRIGGER refund_no_effect_closure_no_truncate
      BEFORE TRUNCATE ON refund_no_effect_closure
      FOR EACH STATEMENT EXECUTE FUNCTION refund_no_effect_candidate_deny();
    ALTER TABLE refund_no_effect_closure ENABLE ALWAYS TRIGGER refund_no_effect_closure_sealed;
    ALTER TABLE refund_no_effect_closure ENABLE ALWAYS TRIGGER refund_no_effect_closure_no_truncate;`)
    this.addSql(`CREATE FUNCTION refund_settlement_no_effect_candidate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN
          RAISE EXCEPTION 'Settlement identity is append-only; reconciliation required';
        END IF;
        IF NEW.phase='refund_no_effect' OR NEW.no_effect_receipt_id IS NOT NULL THEN
          RAISE EXCEPTION 'NO-EFFECT closure protocol unavailable; reconciliation required';
        END IF;
        IF TG_OP='UPDATE' THEN
          IF OLD.phase='refund_no_effect' OR OLD.no_effect_receipt_id IS NOT NULL THEN
            RAISE EXCEPTION 'NO-EFFECT terminal identity is immutable; reconciliation required';
          END IF;
        END IF;
        RETURN NEW;
      END;
    $$;
    CREATE TRIGGER refund_settlement_no_effect_candidate_trigger
      BEFORE INSERT OR UPDATE OR DELETE ON refund_settlement
      FOR EACH ROW EXECUTE FUNCTION refund_settlement_no_effect_candidate_guard();
    CREATE TRIGGER refund_settlement_no_truncate
      BEFORE TRUNCATE ON refund_settlement
      FOR EACH STATEMENT EXECUTE FUNCTION refund_no_effect_candidate_deny();
    ALTER TABLE refund_settlement ENABLE ALWAYS TRIGGER refund_settlement_no_effect_candidate_trigger;
    ALTER TABLE refund_settlement ENABLE ALWAYS TRIGGER refund_settlement_no_truncate;`)
  }

  override async down(): Promise<void> {
    throw new Error('NO-EFFECT protocol is append-only; destructive rollback is forbidden')
  }
}
