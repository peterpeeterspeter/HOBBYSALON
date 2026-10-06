'use strict'
// In-memory SWC emission only; installed pinned-image Migration class, no ORM mock.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const swc = require('@swc/core'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const root = '/source', sources = {}, emissions = {}
const sha = x => crypto.createHash('sha256').update(x).digest('hex')
const opts = filename => ({filename, jsc:{parser:{syntax:'typescript',decorators:true},target:'es2022'},module:{type:'commonjs'},sourceMaps:false})
Module._extensions['.ts'] = (m, f) => {
  const raw = fs.readFileSync(f); sources[path.relative(root,f)] = sha(raw)
  const code = swc.transformSync(raw.toString(),opts(f)).code
  emissions[path.relative(root,f)] = sha(code); m.paths = [...module.paths,...m.paths]; m._compile(code,f)
}
async function migration(name) {
  const file = path.join(root,'packages/modules/b2c-core/src/modules/marketplace/migrations',name+'.ts')
  const C = require(file)[name], m = new C({},{}), up = [], down = []
  m.addSql = sql => up.push(sql); await m.up()
  m.addSql = sql => down.push(sql); await m.down()
  return {up,down}
}
;(async()=>{
  const tail = await migration('Migration20261005190000'), ack = await migration('Migration20261006113000')
  const file = path.join(root,'packages/modules/b2c-core/src/utils/marketplace-capture.ts'), raw = fs.readFileSync(file)
  sources[path.relative(root,file)] = sha(raw)
  const ast = swc.parseSync(raw.toString(),{syntax:'typescript',decorators:true})
  const node = ast.body.find(n=>n.type==='ExportDeclaration' && n.declaration.type==='FunctionDeclaration' && n.declaration.identifier.value==='marketplaceSnapshotKey')
  assert(node,'actual snapshot export missing')
  // SWC spans are byte offsets. Isolate the exact dependency-free source export,
  // not a copied/reimplemented hash algorithm, avoiding application boot/dispatch.
  const exact = raw.subarray(node.span.start-ast.span.start,node.span.end-ast.span.start).toString()
  assert(exact.startsWith('export function marketplaceSnapshotKey'))
  const code = swc.transformSync(exact,opts(file)).code, m = new Module(file,module)
  m._compile(code,file); emissions['marketplaceSnapshotKey_exact_export'] = sha(code)
  const fixtures = {}
  const make = (name, change = () => {}) => {
    const snapshot = {version:1,payment_id:'pay_ack_'+name,cart_id:'cart_ack_'+name,order_set_id:'os_'+name,collection_id:'pc_'+name,session_id:'ps_'+name,intent_id:'pi_'+name,provider_id:'pp_card_stripe-connect',allocations:[{order_id:'order_ack_'+name,version:1,split_id:'sp_'+name,amount:'12.34',currency_code:'eur',nested:{z:2,a:1}}],currency_code:'eur',amount:'12.34',cart_items:[{id:'item_'+name,variant_id:'variant_'+name,quantity:'1',unit_price:'12.34',is_tax_inclusive:false,tax_lines:[],adjustments:[]}],cart_shipping:[],order_items:[{order_id:'order_ack_'+name,items:[],shipping:[]}]}
    change(snapshot)
    const key = m.exports.marketplaceSnapshotKey(snapshot), hash = sha(key)
    fixtures[name]={snapshot,key,hash,payment_id:snapshot.payment_id,cart_id:snapshot.cart_id,capture_id:'cap_ack_'+name,event_id:'marketplace-captured-'+hash}
  }
  for (const name of ['valid','pending_accounting','pending_enqueue','pending_complete','forged','early_ack','future_ack','reversed_tail','infinite_tail','negative_infinite_tail','future_tail','empty_allocations','equal_timeline']) {
    make(name, s => { if(name==='empty_allocations') s.allocations=[] })
  }
  const unicode = {z:[null,true,false,[],{},'é 😀 漢字 e\u0301 / \\" \\n\\t\\b\\f\\r \u0001 \u001f \u2028\u2029'],a:{'2':'two','10':'ten','A':'upper','a':'lower','quote"':'x','back\\slash':'y'},integers:[-9007199254740991,0,9007199254740991]}
  const allControls = Array.from({length:31},(_,i)=>String.fromCharCode(i+1)).join('')
  unicode.controls = allControls
  make('unicode_unknown', s => { s.unknown_metadata = unicode })
  make('changed_unknown', s => { s.unknown_metadata = {nested:['original',unicode]} })
  make('each_infinite_accounting'); make('each_infinite_enqueue'); make('each_infinite_complete')
  make('enqueue_reversed'); make('long_key', s => { s.metadata = {['x'.repeat(256)]:null} })
  make('empty_key', s => { s.metadata = {'':null} })
  make('string_version', s => { s.version = '1' })
  make('fractional', s => { s.metadata = {number:1.25} })
  make('unsafe_integer', s => { s.metadata = {number:9007199254740992} })
  make('unicode_key', s => { s.metadata = {'é':'value'} })
  make('control_key', s => { s.metadata = {'bad\nkey':'value'} })
  make('oversize', s => { s.metadata = 'x'.repeat(65536) })
  make('deep', s => { let n = null; for(let i=0;i<34;i++) n={next:n}; s.metadata=n })
  make('object_bound', s => { s.metadata = Object.fromEntries(Array.from({length:257},(_,i)=>['k'+i,i])) })
  make('array_bound', s => { s.metadata = Array(1025).fill(null) })
  const canonicalCases = [unicode, {unknown:unicode,empty:'',negativeZero:-0}, ['\u007f','é','😀',null,1], {' a':0,'~':1,'Z':2,'a':3}, {finance:'19.990000000000000001234567890123456789'}].map(value=>({value,key:m.exports.marketplaceSnapshotKey(value)}))
  console.log(JSON.stringify({tail,ack,sources,emissions,bridge:'exact SWC AST export, dependency-free actual marketplaceSnapshotKey',fixtures,canonicalCases}))
})().catch(e=>{console.error(e.stack);process.exitCode=1})
