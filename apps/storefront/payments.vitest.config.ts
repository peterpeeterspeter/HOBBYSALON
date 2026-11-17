import base from "./vitest.config";

// Keeps compiled test/cache files inside this worktree, not the shared dependency symlink.
export default {
  ...base,
  cacheDir: "./.cache/payments-vitest",
  esbuild: { jsx: "automatic" },
  test: { ...base.test, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
