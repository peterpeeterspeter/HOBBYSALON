import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Permanent evidence. No deletion, soft deletion, TTL, or rollback of identities. */
export class Migration20261002170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE payout_execution (
      order_id text PRIMARY KEY, scope_id text NOT NULL, plan jsonb NOT NULL,
      phase text NOT NULL CHECK (phase IN ('started', 'completed')),
      payout_id text NULL, transfer_id text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (length(order_id) BETWEEN 1 AND 255 AND order_id = btrim(order_id) AND
             length(scope_id) BETWEEN 1 AND 255 AND scope_id = btrim(scope_id)),
      CHECK (COALESCE(jsonb_typeof(plan) = 'object' AND
        (plan - ARRAY['amount','currency','account_id','account_reference_id','source_transaction','transaction_id']) = '{}'::jsonb AND
        plan->>'transaction_id' = order_id AND
        jsonb_typeof(plan->'amount') = 'number' AND (plan->>'amount')::numeric BETWEEN 0 AND 9007199254740991 AND
        (plan->>'currency') ~ '^[a-z]{3}$' AND
        length(plan->>'account_id') BETWEEN 1 AND 255 AND
        length(plan->>'account_reference_id') BETWEEN 1 AND 255 AND
        length(plan->>'source_transaction') BETWEEN 1 AND 255, false))
    );`)
    this.addSql(`ALTER TABLE payout_execution ADD CONSTRAINT payout_execution_receipt CHECK (
      (phase = 'started' AND payout_id IS NULL AND transfer_id IS NULL) OR
      (phase = 'completed' AND (
        ((plan->>'amount')::numeric = 0 AND payout_id IS NULL AND transfer_id IS NULL) OR
        ((plan->>'amount')::numeric > 0 AND payout_id IS NOT NULL AND transfer_id IS NOT NULL AND
          length(payout_id) BETWEEN 1 AND 255 AND length(transfer_id) BETWEEN 1 AND 255)
      ))
    );`)
    this.addSql(`CREATE UNIQUE INDEX payout_execution_unfinished_scope ON payout_execution(scope_id) WHERE phase = 'started';`)
    this.addSql(`CREATE UNIQUE INDEX payout_execution_payout_receipt ON payout_execution(payout_id) WHERE payout_id IS NOT NULL;`)
    this.addSql(`CREATE UNIQUE INDEX payout_execution_transfer_receipt ON payout_execution(transfer_id) WHERE transfer_id IS NOT NULL;`)
    this.addSql(`CREATE FUNCTION payout_execution_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'Payout evidence cannot be deleted'; END IF;
        IF TG_OP = 'INSERT' THEN
          IF NEW.phase <> 'started' THEN RAISE EXCEPTION 'Payout must start before dispatch'; END IF;
          RETURN NEW;
        END IF;
        IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
           NEW.plan IS DISTINCT FROM OLD.plan OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'Payout plan is immutable';
        END IF;
        IF OLD.phase <> 'started' OR NEW.phase <> 'completed' THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
        NEW.updated_at := clock_timestamp();
        RETURN NEW;
      END $$;`)
    this.addSql(`CREATE TRIGGER payout_execution_guard BEFORE INSERT OR UPDATE OR DELETE ON payout_execution
      FOR EACH ROW EXECUTE FUNCTION payout_execution_guard();`)
    this.addSql(`CREATE TRIGGER payout_execution_no_truncate BEFORE TRUNCATE ON payout_execution
      FOR EACH STATEMENT EXECUTE FUNCTION payout_execution_guard();`)
  }
  override async down(): Promise<void> {
    throw new Error('Permanent payout evidence cannot be rolled back')
  }
}
