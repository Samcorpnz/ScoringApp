import "@testing-library/jest-dom/vitest";

// Node 22+'s own experimental global `localStorage` getter shadows jsdom's
// working implementation and throws when accessed without a CLI flag —
// point the global back at jsdom's real `window.localStorage`.
Object.defineProperty(globalThis, "localStorage", {
  value: window.localStorage,
  configurable: true,
});
