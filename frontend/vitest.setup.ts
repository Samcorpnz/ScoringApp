import "@testing-library/jest-dom/vitest";

// Node's own experimental global `localStorage` getter shadows jsdom's
// working implementation and throws when accessed without a CLI flag.
// vitest's jsdom environment aliases `window` to `globalThis` itself before
// setup files run, so `window.localStorage` here is the same broken Node
// global, not jsdom's — pull the real implementation off `globalThis.jsdom`
// (the JSDOM instance vitest stashes there) instead. Guarded because this
// setup file also runs for `// @vitest-environment node` test files (e.g.
// API route handler tests), where `globalThis.jsdom` doesn't exist at all.
if ("jsdom" in globalThis) {
  Object.defineProperty(globalThis, "localStorage", {
    value: (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
      .localStorage,
    configurable: true,
  });
}
