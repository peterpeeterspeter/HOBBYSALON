import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Vitest config for security regression tests (src/**/*.security.test.ts).
// The default suite stays on node --test (package.json "test" script);
// these tests need vi.mock for module mocking, which Node 22 does not expose.
// Run with: ./node_modules/.bin/vitest run

export default {
  resolve: {
    alias: [
      // Next.js compile-time guard has no runtime export.
      { find: /^server-only$/, replacement: path.join(rootDir, "scripts/server-only-noop.mjs") },
      { find: /^@\/(.*)$/, replacement: path.join(rootDir, "src") + "/$1" },
    ],
  },
  test: {
    include: ["src/**/*.vitest.spec.ts"],
    environment: "node",
  },
};
