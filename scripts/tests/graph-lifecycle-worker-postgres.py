#!/usr/bin/env python3
"""Local CLI -> HTTP adapter -> real PostgreSQL; NOT a PostgREST/live Supabase test.
Imported by the offline DB acceptance runner. No external DSN or production credentials.
"""
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs


def exercise(db):
    root = db.ROOT
    allowed = {'articles', 'products', 'workshops', 'events', 'event_domains', 'entity_links'}
    calls = []
    def literal(value):
        if value is None: return 'NULL'
        if isinstance(value, bool): return 'true' if value else 'false'
        if isinstance(value, int): return str(value)
        return "'" + str(value).replace("'", "''") + "'"
    signatures = {
        'graph_claim_matching_jobs': [('p_limit','integer'),('p_lease_seconds','integer')],
        'graph_article_fingerprint': [('p_article_id','uuid')],
        'graph_propose_article_suggestions': [('p_article_id','uuid'),('p_fingerprint','text'),('p_proposals','jsonb')],
        'graph_finish_matching_job': [('p_job_key','text'),('p_lease_token','uuid'),('p_success','boolean'),('p_error','text')],
        'graph_release_matching_job': [('p_job_key','text'),('p_lease_token','uuid'),('p_outcome','text')],
        'graph_fanout_matching_job': [('p_job_key','text'),('p_lease_token','uuid'),('p_batch_size','integer')],
    }
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args): pass
        def handle_request(self):
            try:
                assert self.headers.get('apikey') == 'offline-postgres-fixture'
                u = urlparse(self.path); name = u.path.split('/')[-1]
                if self.command == 'POST':
                    assert name in signatures and u.path == '/rest/v1/rpc/' + name
                    data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                    args = [literal(json.dumps(data[k]) if typ=='jsonb' else data.get(k))+'::'+typ for k,typ in signatures[name]]
                    fn = 'public.' + name + '(' + ','.join(args) + ')'
                    if name == 'graph_claim_matching_jobs':
                        q = "SELECT coalesce(json_agg(row_to_json(j)),'[]'::json)::text FROM " + fn + ' j;'
                    else: q = 'SELECT to_json(' + fn + ')::text;'
                    result = json.loads(db.value('SET ROLE service_role; ' + q))
                else:
                    assert name in allowed and u.path == '/rest/v1/' + name
                    params = parse_qs(u.query); columns = params['select'][0]
                    assert all(re.fullmatch(r'[a-z_]+',c) for c in columns.split(','))
                    filters = []
                    for k,v in params.items():
                        if k in {'select','order','offset','limit'}: continue
                        assert re.fullmatch(r'[a-z_]+',k) and v[0].startswith('eq.')
                        filters.append(k + ' = ' + literal(v[0][3:]))
                    offset = int(params['offset'][0]); limit = int(params['limit'][0])
                    assert offset >= 0 and 0 < limit <= 1000
                    ordering = ','.join(x.split('.')[0] for x in params['order'][0].split(','))
                    assert all(re.fullmatch(r'[a-z_]+',x) for x in ordering.split(','))
                    q = 'SELECT '+columns+' FROM public.'+name + (' WHERE '+' AND '.join(filters) if filters else '')+' ORDER BY '+ordering+' OFFSET '+str(offset)+' LIMIT '+str(limit)
                    result = json.loads(db.value("SELECT coalesce(json_agg(row_to_json(r)),'[]'::json)::text FROM ("+q+") r;"))
                calls.append({'method':self.command,'name':name})
                text = json.dumps(result).encode(); self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(text)
            except Exception:
                self.send_response(400);self.end_headers();self.wfile.write(b'{"error":"offline adapter request failed"}')
        do_GET = handle_request
        do_POST = handle_request
    server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread = threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    envfile = db.ATTEMPT / 'offline-worker.env'
    envfile.write_text('SUPABASE_URL=http://127.0.0.1:'+str(server.server_port)+'\nSUPABASE_SERVICE_ROLE_KEY=offline-postgres-fixture\n')
    reports = []
    def worker(max_jobs=20):
        p = subprocess.run(['node','--max-old-space-size=160','--experimental-strip-types','--import',str(root/'apps/storefront/scripts/test-resolver-register.mjs'),str(root/'apps/storefront/scripts/run-article-matching-jobs.ts'),'--env-file',str(envfile),'--max-jobs',str(max_jobs)],cwd=str(db.ATTEMPT),env={'PATH':os.environ['PATH'],'NODE_NO_WARNINGS':'1'},capture_output=True,text=True,timeout=45)
        db.require(p.returncode==0,'actual PostgreSQL-backed worker failed: '+p.stderr + p.stdout)
        result = json.loads(p.stdout);reports.append(result)
        db.require(not result['failed'] and not result['lost'],'worker reported failure/lost lease')
        return result
    try:
        db.reset_edges();db.reset_jobs()
        db.sql(f"UPDATE public.articles SET title='Mandje haken',excerpt=NULL,body_markdown='## Materialen\n- Haaknaald 6 mm',domain_id=NULL,is_published=true WHERE id='{db.A}'; UPDATE public.articles SET is_published=false WHERE id='{db.B}'; UPDATE public.products SET title='Haaknaald 6 mm',description=NULL,short_description=NULL,domain_id=NULL,is_active=true,status='active' WHERE id='{db.P}'; UPDATE public.products SET is_active=false WHERE id='{db.Q}';")
        r = worker();db.require(r['inserted']==1,'initial real matcher must nominate one needle')
        db.scalar(f"SELECT state || ':' || matcher_version || ':' || (fingerprint IS NOT NULL)::text FROM public.graph_article_reviews WHERE article_id='{db.A}' AND target_entity_id='{db.P}';",'pending:article-catalog-v1:true')
        db.scalar("SELECT count(*) FROM public.entity_links WHERE relation_type <> 'suggested_auto';",0)
        db.sql(f"DELETE FROM public.entity_links WHERE source_entity_id='{db.A}' AND target_entity_id='{db.P}';")
        db.scalar('SELECT state FROM public.graph_article_reviews;','dismissed')
        db.sql(f"UPDATE public.products SET description='Nieuwe catalogustekst' WHERE id='{db.P}';")
        r = worker();db.require(r['inserted']==0 and r['claimed']>=2,'catalog trigger must revisit old article and respect dismissal')
        db.scalar('SELECT count(*) FROM public.entity_links;',0)
        db.sql(f"UPDATE public.products SET title='Haaknaald 6 mm',description=NULL,domain_id=NULL,is_active=true,status='active' WHERE id='{db.Q}';")
        r=worker();db.require(r['inserted']==1 and r['claimed']>=2,'newly eligible product must reach old article')
        db.scalar(f"SELECT count(*) FROM public.entity_links WHERE target_entity_id='{db.P}';",0)
        db.scalar(f"SELECT count(*) FROM public.entity_links WHERE target_entity_id='{db.Q}' AND relation_type='suggested_auto';",1)
        r=worker();db.require(r['claimed']==0,'idle rerun must have no effects')
        # Actual CLI defaults: four fanout batches of fifty, across six fresh claims.
        # Only fixture queue readiness is accelerated; SQL/worker yield remains real.
        db.sql("INSERT INTO public.articles(id,title,slug,is_published) SELECT ('72000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'CLI large catalog','worker-large-' || i,true FROM generate_series(1,1001) i;")
        db.reset_jobs();db.sql('SELECT public.graph_enqueue_catalog_matching();')
        large=[]
        for index in range(6):
            db.sql("UPDATE public.graph_matching_jobs SET available_at=clock_timestamp()+interval '1 hour' WHERE kind='article'; UPDATE public.graph_matching_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE job_key='catalog';")
            r=worker(1);large.append(r)
            db.require(r['claimed']==1 and r['completed']==(1 if index==5 else 0) and r['deferred']==(0 if index==5 else 1),'large catalog must yield without false completion or retry exhaustion')
            db.scalar("SELECT attempts FROM public.graph_matching_jobs WHERE job_key='catalog';",1 if index==5 else 0)
        db.scalar("SELECT status FROM public.graph_matching_jobs WHERE job_key='catalog';",'complete')
        db.scalar("SELECT count(*) FROM public.graph_matching_jobs WHERE kind='article';",1002)
        db.sql("DELETE FROM public.articles WHERE slug LIKE 'worker-large-%';")
        (db.ATTEMPT/'worker-postgres.json').write_text(json.dumps({'scope':'real CLI + actual matcher + localhost HTTP adapter + actual PostgreSQL functions/triggers; not PostgREST', 'reports':reports,'calls':calls},indent=2)+'\n')
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3);envfile.unlink(missing_ok=True)
