-- Private article review memory and inert, leased matching queue.
-- No scheduler, network extension, public relation/state, or legacy-edge rewrite.
BEGIN;

CREATE TABLE public.graph_article_reviews (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  target_entity_type text NOT NULL CHECK (target_entity_type IN ('product','workshop','event')),
  target_entity_id uuid NOT NULL, -- deliberately no target FK: keep decision/evidence after deletion
  state text NOT NULL CHECK (state IN ('pending','accepted','dismissed')),
  proposed_relation text, -- original matcher provenance, never overwritten by approval
  accepted_relation text, -- chosen human role survives public-edge removal
  score numeric,
  evidence jsonb,
  compatibility jsonb,
  matcher_version text,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id,target_entity_type,target_entity_id)
);

CREATE TABLE public.graph_matching_jobs (
  job_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('article','catalog')),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  claimed_revision bigint NOT NULL DEFAULT 0 CHECK (claimed_revision >= 0),
  lease_token uuid,
  lease_until timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT now(),
  cursor_article_id uuid,
  lease_cursor_article_id uuid, -- cursor at claim; yield requires forward progress
  last_error text,
  CHECK ((kind = 'catalog' AND job_key = 'catalog' AND article_id IS NULL)
    OR (kind = 'article' AND article_id IS NOT NULL AND job_key = 'article:' || article_id::text)),
  CHECK ((status = 'running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (status <> 'running' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX graph_matching_jobs_ready ON public.graph_matching_jobs (available_at,job_key)
  WHERE status IN ('pending','running');
ALTER TABLE public.graph_article_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_matching_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.graph_article_reviews,public.graph_matching_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.graph_article_reviews,public.graph_matching_jobs TO service_role;

CREATE FUNCTION public.graph_article_fingerprint(p_article_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_fingerprint text;
BEGIN
  SELECT md5(jsonb_build_array(title,excerpt,body_markdown,domain_id)::text)
    INTO v_fingerprint FROM public.articles WHERE id = p_article_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'article does not exist' USING ERRCODE = '22023'; END IF;
  RETURN v_fingerprint;
END;
$$;

-- Serialize BEFORE writing any recognized article/target pair, including unknown human roles.
-- UPDATE locks old and new endpoints in deterministic order. Pending RPC memory is allowed.
CREATE FUNCTION public.graph_lock_article_pair()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_link jsonb; v_key bigint; v_article uuid; v_type text; v_target uuid;
BEGIN
  FOR v_key IN
    SELECT DISTINCT hashtextextended('graph-review:' ||
      CASE WHEN e->>'source_entity_type' = 'article' THEN e->>'source_entity_id' ELSE e->>'target_entity_id' END || ':' ||
      CASE WHEN e->>'source_entity_type' = 'article' THEN e->>'target_entity_type' ELSE e->>'source_entity_type' END || ':' ||
      CASE WHEN e->>'source_entity_type' = 'article' THEN e->>'target_entity_id' ELSE e->>'source_entity_id' END,0)
    FROM jsonb_array_elements(CASE TG_OP WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END) e
    WHERE (e->>'source_entity_type' = 'article' AND e->>'target_entity_type' IN ('product','workshop','event'))
       OR (e->>'target_entity_type' = 'article' AND e->>'source_entity_type' IN ('product','workshop','event'))
    ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(v_key);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.relation_type = 'suggested_auto' THEN
    IF NEW.source_entity_type = 'article' AND NEW.target_entity_type IN ('product','workshop','event') THEN
      v_article := NEW.source_entity_id; v_type := NEW.target_entity_type; v_target := NEW.target_entity_id;
    ELSIF NEW.target_entity_type = 'article' AND NEW.source_entity_type IN ('product','workshop','event') THEN
      v_article := NEW.target_entity_id; v_type := NEW.source_entity_type; v_target := NEW.source_entity_id;
    ELSE RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.graph_article_reviews WHERE article_id = v_article
        AND target_entity_type = v_type AND target_entity_id = v_target AND state IN ('accepted','dismissed'))
      OR EXISTS (SELECT 1 FROM public.entity_links WHERE id <> NEW.id AND
        ((source_entity_type = 'article' AND source_entity_id = v_article AND target_entity_type = v_type AND target_entity_id = v_target)
         OR (target_entity_type = 'article' AND target_entity_id = v_article AND source_entity_type = v_type AND source_entity_id = v_target))) THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER graph_entity_links_pair_lock BEFORE INSERT OR UPDATE OR DELETE ON public.entity_links
FOR EACH ROW EXECUTE FUNCTION public.graph_lock_article_pair();

-- Private manual acceptance wins over automatic proposals; never create public dismissed edges.
CREATE FUNCTION public.graph_record_article_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_link public.entity_links; v_article uuid; v_type text; v_target uuid; v_state text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_link := OLD; ELSE v_link := NEW; END IF;
  IF v_link.source_entity_type = 'article' AND v_link.target_entity_type IN ('product','workshop','event') THEN
    v_article := v_link.source_entity_id; v_type := v_link.target_entity_type; v_target := v_link.target_entity_id;
  ELSIF v_link.target_entity_type = 'article' AND v_link.source_entity_type IN ('product','workshop','event') THEN
    v_article := v_link.target_entity_id; v_type := v_link.source_entity_type; v_target := v_link.source_entity_id;
  ELSE RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.articles WHERE id = v_article) THEN RETURN NULL; END IF;
  IF v_link.relation_type = 'suggested_auto' THEN
    v_state := CASE WHEN TG_OP = 'DELETE' THEN 'dismissed' ELSE 'pending' END;
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN NULL; END IF;
    v_state := 'accepted'; -- all explicit non-auto human roles, including unknown legacy roles
  END IF;
  INSERT INTO public.graph_article_reviews(article_id,target_entity_type,target_entity_id,state,accepted_relation)
  VALUES(v_article,v_type,v_target,v_state,CASE WHEN v_state = 'accepted' THEN v_link.relation_type ELSE NULL END)
  ON CONFLICT (article_id,target_entity_type,target_entity_id) DO UPDATE
    SET state = EXCLUDED.state, accepted_relation = EXCLUDED.accepted_relation, updated_at = now()
    WHERE EXCLUDED.state = 'accepted' OR (graph_article_reviews.state = 'pending' AND EXCLUDED.state = 'dismissed');
  -- Write accepted memory FIRST: auto DELETE triggers must not turn it into dismissal.
  -- Remove only redundant same-pair automatic rows; preserve every human edge.
  IF v_state = 'accepted' THEN
    DELETE FROM public.entity_links WHERE relation_type = 'suggested_auto' AND
      ((source_entity_type = 'article' AND source_entity_id = v_article AND target_entity_type = v_type AND target_entity_id = v_target)
       OR (target_entity_type = 'article' AND target_entity_id = v_article AND source_entity_type = v_type AND source_entity_id = v_target));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER graph_entity_links_review AFTER INSERT OR UPDATE OR DELETE ON public.entity_links
FOR EACH ROW EXECUTE FUNCTION public.graph_record_article_review();

-- Do not deduplicate/delete/relabel legacy entity_links. Accepted precedence is private only.
INSERT INTO public.graph_article_reviews(article_id,target_entity_type,target_entity_id,state,accepted_relation)
SELECT DISTINCT ON (e.article_id,e.target_type,e.target_id)
  e.article_id,e.target_type,e.target_id,
  CASE WHEN e.relation_type = 'suggested_auto' THEN 'pending' ELSE 'accepted' END,
  CASE WHEN e.relation_type = 'suggested_auto' THEN NULL ELSE e.relation_type END
FROM (
  SELECT source_entity_id AS article_id,target_entity_type AS target_type,target_entity_id AS target_id,relation_type,created_at,id
  FROM public.entity_links WHERE source_entity_type = 'article' AND target_entity_type IN ('product','workshop','event')
  UNION ALL
  SELECT target_entity_id,source_entity_type,source_entity_id,relation_type,created_at,id
  FROM public.entity_links WHERE target_entity_type = 'article' AND source_entity_type IN ('product','workshop','event')
) e JOIN public.articles a ON a.id = e.article_id
ORDER BY e.article_id,e.target_type,e.target_id,
  (e.relation_type <> 'suggested_auto') DESC,e.created_at,e.id;

CREATE FUNCTION public.graph_propose_article_suggestions(p_article_id uuid,p_fingerprint text,p_proposals jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_current text; v_p jsonb; v_type text; v_target uuid; v_relation text;
  v_weight integer; v_order integer; v_score numeric; v_count integer := 0; v_rows integer; v_eligible boolean;
BEGIN
  IF p_article_id IS NULL OR p_fingerprint IS NULL OR p_proposals IS NULL
    OR jsonb_typeof(p_proposals) <> 'array' THEN
    RAISE EXCEPTION 'invalid proposal request' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_proposals) > 200 THEN RAISE EXCEPTION 'too many proposals' USING ERRCODE = '22023'; END IF;
  SELECT md5(jsonb_build_array(title,excerpt,body_markdown,domain_id)::text) INTO v_current
    FROM public.articles WHERE id = p_article_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'article does not exist' USING ERRCODE = '22023'; END IF;
  IF v_current <> p_fingerprint THEN RAISE EXCEPTION 'stale article fingerprint' USING ERRCODE = '40001'; END IF;
  -- Deterministic target order avoids multi-target deadlocks between article transactions.
  FOR v_p IN SELECT value FROM jsonb_array_elements(p_proposals)
    ORDER BY value->>'target_entity_type',value->>'target_entity_id' LOOP
    IF jsonb_typeof(v_p) <> 'object'
      OR NOT (v_p ?& ARRAY['target_entity_type','target_entity_id','weight','sort_order','proposed_relation','score','evidence','compatibility','matcher_version'])
      OR jsonb_typeof(v_p->'target_entity_type') <> 'string'
      OR jsonb_typeof(v_p->'target_entity_id') <> 'string'
      OR jsonb_typeof(v_p->'proposed_relation') <> 'string'
      OR jsonb_typeof(v_p->'matcher_version') <> 'string'
      OR length(v_p->>'matcher_version') NOT BETWEEN 1 AND 100
      OR jsonb_typeof(v_p->'weight') <> 'number'
      OR jsonb_typeof(v_p->'sort_order') <> 'number'
      OR jsonb_typeof(v_p->'score') <> 'number'
      OR jsonb_typeof(v_p->'evidence') NOT IN ('array','object')
      OR jsonb_typeof(v_p->'compatibility') NOT IN ('array','object','string','null') THEN
      RAISE EXCEPTION 'invalid proposal' USING ERRCODE = '22023';
    END IF;
    v_type := v_p->>'target_entity_type'; v_relation := v_p->>'proposed_relation';
    IF v_type NOT IN ('product','workshop','event') OR NOT
      ((v_type = 'product' AND v_relation IN ('required_material','required_tool','optional_material','related_product'))
       OR (v_type IN ('workshop','event') AND v_relation = 'related')) THEN
      RAISE EXCEPTION 'invalid target relation' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_target := (v_p->>'target_entity_id')::uuid;
      v_weight := (v_p->>'weight')::integer; v_order := (v_p->>'sort_order')::integer; v_score := (v_p->>'score')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid proposal values' USING ERRCODE = '22023';
    END;
    IF v_weight NOT BETWEEN 1 AND 100 OR v_order NOT BETWEEN 0 AND 100000
      OR v_score NOT BETWEEN 0 AND 100000 OR v_target IS NULL THEN
      RAISE EXCEPTION 'invalid proposal values' USING ERRCODE = '22023';
    END IF;
    -- FOR SHARE prevents deletion and visibility/content changes until commit.
    v_eligible := NULL;
    IF v_type = 'product' THEN
      SELECT is_active AND status = 'active' INTO v_eligible FROM public.products WHERE id = v_target FOR SHARE;
    ELSIF v_type = 'workshop' THEN
      SELECT is_active AND (listing_fee_status = 'launch_free' OR
        (listing_fee_status = 'paid' AND listing_expires_at > clock_timestamp()))
        INTO v_eligible FROM public.workshops WHERE id = v_target FOR SHARE;
    ELSE
      SELECT is_active AND ends_at > clock_timestamp() INTO v_eligible FROM public.events WHERE id = v_target FOR SHARE;
    END IF;
    IF v_eligible IS DISTINCT FROM true THEN RAISE EXCEPTION 'target missing or ineligible' USING ERRCODE = '22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('graph-review:' || p_article_id::text || ':' || v_type || ':' || v_target::text,0));
    IF EXISTS (SELECT 1 FROM public.graph_article_reviews WHERE article_id = p_article_id
      AND target_entity_type = v_type AND target_entity_id = v_target)
      OR EXISTS (SELECT 1 FROM public.entity_links WHERE
        (source_entity_type = 'article' AND source_entity_id = p_article_id AND target_entity_type = v_type AND target_entity_id = v_target)
        OR (target_entity_type = 'article' AND target_entity_id = p_article_id AND source_entity_type = v_type AND source_entity_id = v_target)) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.graph_article_reviews(article_id,target_entity_type,target_entity_id,state,
      proposed_relation,score,evidence,compatibility,matcher_version,fingerprint)
    VALUES(p_article_id,v_type,v_target,'pending',v_relation,v_score,v_p->'evidence',v_p->'compatibility',v_p->>'matcher_version',v_current)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
      INSERT INTO public.entity_links(source_entity_type,source_entity_id,target_entity_type,target_entity_id,relation_type,weight,sort_order)
      VALUES('article',p_article_id,v_type,v_target,'suggested_auto',v_weight,v_order);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Managed decisions acquire the pair advisory lock BEFORE any entity_links tuple lock.
-- Raw SQL UPDATE/DELETE clients can still invert that order and must retry deadlocks.
CREATE FUNCTION public.graph_decide_article_suggestion(p_link_id uuid,p_article_id uuid,p_creator_id uuid,p_relation text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_link public.entity_links; v_type text; v_target uuid; v_author uuid; v_rows integer;
BEGIN
  IF p_creator_id IS NULL THEN RETURN false; END IF;
  -- Protect ownership before effects, with the same article-before-pair order as proposals.
  SELECT author_creator_id INTO v_author FROM public.articles WHERE id = p_article_id FOR NO KEY UPDATE;
  IF NOT FOUND OR v_author IS DISTINCT FROM p_creator_id THEN RETURN false; END IF;
  -- Deliberately no tuple lock here: manual insertion may remove this pending row.
  SELECT * INTO v_link FROM public.entity_links WHERE id = p_link_id AND relation_type = 'suggested_auto'
    AND ((source_entity_type = 'article' AND source_entity_id = p_article_id AND target_entity_type IN ('product','workshop','event'))
      OR (target_entity_type = 'article' AND target_entity_id = p_article_id AND source_entity_type IN ('product','workshop','event')));
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_link.source_entity_type = 'article' THEN
    v_type := v_link.target_entity_type; v_target := v_link.target_entity_id;
  ELSE v_type := v_link.source_entity_type; v_target := v_link.source_entity_id; END IF;
  IF p_relation IS NOT NULL AND NOT
    ((v_type = 'product' AND p_relation IN ('required_material','required_tool','optional_material','related_product'))
      OR (v_type IN ('workshop','event') AND p_relation = 'related')) THEN
    RAISE EXCEPTION 'invalid target relation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('graph-review:' || p_article_id::text || ':' || v_type || ':' || v_target::text,0));
  PERFORM 1 FROM public.entity_links WHERE id = p_link_id AND relation_type = 'suggested_auto'
    AND source_entity_type = v_link.source_entity_type AND source_entity_id = v_link.source_entity_id
    AND target_entity_type = v_link.target_entity_type AND target_entity_id = v_link.target_entity_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_relation IS NULL THEN DELETE FROM public.entity_links WHERE id = p_link_id AND relation_type = 'suggested_auto';
  ELSE UPDATE public.entity_links SET relation_type = p_relation WHERE id = p_link_id AND relation_type = 'suggested_auto'; END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE FUNCTION public.graph_enqueue_catalog_matching()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  INSERT INTO public.graph_matching_jobs(job_key,kind) VALUES('catalog','catalog')
  ON CONFLICT (job_key) DO UPDATE SET revision = graph_matching_jobs.revision + 1,
    status = CASE WHEN graph_matching_jobs.status = 'running' THEN 'running' ELSE 'pending' END,
    attempts = CASE WHEN graph_matching_jobs.status = 'running' THEN graph_matching_jobs.attempts ELSE 0 END,
    cursor_article_id = CASE WHEN graph_matching_jobs.status = 'running' THEN graph_matching_jobs.cursor_article_id ELSE NULL END,
    available_at = clock_timestamp(),last_error = NULL;
END;
$$;
CREATE FUNCTION public.graph_enqueue_article_matching(p_article_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  -- Row lock orders explicit recovery against article deletion and article-save triggers.
  PERFORM 1 FROM public.articles WHERE id = p_article_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'article does not exist' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.graph_matching_jobs(job_key,kind,article_id) VALUES('article:' || p_article_id::text,'article',p_article_id)
  ON CONFLICT (job_key) DO UPDATE SET revision = graph_matching_jobs.revision + 1,
    status = CASE WHEN graph_matching_jobs.status = 'running' THEN 'running' ELSE 'pending' END,
    attempts = CASE WHEN graph_matching_jobs.status = 'running' THEN graph_matching_jobs.attempts ELSE 0 END,
    cursor_article_id = CASE WHEN graph_matching_jobs.status = 'running' THEN graph_matching_jobs.cursor_article_id ELSE NULL END,
    available_at = clock_timestamp(),last_error = NULL;
END;
$$;

CREATE FUNCTION public.graph_claim_matching_jobs(p_limit integer DEFAULT 1,p_lease_seconds integer DEFAULT 120)
RETURNS SETOF public.graph_matching_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_now timestamptz := clock_timestamp(); v_job public.graph_matching_jobs;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 1 AND 900 THEN
    RAISE EXCEPTION 'invalid claim bounds' USING ERRCODE = '22023';
  END IF;
  -- Exhaustion is also SKIP LOCKED: no waiting behind an active worker transaction.
  FOR v_job IN SELECT * FROM public.graph_matching_jobs
    WHERE status = 'running' AND lease_until <= v_now AND attempts >= 5
    ORDER BY available_at,job_key LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    IF v_job.revision <> v_job.claimed_revision THEN
      UPDATE public.graph_matching_jobs SET status = 'pending',attempts = 0,cursor_article_id = NULL,
        lease_token = NULL,lease_until = NULL,available_at = v_now,last_error = NULL WHERE job_key = v_job.job_key;
    ELSE
      UPDATE public.graph_matching_jobs SET status = 'failed',lease_token = NULL,lease_until = NULL,
        last_error = 'lease attempts exhausted' WHERE job_key = v_job.job_key;
    END IF;
  END LOOP;
  FOR v_job IN SELECT * FROM public.graph_matching_jobs
    WHERE (status = 'pending' AND available_at <= v_now AND attempts < 5)
       OR (status = 'running' AND lease_until <= v_now AND attempts < 5)
    ORDER BY available_at,job_key LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.graph_matching_jobs SET status = 'running',claimed_revision = revision,
      attempts = CASE WHEN revision <> v_job.claimed_revision THEN 1 ELSE attempts + 1 END,
      cursor_article_id = CASE WHEN revision <> v_job.claimed_revision THEN NULL ELSE cursor_article_id END,
      lease_cursor_article_id = CASE WHEN revision <> v_job.claimed_revision THEN NULL ELSE cursor_article_id END,
      lease_token = gen_random_uuid(),lease_until = v_now + make_interval(secs => p_lease_seconds),last_error = NULL
    WHERE job_key = v_job.job_key RETURNING * INTO v_job;
    RETURN NEXT v_job;
  END LOOP;
END;
$$;

CREATE FUNCTION public.graph_finish_matching_job(p_job_key text,p_lease_token uuid,p_success boolean,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_job public.graph_matching_jobs; v_now timestamptz := clock_timestamp();
BEGIN
  IF p_success IS NULL THEN RAISE EXCEPTION 'success is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_job FROM public.graph_matching_jobs WHERE job_key = p_job_key FOR UPDATE;
  -- Evaluate expiry after acquiring the lock, not before a potentially blocked SELECT.
  v_now := clock_timestamp();
  IF NOT FOUND OR v_job.status <> 'running' OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_until <= v_now THEN RETURN false; END IF;
  UPDATE public.graph_matching_jobs SET lease_token = NULL,lease_until = NULL,
    status = CASE WHEN revision <> claimed_revision THEN 'pending' WHEN p_success THEN 'complete'
      WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
    attempts = CASE WHEN revision <> claimed_revision THEN 0 ELSE attempts END,
    cursor_article_id = CASE WHEN revision <> claimed_revision THEN NULL ELSE cursor_article_id END,
    available_at = CASE WHEN revision <> claimed_revision OR p_success THEN v_now
      ELSE v_now + make_interval(secs => least(300,5 * (1 << (attempts - 1)))) END,
    -- Never persist caller error text: it can contain credentials, URLs, SQL or PII.
    last_error = CASE WHEN revision <> claimed_revision OR p_success THEN NULL ELSE 'matching failed' END
  WHERE job_key = p_job_key;
  RETURN true;
END;
$$;

CREATE FUNCTION public.graph_release_matching_job(p_job_key text,p_lease_token uuid,p_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_job public.graph_matching_jobs; v_released boolean; v_status text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('success','failure','yield') THEN
    RAISE EXCEPTION 'invalid release outcome' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_job FROM public.graph_matching_jobs WHERE job_key = p_job_key FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'running' OR v_job.lease_token IS DISTINCT FROM p_lease_token
    OR v_job.lease_until <= clock_timestamp() THEN
    RETURN jsonb_build_object('released',false,'status',NULL); END IF;
  IF p_outcome = 'yield' THEN
    IF v_job.kind <> 'catalog' OR v_job.cursor_article_id IS NULL
      OR (v_job.lease_cursor_article_id IS NOT NULL AND v_job.cursor_article_id <= v_job.lease_cursor_article_id) THEN
      RAISE EXCEPTION 'catalog yield requires progress' USING ERRCODE = '22023'; END IF;
    UPDATE public.graph_matching_jobs SET status = 'pending',attempts = 0,
      cursor_article_id = CASE WHEN revision <> claimed_revision THEN NULL ELSE cursor_article_id END,
      lease_cursor_article_id = NULL,lease_token = NULL,lease_until = NULL,last_error = NULL,
      available_at = clock_timestamp() + interval '1 second' WHERE job_key = p_job_key;
    RETURN jsonb_build_object('released',true,'status','pending');
  END IF;
  v_released := public.graph_finish_matching_job(p_job_key,p_lease_token,p_outcome = 'success');
  IF NOT v_released THEN RETURN jsonb_build_object('released',false,'status',NULL); END IF;
  SELECT status INTO v_status FROM public.graph_matching_jobs WHERE job_key = p_job_key;
  RETURN jsonb_build_object('released',true,'status',v_status);
END;
$$;

CREATE FUNCTION public.graph_fanout_matching_job(p_job_key text,p_lease_token uuid,p_batch_size integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_job public.graph_matching_jobs; v_article uuid; v_cursor uuid; v_count integer := 0; v_done boolean;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid fanout bounds' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_job FROM public.graph_matching_jobs WHERE job_key = p_job_key FOR UPDATE;
  IF NOT FOUND OR v_job.kind <> 'catalog' OR v_job.status <> 'running'
    OR v_job.lease_token IS DISTINCT FROM p_lease_token OR v_job.lease_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'invalid catalog lease' USING ERRCODE = '22023'; END IF;
  IF v_job.revision <> v_job.claimed_revision THEN
    v_job.cursor_article_id := NULL;
    UPDATE public.graph_matching_jobs SET cursor_article_id = NULL,lease_cursor_article_id = NULL,claimed_revision = revision,attempts = 1
      WHERE job_key = p_job_key;
  END IF;
  v_cursor := v_job.cursor_article_id;
  FOR v_article IN SELECT id FROM public.articles WHERE is_published
    AND (v_cursor IS NULL OR id > v_cursor) ORDER BY id LIMIT p_batch_size FOR KEY SHARE LOOP
    PERFORM public.graph_enqueue_article_matching(v_article);
    v_job.cursor_article_id := v_article; v_count := v_count + 1;
  END LOOP;
  -- No SKIP LOCKED on this scan: locked lower IDs must never be skipped behind the cursor.
  v_done := NOT EXISTS (SELECT 1 FROM public.articles WHERE is_published
    AND (v_job.cursor_article_id IS NULL OR id > v_job.cursor_article_id));
  -- Downstream article/job locks can outlive the lease: throw to roll back the whole batch.
  IF v_job.lease_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'invalid catalog lease' USING ERRCODE = '22023'; END IF;
  UPDATE public.graph_matching_jobs SET cursor_article_id = v_job.cursor_article_id,
    status = CASE WHEN v_done THEN 'complete' ELSE 'running' END,
    lease_token = CASE WHEN v_done THEN NULL ELSE lease_token END,
    lease_until = CASE WHEN v_done THEN NULL ELSE lease_until END,last_error = NULL WHERE job_key = p_job_key;
  RETURN jsonb_build_object('enqueued',v_count,'done',v_done);
END;
$$;

CREATE FUNCTION public.graph_article_matching_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN PERFORM public.graph_enqueue_article_matching(NEW.id);
  ELSIF ROW(NEW.title,NEW.excerpt,NEW.body_markdown,NEW.domain_id,NEW.is_published)
    IS DISTINCT FROM ROW(OLD.title,OLD.excerpt,OLD.body_markdown,OLD.domain_id,OLD.is_published) THEN
    PERFORM public.graph_enqueue_article_matching(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER graph_articles_matching AFTER INSERT OR UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.graph_article_matching_trigger();

CREATE FUNCTION public.graph_catalog_matching_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_fields text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_fields := CASE TG_TABLE_NAME
      WHEN 'products' THEN ARRAY['title','description','short_description','domain_id','product_type','status','is_active']
      WHEN 'workshops' THEN ARRAY['title','description','short_description','domain_id','is_active','listing_fee_status','listing_expires_at']
      WHEN 'events' THEN ARRAY['title','description','short_description','is_active','ends_at']
      ELSE ARRAY['event_id','domain_id'] END;
    IF (SELECT jsonb_object_agg(k,to_jsonb(NEW)->k) FROM unnest(v_fields) k)
      IS NOT DISTINCT FROM (SELECT jsonb_object_agg(k,to_jsonb(OLD)->k) FROM unnest(v_fields) k) THEN RETURN NULL; END IF;
  END IF;
  PERFORM public.graph_enqueue_catalog_matching();
  RETURN NULL;
END;
$$;
CREATE TRIGGER graph_products_matching AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.graph_catalog_matching_trigger();
CREATE TRIGGER graph_workshops_matching AFTER INSERT OR UPDATE OR DELETE ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.graph_catalog_matching_trigger();
CREATE TRIGGER graph_events_matching AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.graph_catalog_matching_trigger();
CREATE TRIGGER graph_event_domains_matching AFTER INSERT OR UPDATE OR DELETE ON public.event_domains
FOR EACH ROW EXECUTE FUNCTION public.graph_catalog_matching_trigger();

-- Supabase can install default privileges; explicitly revoke every new function.
REVOKE ALL ON FUNCTION public.graph_article_fingerprint(uuid),
  public.graph_propose_article_suggestions(uuid,text,jsonb),
  public.graph_enqueue_article_matching(uuid),public.graph_enqueue_catalog_matching(),
  public.graph_claim_matching_jobs(integer,integer),public.graph_finish_matching_job(text,uuid,boolean,text),
  public.graph_release_matching_job(text,uuid,text),public.graph_decide_article_suggestion(uuid,uuid,uuid,text),
  public.graph_fanout_matching_job(text,uuid,integer),public.graph_record_article_review(),public.graph_lock_article_pair(),
  public.graph_article_matching_trigger(),public.graph_catalog_matching_trigger() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.graph_article_fingerprint(uuid),
  public.graph_propose_article_suggestions(uuid,text,jsonb),public.graph_enqueue_article_matching(uuid),
  public.graph_claim_matching_jobs(integer,integer),public.graph_finish_matching_job(text,uuid,boolean,text),
  public.graph_release_matching_job(text,uuid,text),public.graph_decide_article_suggestion(uuid,uuid,uuid,text),
  public.graph_fanout_matching_job(text,uuid,integer) TO service_role;

-- Seed exactly one global sweep; applying this migration does not execute matching.
SELECT public.graph_enqueue_catalog_matching();
COMMIT;
