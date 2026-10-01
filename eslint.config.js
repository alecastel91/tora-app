// Single-purpose lint: catch identifiers used outside the scope where they are
// declared. Three production crashes in ten days (money in the checkout
// subtree, embeds in ViewProfile, uploading in the mobile Profile tab) came
// from exactly this, and `vite build` only parses — it never resolves names.
// Runs as part of `npm run build`, so Vercel refuses to deploy such a bundle.
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-preview/**', 'dev-dist/**', 'node_modules/**', 'public/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    // The code carries `eslint-disable-next-line react-hooks/exhaustive-deps`
    // comments from the CRA days; a stub keeps ESLint from treating those
    // directives as unknown-rule errors without pulling in the hooks plugin.
    plugins: { 'react-hooks': { rules: { 'exhaustive-deps': { create: () => ({}) } } } },
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.serviceworker },
    },
    rules: { 'no-undef': 'error' },
  },
];
