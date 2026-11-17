import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../../', import.meta.url));
const compiled = new Map();

// Executes repository TS/TSX, not copied handlers. Only rendering/hooks and external
// boundaries are fixtures; no DOM package, Next build, SDK transport or DB is used.
export function componentRuntime(overrides = {}) {
  const modules = new Map();
  let active;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const hooks = {
    useState(initial) {
      const owner = active, index = owner.cursor++;
      if (!(index in owner.slots)) owner.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [owner.slots[index], (next) => {
        const value = typeof next === 'function' ? next(owner.slots[index]) : next;
        if (!Object.is(value, owner.slots[index])) { owner.slots[index] = value; owner.dirty = true; }
      }];
    },
    useRef(initial) {
      const index = active.cursor++;
      return active.slots[index] ??= { current: initial };
    },
    useMemo(factory, deps) {
      const index = active.cursor++;
      if (!same(active.slots[index]?.deps, deps)) active.slots[index] = { deps, value: factory() };
      return active.slots[index].value;
    },
    useEffect(effect, deps) {
      const owner = active, index = owner.cursor++;
      if (!same(owner.slots[index]?.deps, deps)) {
        const previous = owner.slots[index];
        owner.slots[index] = { deps, cleanup: previous?.cleanup };
        owner.effects.push(() => {
          previous?.cleanup?.();
          owner.slots[index].cleanup = effect();
        });
      }
    },
  };
  const replacements = {
    react: { ...require('react'), ...hooks },
    'next/link': { __esModule: true, default: 'a' },
    '@/components/ui/input': { Input: 'input' },
    '@/components/ui/select': { Select: 'select' },
    '@/components/ui/button': { Button: 'button' },
    '@/components/domain/difficulty-indicator': { DifficultyIndicator: 'difficulty' },
    '@/components/domain/date-display': { DateDisplay: 'date' },
    '@/components/domain/price-display': { PriceDisplay: 'price' },
    '@/components/ui/ai-generated-image': { LANDING_IMAGES: {} },
    './HomeReveal': { HomeReveal: 'div' },
    './CalculatorCard': { CalculatorCard: 'section' },
    ...overrides,
  };
  function load(specifier, parent = resolve(source, 'entry.ts')) {
    if (Object.hasOwn(replacements, specifier)) return replacements[specifier];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return require(specifier);
    const base = specifier.startsWith('@/') ? resolve(source, specifier.slice(2)) : resolve(dirname(parent), specifier);
    const file = [base + '.ts', base + '.tsx', resolve(base, 'index.ts'), base].find(existsSync);
    assert.ok(file, `unresolved source ${specifier}`);
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText);
    const mod = { exports: {} };
    modules.set(file, mod);
    new Script(`(function(require,module,exports){${compiled.get(file)}\n})`, { filename: file })
      .runInThisContext()((id) => load(id, file), mod, mod.exports);
    return mod.exports;
  }
  /** @param {any} Component @param {any} props @param {(tree: any) => void} beforeEffects */
  function mount(Component, props = {}, beforeEffects = () => {}) {
    /** @type {any} */
    const owner = { cursor: 0, slots: [], effects: [], dirty: false, tree: null };
    function render() {
      for (let count = 0; count < 30; count++) {
        owner.cursor = 0; owner.dirty = false; active = owner;
        owner.tree = Component(props);
        active = undefined;
        beforeEffects(owner.tree);
        owner.effects.splice(0).forEach((effect) => effect());
        if (!owner.dirty) return owner.tree;
      }
      assert.fail('fixture exceeded render limit');
    }
    render();
    return {
      get tree() { return owner.tree; }, render,
      unmount() { owner.slots.forEach((slot) => slot?.cleanup?.()); },
    };
  }
  return { load, mount };
}

export function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

export function globalFixture(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
}

export class Control {
  /** @param {string} tag @param {boolean} disabled @param {Control | null} parent */
  constructor(tag, disabled = false, parent = null) { this.tag = tag; this.disabled = disabled; this.parent = parent; }
  closest(selector) { return selector.split(',').includes(this.tag) ? this : this.parent?.closest(selector) ?? null; }
  matches() { return this.disabled; }
}

export function controlEvent(tag, options = {}) {
  return { isTrusted: true, target: new Control(tag), currentTarget: { contains: () => true }, ...options };
}
