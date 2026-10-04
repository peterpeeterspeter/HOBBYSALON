// Offline, source-bound TSX execution with a synthetic JSX tree.
// This is not React/Next/browser, database, or real analytics acceptance.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.HOBBYSALON_TEST_TYPESCRIPT_PATH || "typescript");
const journeySource = readFileSync(new URL("../../apps/storefront/src/components/home/HomeJourneySection.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../apps/storefront/src/app/(public)/page.tsx", import.meta.url), "utf8");
const fallbackImage = "/offline-crafts-grid.jpg";
const jsx = (type, props, key) => ({ type, props, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "Fragment" };

async function loadSource(source, fileName, collaborators, forbidden) {
  const context = vm.createContext({ fetch: () => {
    forbidden.push("network");
    throw new Error("Network forbidden in offline source runtime");
  } });
  const transformed = ts.transpileModule(source, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.deepEqual(transformed.diagnostics ?? [], [], `${fileName}: no syntax diagnostics`);
  const module = new vm.SourceTextModule(transformed.outputText, { context });
  await module.link(name => {
    assert.ok(Object.hasOwn(collaborators, name), `Unexpected source import: ${name}`);
    const exports = collaborators[name];
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

async function loadJourneyModule() {
  const forbidden = [];
  const namespace = await loadSource(journeySource, "HomeJourneySection.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/components/ui/ai-generated-image": { LANDING_IMAGES: { craftsGrid: fallbackImage } },
    "./HomeReveal": { HomeReveal: "HomeReveal" },
    "./TrackedLink": { TrackedLink: "TrackedLink" },
  }, forbidden);
  return {
    component: namespace.HomeJourneySection,
    render: journey => {
      let tree;
      try { tree = namespace.HomeJourneySection({ journey }); }
      finally { assert.deepEqual(forbidden, [], "No network attempts, including swallowed errors"); }
      return nodes(tree);
    },
  };
}

async function renderHomePage(data, reject = false) {
  const forbidden = [], calls = [];
  const journeyModule = await loadJourneyModule();
  const components = ["HomeAgendaTeaser", "HomeDiscoverBlock", "HomeHero", "HomeHobbyChips", "HomeMakers", "HomeProductRail", "HomeProvidersCta"];
  const collaborators = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: "Link" },
    "@/components/home/HomeJourneySection": { HomeJourneySection: journeyModule.component },
    "@/components/seo/JsonLd": { JsonLd: "JsonLd" },
    "@/components/ui/container": { Container: "Container" },
    "@/lib/auth/session": { getAuthUser: async () => { calls.push("auth"); return null; } },
    "@/lib/profile/resumable-saved-project-service": { listResumableSavedProjects: async () => {
      forbidden.push("authenticated profile lookup"); throw new Error("Guest fixture must not load profile");
    } },
    "@/lib/services/home-page": {
      getHomePageData: async () => { calls.push("home-data"); if (reject) throw new Error("fixture home-data failure"); return data; },
      homeWeekendAgendaHref: () => "/agenda?weekend=fixture",
    },
    "@/lib/seo": { absoluteUrl: path => `https://offline.invalid${path}` },
  };
  for (const name of components) collaborators[`@/components/home/${name}`] = { [name]: name };
  let all;
  try {
    const page = await loadSource(pageSource, "public-home-page.tsx", collaborators, forbidden);
    all = nodes(await page.default());
  } finally {
    assert.deepEqual(forbidden, [], "No forbidden side effects outside the page's swallowed catches");
  }
  assert.deepEqual(calls, ["home-data", "auth"]);
  return { all, journeyModule };
}

function nodes(tree) {
  const all = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    all.push(node);
    walk(node.props?.children);
  }
  walk(tree);
  return all;
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return text(node.props?.children);
}
function fixture(overrides = {}) {
  return {
    kind: "project", title: "Een creatief idee", href: "/project/creatief-idee",
    imageUrl: " /journey.jpg ", difficultyLevel: null,
    materials: [{ label: "Wol", href: "/product/wol" }, { label: "Haaknaald", href: "/product/haaknaald" }],
    workshop: { label: "Samen haken", href: "/workshop/samen-haken" },
    makers: [{ label: "Atelier", href: "/creator/atelier" }],
    ...overrides,
  };
}
function pageFixture(journey) {
  return {
    journey,
    domainsWithLiveContent: [{ id: "domain" }], featuredEvents: [{ id: "event" }],
    upcomingWorkshops: [{ id: "workshop", featured_image_url: " /hero.jpg " }],
    homeMakeItems: [{ id: "idea" }], makers: [{ id: "maker" }],
    materials: [{ id: "material" }], makersmarkt: [{ id: "handmade" }],
  };
}
function one(all, type) {
  const matches = all.filter(node => node.type === type);
  assert.equal(matches.length, 1, `Exactly one ${typeof type === "function" ? type.name : type}`);
  return matches[0];
}
function assertOtherPageProps(all, data) {
  assert.equal(one(all, "HomeHobbyChips").props.domains, data.domainsWithLiveContent);
  assert.equal(one(all, "HomeAgendaTeaser").props.events, data.featuredEvents);
  const discover = one(all, "HomeDiscoverBlock");
  assert.equal(discover.props.workshops, data.upcomingWorkshops);
  assert.equal(discover.props.makeItems, data.homeMakeItems);
  assert.equal(one(all, "HomeMakers").props.makers, data.makers);
  const rails = all.filter(node => node.type === "HomeProductRail");
  assert.equal(rails.length, 2);
  assert.equal(rails[0].props.products, data.materials);
  assert.equal(rails[0].props.href, "/materials");
  assert.equal(rails[0].props.ctaLabel, "Alle materialen");
  assert.equal(rails[1].props.products, data.makersmarkt);
  assert.equal(rails[1].props.href, "/creators");
  assert.equal(rails[1].props.ctaLabel, "Naar de makersmarkt");
  assert.equal(one(all, "HomeHero").props.imageSrc, " /hero.jpg ");
  assert.equal(one(all, "HomeHero").props.weekendHref, "/agenda?weekend=fixture");
  assert.equal(one(all, "JsonLd").props.data.length, 2);
  one(all, "HomeProvidersCta");
}

test("actual journey TSX exposes ordered clickable material TrackedLinks with singular material leg", async () => {
  const journey = fixture({ materials: [...fixture().materials, { label: "Vrije keuze" }] });
  const before = JSON.stringify(journey);
  const { render } = await loadJourneyModule();
  const all = render(journey);
  const links = all.filter(node => node.type === "TrackedLink" && node.props.eventPayload?.leg === "material");
  assert.deepEqual(links.map(node => node.props.href), ["/product/wol", "/product/haaknaald"]);
  assert.deepEqual(links.map(text), ["Wol", "Haaknaald"]);
  for (const link of links) {
    assert.equal(link.props.event, "home_journey_clicked");
    assert.equal(link.props.eventPayload.journey_kind, "project");
    assert.equal(link.props.eventPayload.href, link.props.href);
  }
  assert.match(text(all.find(node => node.type === "ul")), /Wol, Haaknaald, Vrije keuze/);
  assert.equal(all.filter(node => node.type === "TrackedLink" && !node.props.href).length, 0);
  assert.equal(JSON.stringify(journey), before);
});

test("same-title material targets retain distinct keys and hrefs",async()=>{
 const {render}=await loadJourneyModule();
 const all=render(fixture({materials:[{label:"Wol",href:"/product/wol-a"},{label:"Wol",href:"/product/wol-b"}]}));
 const spans=all.filter(n=>n.type==="span"&&n.props?.children?.some?.(x=>x?.type==="TrackedLink"&&x.props.eventPayload?.leg==="material"));
 assert.equal(spans.length,2);assert.equal(new Set(spans.map(n=>n.key)).size,2);
 assert.deepEqual(spans.map(n=>n.props.children.find(x=>x?.type==="TrackedLink").props.href),["/product/wol-a","/product/wol-b"]);
});

test("actual journey material label is neutral, not a mandatory supply claim", async () => {
  const { render } = await loadJourneyModule();
  const listText = text(one(render(fixture()), "ul"));
  assert.match(listText, /Materialen bij dit idee: /);
  assert.doesNotMatch(listText, /Dit heb je nodig|verplicht|vereist/i);
});

for (const kind of ["project", "article"]) {
  test(`actual journey ${kind} main CTA matches its kind and retains tracking payload`, async () => {
    const journey = fixture({ kind, href: kind === "article" ? "/artikel/creatief-idee" : "/project/creatief-idee" });
    const { render } = await loadJourneyModule();
    const cta = render(journey).find(node => node.type === "TrackedLink" && node.props.href === journey.href);
    assert.ok(cta);
    assert.equal(text(cta).trim(), kind === "article" ? "Lees dit artikel" : "Bekijk dit project");
    assert.equal(cta.props.event, "home_journey_clicked");
    assert.deepEqual(Object.keys(cta.props.eventPayload).sort(), ["href", "journey_kind"]);
    assert.equal(cta.props.eventPayload.journey_kind, kind);
    assert.equal(cta.props.eventPayload.href, journey.href);
  });
}

const leadCases = [
  [false, false, false, "Ontdek dit idee."],
  [true, false, false, "Materialen bij dit idee."],
  [false, true, false, "Een workshop bij dit idee."],
  [false, false, true, "Makers bij dit idee."],
  [true, true, false, "Materialen en workshop bij dit idee."],
  [true, false, true, "Materialen en makers bij dit idee."],
  [false, true, true, "Workshop en makers bij dit idee."],
  [true, true, true, "Materialen, workshop en makers bij dit idee."],
];
for (const [materials, workshop, makers, expected] of leadCases) {
  test(`actual journey lead describes only nonempty legs: ${expected}`, async () => {
    const base = fixture();
    const { render } = await loadJourneyModule();
    const all = render(fixture({ materials: materials ? base.materials : [], workshop: workshop ? base.workshop : null, makers: makers ? base.makers : [] }));
    assert.equal(text(one(all, "p")).trim(), expected);
    assert.equal(all.filter(node => node.type === "li").length, Number(materials) + Number(workshop) + Number(makers));
  });
}

test("actual journey retains existing reveal, layout and image fallback behavior", async () => {
  const { render } = await loadJourneyModule();
  const all = render(fixture());
  one(all, "HomeReveal");
  assert.equal(one(all, "section").props.className, "overflow-hidden rounded-[1.25rem] bg-[var(--section-alt)]");
  const image = one(all, "img");
  assert.equal(image.props.src, "/journey.jpg");
  assert.equal(image.props.loading, "lazy");
  assert.equal(image.props.alt, "");
  for (const imageUrl of [null, "", "  "]) assert.equal(one(render(fixture({ imageUrl })), "img").props.src, fallbackImage);
});

test("actual journey workshop and maker links retain established tracking and plain-label fallbacks", async () => {
  const { render } = await loadJourneyModule();
  const all = render(fixture());
  for (const [leg, href] of [["workshop", "/workshop/samen-haken"], ["maker", "/creator/atelier"]]) {
    const link = all.find(node => node.type === "TrackedLink" && node.props.eventPayload?.leg === leg);
    assert.equal(link.props.href, href);
    assert.equal(link.props.event, "home_journey_clicked");
    assert.equal(link.props.eventPayload.href, href);
    assert.equal(link.props.eventPayload.journey_kind, "project");
  }
  const plain = render(fixture({ workshop: { label: "Samen haken" }, makers: [{ label: "Atelier" }] }));
  assert.equal(plain.filter(node => node.type === "TrackedLink" && ["workshop", "maker"].includes(node.props.eventPayload?.leg)).length, 0);
  assert.match(text(one(plain, "ul")), /Workshop: Samen hakenMakers: Atelier/);
});

test("actual public homepage mounts exact service journey into actual component and preserves other block props", async () => {
  const journey = fixture({ kind: "article", href: "/artikel/creatief-idee" });
  const data = pageFixture(journey), before = JSON.stringify(data);
  const { all, journeyModule } = await renderHomePage(data);
  const mounted = one(all, journeyModule.component);
  assert.equal(mounted.props.journey, data.journey);
  const rendered = journeyModule.render(mounted.props.journey);
  assert.equal(rendered.filter(node => node.type === "TrackedLink" && node.props.href === journey.href).length, 1);
  assertOtherPageProps(all, data);
  assert.equal(JSON.stringify(data), before);
});

test("actual public homepage omits null journey while keeping every other block's data props", async () => {
  const data = pageFixture(null);
  const { all, journeyModule } = await renderHomePage(data);
  assert.equal(all.filter(node => node.type === journeyModule.component).length, 0);
  assertOtherPageProps(all, data);
});

test("actual public homepage service-failure fallback omits journey and preserves page structure", async () => {
  const { all, journeyModule } = await renderHomePage(pageFixture(fixture()), true);
  assert.equal(all.filter(node => node.type === journeyModule.component).length, 0);
  assert.equal(one(all, "HomeAgendaTeaser").props.events.length, 0);
  assert.equal(one(all, "HomeDiscoverBlock").props.workshops.length, 0);
  assert.equal(one(all, "HomeMakers").props.makers.length, 0);
  assert.equal(all.filter(node => node.type === "HomeProductRail").length, 2);
  one(all, "HomeProvidersCta");
});
