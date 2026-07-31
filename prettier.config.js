/**
 * Aligned with the code that already exists rather than the other way round.
 *
 * The scaffold shipped `singleQuote: true`, `printWidth: 100` and
 * `bracketSameLine: true`, but every file in the project is written
 * double-quoted at 80 columns with the bracket on its own line — which is
 * Prettier's own default, and what the editor produces. The mismatch meant
 * `npm run lint` failed on 62 files from the very first commit, so nobody
 * could use it.
 */
module.exports = {
  tabWidth: 2,
  trailingComma: "all",

  plugins: [require.resolve("prettier-plugin-tailwindcss")],
  tailwindAttributes: ["className"],
};
