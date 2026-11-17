import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { browser, safeProperties } from "./posthog.test-helpers";
import { CONSENT_GENERATION_KEY } from "./conversions";
import { componentRuntime, nodes, globalFixture, Control, controlEvent } from "./interaction.test-helpers.mjs";

const UUID = "98c88340-1111-4222-8333-123456789abc";
const variant = "variant_01ARZ3NDEKTSV4RRFFQ69G5FAV";
function setup(t: TestContext, overrides: Record<string, unknown> = {}) {
  const f = browser(t, { host: "hobbysalon.be", path: "/", consent: "granted", ready: true });
  const timers = new Map<number, () => void>();
  let timerId = 0;
  Object.assign(f.window, {
    setTimeout: (fn: () => void) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  globalFixture(t, "Element", Control);
  const runtime = componentRuntime(overrides);
  return {
    ...f, ...runtime, timers,
    flush: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn()); },
    consent: (value: string) => {
      f.values.set("hs_posthog_consent_v1", value);
      f.cookies.set("hs_posthog_consent_v1", value);
    },
    names: () => f.calls.map(([name]) => name),
  };
}
function all(tree: any, type: string) { return nodes(tree, (n: any) => n.type === type); }
function clickTracked(f: any, tree: any) {
  for (const node of nodes(tree, (n: any) => Boolean(n.props?.event))) {
    f.mount(node.type, node.props).tree.props.onClick({});
  }
}

test("actual social banner clicks pass only producer channel/placement, never profile URLs", (t) => {
  const f = setup(t);
  const { SocialFollowBanner } = f.load("@/components/home/SocialFollowBanner");
  const view = f.mount(SocialFollowBanner);
  const links = all(view.tree, "a");
  assert.ok(links.length > 0);
  for (const link of links) link.props.onClick();
  assert.equal(f.calls.length, links.length);
  for (const call of f.calls) {
    assert.equal(call[0], "social_follow_clicked");
    const p = safeProperties(call);
    assert.ok(["facebook", "instagram", "pinterest", "youtube"].includes(p.channel as string));
    assert.equal(p.placement, "home");
    assert.equal("href" in p, false);
  }
});

test("actual homepage agenda keeps entity ID separate from generated event ID", (t) => {
  const f = setup(t);
  const { HomeAgendaTeaser } = f.load("@/components/home/HomeAgendaTeaser");
  const view = f.mount(HomeAgendaTeaser, { events: [{ id: UUID, slug: "private-slug", title: "Private title", city: "Private city", starts_at: "2026-01-01", makers: [] }] });
  clickTracked(f, view.tree);
  const call = f.calls.find(([name]) => name === "home_event_clicked")!;
  assert.deepEqual(Object.keys(safeProperties(call)).sort(), ["agenda_item_id", "item_index", "page_location", "page_referrer", "page_title"].sort());
  assert.equal(safeProperties(call).agenda_item_id, UUID);
  const log = JSON.parse(f.values.get("hs_analytics_events_v1")!);
  const event = log.find((entry: any) => entry.event === "home_event_clicked");
  assert.equal(event.schema_valid, true);
  assert.equal(event.agenda_item_id, UUID);
  assert.notEqual(event.event_id, UUID);
});

test("actual product rails and provider CTA produce allowed controlled destinations", (t) => {
  const f = setup(t);
  const { HomeProductRail } = f.load("@/components/home/HomeProductRail");
  for (const href of ["/materials", "/creators"]) {
    clickTracked(f, f.mount(HomeProductRail, { href, title: "Private title", lead: "Private lead", ctaLabel: "Go", products: [{ id: UUID, slug: "private-slug", title: "Private product", offer: { badge: "Private badge" } }] }).tree);
  }
  const { HomeProvidersCta } = f.load("@/components/home/HomeProvidersCta");
  clickTracked(f, f.mount(HomeProvidersCta).tree);
  assert.deepEqual(f.names(), ["home_route_clicked", "home_product_clicked", "home_route_clicked", "home_product_clicked", "home_provider_clicked"]);
  assert.equal(safeProperties(f.calls[1]).route, "materials");
  assert.equal(safeProperties(f.calls[3]).route, "makersmarkt");
  assert.equal(safeProperties(f.calls[4]).destination, "partners");
  assert.equal(JSON.stringify(f.calls).includes("Private"), false);
});

test("actual journey links keep controlled leg/destination instead of private hrefs", (t) => {
  const f = setup(t);
  const { HomeJourneySection } = f.load("@/components/home/HomeJourneySection");
  for (const kind of ["article", "project"]) {
    const link = { href: "/private?token=secret", label: "Private label" };
    const view = f.mount(HomeJourneySection, { journey: { kind, href: link.href, title: "Private title", materials: [link], workshop: link, makers: [link] } });
    clickTracked(f, view.tree);
  }
  assert.equal(f.calls.length, 8);
  assert.deepEqual(f.calls.map((call: any) => safeProperties(call).destination), ["product", "workshop", "creator", "article", "product", "workshop", "creator", "project"]);
  assert.equal(JSON.stringify(f.calls).includes("private"), false);
  assert.ok(JSON.parse(f.values.get("hs_analytics_events_v1")!).every((entry: any) => entry.schema_valid));
});

test("actual bundle producer distinguishes full, partial and zero success", async (t) => {
  let result: any = { success: true };
  const f = setup(t, {
    "next/navigation": { useRouter: () => ({ refresh() {}, push() {} }) },
    "@/app/actions/cart": { addBundleToCartAction: async () => result },
  });
  const { AddBundleToCartButton } = f.load("@/components/cart/AddBundleToCartButton");
  const props = { bundleId: `project:${UUID}`, bundleLabel: "Private title", items: [{ product_id: UUID, variant_id: variant, title: "Private item" }] };
  for (const outcome of [{ success: true }, { success: false, added_count: 1 }, { success: false, added_count: 0 }]) {
    result = outcome;
    const view = f.mount(AddBundleToCartButton, props);
    await all(view.tree, "button")[0].props.onClick();
  }
  assert.deepEqual(f.names(), ["bundle_add", "bundle_add"]);
  assert.equal(safeProperties(f.calls[0]).partial, false);
  assert.equal(safeProperties(f.calls[1]).partial, true);
  assert.equal(safeProperties(f.calls[0]).bundle_id, props.bundleId);
  assert.equal(JSON.stringify(f.calls).includes("Private"), false);
});

function formula(f: any) {
  const { FormulaCalculator } = f.load("@/components/tools/FormulaCalculator");
  const { stofcalculatorDefinition } = f.load("@/lib/tools/engine");
  return f.mount(FormulaCalculator, { toolSlug: "stofcalculator", title: "Stof", definition: stofcalculatorDefinition });
}
function change(view: any, value: string) {
  all(view.tree, "input")[0].props.onChange({ target: { value } });
  view.render();
}

test("real formula engine default result is not measurement; input/preset are debounced calculation intent", (t) => {
  const f = setup(t);
  const view = formula(f);
  assert.ok(nodes(view.tree, (n: any) => n.props?.role === "status").length);
  f.flush(); assert.deepEqual(f.calls, []);
  change(view, "55"); change(view, "60");
  assert.equal(f.timers.size, 1);
  f.flush();
  assert.deepEqual(f.names(), ["tool_calculated"]);
  assert.equal(safeProperties(f.calls[0]).formula_id, "fabric");
  view.render(); f.flush(); assert.equal(f.calls.length, 1);
  all(view.tree, "button")[0].props.onClick(); view.render(); f.flush();
  assert.equal(f.calls.length, 2, "preset counts even if rounded headline stays unchanged");
  change(view, "not a number"); f.flush(); assert.equal(f.calls.length, 2);
  change(view, "80"); view.unmount(); f.flush(); assert.equal(f.calls.length, 2);
});

test("denied formula input cannot become a calculation on later grant; withdrawal generation invalidates debounce", (t) => {
  const f = setup(t);
  const view = formula(f);
  f.consent("denied"); change(view, "55");
  f.consent("granted"); view.render(); f.flush();
  assert.deepEqual(f.calls, []);
  change(view, "65");
  f.values.set(CONSENT_GENERATION_KEY, UUID);
  f.cookies.set(CONSENT_GENERATION_KEY, UUID);
  f.flush();
  assert.deepEqual(f.calls, []);
  change(view, "75"); f.flush(); assert.equal(f.calls.length, 1);
});

test("actual boundary excludes links, disabled/readonly controls, synthetic and outside events; dedupes real use", (t) => {
  const f = setup(t);
  const { ToolInteractionBoundary } = f.load("@/components/tools/ToolInteractionBoundary");
  const view = f.mount(ToolInteractionBoundary, { toolSlug: "rijenteller" });
  view.tree.props.onClick(controlEvent("a"));
  view.tree.props.onClick(controlEvent("button", { target: new Control("button", true) }));
  view.tree.props.onChange(controlEvent("input", { target: new Control("input", true) }));
  view.tree.props.onClick(controlEvent("button", { isTrusted: false }));
  view.tree.props.onClick(controlEvent("button", { currentTarget: { contains: () => false } }));
  assert.deepEqual(f.calls, []);
  view.tree.props.onClick(controlEvent("span", { target: new Control("span", false, new Control("button")) }));
  view.tree.props.onChange(controlEvent("input"));
  assert.deepEqual(f.names(), ["tool_used"]);
  assert.equal(safeProperties(f.calls[0]).interaction, "control");
  const denied = f.mount(ToolInteractionBoundary, { toolSlug: "garencalculator" });
  f.consent("denied"); denied.tree.props.onChange(controlEvent("input"));
  f.consent("granted"); denied.render(); denied.tree.props.onClick(controlEvent("button"));
  assert.equal(f.calls.length, 1, "once-per-mount use cannot replay a consumed denied action");
});

test("registry executes every tool wrapper including standalone tools", (t) => {
  const f = setup(t);
  const { getAllTools, getToolBySlug } = f.load("@/lib/tools/registry");
  const { ToolInteractionBoundary } = f.load("@/components/tools/ToolInteractionBoundary");
  const tools = getAllTools();
  assert.ok(tools.length > 10);
  for (const tool of tools) {
    const view = f.mount(tool.component);
    assert.equal(view.tree.type, ToolInteractionBoundary, tool.slug);
    assert.equal(view.tree.props.toolSlug, tool.slug);
    assert.equal(getToolBySlug(tool.slug), tool);
  }
  const wrapped = f.mount(getToolBySlug("rijenteller").component).tree;
  const boundary = f.mount(wrapped.type, wrapped.props);
  boundary.tree.props.onClick(controlEvent("button"));
  assert.deepEqual(f.names(), ["tool_used"]);
});

test("actual observer requires foreground half visibility, counts each row once, consumes denied impressions and cleans up", (t) => {
  const f = setup(t);
  const rows = [{}, {}, {}];
  const listeners = new Map<string, () => void>();
  Object.assign(f.document, { visibilityState: "visible", addEventListener: (name: string, fn: () => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) });
  let callback: (entries: any[]) => void = () => assert.fail("missing observer");
  let disconnected = false;
  globalFixture(t, "IntersectionObserver", class {
    constructor(fn: typeof callback, options: any) { callback = fn; assert.equal(options.threshold, 0.5); }
    observe() {} unobserve() {} disconnect() { disconnected = true; }
  });
  const { HomeRecommendationsList } = f.load("@/components/home/HomeRecommendationsList");
  const view = f.mount(HomeRecommendationsList, { children: "rows" }, (tree: any) => { tree.props.ref.current = { querySelectorAll: () => rows }; });
  const entry = (row: object, ratio: number, intersects = true) => ({ target: row, intersectionRatio: ratio, isIntersecting: intersects });
  callback([entry(rows[0], 0.49), entry(rows[1], 1, false)]); assert.deepEqual(f.calls, []);
  Object.assign(f.document, { visibilityState: "hidden" });
  callback([entry(rows[0], 1)]); assert.deepEqual(f.calls, []);
  Object.assign(f.document, { visibilityState: "visible" }); listeners.get("visibilitychange")!();
  callback([entry(rows[0], 0.5), entry(rows[0], 1)]);
  assert.equal(safeProperties(f.calls[0]).item_count, 1);
  assert.equal(safeProperties(f.calls[0]).recommendation_source, "home_make_list");
  f.consent("denied"); callback([entry(rows[1], 1)]);
  f.consent("granted"); callback([entry(rows[0], 1), entry(rows[1], 1)]);
  assert.equal(f.calls.length, 1);
  callback([entry(rows[2], 1)]); assert.equal(f.calls.length, 2);
  view.unmount(); assert.equal(disconnected, true); assert.equal(listeners.size, 0);
});
