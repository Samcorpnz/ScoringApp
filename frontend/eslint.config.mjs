import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next ships native flat-config arrays now, so this skips
// @eslint/eslintrc's FlatCompat legacy bridge — which crashes with a
// "Converting circular structure to JSON" error on this version of
// eslint-config-next because its flat configs embed plugin objects that
// reference themselves, and FlatCompat's legacy validator isn't equipped
// to JSON.stringify those for its error-formatting path.
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // These are newer, stricter react-hooks rules (oriented at React
    // Compiler compatibility) that flag several pre-existing, working
    // patterns in this codebase (ref-syncing, effect-driven local state).
    // Downgraded to warnings so the new CI lint gate (SA-83) is meaningful
    // without blocking on a backlog of unrelated app-code rewrites.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
