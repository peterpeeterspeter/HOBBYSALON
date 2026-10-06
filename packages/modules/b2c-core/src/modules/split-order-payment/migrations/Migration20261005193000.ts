import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Durable quarantine receipts are append-only, never soft-deleted or rolled back. */
export class Migration20261005193000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE "commerce_refund_dispatch" (
      "refund_id" text NOT NULL,
      "idempotency_key" text NOT NULL,
      "operation_id" text NOT NULL,
      "scope_id" text NOT NULL,
      "payment_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "provider_payment_id" text NOT NULL,
      "amount" numeric NOT NULL,
      "currency_code" text NOT NULL,
      "state" text NOT NULL DEFAULT 'started',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "commerce_refund_dispatch_pkey" PRIMARY KEY ("refund_id"),
      CONSTRAINT "commerce_refund_dispatch_idempotency" CHECK (idempotency_key = refund_id),
      CONSTRAINT "commerce_refund_dispatch_identity" CHECK (
        length(refund_id) BETWEEN 1 AND 255 AND refund_id=btrim(refund_id) AND
        length(operation_id) BETWEEN 1 AND 255 AND operation_id=btrim(operation_id) AND
        length(scope_id) BETWEEN 1 AND 255 AND scope_id=btrim(scope_id) AND
        length(payment_id) BETWEEN 1 AND 255 AND payment_id=btrim(payment_id) AND
        length(provider_id) BETWEEN 1 AND 255 AND provider_id=btrim(provider_id) AND
        length(provider_payment_id) BETWEEN 1 AND 255 AND provider_payment_id=btrim(provider_payment_id)
      ),
      CONSTRAINT "commerce_refund_dispatch_amount" CHECK (amount > 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
      CONSTRAINT "commerce_refund_dispatch_currency" CHECK (currency_code ~ '^[a-z]{3}$'),
      CONSTRAINT "commerce_refund_dispatch_state" CHECK (state IN ('started','completed'))
    );`)
    this.addSql(`CREATE UNIQUE INDEX "commerce_refund_dispatch_started_scope"
      ON "commerce_refund_dispatch" (scope_id) WHERE state = 'started';`)
    this.addSql(`CREATE FUNCTION commerce_refund_dispatch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Refund quarantine is append-only; reconciliation required';
        END IF;
        IF TG_OP = 'INSERT' THEN
          IF NEW.state <> 'started' THEN
            RAISE EXCEPTION 'Refund dispatch must start quarantined';
          END IF;
        ELSE
          IF NEW.refund_id IS DISTINCT FROM OLD.refund_id OR
             NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
             NEW.operation_id IS DISTINCT FROM OLD.operation_id OR
             NEW.scope_id IS DISTINCT FROM OLD.scope_id OR
             NEW.payment_id IS DISTINCT FROM OLD.payment_id OR
             NEW.provider_id IS DISTINCT FROM OLD.provider_id OR
             NEW.provider_payment_id IS DISTINCT FROM OLD.provider_payment_id OR
             NEW.amount IS DISTINCT FROM OLD.amount OR
             NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
             NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Refund dispatch identity is immutable';
          END IF;
          IF NOT (OLD.state = 'started' AND NEW.state = 'completed') THEN
            RAISE EXCEPTION 'Invalid refund quarantine transition; reconciliation required';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM refund r JOIN payment p ON p.id=r.payment_id
          JOIN payment_collection pc ON pc.id=p.payment_collection_id
          JOIN cart_payment_collection c ON c.payment_collection_id=pc.id
          WHERE r.id=NEW.refund_id AND p.id=NEW.payment_id AND pc.id=NEW.scope_id
            AND p.provider_id=NEW.provider_id AND p.data->>'id'=NEW.provider_payment_id
            AND COALESCE(r.raw_amount->>'value',r.amount::text)::numeric=NEW.amount
            AND p.currency_code=NEW.currency_code AND pc.currency_code=NEW.currency_code
            AND r.deleted_at IS NULL AND p.deleted_at IS NULL
            AND pc.deleted_at IS NULL AND c.deleted_at IS NULL
        ) OR (SELECT count(*) FROM cart_payment_collection c
              WHERE c.payment_collection_id=NEW.scope_id AND c.deleted_at IS NULL) <> 1 THEN
          RAISE EXCEPTION 'Refund dispatch native binding invalid; reconciliation required';
        END IF;
        IF NEW.idempotency_key IS DISTINCT FROM NEW.refund_id THEN
          RAISE EXCEPTION 'Refund idempotency identity invalid';
        END IF;
        RETURN NEW;
      END;
    $$;`)
    this.addSql(`CREATE TRIGGER commerce_refund_dispatch_guard_trigger
      BEFORE INSERT OR UPDATE OR DELETE ON commerce_refund_dispatch
      FOR EACH ROW EXECUTE FUNCTION commerce_refund_dispatch_guard();`)
  }

  override async down(): Promise<void> {
    throw new Error('Refund quarantine is append-only; reconciliation required before any operator-managed rollback')
  }
}
