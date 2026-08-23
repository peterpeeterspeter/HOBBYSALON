// Noop stand-in for the "server-only" package under node --test.
// In Next.js builds this import is a compile-time guard; at test runtime it
// must simply resolve to an empty module.
export {};
