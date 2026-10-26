import {createHash} from 'node:crypto';
export const hash = value => createHash('sha256').update(value).digest('hex');
export function sidecarFixture(articles, options={}) {
  const rows=articles.map(article=>{
    const body=article.body_markdown;
    const quote=options.quote??'Haaknaald 6 mm';const start=[...body.slice(0,body.indexOf(quote))].length;
    return {article_id:article.id,source_sha256:hash(body),summary:'Haakproject',content_kind:'full_tutorial',
      metadata_version:'hobbysalon-semantic-v1',claim_scope:'article_asserted_not_externally_verified',
      difficulty:{value:null,basis:'unknown',evidence:null},crafts:[],techniques:[],themes:[],audience:[],projects:[],materials:[],
      tools:[{label:'haaknaald',role:'required',specifications:'6 mm',evidence:quote,project_labels:[],
        evidence_span:{start,end:start+[...quote].length,unit:'unicode_codepoints'}}],constraints:[],safety:[],inferences:[],gaps:[],
      source:{is_published:true},quality_routing:{automatic_recommendation_blocked:false,automatic_publication_allowed:false,
        has_extraction_gaps:false,requires_gap_review_before_matching:false,reasons:[]},...(options.metadata??{})};
  });
  const schema={type:'object',properties:{},required:['article_id','source_sha256','materials','tools','projects','gaps']};
  const files=new Map([['article_metadata.jsonl',Buffer.from(rows.map(x=>JSON.stringify(x)).join('\n')+'\n')],
    ['article_metadata.schema.json',Buffer.from(JSON.stringify(schema))]]);
  const manifest={dataset_version:'hobbysalon-semantic-v1',created_at:'2026-10-26T14:00:00Z',article_count:rows.length,automatic_publication_allowed:false,
    files:Object.fromEntries([...files].map(([path,b])=>[path,{bytes:b.length,sha256:hash(b)}]))};
  files.set('manifest.json',Buffer.from(JSON.stringify(manifest)));
  const manifestSha256=hash(files.get('manifest.json'));
  const bundle={datasetVersion:manifest.dataset_version,createdAt:manifest.created_at,manifestSha256,manifestTrust:'independently_pinned_digest',verifiedFiles:[],articles:rows};
  return {files,manifestSha256,bundle,rows};
}
