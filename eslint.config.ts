import { renton } from "@renton/eslint-config";

export default renton({
  stylistic: {
    quotes: "double",
    semi: true,
  },
  typescript: true,
  jsonc: true,
  yaml: true,
  markdown: false,
}, {
  rules: {
    "jsdoc/check-tag-names": "off",
    "perfectionist/sort-classes": "off",
    "unicorn/consistent-class-member-order": "off",
    "unicorn/name-replacements": "off",
    "unicorn/no-top-level-assignment-in-function": "off",
    "unicorn/no-top-level-side-effects": "off",
    "unicorn/no-unsafe-string-replacement": "off",
    "unicorn/prefer-await": "off",
  },
});
