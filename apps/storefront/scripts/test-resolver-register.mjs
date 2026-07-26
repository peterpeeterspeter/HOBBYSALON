/**
 * Registers the test module resolver (see test-resolver.mjs) for
 * `node --test`. Kept separate because the resolver has to be installed
 * from a module that itself loads before the test files.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-resolver.mjs", pathToFileURL(`${import.meta.dirname}/`));
