import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Candidate only: existing marketplace module discovery, no producer changes.
 * completed_at remains an immutable ENQUEUE marker. No implicit historical ACK.
 * Raw append-only receipt, not a soft-delete Medusa model. Runtime authority is
 * the trusted tagged consumer + current validation, not a SQL role signature.
 */
export class Migration20261006113000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE marketplace_capture_tail
      ADD CONSTRAINT marketplace_capture_tail_ack_identity UNIQUE (payment_id, cart_id, capture_id, event_id);
    CREATE TABLE marketplace_capture_consumer_ack (
      payment_id text PRIMARY KEY CHECK (length(payment_id) BETWEEN 1 AND 255),
      cart_id text NOT NULL UNIQUE CHECK (length(cart_id) BETWEEN 1 AND 255),
      capture_id text NOT NULL UNIQUE CHECK (length(capture_id) BETWEEN 1 AND 255),
      event_id text NOT NULL UNIQUE,
      snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
      subscriber_id text NOT NULL CHECK (subscriber_id = 'split-payment-payment-captured-handler'),
      protocol_version integer NOT NULL CHECK (protocol_version = 1),
      acked_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(acked_at)),
      CHECK (event_id = 'marketplace-captured-' || snapshot_sha256),
      CONSTRAINT marketplace_capture_ack_tail_fk FOREIGN KEY (payment_id, cart_id, capture_id, event_id)
        REFERENCES marketplace_capture_tail (payment_id, cart_id, capture_id, event_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
    );
    -- No extension: require the engine's built-in digest and UTF8 JSON strings.
    DO $$ BEGIN
      IF to_regprocedure('pg_catalog.sha256(bytea)') IS NULL OR current_setting('server_encoding') <> 'UTF8' THEN
        RAISE EXCEPTION 'capture ACK requires built-in sha256(bytea) and UTF8';
      END IF;
    END $$;
    -- Exact marketplaceSnapshotKey on the supported JSONB domain, NOT jsonb::text.
    -- Full unknown metadata is included. Printable ASCII keys sort like JS UTF16
    -- under C; Unicode string VALUES remain unchanged via JSON string escaping.
    -- Reject unsupported numbers rather than round PostgreSQL numeric into JS.
    -- JSONB already rejects NUL/unpaired surrogates. Bounds fail closed, no truncation.
    CREATE FUNCTION marketplace_capture_ack_canonical(v jsonb, depth integer DEFAULT 0)
      RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
    DECLARE kind text; result text; entry record; n numeric; part text;
    BEGIN
      IF depth < 0 OR depth > 32 OR octet_length(v::text) > 65536 THEN
        RAISE EXCEPTION 'capture ACK snapshot canonical bounds exceeded' USING ERRCODE = '23514';
      END IF;
      kind := jsonb_typeof(v);
      IF kind = 'object' THEN
        IF (SELECT count(*) FROM jsonb_object_keys(v)) > 256 THEN
          RAISE EXCEPTION 'capture ACK snapshot object bounds exceeded' USING ERRCODE = '23514';
        END IF;
        result := '';
        FOR entry IN SELECT key, value FROM jsonb_each(v) ORDER BY key COLLATE "C" LOOP
          IF length(entry.key) NOT BETWEEN 1 AND 255 OR entry.key COLLATE "C" !~ '^[ -~]+$' THEN
            RAISE EXCEPTION 'capture ACK snapshot requires printable ASCII keys' USING ERRCODE = '23514';
          END IF;
          part := to_json(entry.key)::text || ':' || public.marketplace_capture_ack_canonical(entry.value, depth + 1);
          result := result || CASE WHEN result = '' THEN '' ELSE ',' END || part;
        END LOOP;
        RETURN '{' || result || '}';
      ELSIF kind = 'array' THEN
        IF jsonb_array_length(v) > 1024 THEN
          RAISE EXCEPTION 'capture ACK snapshot array bounds exceeded' USING ERRCODE = '23514';
        END IF;
        result := '';
        FOR entry IN SELECT value FROM jsonb_array_elements(v) LOOP
          part := public.marketplace_capture_ack_canonical(entry.value, depth + 1);
          result := result || CASE WHEN result = '' THEN '' ELSE ',' END || part;
        END LOOP;
        RETURN '[' || result || ']';
      ELSIF kind = 'number' THEN
        n := (v::text)::numeric;
        IF n <> trunc(n) OR abs(n) > 9007199254740991 THEN
          RAISE EXCEPTION 'capture ACK snapshot numbers must be JS safe integers' USING ERRCODE = '23514';
        END IF;
        RETURN trunc(n)::text;
      ELSIF kind = 'string' THEN
        RETURN to_json(v #>> '{}')::text;
      ELSIF kind IN ('boolean', 'null') THEN
        RETURN v::text;
      END IF;
      RAISE EXCEPTION 'unsupported capture ACK snapshot' USING ERRCODE = '23514';
    END $$;
    CREATE FUNCTION marketplace_capture_ack_ready() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
    DECLARE tail public.marketplace_capture_tail%ROWTYPE; canonical text;
    BEGIN
      SELECT t.* INTO tail FROM public.marketplace_capture_tail t
        WHERE t.payment_id = NEW.payment_id AND t.cart_id = NEW.cart_id
          AND t.capture_id = NEW.capture_id AND t.event_id = NEW.event_id
          AND t.accounting_at IS NOT NULL AND t.event_enqueued_at IS NOT NULL AND t.completed_at IS NOT NULL
        FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'marketplace capture ACK requires exact ready tail';
      END IF;
      IF (jsonb_typeof(tail.snapshot) = 'object'
          AND jsonb_typeof(tail.snapshot->'version') = 'number' AND tail.snapshot->'version' = '1'::jsonb
          AND jsonb_typeof(tail.snapshot->'payment_id') = 'string' AND tail.snapshot->>'payment_id' = NEW.payment_id
          AND jsonb_typeof(tail.snapshot->'cart_id') = 'string' AND tail.snapshot->>'cart_id' = NEW.cart_id
          AND jsonb_typeof(tail.snapshot->'allocations') = 'array') IS NOT TRUE THEN
        RAISE EXCEPTION 'capture ACK snapshot shape/binding invalid' USING ERRCODE = '23514';
      END IF;
      IF jsonb_array_length(tail.snapshot->'allocations') = 0 THEN
        RAISE EXCEPTION 'capture ACK snapshot allocations must be nonempty' USING ERRCODE = '23514';
      END IF;
      IF (isfinite(tail.accounting_at) AND isfinite(tail.event_enqueued_at) AND isfinite(tail.completed_at)
          AND isfinite(NEW.acked_at) AND tail.accounting_at <= tail.event_enqueued_at
          AND tail.event_enqueued_at <= tail.completed_at AND tail.completed_at <= NEW.acked_at
          AND NEW.acked_at <= clock_timestamp()) IS NOT TRUE THEN
        RAISE EXCEPTION 'capture ACK timeline must be finite, ordered and not future' USING ERRCODE = '23514';
      END IF;
      canonical := public.marketplace_capture_ack_canonical(tail.snapshot);
      IF NEW.snapshot_sha256 IS DISTINCT FROM encode(pg_catalog.sha256(convert_to(canonical, 'UTF8')), 'hex') THEN
        RAISE EXCEPTION 'capture ACK snapshot hash mismatch' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE FUNCTION marketplace_capture_ack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'marketplace capture ACK is append-only';
    END $$;
    CREATE TRIGGER marketplace_capture_ack_insert BEFORE INSERT ON marketplace_capture_consumer_ack
      FOR EACH ROW EXECUTE FUNCTION marketplace_capture_ack_ready();
    CREATE TRIGGER marketplace_capture_ack_immutable_row BEFORE UPDATE OR DELETE ON marketplace_capture_consumer_ack
      FOR EACH ROW EXECUTE FUNCTION marketplace_capture_ack_immutable();
    CREATE TRIGGER marketplace_capture_ack_immutable_truncate BEFORE TRUNCATE ON marketplace_capture_consumer_ack
      FOR EACH STATEMENT EXECUTE FUNCTION marketplace_capture_ack_immutable();
    ALTER TABLE marketplace_capture_consumer_ack ENABLE ALWAYS TRIGGER marketplace_capture_ack_insert;
    ALTER TABLE marketplace_capture_consumer_ack ENABLE ALWAYS TRIGGER marketplace_capture_ack_immutable_row;
    ALTER TABLE marketplace_capture_consumer_ack ENABLE ALWAYS TRIGGER marketplace_capture_ack_immutable_truncate;`)
  }

  async down(): Promise<void> {
    // Honest rollback: serialize against insertion and refuse evidence loss.
    // Empty-only removal; never DROP CASCADE or silently erase accepted receipts.
    // Populated rollback requires a separately reviewed evidence-preserving plan.
    this.addSql(`LOCK TABLE marketplace_capture_consumer_ack IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM marketplace_capture_consumer_ack) THEN
        RAISE EXCEPTION 'refusing rollback with durable capture ACK evidence';
      END IF;
    END $$;
    DROP TABLE marketplace_capture_consumer_ack;
    DROP FUNCTION marketplace_capture_ack_ready();
    DROP FUNCTION marketplace_capture_ack_canonical(jsonb, integer);
    DROP FUNCTION marketplace_capture_ack_immutable();
    ALTER TABLE marketplace_capture_tail DROP CONSTRAINT marketplace_capture_tail_ack_identity;`)
  }
}
