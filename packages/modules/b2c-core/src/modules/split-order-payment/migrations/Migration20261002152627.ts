import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Append-only business identities. Deliberately not a soft-deleted Medusa model. */
export class Migration20261002152627 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE "refund_settlement" (
      "operation_id" text NOT NULL,
      "order_id" text NOT NULL,
      "scope_id" text NOT NULL,
      "fingerprint" text NOT NULL,
      "plan" jsonb NOT NULL,
      "phase" text NOT NULL DEFAULT 'pending',
      "reversal_receipt_id" text NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "refund_settlement_pkey" PRIMARY KEY ("operation_id"),
      CONSTRAINT "refund_settlement_identity_check" CHECK (
        length(operation_id) BETWEEN 1 AND 255 AND operation_id = btrim(operation_id) AND
        length(order_id) BETWEEN 1 AND 255 AND order_id = btrim(order_id) AND
        length(scope_id) BETWEEN 1 AND 255 AND scope_id = btrim(scope_id) AND
        length(fingerprint) BETWEEN 1 AND 4096 AND fingerprint = btrim(fingerprint)
      ),
      CONSTRAINT "refund_settlement_phase_check" CHECK (phase IN (
        'pending', 'refund_started', 'refund_completed', 'reversal_started', 'completed'
      )),
      CONSTRAINT "refund_settlement_receipt_check" CHECK (
        reversal_receipt_id IS NULL OR (phase = 'completed' AND
          length(reversal_receipt_id) BETWEEN 1 AND 255 AND reversal_receipt_id = btrim(reversal_receipt_id))
      ),
      CONSTRAINT "refund_settlement_plan_check" CHECK (COALESCE(
        jsonb_typeof(plan) = 'object' AND
        plan->>'operation_id' = operation_id AND plan->>'order_id' = order_id AND plan->>'scope_id' = scope_id AND
        jsonb_typeof(plan->'payment_id') IN ('string', 'null') AND
        jsonb_typeof(plan->'split_order_payment_id') IN ('string', 'null') AND
        jsonb_typeof(plan->'payout_id') IN ('string', 'null') AND
        (plan->>'currency_code') ~ '^[a-z]{3}$' AND
        jsonb_typeof(plan->'customerRefund') = 'number' AND
        jsonb_typeof(plan->'sellerReversal') = 'number' AND
        (plan->>'customerRefund')::numeric BETWEEN 0 AND 9007199254740991 AND
        (plan->>'sellerReversal')::numeric BETWEEN 0 AND 9007199254740991 AND
        ((plan->>'customerRefund')::numeric = 0 OR length(plan->>'payment_id') > 0) AND
        ((plan->>'sellerReversal')::numeric = 0 OR length(plan->>'payout_id') > 0), false
      ))
    );`)
    // Defense in depth for a writer that accidentally omits the application scope lock.
    this.addSql(`CREATE UNIQUE INDEX "refund_settlement_unfinished_scope" ON "refund_settlement" (scope_id)
      WHERE phase <> 'completed';`)
    this.addSql(`CREATE FUNCTION refund_settlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Settlement identities cannot be deleted';
        END IF;
        IF TG_OP = 'INSERT' THEN
          IF NEW.phase <> 'pending' OR NEW.reversal_receipt_id IS NOT NULL THEN
            RAISE EXCEPTION 'Settlement must start pending';
          END IF;
          RETURN NEW;
        END IF;
        IF NEW.operation_id IS DISTINCT FROM OLD.operation_id OR
           NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
           NEW.fingerprint IS DISTINCT FROM OLD.fingerprint OR NEW.plan IS DISTINCT FROM OLD.plan OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'Settlement snapshot is immutable';
        END IF;
        IF NOT (
          (OLD.phase = 'pending' AND NEW.phase = 'refund_started' AND (OLD.plan->>'customerRefund')::numeric > 0) OR
          (OLD.phase = 'pending' AND NEW.phase = 'refund_completed' AND (OLD.plan->>'customerRefund')::numeric = 0) OR
          (OLD.phase = 'refund_started' AND NEW.phase = 'refund_completed') OR
          (OLD.phase = 'refund_completed' AND NEW.phase = 'reversal_started' AND (OLD.plan->>'sellerReversal')::numeric > 0) OR
          (OLD.phase = 'refund_completed' AND NEW.phase = 'completed' AND (OLD.plan->>'sellerReversal')::numeric = 0) OR
          (OLD.phase = 'reversal_started' AND NEW.phase = 'completed')
        ) THEN
          RAISE EXCEPTION 'Invalid settlement phase transition';
        END IF;
        IF NEW.reversal_receipt_id IS DISTINCT FROM OLD.reversal_receipt_id AND NOT (
          OLD.phase = 'reversal_started' AND NEW.phase = 'completed' AND OLD.reversal_receipt_id IS NULL
        ) THEN
          RAISE EXCEPTION 'Settlement receipt is immutable';
        END IF;
        RETURN NEW;
      END;
    $$;`)
    this.addSql(`CREATE TRIGGER refund_settlement_guard_trigger BEFORE INSERT OR UPDATE OR DELETE
      ON refund_settlement FOR EACH ROW EXECUTE FUNCTION refund_settlement_guard();`)
  }

  override async down(): Promise<void> {
    // Destructive rollback is an explicit operator action, never part of settlement execution.
    this.addSql(`DROP TABLE IF EXISTS "refund_settlement" CASCADE;`)
    this.addSql(`DROP FUNCTION IF EXISTS refund_settlement_guard();`)
  }
}
