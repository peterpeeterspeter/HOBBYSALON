-- Auto-accept article catalog suggestions as public relations.
-- Matcher quality need not be perfect; pending suggested_auto becomes the proposed role.
BEGIN;

CREATE OR REPLACE FUNCTION public.graph_propose_article_suggestions(p_article_id uuid,p_fingerprint text,p_proposals jsonb)
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

  -- Promote every pending auto-suggestion for this article to its proposed public role.
  -- Partial textual matches are intentional; fine-tuning thresholds comes later.
  UPDATE public.entity_links AS el
  SET relation_type = COALESCE(
    NULLIF(r.proposed_relation, ''),
    CASE WHEN el.target_entity_type = 'product' OR el.source_entity_type = 'product'
      THEN 'related_product' ELSE 'related' END
  )
  FROM public.graph_article_reviews AS r
  WHERE el.relation_type = 'suggested_auto'
    AND r.state = 'pending'
    AND COALESCE(r.score, 0) >= 0
    AND (
      (el.source_entity_type = 'article' AND el.source_entity_id = p_article_id
        AND r.article_id = el.source_entity_id
        AND r.target_entity_type = el.target_entity_type
        AND r.target_entity_id = el.target_entity_id)
      OR
      (el.target_entity_type = 'article' AND el.target_entity_id = p_article_id
        AND r.article_id = el.target_entity_id
        AND r.target_entity_type = el.source_entity_type
        AND r.target_entity_id = el.source_entity_id)
    );

  RETURN v_count;
END;
$$;

-- Backfill: publish all currently pending matcher suggestions site-wide.
UPDATE public.entity_links AS el
SET relation_type = COALESCE(
  NULLIF(r.proposed_relation, ''),
  CASE WHEN el.target_entity_type = 'product' OR el.source_entity_type = 'product'
    THEN 'related_product' ELSE 'related' END
)
FROM public.graph_article_reviews AS r
WHERE el.relation_type = 'suggested_auto'
  AND r.state = 'pending'
  AND COALESCE(r.score, 0) >= 0
  AND (
    (el.source_entity_type = 'article'
      AND r.article_id = el.source_entity_id
      AND r.target_entity_type = el.target_entity_type
      AND r.target_entity_id = el.target_entity_id)
    OR
    (el.target_entity_type = 'article'
      AND r.article_id = el.target_entity_id
      AND r.target_entity_type = el.source_entity_type
      AND r.target_entity_id = el.source_entity_id)
  );

REVOKE ALL ON FUNCTION public.graph_propose_article_suggestions(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.graph_propose_article_suggestions(uuid,text,jsonb) TO service_role;

SELECT public.graph_enqueue_catalog_matching();

COMMIT;
