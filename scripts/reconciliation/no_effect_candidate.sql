-- TEST-ONLY schema extension. Never an operational migration. Trusted fixture owner
-- provisions retained boundary, inventory, writer fence and operator capabilities.
-- No claim of genuine provider authentication: normal roles cannot issue authority.
DO $$ BEGIN
 IF current_database() !~ '^hs_noeffect_it_[a-f0-9]{16}$'
 OR shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database')
 IS DISTINCT FROM 'new-network-none-tmpfs-no-effect-candidate'
 OR EXISTS(SELECT 1 FROM refund_settlement) OR EXISTS(SELECT 1 FROM commerce_refund_dispatch)
 OR EXISTS(SELECT 1 FROM refund_no_effect_closure) THEN
  RAISE EXCEPTION 'fresh marked isolated database required'; END IF;
END $$;
DO $$ DECLARE t text; n bigint; BEGIN
 FOREACH t IN ARRAY ARRAY['payment_collection','cart_payment_collection','payment','capture','refund','order','order_summary',
 'order_transaction','split_order_payment','order_payment_collection','order_order_split_order_payment_split_order_payment'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'fixture financial tables must be empty'; END IF;
 END LOOP;
END $$;
CREATE ROLE ne_owner NOLOGIN;
CREATE ROLE ne_executor NOLOGIN;
CREATE ROLE ne_runtime NOLOGIN;
CREATE SCHEMA ne AUTHORIZATION ne_owner;
GRANT USAGE ON SCHEMA public TO ne_owner,ne_executor,ne_runtime;
GRANT ALL ON ALL TABLES IN SCHEMA public TO ne_owner;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA public TO ne_runtime;
ALTER TABLE refund_settlement ALTER CONSTRAINT refund_settlement_no_effect_receipt_fk DEFERRABLE INITIALLY DEFERRED;
SET ROLE ne_owner;
CREATE TABLE ne.authority(kind text PRIMARY KEY CHECK(kind IN ('boundary','inventory','fence','operator')),
 token text NOT NULL UNIQUE, operation_id text NOT NULL, snapshot jsonb NOT NULL,
 details jsonb NOT NULL);
CREATE TABLE ne.context(tx bigint PRIMARY KEY,operation_id text NOT NULL,before_rows jsonb NOT NULL,receipt text NOT NULL);
CREATE TABLE ne.audit(receipt text PRIMARY KEY,actual_before jsonb NOT NULL,actual_after jsonb NOT NULL,sha256 text NOT NULL);
CREATE FUNCTION ne.snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,ne,pg_temp AS $$
DECLARE result jsonb='{}'; t text; rows jsonb;
BEGIN
 -- Complete fixture rowsets, including deleted and reverse-link rows. This
 -- deliberately rejects multi-scope databases instead of dropping other rows.
 FOREACH t IN ARRAY ARRAY['payment_collection','cart_payment_collection','payment','capture','refund',
 'order','order_summary','order_transaction','split_order_payment','order_payment_collection',
 'order_order_split_order_payment_split_order_payment','refund_settlement','commerce_refund_dispatch'] LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM public.%I r',t) INTO rows;
  result=result||jsonb_build_object(t,rows);
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION ne.hash(j jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(sha256(convert_to(j::text,'UTF8')),'hex') $$;
CREATE FUNCTION ne.allowed(oldrow jsonb,newrow jsonb) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public,ne,pg_temp AS $$
DECLARE c ne.context;
BEGIN
 IF current_user <> 'ne_owner' THEN RETURN false; END IF;
 SELECT * INTO c FROM ne.context WHERE tx=txid_current();
 RETURN c.tx IS NOT NULL AND c.operation_id=oldrow->>'operation_id'
 AND oldrow->>'phase'='refund_started' AND newrow->>'phase'='refund_no_effect'
 AND newrow->>'no_effect_receipt_id'=c.receipt
 AND (oldrow-'phase'-'no_effect_receipt_id'-'updated_at')=(newrow-'phase'-'no_effect_receipt_id'-'updated_at');
END $$;
CREATE FUNCTION ne.receipt_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,ne,pg_temp AS $$
DECLARE c ne.context; after_rows jsonb;
BEGIN
 IF TG_OP<>'INSERT' OR current_user<>'ne_owner' THEN RAISE EXCEPTION 'unauthorized/immutable receipt'; END IF;
 SELECT * INTO c FROM ne.context WHERE tx=txid_current();
 after_rows=ne.snapshot();
 IF c.tx IS NULL OR NEW.receipt_id<>c.receipt OR NEW.operation_id<>c.operation_id
 OR NEW.actual_before<>c.before_rows OR NEW.actual_after<>after_rows
 OR NEW.audit_sha256<>ne.hash(jsonb_build_object('before',c.before_rows,'after',after_rows))
 OR NEW.immutable_plan<>(c.before_rows->'refund_settlement'->0->'plan')
 OR NEW.immutable_input<>jsonb_build_object('operation_id',c.operation_id,'order_id',c.before_rows->'refund_settlement'->0->>'order_id',
 'scope_id',c.before_rows->'refund_settlement'->0->>'scope_id','fingerprint',c.before_rows->'refund_settlement'->0->>'fingerprint')
 OR NEW.scope_id<>c.before_rows->'refund_settlement'->0->>'scope_id'
 OR NEW.provider_inventory<>(SELECT details FROM ne.authority WHERE kind='inventory')
 OR NEW.writer_fence<>(SELECT details FROM ne.authority WHERE kind='fence')
 OR NEW.operator_authorization<>(SELECT details FROM ne.authority WHERE kind='operator')
 OR NEW.retained_predispatch_boundary<>(SELECT details FROM ne.authority WHERE kind='boundary') THEN
  RAISE EXCEPTION 'receipt actual-row authentication failed'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ne.close(op text,expected jsonb,tokens jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public,ne,pg_temp AS $$
DECLARE s refund_settlement; snap jsonb; after_rows jsonb; cart text; locked_scope text; locked_payment text;
 r text; k text; d jsonb; p jsonb; cap jsonb; row_data jsonb;
BEGIN
 IF current_database() !~ '^hs_noeffect_it_[a-f0-9]{16}$' OR
 shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database')
 IS DISTINCT FROM 'new-network-none-tmpfs-no-effect-candidate' THEN RAISE EXCEPTION 'isolated gate'; END IF;
 SELECT * INTO STRICT s FROM refund_settlement WHERE operation_id=op;
 SELECT cart_id INTO STRICT cart FROM cart_payment_collection WHERE payment_collection_id=s.scope_id;
 locked_scope=s.scope_id; locked_payment=s.plan->>'payment_id';
 IF cart IS NULL OR locked_scope IS NULL OR locked_payment IS NULL THEN RAISE EXCEPTION 'missing lock ownership'; END IF;
 IF NOT pg_try_advisory_xact_lock(('x'||substr(encode(sha256(convert_to('hobbysalon:commerce-cart:v1:'||cart,'UTF8')),'hex'),1,16))::bit(64)::bigint)
 THEN RAISE EXCEPTION 'cart lock conflict'; END IF;
 IF NOT pg_try_advisory_xact_lock(('x'||substr(encode(sha256(convert_to('hobbysalon:refund-settlement:v1:'||s.scope_id,'UTF8')),'hex'),1,16))::bit(64)::bigint)
 THEN RAISE EXCEPTION 'scope lock conflict'; END IF;
 -- Writer fence plus database table locks stop phantom financial inserts; caller
 -- booleans, session GUCs and forged receipt ids never create permission.
 LOCK TABLE payment_collection,cart_payment_collection,payment,capture,refund,"order",order_summary,order_transaction,
 split_order_payment,order_payment_collection,order_order_split_order_payment_split_order_payment,
 refund_settlement,commerce_refund_dispatch IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 SELECT * INTO STRICT s FROM refund_settlement WHERE operation_id=op FOR UPDATE;
 snap=ne.snapshot();
 IF s.scope_id IS DISTINCT FROM locked_scope OR s.plan->>'payment_id' IS DISTINCT FROM locked_payment
 OR snap->'cart_payment_collection'->0->>'cart_id' IS DISTINCT FROM cart
 OR snap->'cart_payment_collection'->0->>'payment_collection_id' IS DISTINCT FROM locked_scope
 OR snap->'payment'->0->>'id' IS DISTINCT FROM locked_payment
 OR snap->'payment'->0->>'payment_collection_id' IS DISTINCT FROM locked_scope
 THEN RAISE EXCEPTION 'postlock ownership changed'; END IF;
 IF snap IS DISTINCT FROM expected OR s.phase IS DISTINCT FROM 'refund_started' OR s.no_effect_receipt_id IS NOT NULL
 OR s.reversal_receipt_id IS NOT NULL OR NOT COALESCE((s.plan->>'customerRefund')::numeric>0,false)
 OR (s.plan->>'sellerReversal')::numeric IS DISTINCT FROM 0::numeric OR s.plan->>'payout_id' IS NOT NULL
 THEN RAISE EXCEPTION 'snapshot/plan/terminal unsupported'; END IF;
 FOREACH k IN ARRAY ARRAY['boundary','inventory','fence','operator'] LOOP
  SELECT details INTO STRICT d FROM ne.authority WHERE kind=k AND token=tokens->>k
    AND operation_id=op AND snapshot=snap;
  IF d->>'synthetic_test_only' IS DISTINCT FROM 'isolated-trusted-fixture' THEN RAISE EXCEPTION 'synthetic capability required'; END IF;
 END LOOP;
 IF (SELECT details->>'state' FROM ne.authority WHERE kind='boundary') IS DISTINCT FROM 'retained-hard-no-dispatch'
 OR (SELECT details->>'state' FROM ne.authority WHERE kind='inventory') IS DISTINCT FROM 'complete-zero-refunds'
 OR (SELECT details->>'state' FROM ne.authority WHERE kind='fence') IS DISTINCT FROM 'retained-exclusive-writers'
 OR (SELECT details->>'state' FROM ne.authority WHERE kind='operator') IS DISTINCT FROM 'approve-nonsuccess-no-effect'
 THEN RAISE EXCEPTION 'capability semantic mismatch'; END IF;
 FOREACH k IN ARRAY ARRAY['refund','commerce_refund_dispatch'] LOOP
  IF jsonb_array_length(snap->k)<>0 THEN RAISE EXCEPTION 'native reservation/dispatch unsupported'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['payment_collection','cart_payment_collection','payment','capture','order','order_summary',
 'order_transaction','split_order_payment','order_payment_collection','order_order_split_order_payment_split_order_payment','refund_settlement'] LOOP
  IF jsonb_array_length(snap->k)<>1 OR snap->k->0->>'deleted_at' IS NOT NULL THEN RAISE EXCEPTION 'extra/deleted financial row unsupported: %',k; END IF;
 END LOOP;
 p=snap->'payment'->0; cap=snap->'capture'->0;
 -- Required identities must exist before NULL-safe equality (NULL=NULL is not authority).
 FOREACH k IN ARRAY ARRAY['payment_collection','payment','capture','order','order_summary','order_transaction','split_order_payment'] LOOP
  IF NULLIF(snap->k->0->>'id','') IS NULL THEN RAISE EXCEPTION 'missing native identity: %',k; END IF;
 END LOOP;
 IF NULLIF(s.plan->>'payment_id','') IS NULL OR NULLIF(s.plan->>'split_order_payment_id','') IS NULL
 OR NULLIF(s.plan->>'currency_code','') IS NULL OR NULLIF(p->'data'->>'id','') IS NULL
 OR p->>'provider_id' IS DISTINCT FROM 'stripe'
 THEN RAISE EXCEPTION 'fixture provider/native identity'; END IF;
 FOREACH k IN ARRAY ARRAY['payment_collection','payment','capture','order_transaction'] LOOP
  row_data=snap->k->0;
  IF NOT COALESCE((row_data->>'amount')::numeric>0,false)
  OR (row_data->>'amount')::numeric::text IN ('NaN','Infinity','-Infinity')
  OR (row_data->'raw_amount'->>'value')::numeric IS DISTINCT FROM (row_data->>'amount')::numeric
  OR (row_data->'raw_amount'->>'precision')::numeric IS DISTINCT FROM 20::numeric
  THEN RAISE EXCEPTION 'required native money/raw: %',k; END IF;
 END LOOP;
 IF p->>'id' IS DISTINCT FROM s.plan->>'payment_id' OR p->>'payment_collection_id' IS DISTINCT FROM s.scope_id
 OR snap->'payment_collection'->0->>'id' IS DISTINCT FROM s.scope_id
 OR snap->'order'->0->>'id' IS DISTINCT FROM s.order_id
 OR snap->'order_payment_collection'->0->>'order_id' IS DISTINCT FROM s.order_id
 OR snap->'order_payment_collection'->0->>'payment_collection_id' IS DISTINCT FROM s.scope_id
 OR snap->'order_order_split_order_payment_split_order_payment'->0->>'order_id' IS DISTINCT FROM s.order_id
 OR snap->'order_order_split_order_payment_split_order_payment'->0->>'split_order_payment_id' IS DISTINCT FROM s.plan->>'split_order_payment_id'
 OR snap->'split_order_payment'->0->>'id' IS DISTINCT FROM s.plan->>'split_order_payment_id'
 OR snap->'split_order_payment'->0->>'payment_collection_id' IS DISTINCT FROM s.scope_id
 OR cap->>'payment_id' IS DISTINCT FROM p->>'id'
 OR snap->'order_summary'->0->>'order_id' IS DISTINCT FROM s.order_id
 OR snap->'order_transaction'->0->>'order_id' IS DISTINCT FROM s.order_id
 OR snap->'order_transaction'->0->>'reference_id' IS DISTINCT FROM cap->>'id'
 OR cap->>'amount' IS DISTINCT FROM cap->'raw_amount'->>'value'
 OR p->>'amount' IS DISTINCT FROM p->'raw_amount'->>'value'
 OR (cap->>'amount')::numeric IS DISTINCT FROM (p->>'amount')::numeric
 OR p->>'currency_code' IS DISTINCT FROM s.plan->>'currency_code'
 OR p->'data'->>'id' IS NULL THEN RAISE EXCEPTION 'native identity/financial parity'; END IF;
 IF NOT COALESCE((s.plan->>'customerRefund')::numeric<=(cap->>'amount')::numeric,false)
 OR (snap->'payment_collection'->0->>'amount')::numeric IS DISTINCT FROM (cap->>'amount')::numeric
 OR snap->'payment_collection'->0->>'currency_code' IS DISTINCT FROM s.plan->>'currency_code'
 OR snap->'split_order_payment'->0->>'currency_code' IS DISTINCT FROM s.plan->>'currency_code'
 OR snap->'order'->0->>'currency_code' IS DISTINCT FROM s.plan->>'currency_code'
 OR snap->'order_transaction'->0->>'amount' IS DISTINCT FROM snap->'order_transaction'->0->'raw_amount'->>'value'
 OR (snap->'order_transaction'->0->>'amount')::numeric IS DISTINCT FROM (cap->>'amount')::numeric
 OR (snap->'order_summary'->0->'totals'->>'paid')::numeric IS DISTINCT FROM (cap->>'amount')::numeric
 OR (snap->'order_summary'->0->'totals'->>'refunded')::numeric IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'financial gross basis unsupported'; END IF;
 FOREACH k IN ARRAY ARRAY['payment_collection','split_order_payment'] LOOP
  IF (snap->k->0->>'authorized_amount')::numeric IS DISTINCT FROM (cap->>'amount')::numeric
  OR (snap->k->0->>'captured_amount')::numeric IS DISTINCT FROM (cap->>'amount')::numeric
  OR (snap->k->0->>'refunded_amount')::numeric IS DISTINCT FROM 0::numeric
  OR (snap->k->0->>'authorized_amount')::numeric IS NULL
  OR (snap->k->0->>'captured_amount')::numeric IS NULL
  OR (snap->k->0->>'refunded_amount')::numeric IS NULL THEN RAISE EXCEPTION 'financial aggregate parity'; END IF;
 END LOOP;
 IF (SELECT details->>'provider_payment_id' FROM ne.authority WHERE kind='inventory') IS DISTINCT FROM p->'data'->>'id'
 OR (SELECT details->>'provider_namespace' FROM ne.authority WHERE kind='inventory') IS DISTINCT FROM 'stripe'
 OR (SELECT details->>'gross_capture' FROM ne.authority WHERE kind='inventory') IS DISTINCT FROM cap->>'amount'
 THEN RAISE EXCEPTION 'provider gross inventory mismatch'; END IF;
 r='ne:'||op;
 INSERT INTO ne.context VALUES(txid_current(),op,snap,r);
 UPDATE refund_settlement SET phase='refund_no_effect',no_effect_receipt_id=r,updated_at=clock_timestamp() WHERE operation_id=op;
 after_rows=ne.snapshot();
 IF (snap-'refund_settlement')<>(after_rows-'refund_settlement') THEN RAISE EXCEPTION 'financial mutation forbidden'; END IF;
 INSERT INTO refund_no_effect_closure(receipt_id,operation_id,scope_id,protocol,terminal_phase,terminal_result,financial_obligation,
 immutable_input,immutable_plan,provider_inventory,retained_predispatch_boundary,writer_fence,operator_authorization,actual_before,actual_after,audit_sha256)
 VALUES(r,op,s.scope_id,'refund-no-effect/v1-candidate-disabled','refund_no_effect','NO-EFFECT','unchanged_unresolved',
 jsonb_build_object('operation_id',op,'order_id',s.order_id,'scope_id',s.scope_id,'fingerprint',s.fingerprint),s.plan,
 (SELECT details FROM ne.authority WHERE kind='inventory'),(SELECT details FROM ne.authority WHERE kind='boundary'),
 (SELECT details FROM ne.authority WHERE kind='fence'),(SELECT details FROM ne.authority WHERE kind='operator'),snap,after_rows,
 ne.hash(jsonb_build_object('before',snap,'after',after_rows)));
 INSERT INTO ne.audit VALUES(r,snap,after_rows,ne.hash(jsonb_build_object('before',snap,'after',after_rows)));
 DELETE FROM ne.context WHERE tx=txid_current();
 RETURN jsonb_build_object('terminal_result','NO-EFFECT','runtime_success',false,'financial_obligation','unchanged_unresolved','receipt',r);
END $$;
CREATE FUNCTION ne.readback(receipt text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public,ne,pg_temp AS $$
DECLARE r refund_no_effect_closure; a ne.audit; actual jsonb;
BEGIN
 IF current_database() !~ '^hs_noeffect_it_[a-f0-9]{16}$' OR
 shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database')
 IS DISTINCT FROM 'new-network-none-tmpfs-no-effect-candidate' THEN RAISE EXCEPTION 'isolated readback gate'; END IF;
 SELECT * INTO STRICT r FROM refund_no_effect_closure WHERE receipt_id=receipt;
 SELECT * INTO STRICT a FROM ne.audit WHERE ne.audit.receipt=readback.receipt;
 actual=ne.snapshot();
 IF actual IS DISTINCT FROM r.actual_after OR a.actual_before IS DISTINCT FROM r.actual_before
 OR a.actual_after IS DISTINCT FROM actual OR a.sha256 IS DISTINCT FROM r.audit_sha256
 OR a.sha256 IS DISTINCT FROM ne.hash(jsonb_build_object('before',a.actual_before,'after',actual))
 OR NOT EXISTS(SELECT 1 FROM refund_settlement WHERE operation_id=r.operation_id AND phase='refund_no_effect'
 AND no_effect_receipt_id=r.receipt_id AND scope_id=r.scope_id AND plan=r.immutable_plan)
 THEN RAISE EXCEPTION 'actual audited readback mismatch'; END IF;
 RETURN jsonb_build_object('terminal_result',r.terminal_result,'runtime_success',false,
 'financial_obligation',r.financial_obligation,'receipt',r.receipt_id);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ne FROM PUBLIC;
GRANT USAGE ON SCHEMA ne TO ne_executor;
GRANT EXECUTE ON FUNCTION ne.close(text,jsonb,jsonb),ne.readback(text) TO ne_executor;
RESET ROLE;
-- Fresh fixture ONLY: deliberately extend the two existing guard functions.
-- Preserve their entire actual migration bodies for every normal transition.
DO $$ DECLARE n text; src text; pos integer; BEGIN
 FOREACH n IN ARRAY ARRAY['refund_settlement_guard','refund_settlement_no_effect_candidate_guard'] LOOP
  src=pg_get_functiondef(to_regprocedure(n||'()')); pos=strpos(src,'BEGIN');
  IF pos=0 THEN RAISE EXCEPTION 'guard shape unavailable'; END IF;
  src=overlay(src placing E'BEGIN\n IF TG_OP=''UPDATE'' AND ne.allowed(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;\n' from pos for 5);
  EXECUTE src;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION refund_no_effect_candidate_deny() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='refund_no_effect_closure' AND TG_OP='INSERT' AND current_user='ne_owner'
 AND EXISTS(SELECT 1 FROM ne.context WHERE tx=txid_current()) THEN RETURN NULL; END IF;
 RAISE EXCEPTION 'sealed immutable/unauthorized NO-EFFECT write';
END $$;
CREATE TRIGGER ne_receipt_actual_guard BEFORE INSERT OR UPDATE OR DELETE ON refund_no_effect_closure
 FOR EACH ROW EXECUTE FUNCTION ne.receipt_guard();
CREATE FUNCTION ne.audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable audit'; END $$;
CREATE TRIGGER ne_audit_immutable BEFORE UPDATE OR DELETE ON ne.audit FOR EACH STATEMENT EXECUTE FUNCTION ne.audit_immutable();
CREATE TRIGGER ne_audit_no_truncate BEFORE TRUNCATE ON ne.audit FOR EACH STATEMENT EXECUTE FUNCTION ne.audit_immutable();
-- Runtime guard calls can read only the context helper, never issue capabilities.
GRANT USAGE ON SCHEMA ne TO ne_runtime;
GRANT EXECUTE ON FUNCTION ne.allowed(jsonb,jsonb) TO ne_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA ne FROM PUBLIC,ne_runtime,ne_executor;
