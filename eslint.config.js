// Single-purpose lint: catch identifiers used outside the scope where they are
// declared. Three production crashes in ten days (money in the checkout
// subtree, embeds in ViewProfile, uploading in the mobile Profile tab) came
// from exactly this, and `vite build` only parses — it never resolves names.
// Runs inside `npm run build`, so Vercel refuses to deploy such a bundle.
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-preview/**', 'dev-dist/**', 'public/**'] },
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
    rules: { 'no-undef': 'error' },
  },
];
