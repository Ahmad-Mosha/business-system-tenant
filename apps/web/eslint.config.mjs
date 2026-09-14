import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Text, not a message key: a capitalised word ("Delivered") or a phrase. */
const TEXT = "/^[A-Z][a-z]|\\s[a-z]/";
const IS_TEXT = `:matches(Literal[value=${TEXT}], TemplateLiteral:has(TemplateElement[value.raw=${TEXT}]))`;
/** Where a string reaches the reader other than as JSX text. */
const TEXT_PROP = "JSXAttribute[name.name=/^(title|label|placeholder|description|hint|alt|all|heading|aria-label)$/]";
const TEXT_KEY = "Property[key.name=/^(message|label|hint|title|description)$/]";
const TEXT_SELECTORS = [
  `${TEXT_PROP} > ${IS_TEXT}`,
  `${TEXT_PROP} > JSXExpressionContainer > ${IS_TEXT}`,
  `${TEXT_PROP} > JSXExpressionContainer > ConditionalExpression > ${IS_TEXT}`,
  `${TEXT_KEY} > ${IS_TEXT}`,
  `${TEXT_KEY} > ConditionalExpression > ${IS_TEXT}`,
  'CallExpression[callee.object.name="toast"] > :matches(Literal, TemplateLiteral)',
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Words on screen come from src/messages, never from the code (docs/i18n.md):
  // not JSX text, not a text prop, not a toast or an action's message.
  // Warnings while screens move over module by module; errors after.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/dev-preview/**", "src/app/api/**", "src/components/ui/**"],
    rules: {
      "react/jsx-no-literals": [
        "warn",
        { noStrings: false, ignoreProps: true, allowedStrings: ["·", "—", "–", "/", "(", ")", "%", "+", "−", ":", "×"] },
      ],
      "no-restricted-syntax": [
        "warn",
        ...TEXT_SELECTORS.map((selector) => ({
          selector,
          message: "Text a reader sees comes from src/messages (docs/i18n.md).",
        })),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
