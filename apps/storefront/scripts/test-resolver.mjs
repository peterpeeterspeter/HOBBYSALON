/**
 * Module resolver hook for `node --test`.
 *
 * The test files run on Node's built-in runner with --experimental-strip-types,
 * which has no notion of tsconfig `paths` and requires explicit file
 * extensions. That combination made any test unrunnable as soon as the
 * module under test used the `@/` alias or an extensionless relative
 * import - which is most of them.
 *
 * Rather than bending production source to suit the runner, this hook
 * teaches the runner the two conventions the codebase already uses:
 *   1. `@/...` maps to `src/...`
 *   2. a specifier with no extension may be a .ts/.tsx file
 *
 * Wired up via the `test` script in package.json.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC_ROOT = path.resolve(import.meta.dirname, "..", "src");
const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function resolveToExistingFile(absolutePathWithoutExt) {
  if (existsSync(absolutePathWithoutExt)) {
    const isDirectory = !path.extname(absolutePathWithoutExt);
    if (!isDirectory) return absolutePathWithoutExt;
  }

  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = `${absolutePathWithoutExt}${ext}`;
    if (existsSync(candidate)) return candidate;
  }

  // Directory import: resolve to its index file.
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = path.join(absolutePathWithoutExt, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 0. "server-only" is a Next.js compile-time guard with no runtime export.
  //    Under node --test it must resolve to a noop module or every test that
  //    transitively imports a server module fails with ERR_MODULE_NOT_FOUND.
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(path.join(import.meta.dirname, "server-only-noop.mjs"))
        .href,
      shortCircuit: true,
    };
  }

  // 1. tsconfig path alias: "@/lib/foo" -> <src>/lib/foo
  if (specifier.startsWith("@/")) {
    const resolved = resolveToExistingFile(
      path.join(SRC_ROOT, specifier.slice(2))
    );
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  // 2. Extensionless relative import from a TypeScript module.
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolved = resolveToExistingFile(path.resolve(parentDir, specifier));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
