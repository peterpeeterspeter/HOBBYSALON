// Behavioral regressions against the real scorer and pipeline, with no SDK or IO collaborators.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const content = 'apps/storefront/src/lib/content/';
async function load() {
  const context = vm.createContext({ Date, Error });
  const modules = new Map();
  const linking = new Map();
  function module(url) {
    if (!modules.has(url.href)) {
      modules.set(url.href, new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(url, 'utf8')), {
        context, identifier: url.href,
      }));
    }
    return modules.get(url.href);
  }
  async function linked(url) {
    const mod = module(url);
    if (!linking.has(url.href)) {
      linking.set(url.href, mod.link(specifier => linked(new URL(
        specifier + (specifier.endsWith('.ts') ? '' : '.ts'), url,
      ))));
    }
    await linking.get(url.href);
    return mod;
  }
  const pipeline = await linked(new URL(content + 'article-catalog-pipeline.ts', root));
  await pipeline.evaluate();
  return { ...pipeline.namespace, ...module(new URL(content + 'article-catalog-matcher.ts', root)).namespace };
}
const api = await load();
const article = (overrides = {}) => ({
  title: 'Rendierkersttrui haken: voorbereiding, kleurwerk en pasvorm',
  excerpt: 'Een praktische gids: kies je maat, test je stekenverhouding en plan kleuren zonder de teltekening over te nemen.',
  bodyMarkdown: '', domainId: 'textiel', materialTitles: [], ...overrides,
});
const product = (overrides = {}) => ({
  targetType: 'product', targetId: 'p', title: 'Haaknaald 6 mm',
  domainIds: [], productType: 'supply', ...overrides,
});
const ids = result => Array.from(result, match => match.candidate.targetId);
const emojiBody = 'Introductie.\n\n🛒 MATERIALENLIJST\n\n'
  + '- **100% katoenen garen**\n- [Haaknaald 6,5 mm](https://example.invalid/naald)\n\n'
  + '📋 STAP VOOR STAP\n\n- Oefen met een haaknaald 4 mm en wollen vilt op een proeflap.\n';

test('emoji/plain materials heading uses checklist evidence and stops at STAP VOOR STAP', () => {
  const result = api.matchArticleCatalog(article({ bodyMarkdown: emojiBody }), [
    product({ targetId: 'cotton', title: '100% cotton garen' }),
    product({ targetId: 'needle', title: 'Haaknaald 6.5 mm' }),
    product({ targetId: 'wrong-needle', title: 'Haaknaald 4 mm' }),
    product({ targetId: 'wrong-yarn', title: '100% wollen haakgaren' }),
  ]);
  assert.deepEqual(ids(result).sort(), ['cotton', 'needle']);
  assert.ok(result.every(match => match.compatibility === 'textual'));
  assert.ok(result.every(match => match.evidence.some(line => line.startsWith('Materiaal:'))));
  assert.ok(result.every(match => match.evidence.every(line => !line.includes('Oefen met'))));
});

test('generic long descriptions cannot qualify products, workshops or events', () => {
  const generic = 'Praktische tips: kies je maat, vergelijk het ontwerp en neem zonder zorgen een kleine grote hoeveelheid. '
    + 'Korte tekst, volledige informatie, eigen werk, warme kleuren, voor een origineel resultaat. ';
  for (const targetType of ['product', 'workshop', 'event']) {
    const candidate = product({ targetType, title: 'Worry Stones', description: generic.repeat(80), productType: 'handmade' });
    assert.equal(api.matchArticleCatalog(article({ bodyMarkdown: generic.repeat(20) }), [candidate]).length, 0);
  }
});

test('leather hardware haken is not the crochet technique, even in a shared domain', () => {
  const leather = product({ targetType: 'workshop', targetId: 'leather',
    title: 'Workshop lederen handtas en portemonee', domainIds: ['textiel'],
    description: 'Je leert het bevestigen van metalen fournituren zoals slotjes, haken en ringen. Praktische informatie: kies je kleuren zonder stikwerk.' });
  assert.equal(api.matchArticleCatalog(article(), [leather]).length, 0);
  assert.equal(api.matchArticleCatalog(article(), [product({ title: 'Metalen haken en ringen', description: 'Fournituren voor een lederen tas.' })]).length, 0);
});

test('uppercase leading millimetres survive the real matcher size veto', () => {
  const result = api.matchArticleCatalog(article({ bodyMarkdown: '## Materialen\n- 6 MM haaknaald\n## Stappen\nVolg het schema.' }), [
    product({ targetId: 'right', title: 'Haaknaald 6 mm' }),
    product({ targetId: 'wrong', title: 'Haaknaald 4 mm' }),
  ]);
  assert.deepEqual(ids(result), ['right']);
  assert.equal(result[0].compatibility, 'textual');
});

test('wall mounting and fastening hooks never qualify as crochet topics', () => {
  for (const targetType of ['product', 'workshop', 'event']) {
    for (const overrides of [
      { title: 'Haken voor wandmontage' },
      { title: 'Winteratelier', description: 'Je leert haken bevestigen' },
      { title: 'Haken bevestigen aan de muur' },
      { title: 'Winteratelier', description: 'Je leert haken monteren en ophangen.' },
    ]) {
      assert.equal(api.matchArticleCatalog(article(), [product({ targetType, ...overrides })]).length, 0);
    }
  }
});

test('standalone Haken and instructional crochet without named supplies remain genuine topics', () => {
  for (const overrides of [
    { title: 'Haken' },
    { title: 'Winteratelier', description: 'Je leert haken.' },
  ]) {
    const [match] = api.matchArticleCatalog(article(), [product({ targetType: 'workshop', ...overrides })]);
    assert.equal(match?.proposedRelation, 'related');
  }
});

test('a genuine crochet workshop qualifies through title or instructional description without domain', () => {
  for (const candidate of [
    product({ targetType: 'workshop', title: 'Workshop haken met kleurwerk' }),
    product({ targetType: 'workshop', title: 'Winteratelier', description: 'Je leert een trui haken met garen en een haaknaald. Oefen kleurwissels.' }),
  ]) {
    const [match] = api.matchArticleCatalog(article(), [candidate]);
    assert.equal(match?.proposedRelation, 'related');
    assert.equal(match.compatibility, 'unknown');
    assert.ok(match.evidence.some(line => line.startsWith('Onderwerp')));
  }
});

test('cross-domain yarn and tools stay related recommendations, with material evidence outranking generic prose', () => {
  const result = api.matchArticleCatalog(article({ title: 'Zomerproject', excerpt: null, bodyMarkdown: emojiBody }), [
    product({ targetId: 'cotton', title: '100% cotton garen', domainIds: ['breien'], productType: 'destash' }),
    product({ targetId: 'needle', title: 'Haaknaald 6.5 mm', domainIds: ['naaien'] }),
  ]);
  assert.deepEqual(ids(result).sort(), ['cotton', 'needle']);
  assert.ok(result.every(match => match.compatibility === 'textual' && match.proposedRelation === 'related_product'));
});

test('material sections never leak into workshop/event topic evidence or promote non-supply products', () => {
  for (const targetType of ['workshop', 'event']) {
    assert.equal(api.matchArticleCatalog(article({ title: 'Zomerproject', excerpt: null, bodyMarkdown: emojiBody }), [
      product({ targetType, title: 'Haken met katoen' }),
    ]).length, 0);
  }
  for (const productType of ['handmade', 'workshop_kit', 'workshop_ticket', 'event_ticket', null]) {
    assert.equal(api.matchArticleCatalog(article({ title: 'Zomerproject', excerpt: null,
      bodyMarkdown: '🛒 MATERIALENLIJST\n- 100% katoen garen\n📋 STAP VOOR STAP\nVolg het schema.' }), [
      product({ title: '100% katoen garen', productType }),
    ]).length, 0);
  }
});

test('body-only concrete hobby technique remains discovery evidence but generic description overlap cannot increase its score', () => {
  const input = article({ title: 'Zomerproject', excerpt: null, bodyMarkdown: 'Maak een borduurmotief. Kies zonder zorgen je eigen ontwerp.' });
  const candidate = product({ title: 'Borduurmotief', productType: 'handmade' });
  const [short] = api.matchArticleCatalog(input, [candidate]);
  const [long] = api.matchArticleCatalog(input, [{ ...candidate, description: 'Kies zonder zorgen je eigen ontwerp. '.repeat(100) }]);
  assert.ok(short);
  assert.equal(short.compatibility, 'unknown');
  assert.equal(long.score, short.score);
});

test('multiple materials sections preserve separate components, decimal sizes and composition hard vetoes', () => {
  const bodyMarkdown = '🛒 MATERIALENLIJST\n- 100% katoen garen\n📋 STAP VOOR STAP\nVolg het schema.\n'
    + '## Gereedschap en materialen\n- Haaknaald 6,5 mm en breinaald 4 mm\n## Tips\nKies je kleur.';
  const result = api.matchArticleCatalog(article({ bodyMarkdown }), [
    product({ targetId: 'cotton', title: '100% katoen haakgaren', description: 'Met 100% wollen vilt' }),
    product({ targetId: 'needle', title: 'Haaknaald 6.5 mm met handvat 4 mm' }),
    product({ targetId: 'wrong-blend', title: '50% katoen 50% acryl haakgaren' }),
    product({ targetId: 'wrong-size', title: 'Haaknaald 4 mm met handvat 6.5 mm' }),
  ]);
  assert.deepEqual(ids(result).sort(), ['cotton', 'needle']);
  assert.ok(result.every(match => match.compatibility === 'textual'));
});

test('legacy tool headings retain explicit millimetre vetoes using the shared material parser', () => {
  for (const heading of ['## Tools', '## Gereedschap']) {
    const result = api.matchArticleCatalog(article({ bodyMarkdown: `${heading}\n- Haaknaald 6 mm\n## Werkwijze\nOefen met een haaknaald 4 mm.` }), [
      product({ targetId: 'right', title: 'Haaknaald 6 mm' }),
      product({ targetId: 'wrong', title: 'Haaknaald 4 mm' }),
    ]);
    assert.deepEqual(ids(result), ['right']);
    assert.equal(result[0].compatibility, 'textual');
  }
});

test('leading millimetres on a checklist tool remain size evidence, not a stripped quantity', () => {
  const result = api.matchArticleCatalog(article({ bodyMarkdown: '🛒 MATERIALENLIJST\n- 6 mm haaknaald\n📋 STAP VOOR STAP\nVolg het schema.' }), [
    product({ targetId: 'right', title: 'Haaknaald 6 mm' }),
    product({ targetId: 'wrong', title: 'Haaknaald 4 mm' }),
  ]);
  assert.deepEqual(ids(result), ['right']);
  assert.equal(result[0].compatibility, 'textual');
});

test('a spaced leading composition percentage survives checklist quantity cleanup', () => {
  const result = api.matchArticleCatalog(article({ bodyMarkdown: '🛒 MATERIALENLIJST\n- 100 % katoen garen\n📋 STAP VOOR STAP\nVolg het schema.' }), [
    product({ targetId: 'right', title: '100% cotton garen' }),
    product({ targetId: 'wrong', title: '50% katoen 50% acryl haakgaren' }),
  ]);
  assert.deepEqual(ids(result), ['right']);
  assert.equal(result[0].compatibility, 'textual');
});

test('pipeline preserves suggested_auto, existing-key suppression, eligibility and deterministic independent budgets', async () => {
  const catalog = [
    ...Array.from({ length: 5 }, (_, i) => product({ targetId: `p${i}` })),
    ...Array.from({ length: 4 }, (_, i) => product({ targetType: 'workshop', targetId: `w${i}`, title: 'Workshop haken' })),
    ...Array.from({ length: 3 }, (_, i) => product({ targetType: 'event', targetId: `e${i}`, title: 'Haak festival' })),
    product({ targetId: 'domain-only', title: 'Worry Stones', domainIds: ['textiel'] }),
  ];
  const input = { id: 'article', title: 'Haken', domain_id: 'textiel', body_markdown: '🛒 MATERIALENLIJST\n- Haaknaald 6 mm\n📋 STAP VOOR STAP\nVolg het schema.' };
  const existing = new Set(['product:p0']);
  const results = api.planArticleSuggestions(input, catalog, existing);
  assert.equal(results.length, 6);
  assert.equal(results.filter(match => match.row.target_entity_type === 'product').length, 3);
  assert.equal(results.filter(match => match.row.target_entity_type === 'workshop').length, 2);
  assert.equal(results.filter(match => match.row.target_entity_type === 'event').length, 1);
  assert.ok(results.every(match => match.row.relation_type === 'suggested_auto' && match.row.weight <= 100));
  assert.ok(results.every(match => ['related_product', 'related'].includes(match.proposedRelation)));
  assert.ok(results.every(match => !['p0', 'domain-only'].includes(match.row.target_entity_id)));
  assert.equal(JSON.stringify(results), JSON.stringify(api.planArticleSuggestions(input, [...catalog].reverse(), existing)));
  const tables = {
    products: [{ id: 'inactive', is_active: false, status: 'active' }, { id: 'archived', is_active: true, status: 'archived' }],
    workshops: [{ id: 'unpaid', is_active: true, listing_fee_status: 'unpaid' }],
    events: [{ id: 'past', is_active: true, ends_at: '2026-10-02T00:00:00Z' }], event_domains: [],
  };
  const eligible = await api.loadArticleCatalog(async request => (tables[request.table] ?? []).slice(request.offset, request.offset + request.limit),
    { now: new Date('2026-10-04T00:00:00Z') });
  assert.equal(eligible.length, 0);
});
