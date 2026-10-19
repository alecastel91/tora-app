// Single-purpose lint: catch identifiers that are not usable where they are
// used. `vite build` only parses — it never resolves names or orders them.
// Runs inside `npm run build`, so Vercel refuses to deploy such a bundle.
//
//   no-undef            — the name is not in scope at all. Three production
//                         crashes in ten days (money in the checkout subtree,
//                         embeds in ViewProfile, uploading in the mobile
//                         Profile tab) were this.
//   no-use-before-define — the name IS in scope but declared further down, so
//                         reading it throws ReferenceError at runtime (the
//                         temporal dead zone). Two outages were this: the
//                         organisation effect above useAppContext() on the
//                         16th, and `mult` read above its declaration in
//                         AgentSeatPricing on the 19th, which replaced the
//                         whole app with the error boundary for every agent.
//                         `variables: false` is deliberate — it still catches
//                         same-scope use-before-declaration (the dangerous
//                         case) while ignoring references from nested
//                         functions, which only run after initialisation.
//                         With `variables: true` the rule reports 64 such safe
//                         callback references and becomes noise.
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-preview/**', 'dev-dist/**', 'public/**', '.vite-desktop/**'] },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    // Stub so the CRA-era `eslint-disable-next-line react-hooks/exhaustive-deps`
    // comments are not unknown-rule errors.
    plugins: { 'react-hooks': { rules: { 'exhaustive-deps': { create: () => ({}) } } } },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'error',
      'no-use-before-define': ['error', { variables: false, functions: false, classes: false }],
    },
  },
];
